// Träumerei's desktop shell: one window showing the one-file page (desktop/dist/index.html).
// The page keeps its own menu (the Veil) and keys, so the webview's browser keys are switched off:
// otherwise Ctrl+R reloads, F5 refreshes, Ctrl+F opens find and Ctrl+P prints over the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

fn main() {
    let started_with = traum_files(std::env::args());
    tauri::Builder::default()
        // A second start (a .traum double-clicked while the app is open) hands its file to this one.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = traum_files(argv.into_iter());
            let Some(window) = app.get_webview_window("main") else { return };
            let _ = window.unminimize();
            let _ = window.set_focus();
            if paths.is_empty() { return }
            app.state::<Opened>().0.lock().unwrap().extend(paths);
            let _ = window.eval("window.__traumereiOpened && window.__traumereiOpened()");
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Opened(Mutex::new(started_with)))
        .manage(Listening(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![save_file, take_opened, open_link, sign_in_port, sign_in_wait])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                quiet_webview(&window);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Träumerei could not start");
}

/// Room files opened from Windows and not yet taken by the page.
struct Opened(Mutex<Vec<std::path::PathBuf>>);

/// The .traum files among a start's arguments (the first is the program).
fn traum_files(args: impl Iterator<Item = String>) -> Vec<std::path::PathBuf> {
    args.skip(1)
        .map(std::path::PathBuf::from)
        .filter(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("traum")) && p.is_file())
        .collect()
}

/// The page's t.ui.files.arrived (app/core/api/files.js): each waiting file as (name, bytes).
#[tauri::command]
fn take_opened(opened: tauri::State<Opened>) -> Vec<(String, Vec<u8>)> {
    let paths: Vec<_> = opened.0.lock().unwrap().drain(..).collect();
    paths
        .into_iter()
        .filter_map(|p| {
            let name = p.file_name()?.to_string_lossy().into_owned();
            Some((name, std::fs::read(&p).ok()?))
        })
        .collect()
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

/// The page's t.ui.link: an https address, in the person's default browser.
#[tauri::command]
fn open_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("only https addresses".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// The port on this computer the browser comes back to after signing in (sign_in_port), until
/// sign_in_wait takes it.
struct Listening(Mutex<Option<TcpListener>>);

/// The page's t.ui.roundTrip (app/core/api/files.js), step one: a free port on 127.0.0.1 only.
#[tauri::command]
fn sign_in_port(listening: tauri::State<Listening>) -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    *listening.0.lock().unwrap() = Some(listener);
    Ok(port)
}

/// Step two: waits up to five minutes for the browser to come to /done on that port, answers it
/// with a short page, brings the window forward and hands the page the path and query ("/done?…").
/// Anything else asked of the port (a favicon) gets a 404.
#[tauri::command]
async fn sign_in_wait(app: tauri::AppHandle, listening: tauri::State<'_, Listening>) -> Result<String, String> {
    let listener = listening.0.lock().unwrap().take().ok_or("no sign-in waiting")?;
    let path = tauri::async_runtime::spawn_blocking(move || came_back(listener))
        .await
        .map_err(|e| e.to_string())??;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(path)
}

fn came_back(listener: TcpListener) -> Result<String, String> {
    const PAGE: &str = "<!doctype html><meta charset=utf-8><title>Träumerei</title><body style=\"font:16px system-ui;margin:3em\">Signed in. You can close this tab and go back to Träumerei.";
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let until = Instant::now() + Duration::from_secs(300);
    while Instant::now() < until {
        let Ok((mut stream, _)) = listener.accept() else {
            std::thread::sleep(Duration::from_millis(200));
            continue;
        };
        let _ = stream.set_nonblocking(false);
        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let mut buf = Vec::new();
        let mut chunk = [0u8; 4096];
        while buf.len() < 32 * 1024 && !buf.windows(4).any(|w| w == b"\r\n\r\n") {
            match stream.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => buf.extend_from_slice(&chunk[..n]),
            }
        }
        let head = String::from_utf8_lossy(&buf);
        let path = head.lines().next().and_then(|l| l.strip_prefix("GET ")).and_then(|l| l.split(' ').next()).unwrap_or("");
        if path.starts_with("/done?") {
            let _ = write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", PAGE.len(), PAGE);
            return Ok(path.to_string());
        }
        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    }
    Err("nobody came back".into())
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
