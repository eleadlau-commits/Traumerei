//! Files on this computer a plugin may come back to (the page's t.ui.files path, show and hash,
//! app/core/api/files.js; core-gaps.md gap 3): a file the person picked in the app's own Open
//! dialog is remembered, and only a remembered file may later be shown in its own app, revealed in
//! Explorer, read again or hashed. Any other path is refused, whatever the page asks, so a plugin
//! (or a .traum file someone sent) can't reach a file the person never chose here. The list is
//! kept in the app's data folder (`handed-paths.txt`, one path a line), so it lasts between runs.
//! A program (an .exe, a script) is never opened, only revealed. Plain std, so `cargo test` runs it.

use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// The remembered files, read from `file` once and appended to it on each new one.
pub struct Handed {
    file: PathBuf,
    known: Mutex<Option<HashSet<String>>>,
}

/// Kinds of file that run something when opened: revealed in Explorer, never opened.
const RUNS: &[&str] = &["exe", "com", "bat", "cmd", "msi", "msix", "msp", "scr", "pif", "cpl", "lnk", "url", "ps1", "psm1",
    "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "jar", "reg", "inf", "dll", "sys", "appx", "appref-ms", "application",
    "gadget", "msc", "settingcontent-ms", "sh", "app", "command"];

/// Whether opening this file would run a program.
pub fn runs(path: &Path) -> bool {
    path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).is_some_and(|e| RUNS.contains(&e.as_str()))
}

/// A path as it is remembered: absolute and canonical (so `a\..\b` and `B` are one file), as words,
/// without Windows' `\\?\` prefix (a person reads and pastes `C:\…`).
fn key(path: &Path) -> Option<String> {
    let k = fs::canonicalize(path).ok()?.to_string_lossy().into_owned();
    Some(match k.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC\\") => rest.to_string(),
        Some(rest) => format!(r"\\{}", &rest[4..]),
        None => k,
    })
}

impl Handed {
    pub fn new(file: PathBuf) -> Self { Handed { file, known: Mutex::new(None) } }

    fn with<T>(&self, f: impl FnOnce(&mut HashSet<String>) -> T) -> T {
        let mut known = self.known.lock().unwrap();
        let set = known.get_or_insert_with(|| fs::read_to_string(&self.file).map(|t| t.lines().filter(|l| !l.is_empty()).map(str::to_string).collect()).unwrap_or_default());
        f(set)
    }

    /// Remembers a file the person picked here; its path as the page gets it, or None when it
    /// isn't a file.
    pub fn remember(&self, path: &Path) -> Option<String> {
        if !path.is_file() { return None }
        let k = key(path)?;
        let new = self.with(|s| s.insert(k.clone()));
        if new {
            if let Some(dir) = self.file.parent() { let _ = fs::create_dir_all(dir); }
            if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&self.file) {
                let _ = writeln!(f, "{k}");
            }
        }
        Some(k)
    }

    /// The file at `path` if it was picked here and is still there, else why not.
    pub fn check(&self, path: &str) -> Result<PathBuf, String> {
        let p = Path::new(path);
        let k = key(p).ok_or("the file isn't there any more")?;
        if !self.with(|s| s.contains(&k)) { return Err("only a file picked in this app can be reached".into()) }
        if !p.is_file() { return Err("not a file".into()) }
        Ok(PathBuf::from(k))
    }
}

/// The extensions an input's accept names ('.pdf,.traum,image/png' → pdf, traum); types are left out.
pub fn extensions(accept: &str) -> Vec<String> {
    accept.split(',').map(str::trim).filter_map(|a| a.strip_prefix('.')).filter(|e| !e.is_empty() && e.chars().all(|c| c.is_ascii_alphanumeric()))
        .map(str::to_ascii_lowercase).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("traumerei-handles-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn only_a_picked_file_is_reached_and_it_lasts_between_runs() {
        let d = tmp("picked");
        let pdf = d.join("paper.pdf");
        let other = d.join("secret.txt");
        fs::write(&pdf, b"%PDF").unwrap();
        fs::write(&other, b"no").unwrap();
        let list = d.join("data").join("handed-paths.txt");
        let h = Handed::new(list.clone());
        assert!(h.check(pdf.to_str().unwrap()).is_err());
        let said = h.remember(&pdf).unwrap();
        assert!(h.check(&said).is_ok());
        let roundabout = d.join("data").join("..").join("paper.pdf");
        assert!(h.check(roundabout.to_str().unwrap()).is_ok()); // the same file by another way
        assert!(h.check(other.to_str().unwrap()).is_err());
        assert!(h.remember(&d).is_none()); // a folder is not a file
        let again = Handed::new(list); // the next run
        assert!(again.check(&said).is_ok());
        fs::remove_file(&pdf).unwrap();
        assert_eq!(again.check(&said).unwrap_err(), "the file isn't there any more");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn programs_are_never_opened_and_accept_gives_extensions() {
        assert!(runs(Path::new("C:/x/setup.EXE")));
        assert!(runs(Path::new("a.ps1")));
        assert!(!runs(Path::new("paper.pdf")));
        assert!(!runs(Path::new("notes")));
        assert_eq!(extensions(".pdf, .TRAUM,image/png,.,.a b"), vec!["pdf", "traum"]);
    }
}
