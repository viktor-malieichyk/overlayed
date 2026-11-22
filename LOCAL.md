# Local Setup

To contribute you will first need to fork the repo and make some adjustments to
get it up and running on your local machine. Below are the steps to follow for you to get Overlayed to run on your local machine.

# Prerequisites

- Rust
- Node
- pnpm

### 1. Fork & clone the repo

Follow https://docs.github.com/en/get-started/quickstart/fork-a-repo

### 2. Install the deps

From the root of the monorepo run.

```sh
pnpm install
```

### 3. Start the desktop app

From the root of the monorepo run
```sh
pnpm start --filter=desktop
```

### Running the Web & API 
Since the API uses github API you'll need to create a `apps/web/.dev.vars` that has a `GITHUB_TOKEN` (github personal access toke).

Then you'd run something like this to start both `api` and `web`.
```
pnpm start --filter=web --filter=api
```

If you want to use a mocked response you can run this command in the `apps/web` directory.

```
pnpm start:mocked

```

### 4. Building the latest version locally
```
pnpm build:desktop
```

### 4b. Building locally without updater signing
```
pnpm build:desktop:unsigned
```

### 5. Building the canary version locally
```
pnpm build:canary
```

### Windows x64 releases for this fork

Use the same updater signing key for every release. Keep the private key and its password outside the repository, and set `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in the build environment.

After bumping the Tauri and Rust package versions, build the signed NSIS installer and generate its update manifest from the repository root.

```sh
pnpm --filter desktop exec tauri build --target x86_64-pc-windows-msvc --bundles nsis
node scripts/create-fork-update-manifest.mjs <path-to-x64-setup.exe>
```

Attach the installer and the generated `latest.json` to the matching GitHub release, tagged `v<version>`. The manifest contains the installer signature and must be published with each release that is marked latest.
