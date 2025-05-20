#!/usr/bin/env bun

import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { program } from 'commander';

interface Args {
  runPath: string;
  buildType: 'debug' | 'release';
  platform?: string; // Added optional platform
}

interface ProcessableArtifact {
  artifactData: any; // Original artifact data from GitHub API
  platformId: string; // e.g., 'macos-latest', 'windows-latest'
}

const platformDirNameMap: Record<string, string> = {
  'macos-latest': 'aarch64-macos',
  'macos-13': 'x86_64-macos',
  'ubuntu-latest': 'x86_64-linux',
  'windows-latest': 'x86_64-windows',
};

async function main(args: Args) {
  console.log('Using gh CLI for GitHub API requests and artifact downloads.');
  console.log('Fetching artifacts for:', args.runPath, 'Build type:', args.buildType);

  const pathParts = args.runPath.split('/');
  
  if (pathParts.length < 5) {
    console.error('Invalid run path format. Expected: owner/repo/actions/runs/runId_number');
    process.exit(1);
  }
  const [owner, repo, , , runIdStr] = pathParts;
  const runId = parseInt(runIdStr!, 10);

  if (!owner || !repo || !runIdStr || isNaN(runId)) {
    console.error('Invalid run path format or run ID. Expected: owner/repo/actions/runs/runId_number');
    process.exit(1);
  }

  const listArtifactsEndpoint = `repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
  console.log(`Listing artifacts using: gh api ${listArtifactsEndpoint}`);

  try {
    const listProc = Bun.spawnSync(['gh', 'api', listArtifactsEndpoint], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (listProc.exitCode !== 0) {
      console.error(`Error listing artifacts with gh api. Exit code: ${listProc.exitCode}`);
      if (listProc.stdout) console.error(`Stdout: ${listProc.stdout.toString()}`);
      if (listProc.stderr) console.error(`Stderr: ${listProc.stderr.toString()}`);
      console.error("Please ensure 'gh' CLI is installed, authenticated ('gh auth login'), and has necessary permissions.");
      process.exit(1);
    }

    const listOutput = listProc.stdout.toString();
    const data = JSON.parse(listOutput) as { artifacts: any[], message?: string, total_count?: number };

    if (data.message && data.message.toLowerCase().includes("not found")) {
        console.error(`Error: Could not find run or artifacts via gh api. Message: ${data.message}`);
        process.exit(1);
    }
    
    if (!data.artifacts || data.artifacts.length === 0) {
      console.log('No artifacts found for this run.');
      return;
    }

    const buildTypeSuffix = args.buildType === 'debug' ? 'Debug' : 'Release';
    const platformMatchers = [
      { id: 'windows-latest', test: (name: string) => name.includes('-windows') },
      { id: 'ubuntu-latest', test: (name: string) => name.includes('-ubuntu') || name.includes('-linux') },
      { id: 'macos-13', test: (name: string) => name.includes('-macos-13') },
      { id: 'macos-latest', test: (name: string) => name.includes('-macos-') && !name.includes('-macos-13') },
    ];

    const artifactsToProcess = new Set<ProcessableArtifact>();
    for (const artifact of data.artifacts) {
      if (!artifact.name.endsWith(buildTypeSuffix) || artifact.expired) {
        continue;
      }

      let matchedPlatformId: string | undefined = undefined;

      for (const matcher of platformMatchers) {
        if (matcher.test(artifact.name)) {
          matchedPlatformId = matcher.id;
          break;
        }
      }

      if (!matchedPlatformId) {
        continue;
      }

      if (args.platform) {
        if (platformDirNameMap[args.platform]) {
          if (matchedPlatformId === args.platform) {
            artifactsToProcess.add({ artifactData: artifact, platformId: matchedPlatformId });
          }
        } else {
          const artifactPlatformGenericName = platformDirNameMap[matchedPlatformId]?.split('-')[1]; //e.g. 'macos' from 'aarch64-macos'
          if (artifactPlatformGenericName && artifactPlatformGenericName.includes(args.platform.toLowerCase())) {
             artifactsToProcess.add({ artifactData: artifact, platformId: matchedPlatformId });
          } else if (matchedPlatformId.toLowerCase().includes(args.platform.toLowerCase())) {
            artifactsToProcess.add({ artifactData: artifact, platformId: matchedPlatformId });
          }
        }
      } else {
        artifactsToProcess.add({ artifactData: artifact, platformId: matchedPlatformId });
      }
    }

    if (artifactsToProcess.size === 0) {
      if (args.platform) {
        console.log(`No artifacts found matching platform '${args.platform}' and build type '${args.buildType}'.`);
      } else {
        console.log(`No artifacts found matching the specified platforms and build type '${args.buildType}'.`);
      }
      return;
    }

    for (const item of artifactsToProcess) {
      const { artifactData, platformId } = item;
      const artifactName = artifactData.name;
      const artifactId = artifactData.id;
      const artifactSizeBytes = artifactData.size_in_bytes;

      const finalDirName = platformDirNameMap[platformId];
      if (!finalDirName) {
        console.warn(`No directory mapping found for platformId: ${platformId}. Skipping artifact: ${artifactName}`);
        continue;
      }
      const artifactDir = path.join(__dirname, 'libs', finalDirName); // Final directory for unpacked content
      
      console.log(`Processing artifact: ${artifactName}, ID: ${artifactId}, Size: ${artifactSizeBytes} bytes`);
      console.log(`Target directory: ${artifactDir}`);

      let tempDownloadDir: string | undefined;

      try {
        tempDownloadDir = await fs.mkdtemp(path.join(tmpdir(), `gh-dl-${artifactId}-`));
        console.log(`Created temporary download directory: ${tempDownloadDir}`);
        
        // Ensure the final directory exists, clear it if it does to ensure fresh unpack
        await fs.rm(artifactDir, { recursive: true, force: true }); // Clear if exists
        await fs.mkdir(artifactDir, { recursive: true });
        console.log(`Ensured final artifact directory is clean: ${artifactDir}`);

        console.log(`Downloading "${artifactName}" using gh run download...`);
        const ghDownloadProc = Bun.spawnSync([
          'gh',
          'run',
          'download',
          runId.toString(), 
          '--repo', `${owner}/${repo}`,
          '--name', artifactName, 
          '--dir', tempDownloadDir,
        ], {
          stdout: 'pipe',
          stderr: 'pipe',
        });

        if (ghDownloadProc.exitCode !== 0) {
          console.error(`Error downloading artifact "${artifactName}" with gh run download. Exit code: ${ghDownloadProc.exitCode}`);
          if (ghDownloadProc.stdout) console.error(`Stdout: ${ghDownloadProc.stdout.toString()}`);
          if (ghDownloadProc.stderr) console.error(`Stderr: ${ghDownloadProc.stderr.toString()}`);
          continue;
        }
        console.log(`Artifact "${artifactName}" downloaded by gh to ${tempDownloadDir}`);
        if (ghDownloadProc.stdout.length > 0) console.log(`gh download stdout: ${ghDownloadProc.stdout.toString()}`);
        if (ghDownloadProc.stderr.length > 0) console.warn(`gh download stderr: ${ghDownloadProc.stderr.toString()}`);
        
        const filesInTempDir = await fs.readdir(tempDownloadDir);
        if (filesInTempDir.length === 0) {
          console.error(`No files found in temporary download directory: ${tempDownloadDir}`);
          continue;
        }
        if (filesInTempDir.length > 1) {
          console.warn(`Multiple files found in temporary download directory: ${tempDownloadDir}. Using the first one: ${filesInTempDir[0]}`);
        }
        const downloadedArchiveFileName = filesInTempDir[0]!;
        const downloadedArchivePath = path.join(tempDownloadDir, downloadedArchiveFileName);

        console.log(`Downloaded archive found: ${downloadedArchivePath}`);

        try {
          await fs.access(downloadedArchivePath);
        } catch (e) {
          console.error(`Downloaded archive file not found at path: ${downloadedArchivePath}`);
          continue;
        }

        console.log(`Unpacking ${downloadedArchivePath} to ${artifactDir} using tar...`);
        const tarProc = Bun.spawnSync(
          ['tar', 'xf', downloadedArchivePath, '-C', artifactDir, '--strip-components=1'],
          { stdout: 'pipe', stderr: 'pipe' }
        );

        const stdoutContent = tarProc.stdout.toString('utf-8');
        const stderrContent = tarProc.stderr.toString('utf-8');

        if (tarProc.exitCode !== 0) {
          console.error(`Error unpacking "${artifactName}" with tar. Exit code: ${tarProc.exitCode}`);
          if (stdoutContent.length > 0) console.error(`Stdout: ${stdoutContent}`);
          if (stderrContent.length > 0) console.error(`Stderr: ${stderrContent}`);
        } else {
          console.log(`Unpacked "${artifactName}" to ${artifactDir} successfully.`);
          if (stdoutContent.length > 0) console.log(`tar stdout: ${stdoutContent}`);
          if (stderrContent.length > 0) console.warn(`tar stderr (on success): ${stderrContent}`);
        }
      } catch (error) {
        console.error(`Error processing artifact ${artifactName}:`, error);
      } finally {
        if (tempDownloadDir) {
          try {
            await fs.rm(tempDownloadDir, { recursive: true, force: true });
            console.log(`Cleaned up temporary download directory: ${tempDownloadDir}`);
          } catch (cleanupError) {
            console.error(`Error cleaning up temporary download directory ${tempDownloadDir}:`, cleanupError);
          }
        }
      }
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    if (error instanceof Error && error.message.includes('ENOENT')) {
      console.error("This might be because the 'gh' command was not found. Please ensure it is installed and in your PATH.");
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  const defaultRunPath = 'kommander/dawn/actions/runs/15122153809';
  const defaultBuildType = 'release';

  program
    .name('download_artifacts.ts')
    .description('Downloads and unpacks build artifacts from a GitHub Actions run.')
    .option('-r, --runPath <path>', 'GitHub Actions run path (e.g., owner/repo/actions/runs/runId)', defaultRunPath)
    .option('-b, --buildType <type>', "Build type: 'debug' or 'release'", defaultBuildType)
    .option('-p, --platform <name>', 'Optional: Specific platform to download (e.g., macos-latest, windows-latest, linux, macos)')
    .action((options) => {
      const runPath = options.runPath;
      const buildType = options.buildType.toLowerCase();
      const platform = options.platform;

      console.log(`Using runPath: ${runPath}`);
      console.log(`Using buildType: ${buildType}`);
      if (platform) {
        console.log(`Using platform: ${platform}`);
      }

      if (buildType !== 'debug' && buildType !== 'release') {
        console.error(`Invalid build type "${buildType}". Must be "debug" or "release".`);
        program.help();
      }

      main({ runPath, buildType: buildType as 'debug' | 'release', platform });
    });

  program.parse(process.argv);
} 