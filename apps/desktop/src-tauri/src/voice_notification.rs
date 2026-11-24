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

    let app_id = if tauri::is_dev() {
      Toast::POWERSHELL_APP_ID
    } else {
      &app.config().identifier
    };
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
