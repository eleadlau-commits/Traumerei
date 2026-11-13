//! The vectors the engine has made, kept in memory and in a file in the plugin's store, so a room
//! read again (today, or next week) costs only its new thoughts. Texts are not kept: each vector
//! is filed under the sha256 of its text.
//!
//! File `vectors-<model name>.bin`: the header `TRVC1 <model sha256> <dim>\n`, then records of
//! 32 bytes (the text's sha256) and `dim` little-endian float32s. A header for another model or
//! size, or a cut-off record, starts the file afresh.

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub type Key = [u8; 32];

pub fn key(text: &str) -> Key { Sha256::digest(text.as_bytes()).into() }

pub struct Memory {
    most: usize,
    dim: usize,
    header: Vec<u8>,
    path: Option<PathBuf>,
    map: HashMap<Key, Vec<f32>>,
}

impl Memory {
    /// Up to `most` vectors (0: none, and no file). `path`: the file, or None to keep them in memory only.
    pub fn open(path: Option<PathBuf>, model_sha256: &str, dim: usize, most: usize) -> Memory {
        let header = format!("TRVC1 {} {dim}\n", model_sha256.trim_start_matches("sha256:").to_ascii_lowercase()).into_bytes();
        let mut m = Memory { most, dim, header, path: if most > 0 { path } else { None }, map: HashMap::new() };
        if let Some(p) = m.path.clone() {
            if m.read(&p).is_err() { m.map.clear(); m.restart(); }
        }
        m
    }

    fn read(&mut self, p: &Path) -> Result<(), ()> {
        let mut bytes = Vec::new();
        File::open(p).map_err(|_| ())?.read_to_end(&mut bytes).map_err(|_| ())?;
        if !bytes.starts_with(&self.header) { return Err(()) }
        let rec = 32 + 4 * self.dim;
        let body = &bytes[self.header.len()..];
        if body.len() % rec != 0 { return Err(()) }
        for r in body.chunks_exact(rec) {
            let mut k = [0u8; 32];
            k.copy_from_slice(&r[..32]);
            let v = r[32..].chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect();
            self.map.insert(k, v);
        }
        if self.map.len() > self.most { self.map.clear(); return Err(()) }
        Ok(())
    }

    /// An empty file with just the header (or nothing, when kept in memory only).
    fn restart(&mut self) {
        if let Some(p) = &self.path {
            if let Ok(mut f) = File::create(p) { let _ = f.write_all(&self.header); }
        }
    }

    pub fn len(&self) -> usize { self.map.len() }

    pub fn get(&self, k: &Key) -> Option<&Vec<f32>> { self.map.get(k) }

    /// Keeps these vectors (in memory and at the end of the file). When they would pass `most`,
    /// everything kept so far is let go first.
    pub fn keep(&mut self, rows: &[(Key, &[f32])]) {
        if self.most == 0 || rows.is_empty() { return }
        if self.map.len() + rows.len() > self.most { self.map.clear(); self.restart(); }
        let mut out = Vec::with_capacity(rows.len() * (32 + 4 * self.dim));
        for (k, v) in rows {
            if v.len() != self.dim || self.map.contains_key(k) { continue }
            out.extend_from_slice(k);
            for x in v.iter() { out.extend_from_slice(&x.to_le_bytes()); }
            self.map.insert(*k, v.to_vec());
        }
        if let Some(p) = &self.path {
            if let Ok(mut f) = OpenOptions::new().append(true).open(p) { let _ = f.write_all(&out); }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_vectors_across_opens_and_starts_afresh_for_another_model() {
        let dir = std::env::temp_dir().join(format!("traum-engine-mem-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("vectors-m.bin");
        let _ = std::fs::remove_file(&p);
        let mut m = Memory::open(Some(p.clone()), "ab", 2, 10);
        m.keep(&[(key("bread"), &[0.6, 0.8]), (key("logic"), &[1.0, 0.0])]);
        assert_eq!(m.len(), 2);
        let again = Memory::open(Some(p.clone()), "AB", 2, 10);
        assert_eq!(again.get(&key("bread")), Some(&vec![0.6, 0.8]));
        assert_eq!(again.get(&key("soup")), None);
        let other = Memory::open(Some(p.clone()), "cd", 2, 10);
        assert_eq!(other.len(), 0);
        assert_eq!(Memory::open(Some(p.clone()), "cd", 2, 10).len(), 0);
        // Past `most`, it lets go of what it had.
        let mut small = Memory::open(Some(p.clone()), "cd", 2, 2);
        small.keep(&[(key("a"), &[1.0, 0.0]), (key("b"), &[0.0, 1.0])]);
        small.keep(&[(key("c"), &[1.0, 0.0])]);
        assert_eq!(small.len(), 1);
        assert_eq!(Memory::open(Some(p.clone()), "cd", 2, 2).len(), 1);
        // A cut-off file starts afresh.
        let mut bytes = std::fs::read(&p).unwrap();
        bytes.pop();
        std::fs::write(&p, bytes).unwrap();
        assert_eq!(Memory::open(Some(p.clone()), "cd", 2, 2).len(), 0);
        // Nothing kept at all with most 0.
        let mut none = Memory::open(Some(dir.join("none.bin")), "cd", 2, 0);
        none.keep(&[(key("a"), &[1.0, 0.0])]);
        assert_eq!(none.len(), 0);
        assert!(!dir.join("none.bin").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
