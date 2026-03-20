import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"
import process from "process"

interface Variant {
  platform: string
  arch: string
}

interface PackageJson {
  name: string
  version: string
  license?: string
  repository?: any
  description?: string
  homepage?: string
  author?: string
  bugs?: any
  keywords?: string[]
  module?: string
  main?: string
  types?: string
  type?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  exports?: Record<string, any>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, "..")
const licensePath = join(rootDir, "LICENSE")
const packageJson: PackageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"))

// Parse command line arguments
// Usage examples:
//   --native              Build and package native binaries
//   --lib                 Build JavaScript library and TypeScript declarations  
//   --native --lib        Build everything
//   --native --skip-build Package existing native binaries (for CI)
//   --native --skip-build --lib  Package existing binaries and build JS library (for CI publish)
const args = process.argv.slice(2)
const buildLib = args.includes("--lib")
const buildNative = args.includes("--native")
const skipBuild = args.includes("--skip-build")
const isDev = args.includes("--dev")

// Derive platform variants from optionalDependencies in package.json
const prefix = `${packageJson.name}-`
const variants: Variant[] = Object.keys(packageJson.optionalDependencies || {})
  .filter((dep) => dep.startsWith(prefix))
  .map((dep) => {
    const parts = dep.slice(prefix.length).split("-")
    return { platform: parts[0]!, arch: parts[1]! }
  })

if (!buildLib && !buildNative) {
  console.error("Error: Please specify --lib, --native, or both")
  console.error("  --native: Build and package native binaries")
  console.error("  --lib: Build JavaScript library and TypeScript declarations")
  console.error("  --skip-build: Skip building native binaries (use with --native to package existing binaries)")
  process.exit(1)
}

const getZigTarget = (platform: string, arch: string): string => {
  const platformMap: Record<string, string> = { darwin: "macos", win32: "windows", linux: "linux" }
  const archMap: Record<string, string> = { x64: "x86_64", arm64: "aarch64" }
  return `${archMap[arch] ?? arch}-${platformMap[platform] ?? platform}`
}

const replaceLinks = (text: string): string => {
  return packageJson.homepage
    ? text.replace(
        /(\[.*?\]\()(\.\/.*?\))/g,
        (_, p1: string, p2: string) => `${p1}${packageJson.homepage}/blob/HEAD/${p2.replace("./", "")}`,
      )
    : text
}

const requiredFields: (keyof PackageJson)[] = ["name", "version", "license", "repository", "description"]
const missingRequired = requiredFields.filter((field) => !packageJson[field])
if (missingRequired.length > 0) {
  console.error(`Error: Missing required fields in package.json: ${missingRequired.join(", ")}`)
  process.exit(1)
}

