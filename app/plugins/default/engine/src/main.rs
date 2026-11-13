//! traumerei-engine: the default AI system's engine (app/plugins/default/README.md).
//!
//! The desktop app starts it as the `default` plugin's sidecar (app/core/AI.md, Sidecars):
//!
//!     traumerei-engine --port <port> --store <the plugin's folder> [--threads N] [--idle S] [--remember N]
//!
//! It answers the framework's HTTP bridge on 127.0.0.1 only:
//!   GET  /traumerei/ai/v1/health   200 { ok, engine, version, tasks }  (before any model loads)
//!   POST /traumerei/ai/v1/embed    { version, input: { items } } → { output: { vectors } }
//! A vector's data travels as { "float32": "<base64 of little-endian float32>" }. Failures answer
//! { reason } in words. Models load on first use, from what engine.json in the store names.
//! It exits by itself after --idle seconds with no request (1800 by default), in case the app
//! that started it is gone without stopping it. --remember is how many texts' vectors it keeps in
//! memory (50,000 by default; 0 for none, as the exams use).

mod embed;

use base64::Engine as _;
use serde::Deserialize;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tiny_http::{Header, Method, Request, Response, Server};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const TASKS: &[&str] = &["embed"];
/// The origins a page of the desktop app has (Tauri 2), and none for a caller that isn't a page.
const ORIGINS: &[&str] = &["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"];

struct Args { port: u16, store: PathBuf, threads: Option<usize>, idle: u64, remember: usize }

fn args() -> Result<Args, String> {
    let mut a = Args { port: 0, store: PathBuf::from("."), threads: None, idle: 1800, remember: embed::REMEMBER };
    let mut it = std::env::args().skip(1);
    while let Some(k) = it.next() {
        let mut v = || it.next().ok_or(format!("{k} needs a value"));
        match k.as_str() {
            "--port" => a.port = v()?.parse().map_err(|_| "--port needs a number")?,
            "--store" => a.store = PathBuf::from(v()?),
            "--threads" => a.threads = Some(v()?.parse().map_err(|_| "--threads needs a number")?),
            "--remember" => a.remember = v()?.parse().map_err(|_| "--remember needs a number of texts")?,
            "--idle" => a.idle = v()?.parse().map_err(|_| "--idle needs a number of seconds")?,
            "--version" => { println!("traumerei-engine {VERSION}"); std::process::exit(0) }
            other => return Err(format!("unknown argument {other}")),
        }
    }
    if a.port == 0 { return Err("--port is needed".into()) }
    Ok(a)
}

#[derive(Deserialize)]
struct Item { text: String }
#[derive(Deserialize)]
struct EmbedInput { items: Vec<Item> }
#[derive(Deserialize)]
struct Call<T> { input: T }

struct Engine {
    env: Option<ort::environment::Environment>,
    store: PathBuf,
    threads: Option<usize>,
    remember: usize,
    embedder: Option<embed::Embedder>,
}

impl Engine {
    fn environment(&mut self) -> Result<&ort::environment::Environment, String> {
        if self.env.is_none() {
            #[cfg(feature = "dylib")]
            let b = ort::init_from(std::env::var("ORT_DYLIB_PATH").map_err(|_| "set ORT_DYLIB_PATH to a libonnxruntime".to_string())?)
                .map_err(|e| format!("ONNX Runtime doesn't load: {e}"))?;
            #[cfg(not(feature = "dylib"))]
            let b = ort::init();
            self.env = Some(b.with_name("traumerei-engine").build().map_err(|e| format!("ONNX Runtime doesn't start: {e}"))?);
        }
        Ok(self.env.as_ref().unwrap())
    }

    /// The embedder engine.json names now, loaded (again, when engine.json changed).
    fn embedder(&mut self) -> Result<&mut embed::Embedder, String> {
        let spec = embed::Config::read(&self.store)?.embed.ok_or("engine.json names no embedder")?;
        if self.embedder.as_ref().map(|e| &e.spec) != Some(&spec) {
            self.embedder = None;
            let (store, threads, remember) = (self.store.clone(), self.threads, self.remember);
            let env = self.environment()?;
            self.embedder = Some(embed::Embedder::load(env, &store, &spec, threads, remember)?);
        }
        Ok(self.embedder.as_mut().unwrap())
    }

