//! Programs a plugin brings to run beside the app (app/core/ai/sidecar.js, part 10 of the plan):
//! a plugin's manifest names one (program, checksum, args); the page asks the person once per
//! plugin, downloads the program into the plugin's own folder (store.rs), and asks this to start
//! it. Here it is checked against its checksum, given a free port on 127.0.0.1, started with no
//! window, and stopped on request, when idle (the page says), or when the app closes.

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::net::TcpListener;
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;

/// The running programs, by plugin id: (the process, its port).
#[derive(Default)]
pub struct Sidecars(pub Mutex<HashMap<String, (Child, u16)>>);

/// "sha256:<hex>" of a file, read in pieces.
pub fn checksum(path: &Path) -> Result<String, String> {
    let mut f = std::fs::File::open(path).map_err(|e| format!("its program isn't there: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break }
        hasher.update(&buf[..n]);
    }
    Ok(format!("sha256:{:x}", hasher.finalize()))
}

/// The arguments with {port} and {store} (the plugin's folder) filled in.
pub fn fill(args: &[String], port: u16, store: &Path) -> Vec<String> {
    args.iter().map(|a| a.replace("{port}", &port.to_string()).replace("{store}", &store.to_string_lossy())).collect()
}

/// A port on 127.0.0.1 nothing listens on now.
pub fn free_port() -> Result<u16, String> {
    let l = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| e.to_string())?;
    Ok(l.local_addr().map_err(|e| e.to_string())?.port())
}

impl Sidecars {
    /// Starts the plugin's program (or answers the port of the one already running).
    pub fn start(&self, root: &Path, id: &str, program: &str, want: &str, args: &[String]) -> Result<u16, String> {
        let mut running = self.0.lock().unwrap();
        if let Some((child, port)) = running.get_mut(id) {
            if matches!(child.try_wait(), Ok(None)) { return Ok(*port) }
            running.remove(id);
        }
        let path = crate::store::file(root, id, program)?;
        let got = checksum(&path)?;
        if !got.eq_ignore_ascii_case(want) {
            return Err(format!("its program doesn't match its checksum ({got}); it was not started"));
        }
        let folder = crate::store::folder(root, id)?;
        let port = free_port()?;
        let mut cmd = Command::new(&path);
        cmd.args(fill(args, port, &folder)).current_dir(&folder);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let child = cmd.spawn().map_err(|e| format!("its program couldn't start: {e}"))?;
        running.insert(id.to_string(), (child, port));
        Ok(port)
    }

    /// Stops the plugin's program. True when one was running.
    pub fn stop(&self, id: &str) -> bool {
        let Some((mut child, _)) = self.0.lock().unwrap().remove(id) else { return false };
        let _ = child.kill();
        let _ = child.wait();
        true
    }

    pub fn stop_all(&self) {
        let ids: Vec<String> = self.0.lock().unwrap().keys().cloned().collect();
        for id in ids { self.stop(&id); }
    }

    /// The ids running now, with their ports.
    pub fn running(&self) -> Vec<(String, u16)> {
        let mut running = self.0.lock().unwrap();
        running.retain(|_, (child, _)| matches!(child.try_wait(), Ok(None)));
        let mut out: Vec<_> = running.iter().map(|(id, (_, port))| (id.clone(), *port)).collect();
        out.sort();
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checksum_and_args() {
        let dir = std::env::temp_dir().join(format!("traum-sidecar-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("x.bin");
        std::fs::write(&p, b"abc").unwrap();
        assert_eq!(checksum(&p).unwrap(), "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert!(checksum(&dir.join("none")).is_err());
        let args = fill(&["--port".into(), "{port}".into(), "--model={store}/m.gguf".into()], 4321, Path::new("/s"));
        assert_eq!(args, vec!["--port", "4321", "--model=/s/m.gguf"]);
        assert!(free_port().unwrap() > 0);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
