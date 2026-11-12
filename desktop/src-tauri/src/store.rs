//! Each plugin's own files on this computer (the page's t.store.files, app/core/store/): one folder
//! per plugin under the app's data folder, `%APPDATA%\app.traumerei.desktop\plugins\<id>\` on
//! Windows. Names are plain file names (no folders, no `..`), and every write is held to the
//! plugin's quota. Plain std, so `cargo test` runs it without a window.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// No plugin may keep more than this, whatever quota the page asks for.
pub const MOST: u64 = 16 * 1024 * 1024 * 1024;

/// A plugin id: lowercase words joined by dashes (as the compiler and the loader require).
pub fn good_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.starts_with(|c: char| c.is_ascii_lowercase())
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// A file name: letters, digits, dot, dash and underscore, not starting with a dot.
pub fn good_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 128 && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

/// The plugin's folder (not made).
pub fn folder(root: &Path, id: &str) -> Result<PathBuf, String> {
    if !good_id(id) { return Err(format!("not a plugin id: {id}")) }
    Ok(root.join(id))
}

/// One of its files (not made).
pub fn file(root: &Path, id: &str, name: &str) -> Result<PathBuf, String> {
    if !good_name(name) { return Err(format!("not a file name: {name}")) }
    Ok(folder(root, id)?.join(name))
}

/// Its files as (name, bytes), by name.
pub fn list(root: &Path, id: &str) -> Result<Vec<(String, u64)>, String> {
    let dir = folder(root, id)?;
    let Ok(entries) = fs::read_dir(&dir) else { return Ok(vec![]) };
    let mut out: Vec<(String, u64)> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| { let m = e.metadata().ok()?; m.is_file().then(|| (e.file_name().to_string_lossy().into_owned(), m.len())) })
        .collect();
    out.sort();
    Ok(out)
}

/// What it keeps, in bytes.
pub fn used(root: &Path, id: &str) -> Result<u64, String> {
    Ok(list(root, id)?.iter().map(|(_, n)| n).sum())
}

/// Writes (or, with `append`, adds to) one of its files, unless that would take it over `quota`
/// bytes. Returns what it keeps afterwards.
pub fn write(root: &Path, id: &str, name: &str, bytes: &[u8], append: bool, quota: u64) -> Result<u64, String> {
    let path = file(root, id, name)?;
    let before = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let others = used(root, id)? - before;
    let after = others + if append { before } else { 0 } + bytes.len() as u64;
    if after > quota.min(MOST) {
        return Err(format!("over its quota: it would keep {} MB of {} MB", after / 1_048_576, quota.min(MOST) / 1_048_576));
    }
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let mut f = fs::OpenOptions::new().create(true).write(true).append(append).truncate(!append).open(&path).map_err(|e| e.to_string())?;
    f.write_all(bytes).map_err(|e| e.to_string())?;
    Ok(after)
}

/// One of its files, or None.
pub fn read(root: &Path, id: &str, name: &str) -> Result<Option<Vec<u8>>, String> {
    let path = file(root, id, name)?;
    match fs::read(&path) {
        Ok(b) => Ok(Some(b)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Takes one file away (true when it was there).
pub fn delete(root: &Path, id: &str, name: &str) -> Result<bool, String> {
    let path = file(root, id, name)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Takes all its files away.
pub fn clear(root: &Path, id: &str) -> Result<(), String> {
    let dir = folder(root, id)?;
    match fs::remove_dir_all(&dir) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        let p = std::env::temp_dir().join(format!("traum-store-{}-{:?}", std::process::id(), std::thread::current().id()));
        let _ = fs::remove_dir_all(&p);
        p
    }

    #[test]
    fn names_and_ids_stay_inside_the_folder() {
        assert!(good_id("provoke") && good_id("word-count2"));
        assert!(!good_id("") && !good_id("../x") && !good_id("Provoke") && !good_id("a/b"));
        assert!(good_name("model.gguf") && good_name("nomic_embed-1.5.bin"));
        assert!(!good_name("..") && !good_name(".hidden") && !good_name("a/b") && !good_name("a\\b") && !good_name("c:x"));
        assert!(file(Path::new("/r"), "p", "../../x").is_err());
    }

    #[test]
    fn write_read_append_list_delete_clear() {
        let r = root();
        assert_eq!(list(&r, "p").unwrap(), vec![]);
        assert_eq!(write(&r, "p", "a.bin", b"hello", false, 100).unwrap(), 5);
        assert_eq!(write(&r, "p", "a.bin", b" world", true, 100).unwrap(), 11);
        assert_eq!(read(&r, "p", "a.bin").unwrap().unwrap(), b"hello world");
        assert_eq!(write(&r, "p", "b.bin", b"xy", false, 100).unwrap(), 13);
        assert_eq!(list(&r, "p").unwrap(), vec![("a.bin".into(), 11), ("b.bin".into(), 2)]);
        assert_eq!(write(&r, "p", "a.bin", b"new", false, 100).unwrap(), 5, "a rewrite counts once");
        assert!(delete(&r, "p", "b.bin").unwrap());
        assert!(!delete(&r, "p", "b.bin").unwrap());
        assert_eq!(read(&r, "p", "b.bin").unwrap(), None);
        clear(&r, "p").unwrap();
        assert_eq!(used(&r, "p").unwrap(), 0);
        let _ = fs::remove_dir_all(&r);
    }

    #[test]
    fn the_quota_holds() {
        let r = root();
        write(&r, "q", "a", &[0; 60], false, 100).unwrap();
        assert!(write(&r, "q", "b", &[0; 50], false, 100).unwrap_err().contains("quota"));
        assert!(write(&r, "q", "a", &[0; 50], true, 100).is_err());
        assert_eq!(write(&r, "q", "a", &[0; 100], false, 100).unwrap(), 100, "replacing may use the whole quota");
        assert_eq!(read(&r, "q", "b").unwrap(), None, "nothing written when refused");
        let _ = fs::remove_dir_all(&r);
    }
}