    fn embed(&mut self, body: &str) -> Result<serde_json::Value, (u16, String)> {
        let call: Call<EmbedInput> = serde_json::from_str(body).map_err(|e| (400, format!("the call doesn't read: {e}")))?;
        let texts: Vec<String> = call.input.items.into_iter().map(|i| i.text).collect();
        let e = self.embedder().map_err(|r| (503, r))?;
        let data = if texts.is_empty() { Vec::new() } else { e.embed(&texts).map_err(|r| (500, r))? };
        let bytes: Vec<u8> = data.iter().flat_map(|x| x.to_le_bytes()).collect();
        Ok(serde_json::json!({ "output": { "vectors": {
            "dim": e.dim, "data": { "float32": base64::engine::general_purpose::STANDARD.encode(bytes) } } } }))
    }
}

fn header(k: &str, v: &str) -> Header { Header::from_bytes(k.as_bytes(), v.as_bytes()).unwrap() }

fn answer(req: Request, status: u16, body: &serde_json::Value, origin: Option<&str>) {
    let mut r = Response::from_string(body.to_string()).with_status_code(status).with_header(header("Content-Type", "application/json"));
    if let Some(o) = origin {
        r = r.with_header(header("Access-Control-Allow-Origin", o)).with_header(header("Vary", "Origin"));
    }
    let _ = req.respond(r);
}

fn main() {
    let a = match args() {
        Ok(a) => a,
        Err(e) => { eprintln!("traumerei-engine: {e}"); std::process::exit(2) }
    };
    let server = match Server::http(("127.0.0.1", a.port)) {
        Ok(s) => s,
        Err(e) => { eprintln!("traumerei-engine: can't listen on 127.0.0.1:{}: {e}", a.port); std::process::exit(1) }
    };
    let mut engine = Engine { env: None, store: a.store, threads: a.threads, remember: a.remember, embedder: None };
    let idle = Duration::from_secs(a.idle.max(10));
    let mut last = Instant::now();
    loop {
        let req = match server.recv_timeout(Duration::from_secs(5)) {
            Ok(Some(r)) => r,
            Ok(None) => { if last.elapsed() > idle { break } continue }
            Err(_) => break,
        };
        last = Instant::now();
        let origin = req.headers().iter().find(|h| h.field.equiv("Origin")).map(|h| h.value.as_str().to_string());
        // A page of the app may call; a page anywhere else may not. A caller with no Origin (not a page) may.
        let allowed = match &origin { None => true, Some(o) => ORIGINS.contains(&o.as_str()) };
        if !allowed {
            answer(req, 403, &serde_json::json!({ "reason": "only the Träumerei app may call this engine" }), None);
            continue;
        }
        let o = origin.as_deref();
        if *req.method() == Method::Options {
            let mut r = Response::empty(204)
                .with_header(header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
                .with_header(header("Access-Control-Allow-Headers", "Content-Type"))
                .with_header(header("Access-Control-Allow-Private-Network", "true"))
                .with_header(header("Access-Control-Max-Age", "600"));
            if let Some(o) = o { r = r.with_header(header("Access-Control-Allow-Origin", o)).with_header(header("Vary", "Origin")); }
            let _ = req.respond(r);
            continue;
        }
        let path = req.url().split('?').next().unwrap_or("").to_string();
        let method = req.method().clone();
        match (method, path.as_str()) {
            (Method::Get, "/traumerei/ai/v1/health") => {
                answer(req, 200, &serde_json::json!({ "ok": true, "engine": "traumerei-engine", "version": VERSION, "tasks": TASKS }), o)
            }
            (Method::Post, "/traumerei/ai/v1/embed") => {
                let mut req = req;
                let mut body = String::new();
                if req.as_reader().read_to_string(&mut body).is_err() {
                    answer(req, 400, &serde_json::json!({ "reason": "the call's body doesn't read" }), o);
                    continue;
                }
                match engine.embed(&body) {
                    Ok(v) => answer(req, 200, &v, o),
                    Err((status, reason)) => answer(req, status, &serde_json::json!({ "reason": reason }), o),
                }
            }
            (_, p) if p.starts_with("/traumerei/ai/v1/") => {
                let task = p.trim_start_matches("/traumerei/ai/v1/").to_string();
                answer(req, 404, &serde_json::json!({ "reason": format!("this engine doesn't do {task} yet") }), o)
            }
            _ => answer(req, 404, &serde_json::json!({ "reason": "not a place this engine answers" }), o),
        }
    }
}
