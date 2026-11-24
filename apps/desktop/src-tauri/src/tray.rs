use std::sync::{
  atomic::{AtomicBool, Ordering},
  Mutex,
};

use tauri::{
  menu::{CheckMenuItemBuilder, Menu, MenuBuilder, MenuEvent},
  tray::TrayIconBuilder,
  AppHandle, Emitter, Manager, State, Wry,
};

use anyhow::Result;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::{
  commands, hotkeys, TrayMenu, MAIN_WINDOW_NAME, OVERLAYED, SETTINGS_WINDOW_NAME,
  TRAY_JOIN_HISTORY, TRAY_QUIT, TRAY_RELOAD, TRAY_SETTINGS, TRAY_SHOW_APP, TRAY_SPEAKING_ONLY,
  TRAY_TOGGLE_PIN,
};

#[tauri::command]
pub fn set_speaking_only_checked(menu: State<TrayMenu>, checked: bool) -> Result<(), String> {
  let item = menu
    .lock()
    .map_err(|error| error.to_string())?
    .get(TRAY_SPEAKING_ONLY);
  if let Some(item) = item.and_then(|item| item.as_check_menuitem().cloned()) {
    item
      .set_checked(checked)
      .map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[derive(Default)]
pub struct TrayLanguage(AtomicBool);

impl TrayLanguage {
  pub fn ukrainian(&self) -> bool {
    self.0.load(Ordering::Relaxed)
  }
}

pub fn pin_label(pinned: bool, ukrainian: bool) -> &'static str {
  match (pinned, ukrainian) {
    (true, true) => "Відкріпити",
    (false, true) => "Закріпити",
    (true, false) => "Unpin",
    (false, false) => "Pin",
  }
}

#[tauri::command]
pub fn set_tray_language(app: AppHandle, language: &str) -> Result<(), String> {
  let ukrainian = language == "uk";
  app
    .state::<TrayLanguage>()
    .0
    .store(ukrainian, Ordering::Relaxed);
  let pinned = commands::get_pin(app.state::<crate::Pinned>());
  let menu = app.state::<TrayMenu>();
  let menu = menu.lock().map_err(|error| error.to_string())?.clone();

  for (id, english, translated) in [
    (TRAY_SHOW_APP, "Show UniversalOverlay", "Показати UniversalOverlay"),
    (TRAY_RELOAD, "Reload app", "Перезавантажити застосунок"),
    (TRAY_SETTINGS, "Settings", "Налаштування"),
    (TRAY_JOIN_HISTORY, "History", "Історія"),
    (TRAY_QUIT, "Quit", "Закрити"),
  ] {
    if let Some(item) = menu.get(id) {
      item
        .as_menuitem_unchecked()
        .set_text(if ukrainian { translated } else { english })
        .map_err(|error| error.to_string())?;
    }
  }
  if let Some(item) = menu.get(TRAY_TOGGLE_PIN) {
    item
      .as_menuitem_unchecked()
      .set_text(pin_label(pinned, ukrainian))
      .map_err(|error| error.to_string())?;
  }
  if let Some(item) = menu.get(TRAY_SPEAKING_ONLY) {
    if let Some(item) = item.as_check_menuitem() {
      item
        .set_text(if ukrainian {
          "Показувати лише тих хто говорить"
        } else {
          "Only show users who are speaking"
        })
        .map_err(|error| error.to_string())?;
    }
  }
  if let Some(settings) = app.get_webview_window(SETTINGS_WINDOW_NAME) {
    settings
      .set_title(if ukrainian {
        "UniversalOverlay - Налаштування"
      } else {
        "UniversalOverlay - Settings"
      })
      .map_err(|error| error.to_string())?;
  }
  Ok(())
}

pub struct Tray;

impl Tray {
  pub fn create_tray_menu(app_handle: &AppHandle) -> Result<Menu<Wry>, tauri::Error> {
    let version = app_handle.package_info().version.to_string();
    let speaking_only = CheckMenuItemBuilder::with_id(TRAY_SPEAKING_ONLY, "Only show users who are speaking")
      .checked(false)
      .build(app_handle)?;
    MenuBuilder::new(app_handle)
      .text(TRAY_TOGGLE_PIN, "Pin")
      .text(TRAY_SHOW_APP, "Show UniversalOverlay")
      .item(&speaking_only)
      .text(TRAY_RELOAD, "Reload app")
      .text(TRAY_SETTINGS, "Settings")
      .text(TRAY_JOIN_HISTORY, "History")
      .separator()
      .text(OVERLAYED, format!("UniversalOverlay v{version}"))
      .text(TRAY_QUIT, "Quit")
      .build()
  }

  pub fn update_tray(app_handle: &AppHandle) -> Result<()> {
    let menu = Tray::create_tray_menu(app_handle)?;
    let _ = TrayIconBuilder::with_id(OVERLAYED)
      .tooltip(app_handle.package_info().name.clone())
      .icon_as_template(false)
      .menu(&menu)
      .on_menu_event(Self::handle_menu_events)
      .build(app_handle)?;
    app_handle.manage(TrayMenu(Mutex::new(menu)));
    commands::update_tray_icon(app_handle, false);
    Ok(())
  }

  pub fn handle_menu_events(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
      TRAY_TOGGLE_PIN => {
        if let Err(error) = hotkeys::toggle_overlay_pin(app) {
          log::warn!("Could not toggle overlay pin from tray: {error}");
        }
      }
      TRAY_SPEAKING_ONLY => {
        hotkeys::run_action(app, hotkeys::HotkeyCommand::ToggleSpeakingOnly);
      }
      TRAY_SHOW_APP => {
        if app.state::<hotkeys::OverlayVisibility>().is_hidden() {
          if let Err(error) = app.emit_to(MAIN_WINDOW_NAME, hotkeys::SHOW_OVERLAY, ()) {
            log::warn!("Could not restore overlay visibility from tray: {error}");
          }
          return;
        }
        let window = app.get_webview_window(MAIN_WINDOW_NAME).unwrap();
        window.show().unwrap();

        let placement = app.state::<crate::placement::PlacementState>();
        if placement.is_active() {
          if let Err(error) = crate::placement::reapply(&window, &placement) {
            log::warn!("Could not reapply overlay placement: {error}");
          }
        }

        window.set_focus().unwrap();
      }
      TRAY_RELOAD => {
        if let Some(window) = app.get_webview_window(MAIN_WINDOW_NAME) {
          if let Err(error) = window.eval("window.location.reload();") {
            log::warn!("Could not reload the overlay: {error}");
          }
        }
      }
      TRAY_SETTINGS | TRAY_JOIN_HISTORY => {
        if let Err(error) = commands::show_settings(app, event.id().as_ref() == TRAY_JOIN_HISTORY) {
          log::warn!("Could not open settings: {error}");
        }
      }
      TRAY_QUIT => {
        // NOTE: we only save position and size so that StateFlags::FULLSCREEN is not saved, as
        // nspanels do not support it
        app.save_window_state(StateFlags::POSITION | StateFlags::SIZE);
        std::process::exit(0)
      }
      _ => {}
    }
  }
}
