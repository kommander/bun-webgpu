import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

interface PackageJson {
  name: string
  version: string
  optionalDependencies?: Record<string, string>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, "..")

const packageJson: PackageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"))

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"

if (dryRun) {
  console.log("🔍 DRY RUN MODE - No packages will be published")
}

if (!isCI) {
  console.log(
    `
Please confirm the following before continuing:

1. The "version" field in package.json has been updated.
2. The changes have been pushed to GitHub.

Continue? (y/n)
`.trim(),
  )

  const confirm = spawnSync(
    "node",
    [
      "-e",
      `
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (data) => {
        const input = data.toString().toLowerCase();
        if (input === 'y') process.exit(0);
        if (input === 'n' || input === '\\x03') process.exit(1);
      });
      `,
    ],
    {
      shell: false,
      stdio: "inherit",
    },
  )

  if (confirm.status !== 0) {
    console.log("Aborted.")
    process.exit(1)
  }
} else {
  console.log("Running in CI mode, skipping confirmation...")
}

try {
  const versions = JSON.parse(
    spawnSync("npm", ["view", packageJson.name, "versions", "--json"], {})
      .stdout.toString()
      .trim(),
  )

  if (versions.includes(packageJson.version)) {
    console.error("Error: package.json version has not been incremented.")
    console.warn("Please update the version before publishing.")
    process.exit(1)
  }
} catch {}

const libDir = join(rootDir, "dist")
if (!existsSync(libDir)) {
  console.error("Error: dist directory not found. Please run 'bun run build' first.")
  process.exit(1)
}

const mismatches: Array<{ name: string; dir: string; expected: string; actual: string }> = []
const packageJsons: Record<string, PackageJson> = {
  [libDir]: JSON.parse(readFileSync(join(libDir, "package.json"), "utf8")),
}

// Load all native package.json files
const libPackageJson = packageJsons[libDir]!
for (const pkgName of Object.keys(libPackageJson.optionalDependencies || {}).filter((x) =>
  x.startsWith(packageJson.name),
)) {
  const nativeDir = join(rootDir, "node_modules", pkgName)
  if (!existsSync(nativeDir)) {
    console.error(`Error: Native package directory not found: ${nativeDir}`)
    console.error("Please run 'bun run build:native' first.")
    process.exit(1)
  }
  packageJsons[nativeDir] = JSON.parse(readFileSync(join(nativeDir, "package.json"), "utf8"))
}

for (const [dir, { name, version }] of Object.entries(packageJsons)) {
  if (version !== packageJson.version) {
    mismatches.push({
      name,
      dir,
      expected: packageJson.version,
      actual: version,
    })
  }
}

if (mismatches.length > 0) {
  console.error("Error: Version mismatch detected between root package and build packages:")
  mismatches.forEach((m) => console.error(`  - ${m.name}: expected ${m.expected}, found ${m.actual}\n  ^ "${m.dir}"`))
  process.exit(1)
}

if (isCI && !process.env.NPM_AUTH_TOKEN && !process.env.NPM_CONFIG_TOKEN) {
  console.error("Error: NPM_AUTH_TOKEN or NPM_CONFIG_TOKEN environment variable is required in CI")
  process.exit(1)
}

// Publish all packages (main + native packages)
Object.entries(packageJsons).forEach(([dir, { name, version }]) => {
  try {
    const versions = JSON.parse(
      spawnSync("npm", ["view", name, "versions", "--json"], {
        cwd: dir,
      })
        .stdout.toString()
        .trim(),
    )

    if (Array.isArray(versions) && versions.includes(version)) {
      console.error("Error: package.json version has not been incremented.")
      console.warn("Please update the version before publishing.")
      process.exit(1)
    }
  } catch {}

  // Check authentication (skip in CI if token is already set)
  if (!isCI) {
    const npmAuth = spawnSync("npm", ["whoami"], {})
    if (npmAuth.status !== 0) {
      console.error("Error: NPM authentication failed. Please run 'npm login'")
      process.exit(1)
    }
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would publish ${name}@${version} from ${dir}`)
    return
  }

  console.log(`\nPublishing ${name}@${version}...`)

  const isSnapshot = version.includes("-snapshot") || /^0\.0\.0-\d{8}-[a-f0-9]{8}$/.test(version)
  const publishArgs = ["publish", "--access=public"]

  if (isSnapshot) {
    publishArgs.push("--tag", "snapshot")
    console.log(`  Publishing as snapshot (--tag snapshot)`)
  }

  const publish: SpawnSyncReturns<Buffer> = spawnSync("npm", publishArgs, {
    cwd: dir,
    stdio: "inherit",
    env: {
      ...process.env,
      ...(process.env.NPM_AUTH_TOKEN ? { NPM_AUTH_TOKEN: process.env.NPM_AUTH_TOKEN } : {}),
      ...(process.env.NPM_CONFIG_TOKEN ? { NPM_CONFIG_TOKEN: process.env.NPM_CONFIG_TOKEN } : {}),
    }
  })

  if (publish.status !== 0) {
    console.error(`Failed to publish '${name}@${version}'.`)
    process.exit(1)
  }

  console.log(`Successfully published '${name}@${version}'`)
})

if (dryRun) {
  console.log("\n📦 DRY RUN COMPLETE - No packages were actually published")
  console.log(`Would have published ${Object.keys(packageJsons).length} packages:`)
  Object.entries(packageJsons).forEach(([_, { name, version }]) => {
    console.log(`  - ${name}@${version}`)
  })
} else {
  console.log(`\nAll ${packageJson.name} packages published successfully!`)
}
