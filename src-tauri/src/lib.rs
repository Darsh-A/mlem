use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    webview::Color,
    Emitter, Manager,
};

#[cfg(target_os = "linux")]
use gtk::prelude::GtkWindowExt;

/// Returns the logical work area (x, y, width, height) — usable screen excluding taskbar.
#[tauri::command]
async fn get_work_area(window: tauri::Window) -> Result<(f64, f64, f64, f64), String> {
    // On Windows, use SystemParametersInfo to get the actual work area (excludes taskbar)
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::SystemParametersInfoW;
        use windows::Win32::UI::WindowsAndMessaging::SPI_GETWORKAREA;
        use windows::Win32::Foundation::RECT;

        let mut rect = RECT::default();
        unsafe {
            SystemParametersInfoW(
                SPI_GETWORKAREA,
                0,
                Some(&mut rect as *mut _ as *mut _),
                Default::default(),
            ).map_err(|e| e.to_string())?;
        }

        let scale = window
            .current_monitor()
            .map_err(|e| e.to_string())?
            .map(|m| m.scale_factor())
            .unwrap_or(1.0);

        return Ok((
            rect.left as f64 / scale,
            rect.top as f64 / scale,
            (rect.right - rect.left) as f64 / scale,
            (rect.bottom - rect.top) as f64 / scale,
        ));
    }

    // On Linux / macOS, fall back to full monitor size
    // (Linux compositors typically don't report work area via Tauri)
    #[cfg(not(target_os = "windows"))]
    {
        let monitor = window
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "No monitor found".to_string())?;
        let size = monitor.size();
        let scale = monitor.scale_factor();
        Ok((
            0.0,
            0.0,
            size.width as f64 / scale,
            size.height as f64 / scale,
        ))
    }
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

                // On Windows, remove residual border/shadow via Win32 API
                #[cfg(target_os = "windows")]
                {
                    use windows::Win32::UI::WindowsAndMessaging::{
                        SetWindowLongW, GetWindowLongW, GWL_EXSTYLE,
                        WS_EX_TOOLWINDOW, WS_EX_APPWINDOW,
                    };
                    use windows::Win32::Foundation::HWND;

                    let hwnd = HWND(window.hwnd().map_err(|e| e.to_string())?.0);
                    unsafe {
                        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
                        // Add TOOLWINDOW (hides from taskbar/alt-tab), remove APPWINDOW
                        let new_style = (ex_style | WS_EX_TOOLWINDOW.0) & !WS_EX_APPWINDOW.0;
                        SetWindowLongW(hwnd, GWL_EXSTYLE, new_style as i32);
                    }
                }

                // On Linux, set the GTK window type hint so compositors
                // don't apply blur, shadows, or rounded corners to this window.
                #[cfg(target_os = "linux")]
                {
                    let gtk_window = window.gtk_window().map_err(|e| e.to_string())?;
                    gtk_window.set_type_hint(gdk::WindowTypeHint::Utility);
                    // Also tell the window to not accept focus by default
                    // (pet windows shouldn't steal focus from other apps)
                    gtk_window.set_accept_focus(false);
                }
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
        .invoke_handler(tauri::generate_handler![get_work_area])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
