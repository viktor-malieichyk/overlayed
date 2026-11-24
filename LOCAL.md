# Desktop builds and releases

Follow [the README](README.md) to install dependencies. Run build commands from the repository root.

## Stable build

```sh
pnpm build:desktop
```

## Build without updater signing

```sh
pnpm build:desktop:unsigned
```

## Canary build

```sh
pnpm build:canary
```

## Windows x64 releases

On the Windows release VM, the signing key is at
`%LOCALAPPDATA%\OverlayedForkSigning\updater.key`. Match its `updater.key.pub`
against `plugins.updater.pubkey` in `tauri.conf.json` before signing.
Unlock `updater-password.dpapi` with PowerShell `ConvertTo-SecureString`
under the original Windows user and pass the password through the
signing process environment.

The portable encrypted backup is on the Mac host at
`~/.tauri/universaloverlay-updater-backup`. Its `RECOVERY.txt` explains how to
recover both files with the Mac's `~/.ssh/id_ed25519` identity. The DPAPI
file alone will not restore signing on a replacement VM.

Use the same updater signing key for every release. Keep the private key and its password outside the repository, and set `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in the build environment.

After bumping the Tauri and Rust package versions, build the signed NSIS installer and generate its update manifest from the repository root.

```sh
pnpm --filter desktop exec tauri build --target x86_64-pc-windows-msvc --bundles nsis
node scripts/create-fork-update-manifest.mjs <path-to-x64-setup.exe>
```

Attach the installer and the generated `latest.json` to the matching GitHub release. Use the title `UniversalOverlay <version>`, tag it `v<version>`, and use the version from `tauri.conf.json` verbatim in both. For example, use `UniversalOverlay 0.7.0-beta.2` and `v0.7.0-beta.2`. Mark beta releases as prereleases. The manifest contains the installer signature and must be published with each release that is marked latest.
