# UniversalOverlay icons

The original artwork is in `source/`. Use `UO-square.png` for larger
icons and the supplied 16, 24, and 32 px exports at their native sizes.
The pinned tray artwork adds a yellow dot to the same mark.

Generate the larger bundle and WebView images with
`cargo tauri icon icons/source/UO-square.png --output <temporary-directory>`
from `apps/desktop/src-tauri`. Use the supplied exports for the 16, 24,
and 32 px entries in the Windows ICO, the 16 and 32 px entries in the
macOS ICNS, and the 32 px bundle and WebView PNGs.

## Windows

The app executable, Start and Explorer shortcuts, and NSIS installer use
the bundle ICO. Keep the 32 px frame first for Tauri's startup icon.

| Surface | Pixel sizes |
| --- | --- |
| Title bar and tray | 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64 |
| Taskbar, search and Start app list | 24, 30, 36, 42, 48, 54, 60, 66, 72, 84, 96 |
| Large window icons and Start pins | 32, 40, 48, 56, 64, 72, 80, 88, 96, 112, 128, 256 |
| Additional Explorer sizes | 120, 144, 160, 168, 192, 224 |

Render each additional size directly from the master with the
`tauri icon -p <size>` option. Put the title-bar and tray sizes in
`tray/windows-pinned.ico` with the pinned dot. Windows notifications use
the stable 128 px PNG as their sender icon.

[Microsoft's Windows app icon guidance](https://learn.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-construction)
