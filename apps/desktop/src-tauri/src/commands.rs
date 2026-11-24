use std::{
  ops::Deref,
  sync::{atomic::AtomicBool, Mutex},
};

#[cfg(not(windows))]
use tauri::image::Image;
use tauri::{menu::Menu, AppHandle, Emitter, Manager, State, WebviewWindow, Wry};

use crate::{constants::*, Pinned, TaskbarHideMode, TrayMenu};

#[tauri::command]
pub fn open_settings(window: WebviewWindow) -> Result<(), String> {
  show_settings(window.app_handle(), false)
}

pub(crate) fn show_settings(app: &AppHandle, history: bool) -> Result<(), String> {
  let result = (|| -> tauri::Result<()> {
    let settings = app.get_webview_window(SETTINGS_WINDOW_NAME)
      .ok_or(tauri::Error::WindowNotFound)?;
    if history {
      settings.eval("window.location.hash = '/settings?tab=join-history';")?;
    }
    settings.show()?;
    settings.unminimize()?;
    settings.set_focus()
  })();
  result.map_err(|error| error.to_string())
}

#[tauri::command]
pub fn close_settings(window: WebviewWindow) {
  let app = window.app_handle();
  let settings_windows = app.get_webview_window(SETTINGS_WINDOW_NAME);
  if let Some(settings_windows) = settings_windows {
    settings_windows.hide();
  }
}

#[tauri::command]
pub fn get_pin(storage: State<Pinned>) -> bool {
  storage.0.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
pub fn open_devtools(window: WebviewWindow) {
  window.open_devtools();
}

#[tauri::command]
pub fn open_overlay_devtools(window: WebviewWindow) {
  let app = window.app_handle();
  if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_NAME) {
    main_window.open_devtools();
  }
}

#[tauri::command]
pub fn simulate_error_screen(window: WebviewWindow) {
  let app = window.app_handle();

  if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_NAME) {
    let _ = main_window.eval("window.location.hash = '#/error';");
    let _ = main_window.show();
    let _ = main_window.set_focus();
  }

  if let Some(settings_window) = app.get_webview_window(SETTINGS_WINDOW_NAME) {
    let _ = settings_window.hide();
  }
}

pub fn set_pin(
  window: WebviewWindow,
  pin: State<Pinned>,
  menu: State<TrayMenu>,
  hide_taskbar: State<Mutex<TaskbarHideMode>>,
  value: bool,
  remember: bool,
) {
  if let Some(main_win) = window.app_handle().get_webview_window(MAIN_WINDOW_NAME) {
    _set_pin(value, &main_win, pin, menu, hide_taskbar, remember);
  }
}

impl Deref for Pinned {
  type Target = AtomicBool;

  fn deref(&self) -> &Self::Target {
    &self.0
  }
}

impl Deref for TrayMenu {
  type Target = Mutex<Menu<Wry>>;

  fn deref(&self) -> &Self::Target {
    &self.0
  }
}

fn apply_taskbar_visibility(app: &AppHandle, pinned: bool, mode: TaskbarHideMode) {
  let skip_taskbar = match mode {
    TaskbarHideMode::Never => false,
    TaskbarHideMode::Pinned => pinned,
    TaskbarHideMode::Always => true,
  };

  #[cfg(not(target_os = "macos"))]
  if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_NAME) {
    main_window.set_skip_taskbar(skip_taskbar).ok();
  }

  #[cfg(target_os = "macos")]
  {
    use tauri::ActivationPolicy;
    app
      .set_activation_policy(if skip_taskbar {
        ActivationPolicy::Accessory
      } else {
        ActivationPolicy::Regular
      })
      .ok();
  }
}

