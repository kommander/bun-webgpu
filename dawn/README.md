# Dawn Libs

Download and manage pre-built Dawn libraries using the provided script.

## Prerequisites

1.  **Bun**: Ensure you have BunJS installed. (https://bun.sh)
2.  **GitHub CLI (`gh`)**: The script uses the `gh` command-line tool to interact with the GitHub API and download artifacts.
    *   Install `gh` from [cli.github.com](https://cli.github.com/).
    *   Authenticate with GitHub by running: `gh auth login`

## Downloading Artifacts

Use `download_artifacts.ts` to automate the downloading and unpacking of Dawn build artifacts from GitHub Actions.

### How to Run

Navigate to the `packages/bun-webgpu/dawn/` directory and run the script using Bun:

```bash
bun run ./download_artifacts.ts [<run_path_or_build_type>] [<build_type_if_run_path_first>]
```

**Arguments:**

*   **`run_path_or_build_type`** (optional):
    *   If this is the only argument provided:
        *   If it's `debug` or `release`, it specifies the build type, and the default run path is used.
        *   Otherwise, it's treated as the `run_path`.
    *   Default `run_path`: `google/dawn/actions/runs/14686102284` (This is an example, you'll likely want to update this to a more recent run).
        *   The `run_path` format is `OWNER/REPO/actions/runs/RUN_ID`.

*   **`build_type_if_run_path_first`** (optional):
    *   Specifies the build type (`debug` or `release`) if the first argument was a `run_path`.
    *   Default `build_type`: `release`

**Examples:**

*   Download `release` artifacts from the default run:
    ```bash
    bun run ./download_artifacts.ts
    ```
    or
    ```bash
    bun run ./download_artifacts.ts release
    ```

*   Download `debug` artifacts from the default run:
    ```bash
    bun run ./download_artifacts.ts debug
    ```

*   Download `release` artifacts from a specific run:
    ```bash
    bun run ./download_artifacts.ts google/dawn/actions/runs/YOUR_RUN_ID
    ```
    or
    ```bash
    bun run ./download_artifacts.ts google/dawn/actions/runs/YOUR_RUN_ID release
    ```

*   Download `debug` artifacts from a specific run:
    ```bash
    bun run ./download_artifacts.ts google/dawn/actions/runs/YOUR_RUN_ID debug
    ```

