use std::{cell::RefCell, collections::HashMap, io::Cursor, ptr::null};
use tauri::{image::Image, WebviewWindow};
use windows_sys::Win32::{
  System::LibraryLoader::GetModuleHandleW,
  UI::{
    HiDpi::{GetDpiForSystem, GetDpiForWindow, GetSystemMetricsForDpi},
    WindowsAndMessaging::{
      FindWindowW, LoadImageW, SendMessageW, HICON, ICON_BIG, ICON_SMALL, IMAGE_ICON, SM_CXICON,
      SM_CXSMICON, WM_SETICON,
    },
  },
};

// Tauri embeds the bundle ICO as resource 32512. A window keeps the HICON
// handle, so retain each loaded size on the UI thread for the process lifetime.
const APP_ICON_RESOURCE: usize = 32512;
thread_local! {
  static WINDOW_ICONS: RefCell<HashMap<i32, HICON>> = RefCell::new(HashMap::new());
}

pub fn refresh_window_icons(window: &WebviewWindow) -> tauri::Result<()> {
  let hwnd = window.hwnd()?.0 as _;
  let dpi = unsafe { GetDpiForWindow(hwnd) };
  if dpi == 0 {
    return Ok(());
  }
  let module = unsafe { GetModuleHandleW(null()) };
  for (kind, metric) in [(ICON_SMALL, SM_CXSMICON), (ICON_BIG, SM_CXICON)] {
    let size = unsafe { GetSystemMetricsForDpi(metric, dpi) };
    if size <= 0 {
      continue;
    }
    let icon = WINDOW_ICONS.with(|icons| {
      let mut icons = icons.borrow_mut();
      if let Some(&icon) = icons.get(&size) {
        return icon;
      }
      let icon = unsafe {
        LoadImageW(
          module,
          APP_ICON_RESOURCE as *const u16,
          IMAGE_ICON,
          size,
          size,
          0,
        )
      };
      if !icon.is_null() {
        icons.insert(size, icon);
      }
      icon
    });
    if icon.is_null() {
      log::warn!("Could not load the {size} px window icon");
    } else {
      unsafe { SendMessageW(hwnd, WM_SETICON, kind as usize, icon as isize) };
    }
  }
  Ok(())
}

pub fn tray_icon(pinned: bool) -> std::io::Result<Image<'static>> {
  let taskbar = unsafe { FindWindowW(windows_sys::w!("Shell_TrayWnd"), null()) };
  let dpi = unsafe { GetDpiForWindow(taskbar) };
  let dpi = if dpi == 0 {
    unsafe { GetDpiForSystem() }
  } else {
    dpi
  };
  let size = unsafe { GetSystemMetricsForDpi(SM_CXSMICON, dpi) }.max(16) as u32;
  let bytes: &[u8] = if pinned {
    include_bytes!("../icons/tray/windows-pinned.ico")
  } else {
    include_bytes!("../icons/stable/icon.ico")
  };
  let directory = ico::IconDir::read(Cursor::new(bytes))?;
  let frame = directory
    .entries()
    .iter()
    .min_by_key(|entry| (entry.width().abs_diff(size), entry.width() < size))
    .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Empty tray icon"))?;
  let image = frame.decode()?;
  Ok(Image::new_owned(
    image.rgba_data().to_vec(),
    image.width(),
    image.height(),
  ))
}
