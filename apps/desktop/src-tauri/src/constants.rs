pub const MAIN_WINDOW_NAME: &str = "main";
pub const SETTINGS_WINDOW_NAME: &str = "settings";

/// for the tray events
pub const TRAY_TOGGLE_PIN: &str = "toggle_pin";
pub const TRAY_SHOW_APP: &str = "show_app";
pub const TRAY_RELOAD: &str = "reload";
pub const TRAY_SETTINGS: &str = "show_settings";
pub const TRAY_JOIN_HISTORY: &str = "show_join_history";
pub const TRAY_SPEAKING_ONLY: &str = "toggle_speaking_only";
pub const TRAY_QUIT: &str = "quit";
pub const OVERLAYED: &str = "overlayed";

/// window levels
// NOTE: league sets it's window to 1000 so we go one higher
#[cfg(target_os = "macos")]
pub static HIGHER_LEVEL_THAN_LEAGUE: i32 = 1001;
/// Float panel window level
#[cfg(target_os = "macos")]
pub static OVERLAYED_NORMAL_LEVEL: i32 = 8;

/// HACK: this allows constraint of the size of the settings window
/// because the save sate plugin will not allow use to filter windows out
pub const SETTINGS_WINDOW_WIDTH: i32 = 680;
pub const SETTINGS_WINDOW_HEIGHT: i32 = 640;
