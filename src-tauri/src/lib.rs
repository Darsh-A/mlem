use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    webview::Color,
    Emitter, Manager,
};

/// Returns the logical screen size (width, height) for the monitor the window is on.
#[tauri::command]
async fn get_screen_size(window: tauri::Window) -> Result<(f64, f64), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let size = monitor.size();
    let scale = monitor.scale_factor();
    Ok((size.width as f64 / scale, size.height as f64 / scale))
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Build tray menu
            let reset_item =
                MenuItem::with_id(app, "reset_pos", "Reset Position", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Quit mlem", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&reset_item, &quit_item])?;

            // Force webview background to fully transparent (important for Wayland/Hyprland)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
            }

            // Build tray icon (uses default app icon)
            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("mlem - Desktop Cat")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "reset_pos" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("tray-reset-position", ());
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_screen_size])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