fn _set_pin(
  value: bool,
  window: &WebviewWindow,
  pinned: State<Pinned>,
  menu: State<TrayMenu>,
  hide_taskbar: State<Mutex<TaskbarHideMode>>,
  remember: bool,
) {
  pinned.store(value, std::sync::atomic::Ordering::Relaxed);

  let app_handle = window.app_handle();
  let hidden = app_handle.state::<crate::hotkeys::OverlayVisibility>().is_hidden();
  if let Err(error) = crate::hotkeys::set_cursor_passthrough(window, hidden || value) {
    log::warn!("Could not update overlay cursor handling: {error}");
  }
  let update = serde_json::json!({ "pinned": value, "remember": remember });
  if let Err(error) = app_handle.emit(TRAY_TOGGLE_PIN, update) {
    log::warn!("Could not publish the overlay pin state: {error}");
  }

  // invert the label for the tray
  if let Some(toggle_pin_menu_item) = menu.lock().ok().and_then(|m| m.get(TRAY_TOGGLE_PIN)) {
    let language = app_handle.state::<crate::tray::TrayLanguage>();
    let enable_or_disable = crate::tray::pin_label(value, language.ukrainian());
    toggle_pin_menu_item
      .as_menuitem_unchecked()
      .set_text(enable_or_disable);
  }

  #[cfg(target_os = "macos")]
  window.with_webview(move |webview| unsafe {
    #[cfg(target_os = "macos")]
    use cocoa::appkit::NSWindow;
    let id = webview.ns_window() as cocoa::base::id;

    #[cfg(target_arch = "aarch64")]
    id.setIgnoresMouseEvents_(hidden || value);

    // convert bool into number
    #[cfg(target_arch = "x86_64")]
    {
      let value = if value { 1 } else { 0 };
      id.setHasShadow_(value);
    }
  });

  apply_taskbar_visibility(window.app_handle(), value, *hide_taskbar.lock().unwrap());

  // update the tray icon
  update_tray_icon(window.app_handle(), value);
}

pub fn update_tray_icon(app: &AppHandle, pinned: bool) {
  let Some(tray) = app.tray_by_id(OVERLAYED) else {
    return;
  };
  #[cfg(windows)]
  let icon = crate::windows_icons::tray_icon(pinned);
  #[cfg(not(windows))]
  let icon = {
    let scale = app
      .primary_monitor()
      .ok()
      .flatten()
      .map_or(1.0, |monitor| monitor.scale_factor());
    let (normal, pinned_icon): (&[u8], &[u8]) = match (16.0 * scale).round() as u32 {
      0..=19 => (
        include_bytes!("../icons/source/UO-square-16.png"),
        include_bytes!("../icons/tray/pinned-16.png"),
      ),
      20..=27 => (
        include_bytes!("../icons/source/UO-square-24.png"),
        include_bytes!("../icons/tray/pinned-24.png"),
      ),
      _ => (
        include_bytes!("../icons/source/UO-square-32.png"),
        include_bytes!("../icons/tray/pinned-32.png"),
      ),
    };
    Image::from_bytes(if pinned { pinned_icon } else { normal })
  };
  if let Ok(icon) = icon {
    tray.set_icon(Some(icon));
  }
}

#[tauri::command]
pub fn set_taskbar_hide_mode(
  window: WebviewWindow,
  mode: TaskbarHideMode,
  pinned: State<Pinned>,
  hide_taskbar: State<Mutex<TaskbarHideMode>>,
) {
  *hide_taskbar.lock().unwrap() = mode;
  apply_taskbar_visibility(
    window.app_handle(),
    pinned.load(std::sync::atomic::Ordering::Relaxed),
    mode,
  );
}

#[tauri::command]
pub fn open_config_dir(app: tauri::AppHandle) {
  use tauri::Manager;
  use tauri_plugin_opener::OpenerExt;
  if let Ok(path) = app.path().app_config_dir() {
    let _ = std::fs::create_dir_all(&path);
    let _ = app
      .opener()
      .open_path(path.to_string_lossy().to_string(), None::<&str>);
  }
}
#[tauri::command]
pub fn get_initial_language() -> &'static str {
  #[cfg(windows)]
  {
    #[link(name = "kernel32")]
    extern "system" {
      fn GetUserDefaultUILanguage() -> u16;
    }
    const PRIMARY_LANGUAGE_MASK: u16 = 0x03ff;
    const LANG_UKRAINIAN: u16 = 0x22;
    // SAFETY: The Win32 function takes no arguments and returns a LANGID.
    if unsafe { GetUserDefaultUILanguage() } & PRIMARY_LANGUAGE_MASK == LANG_UKRAINIAN {
      return "uk";
    }
  }
  "en"
}