if (buildNative) {
  if (!skipBuild) {
    console.log(`Building native ${isDev ? "dev" : "prod"} binaries...`)
    
    const zigBuild: SpawnSyncReturns<Buffer> = spawnSync("zig", ["build", `-Doptimize=${isDev ? "Debug" : "ReleaseFast"}`], {
      cwd: join(rootDir, "src", "zig"),
      stdio: "inherit",
    })
    
    if (zigBuild.error) {
      console.error("Error: Zig is not installed or not in PATH")
      process.exit(1)
    }
    
    if (zigBuild.status !== 0) {
      console.error("Error: Zig build failed")
      process.exit(1)
    }
  } else {
    console.log("Packaging existing native binaries (--skip-build flag used)...")
  }

  for (const { platform, arch } of variants) {
    const nativeName = `${packageJson.name}-${platform}-${arch}`
    const nativeDir = join(rootDir, "node_modules", nativeName)
    
    const zigTarget = getZigTarget(platform, arch)
    const libDir = join(rootDir, "src", "lib", zigTarget)

    rmSync(nativeDir, { recursive: true, force: true })
    mkdirSync(nativeDir, { recursive: true })

    let copiedFiles = 0
    let libraryFileName: string | null = null
    for (const name of ["libwebgpu_wrapper", "webgpu_wrapper"]) {
      for (const ext of [".so", ".dll", ".dylib"]) {
        const src = join(libDir, `${name}${ext}`)
        if (existsSync(src)) {
          const fileName = `${name}${ext}`
          copyFileSync(src, join(nativeDir, fileName))
          copiedFiles++
          if (!libraryFileName) {
            libraryFileName = fileName
          }
        }
      }
    }

    if (copiedFiles === 0) {
      console.log(`  Skipping ${platform}-${arch}: library not built (${libDir} not found)`)
      continue
    }

    const indexTsContent = `const module = await import("./${libraryFileName}", { with: { type: "file" } })
const path = module.default
export default path;
`
    writeFileSync(join(nativeDir, "index.ts"), indexTsContent)

    writeFileSync(
      join(nativeDir, "package.json"),
      JSON.stringify(
        {
          name: nativeName,
          version: packageJson.version,
          description: `Prebuilt ${platform}-${arch} binaries for ${packageJson.name}`,
          main: "index.ts",
          types: "index.ts",
          license: packageJson.license,
          author: packageJson.author,
          homepage: packageJson.homepage,
          repository: packageJson.repository,
          bugs: packageJson.bugs,
          keywords: [...(packageJson.keywords ?? []), "prebuild", "prebuilt"],
          os: [platform],
          cpu: [arch],
        },
        null,
        2,
      ),
    )

    writeFileSync(
      join(nativeDir, "README.md"),
      replaceLinks(`## ${nativeName}\n\n> Prebuilt ${platform}-${arch} binaries for \`${packageJson.name}\`.`),
    )

    if (existsSync(licensePath)) copyFileSync(licensePath, join(nativeDir, "LICENSE"))
    console.log("Built:", nativeName)
  }

}

if (buildLib) {
  console.log("Building library...")

  const distDir = join(rootDir, "dist")
  rmSync(distDir, { recursive: true, force: true })
  mkdirSync(distDir, { recursive: true })

  const externalDeps: string[] = [
    ...Object.keys(packageJson.optionalDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ]

  // Build main entry point
  const entryPoint = packageJson.exports?.["."]?.bun?.source
  if (!entryPoint) {
    console.error("Error: 'exports[\".\"].bun.source' not found in package.json")
    process.exit(1)
  }

  spawnSync(
    "bun",
    [
      "build",
      "--target=bun",
      "--outdir=dist",
      ...externalDeps.flatMap((dep) => ["--external", dep]),
      entryPoint,
    ],
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  )

  console.log("Generating TypeScript declarations...")
  
  const tsconfigBuildPath = join(rootDir, "tsconfig.build.json")
  const tsconfigBuild = {
    extends: "./tsconfig.json",
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      outDir: "./dist",
      noEmit: false,
      rootDir: "./src",
      types: ["bun", "node", "@webgpu/types"],
      skipLibCheck: true,
    },
    include: ["src/**/*"],
    exclude: ["**/*.test.ts", "**/*.spec.ts", "src/examples/**/*", "src/benchmark/**/*", "src/zig/**/*"]
  }
  
  writeFileSync(tsconfigBuildPath, JSON.stringify(tsconfigBuild, null, 2))
  
  const tscResult: SpawnSyncReturns<Buffer> = spawnSync("npx", ["tsc", "-p", tsconfigBuildPath], {
    cwd: rootDir,
    stdio: "inherit",
  })
  
  rmSync(tsconfigBuildPath, { force: true })
  
  if (tscResult.status !== 0) {
    console.error("Error: TypeScript declaration generation failed")
    process.exit(1)
  }
  
  console.log("TypeScript declarations generated")
  
  const rootTypesPath = join(rootDir, "index.d.ts")
  if (existsSync(rootTypesPath)) {
    const rootTypesContent = readFileSync(rootTypesPath, "utf8")
    const generatedIndexPath = join(distDir, "index.d.ts")
    if (existsSync(generatedIndexPath)) {
      const generatedContent = readFileSync(generatedIndexPath, "utf8")
      writeFileSync(generatedIndexPath, `${rootTypesContent}\n\n${generatedContent}`)
      console.log("Merged root index.d.ts with generated declarations")
    } else {
      copyFileSync(rootTypesPath, generatedIndexPath)
      console.log("Copied root index.d.ts to dist")
    }
  }

  console.log("Library built at:", distDir)
}
