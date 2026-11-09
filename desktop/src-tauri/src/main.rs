// Träumerei's desktop shell: one window showing the one-file page (desktop/dist/index.html).
// The page keeps its own menu (the Veil) and keys, so the webview's browser keys are switched off:
// otherwise Ctrl+R reloads, F5 refreshes, Ctrl+F opens find and Ctrl+P prints over the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                quiet_webview(&window);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Träumerei could not start");
}

/// The page's t.ui.files.save (app/core/api/files.js): Windows' Save dialog, opening on `name`,
/// then the bytes written where the person chose. False when cancelled.
#[tauri::command]
async fn save_file(app: tauri::AppHandle, name: String, bytes: Vec<u8>) -> Result<bool, String> {
    let mut dialog = app.dialog().file().set_file_name(&name);
    if let Some((_, ext)) = name.rsplit_once('.') {
        dialog = dialog.add_filter(ext.to_uppercase(), &[ext]);
    }
    let Some(path) = dialog.blocking_save_file() else { return Ok(false) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Turns off WebView2's browser accelerator keys, its own right-click menu and its status bar.
/// Clipboard keys (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z) keep working; the page's own right-click stays.
#[cfg(windows)]
fn quiet_webview(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows_core::Interface;
    let _ = window.with_webview(|webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else { return };
        let Ok(settings) = core.Settings() else { return };
        let _ = settings.SetAreDefaultContextMenusEnabled(false);
        let _ = settings.SetIsStatusBarEnabled(false);
        if let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() {
            let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
        }
    });
}

#[cfg(not(windows))]
fn quiet_webview(_window: &tauri::WebviewWindow) {}
