# UniversalOverlay

UniversalOverlay is a desktop overlay for Discord voice chat. Keep the participant list and speaking indicators visible over another app, pin the overlay so clicks pass through it, and adjust its position, size, and opacity.

Voice History keeps the last 24 hours of observed joins, departures, and speaking activity on your device. Each entry has a timestamp, and speaking entries show how long the person spoke. Use the history filters to choose which activity to display. Optional desktop notifications show who joined or left and which voice channel they were in.

UniversalOverlay is developed primarily for Windows. Other operating systems are untested.

## Run locally

Install Rust, Node.js, and pnpm, then run these commands from the repository root.

```sh
pnpm install
pnpm --filter desktop start
```

Open the official Discord desktop client and authorize the overlay when prompted.

UniversalOverlay is a fork of [Overlayed](https://github.com/overlayeddev/overlayed).
