#[cfg(windows)]
async fn windows_sender(app: &tauri::AppHandle) -> Result<&'static String, String> {
  use tauri::Manager;
  use tokio::sync::OnceCell;
  use winreg::{enums::HKEY_CURRENT_USER, RegKey};

  static SENDER: OnceCell<String> = OnceCell::const_new();

  SENDER
    .get_or_try_init(|| async {
      let config = app.config();
      let name = config.product_name.as_deref().unwrap_or("UniversalOverlay");
      // Give Windows a fresh notification sender without changing Tauri's
      // bundle identifier, which also determines the settings directory.
      let app_id = format!("{}.VoiceNotifications", config.identifier);
      let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
      let icon_path = directory.join("voice-notification-icon.png");
      tokio::fs::create_dir_all(&directory)
        .await
        .map_err(|error| error.to_string())?;
      tokio::fs::write(&icon_path, include_bytes!("../icons/stable/128x128.png"))
        .await
        .map_err(|error| error.to_string())?;

      let user = RegKey::predef(HKEY_CURRENT_USER);
      let (sender, _) = user
        .create_subkey(format!(r"Software\Classes\AppUserModelId\{app_id}"))
        .map_err(|error| error.to_string())?;
      sender
        .set_value("DisplayName", &name)
        .and_then(|_| sender.set_value("IconUri", &icon_path.as_os_str()))
        .map_err(|error| error.to_string())?;
      Ok(app_id)
    })
    .await
}

#[tauri::command]
pub async fn show_voice_notification(
  app: tauri::AppHandle,
  title: String,
  body: String,
  user_id: String,
  avatar_hash: Option<String>,
  discriminator: Option<String>,
) -> Result<(), String> {
  #[cfg(windows)]
  {
    use std::time::Duration;
    use tauri::Manager;
    use tauri_plugin_http::reqwest::Client;
    use tauri_winrt_notification::{IconCrop, Toast};

    let default_avatar = match discriminator
      .as_deref()
      .and_then(|value| value.parse::<u16>().ok())
    {
      Some(value) if value != 0 => u64::from(value % 5),
      _ => (user_id.parse::<u64>().unwrap_or_default() >> 22) % 6,
    };
    let custom_avatar = avatar_hash.as_deref().filter(|hash| {
      !hash.is_empty()
        && hash.len() <= 34
        && hash.bytes().all(|c| c.is_ascii_hexdigit() || c == b'_')
        && !user_id.is_empty()
        && user_id.len() <= 20
        && user_id.bytes().all(|c| c.is_ascii_digit())
    });
    let (name, url) = match custom_avatar {
      Some(hash) => (
        format!("{user_id}-{hash}.png"),
        format!("https://cdn.discordapp.com/avatars/{user_id}/{hash}.png?size=64"),
      ),
      None => (
        format!("default-{default_avatar}.png"),
        format!("https://cdn.discordapp.com/embed/avatars/{default_avatar}.png"),
      ),
    };

    let image = async {
      let cache = app
        .path()
        .app_cache_dir()
        .ok()?
        .join("notification-avatars");
      tokio::fs::create_dir_all(&cache).await.ok()?;
      let path = cache.join(name);
      if !path.is_file() {
        let response = Client::builder()
          .timeout(Duration::from_secs(3))
          .build()
          .ok()?
          .get(url)
          .send()
          .await
          .ok()?
          .error_for_status()
          .ok()?;
        let bytes = response.bytes().await.ok()?;
        tokio::fs::write(&path, bytes).await.ok()?;
      }
      Some(path)
    }
    .await;

    let app_id = windows_sender(&app).await?;
    let mut toast = Toast::new(app_id).title(&title).text1(&body);
    if let Some(path) = image {
      toast = toast.icon(&path, IconCrop::Circular, "");
    }
    toast.show().map_err(|error| error.to_string())
  }
  #[cfg(not(windows))]
  {
    let _ = (app, title, body, user_id, avatar_hash, discriminator);
    Err("Windows toast unavailable".into())
  }
}
