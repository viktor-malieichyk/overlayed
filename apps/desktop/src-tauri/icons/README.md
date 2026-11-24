# UniversalOverlay icons

- `icon.svg` is the app mark. Generate the stable and Canary bundle
  assets and the desktop WebView images from this source.
- `tray/windows.svg` and `tray/windows-pinned.svg` are the Windows tray
  variants. Keep the letters on the 16 px pixel grid.
- `tray/icon-pinned.svg` is the pinned tray variant for other platforms.
  The unpinned icon uses the main app mark.

Run `cargo tauri icon <source.svg> --output <temporary-directory>` from
`apps/desktop/src-tauri`. Copy the matching generated files to the
existing bundle and tray paths. Refresh `public/img/icon.png`,
`public/img/32x32.png` and `public/img/32x32-canary.png` from the main mark.
The NSIS installers use the same stable or Canary `icon.ico` as the app.
