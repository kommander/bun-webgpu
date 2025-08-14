import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"
import process from "process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, "..")
const licensePath = join(rootDir, "LICENSE")
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"))

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

const variants = [
  { platform: "darwin", arch: "x64" },
  { platform: "darwin", arch: "arm64" },
  { platform: "linux", arch: "x64" },
  { platform: "win32", arch: "x64" },
  // These could be added in the future:
  // { platform: "linux", arch: "arm64" },
  // { platform: "win32", arch: "arm64" },
]

if (!buildLib && !buildNative) {
  console.error("Error: Please specify --lib, --native, or both")
  console.error("  --native: Build and package native binaries")
  console.error("  --lib: Build JavaScript library and TypeScript declarations")
  console.error("  --skip-build: Skip building native binaries (use with --native to package existing binaries)")
  process.exit(1)
}

const getZigTarget = (platform, arch) => {
  const platformMap = { darwin: "macos", win32: "windows", linux: "linux" }
  const archMap = { x64: "x86_64", arm64: "aarch64" }
  return `${archMap[arch] ?? arch}-${platformMap[platform] ?? platform}`
}

const replaceLinks = (text) => {
  return packageJson.homepage
    ? text.replace(
        /(\[.*?\]\()(\.\/.*?\))/g,
        (_, p1, p2) => `${p1}${packageJson.homepage}/blob/HEAD/${p2.replace("./", "")}`,
      )
    : text
}

const requiredFields = ["name", "version", "license", "repository", "description"]
const missingRequired = requiredFields.filter(field => !packageJson[field])
if (missingRequired.length > 0) {
  console.error(`Error: Missing required fields in package.json: ${missingRequired.join(", ")}`)
  process.exit(1)
}

if (buildNative) {
  if (!skipBuild) {
    console.log(`Building native ${isDev ? "dev" : "prod"} binaries...`)
    
    const zigBuild = spawnSync("zig", ["build", `-Doptimize=${isDev ? "Debug" : "ReleaseFast"}`], {
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

    const ext = platform === "win32" ? ".dll" : platform === "darwin" ? ".dylib" : ".so"
    
    const isWindows = platform === "win32"
    const libraryName = isWindows ? "webgpu_wrapper" : "libwebgpu_wrapper"
    const src = join(libDir, `${libraryName}${ext}`)
    
    if (existsSync(src)) {
      rmSync(nativeDir, { recursive: true, force: true })
      mkdirSync(nativeDir, { recursive: true })
      
      copyFileSync(src, join(nativeDir, `${libraryName}${ext}`))
      console.log(`  Copied: ${libraryName}${ext} for ${platform}-${arch}`)
    } else {
      console.log(`  Skipping ${platform}-${arch}: library not built (${src} not found)`)
      continue
    }

    writeFileSync(
      join(nativeDir, "package.json"),
      JSON.stringify(
        {
          name: nativeName,
          version: packageJson.version,
          description: `Prebuilt ${platform}-${arch} binaries for ${packageJson.name}`,
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

  const externalDeps = [
    ...Object.keys(packageJson.optionalDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ]

  // Build main entry point
  spawnSync(
    "bun",
    [
      "build",
      "--target=bun",
      "--outdir=dist",
      ...externalDeps.flatMap((dep) => ["--external", dep]),
      packageJson.module,
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
  
  const tscResult = spawnSync("npx", ["tsc", "-p", tsconfigBuildPath], {
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

  const exports = {
    ".": {
      import: "./index.js",
      require: "./index.js",
      types: "./index.d.ts"
    }
  }

  const optionalDeps = Object.fromEntries(
    variants.map(({ platform, arch }) => [`${packageJson.name}-${platform}-${arch}`, `^${packageJson.version}`]),
  )

  writeFileSync(
    join(distDir, "package.json"),
    JSON.stringify(
      {
        name: packageJson.name,
        module: "index.js",
        main: "index.js",
        types: "index.d.ts",
        type: packageJson.type,
        version: packageJson.version,
        description: packageJson.description,
        keywords: packageJson.keywords,
        license: packageJson.license,
        author: packageJson.author,
        homepage: packageJson.homepage,
        repository: packageJson.repository,
        bugs: packageJson.bugs,
        exports,
        dependencies: {
          ...packageJson.dependencies,
          "@webgpu/types": packageJson.devDependencies["@webgpu/types"] || "^0.1.60",
        },
        optionalDependencies: {
          ...packageJson.optionalDependencies,
          ...optionalDeps,
        },
      },
      null,
      2,
    ),
  )

  writeFileSync(join(distDir, "README.md"), replaceLinks(readFileSync(join(rootDir, "README.md"), "utf8")))
  if (existsSync(licensePath)) copyFileSync(licensePath, join(distDir, "LICENSE"))

  console.log("Library built at:", distDir)
}
