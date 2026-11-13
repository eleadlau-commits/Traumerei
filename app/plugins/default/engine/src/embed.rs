//! The `embed` task: thoughts in, one unit-length vector each out (app/core/AI.md, Tasks).
//!
//! The model is a sentence-embedding transformer in ONNX form (all-MiniLM-L6-v2 to start), run by
//! ONNX Runtime on the CPU, with its Hugging Face tokenizer. Which files to load is not decided
//! here: the plugin writes `engine.json` into its store folder (README, "engine.json"), and every
//! file named there is checked against its sha256 before it is used, since the store itself only
//! checks sizes.

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;
use std::sync::Mutex;
use tokenizers::Tokenizer;

/// What engine.json says about the embedder.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct EmbedSpec {
    /// A name for the model, as the plugin calls it (it goes into the answer's cache key there).
    pub name: String,
    /// The ONNX file, in the store folder.
    pub model: String,
    pub model_sha256: String,
    /// The tokenizer.json file, in the store folder.
    pub tokenizer: String,
    pub tokenizer_sha256: String,
    /// "mean" (average of the token vectors) or "cls" (the first token's).
    #[serde(default = "mean")]
    pub pooling: String,
    /// Longer thoughts are cut to this many tokens (the model's own limit).
    #[serde(default = "most_tokens")]
    pub max_tokens: usize,
    /// Put in front of every text (some models want "query: " or similar).
    #[serde(default)]
    pub prefix: String,
    /// How many sessions to run side by side (the plugin picks it by machine tier).
    #[serde(default)]
    pub workers: Option<usize>,
}
fn mean() -> String { "mean".into() }
fn most_tokens() -> usize { 128 }

/// engine.json, format traumerei-engine/1.
#[derive(Deserialize, Debug)]
pub struct Config {
    pub format: String,
    pub embed: Option<EmbedSpec>,
}

pub const FORMAT: &str = "traumerei-engine/1";

impl Config {
    pub fn read(store: &Path) -> Result<Config, String> {
        let text = std::fs::read_to_string(store.join("engine.json"))
            .map_err(|_| "engine.json is not in the plugin's folder yet".to_string())?;
        let c: Config = serde_json::from_str(&text).map_err(|e| format!("engine.json doesn't read: {e}"))?;
        if c.format != FORMAT { return Err(format!("engine.json is {}, this engine reads {FORMAT}", c.format)) }
        Ok(c)
    }
}

/// The sha256 of a file, as 64 lowercase hex digits.
pub fn sha256(path: &Path) -> Result<String, String> {
    let mut f = std::fs::File::open(path).map_err(|_| format!("{} is not there", path.display()))?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break }
        h.update(&buf[..n]);
    }
    Ok(format!("{:x}", h.finalize()))
}

/// A plain file name (as the store allows), so engine.json can't point outside the folder.
fn plain(name: &str) -> Result<&str, String> {
    let ok = !name.is_empty() && name.len() <= 128 && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'));
    if ok { Ok(name) } else { Err(format!("engine.json names a file that isn't a plain file name: {name}")) }
}

fn checked(store: &Path, name: &str, want: &str) -> Result<std::path::PathBuf, String> {
    let path = store.join(plain(name)?);
    let got = sha256(&path)?;
    if !got.eq_ignore_ascii_case(want.trim_start_matches("sha256:")) {
        return Err(format!("{name} doesn't match its checksum (sha256 {got}); it was not loaded"));
    }
    Ok(path)
}

/// Vectors kept (memory.rs), so a room read again costs only its new thoughts: 100,000 of them
/// is about 160 MB of file. Let go of all at once when full.
pub const REMEMBER: usize = 100_000;
/// Thoughts run through the model at once (sorted by length first, so padding stays small).
const BATCH: usize = 32;
/// The most sessions run side by side. One session per core, each on one thread, was measured
/// 25% faster than one session on every core, but each holds its own copy of the model's
/// weights as ONNX Runtime prepares them (about 100 MB for MiniLM), so there are at most four.
const MOST_WORKERS: usize = 4;

pub struct Embedder {
    pub spec: EmbedSpec,
    pub dim: usize,
    sessions: Vec<Mutex<ort::session::Session>>,
    tokenizer: Tokenizer,
    types: bool,
    seen: crate::memory::Memory,
}

/// How many sessions to run: --threads if given, else engine.json's `workers`, else the cores there
/// are; never more than MOST_WORKERS.
pub fn workers(threads: Option<usize>, spec: &EmbedSpec) -> usize {
    threads.or(spec.workers)
        .unwrap_or_else(|| std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1))
        .clamp(1, MOST_WORKERS)
}

impl Embedder {
    pub fn load(env: &ort::environment::Environment, store: &Path, spec: &EmbedSpec, threads: Option<usize>, remember: usize) -> Result<Embedder, String> {
        let model = checked(store, &spec.model, &spec.model_sha256)?;
        let tok = checked(store, &spec.tokenizer, &spec.tokenizer_sha256)?;
        let mut tokenizer = Tokenizer::from_file(&tok).map_err(|e| format!("the tokenizer doesn't read: {e}"))?;
        tokenizer
            .with_truncation(Some(tokenizers::TruncationParams { max_length: spec.max_tokens, ..Default::default() }))
            .map_err(|e| e.to_string())?;
        tokenizer.with_padding(None);
        let e = |e: ort::Error| format!("the model doesn't load: {e}");
        let bytes = std::fs::read(&model).map_err(|x| format!("the model doesn't read: {x}"))?;
        let mut sessions = Vec::new();
        // The sessions share one copy of the weights ONNX Runtime prepares, not one each.
        let shared = ort::session::builder::PrepackedWeights::new();
        for _ in 0..workers(threads, spec) {
            let s = ort::session::Session::builder(env).map_err(e)?
                .with_optimization_level(ort::session::builder::GraphOptimizationLevel::Level3).map_err(|x| e(x.into()))?
                .with_intra_threads(1).map_err(|x| e(x.into()))?
                // No arena and no memory pattern: inputs change size every call, and an arena
                // per session kept growing (300 MB a session after a 1,500-thought room).
                .with_memory_pattern(false).map_err(|x| e(x.into()))?
                .with_prepacked_weights(&shared).map_err(|x| e(x.into()))?
                .with_execution_providers([ort::ep::CPU::default().with_arena_allocator(false).build()]).map_err(|x| e(x.into()))?
                .commit_from_memory(&bytes).map_err(e)?;
            sessions.push(Mutex::new(s));
        }
        let types = sessions[0].lock().unwrap().inputs().iter().any(|i| i.name() == "token_type_ids");
        let mut me = Embedder { spec: spec.clone(), dim: 0, sessions, tokenizer, types, seen: crate::memory::Memory::open(None, "", 0, 0) };
        me.dim = me.run(&["dim".to_string()])?.len();
        let file = store.join(plain(&format!("vectors-{}.bin", spec.name))?);
        me.seen = crate::memory::Memory::open(Some(file), &spec.model_sha256, me.dim, remember);
        Ok(me)
    }

    /// How many vectors are kept for reuse.
    pub fn kept(&self) -> usize { self.seen.len() }

    /// One vector per text, unit length, `dim` numbers each, row by row.
    pub fn embed(&mut self, texts: &[String]) -> Result<Vec<f32>, String> {
        let mut out = vec![0f32; texts.len() * self.dim.max(1)];
        let mut todo: Vec<usize> = Vec::new();
        let keys: Vec<crate::memory::Key> = texts.iter().map(|t| crate::memory::key(t)).collect();
        for (i, k) in keys.iter().enumerate() {
            match self.seen.get(k) {
                Some(v) => out[i * self.dim..(i + 1) * self.dim].copy_from_slice(v),
                None => todo.push(i),
            }
        }
        if todo.is_empty() { return Ok(out) }
        let fresh: Vec<String> = todo.iter().map(|&i| texts[i].clone()).collect();
        let got = self.run(&fresh)?;
        let mut keep = Vec::with_capacity(todo.len());
        for (k, &i) in todo.iter().enumerate() {
            let v = &got[k * self.dim..(k + 1) * self.dim];
            out[i * self.dim..(i + 1) * self.dim].copy_from_slice(v);
            keep.push((keys[i], v));
        }
        self.seen.keep(&keep);
        Ok(out)
    }

    fn run(&self, texts: &[String]) -> Result<Vec<f32>, String> {
        let inputs: Vec<String> = texts.iter().map(|t| format!("{}{}", self.spec.prefix, t)).collect();
        let enc = self.tokenizer.encode_batch(inputs, true).map_err(|e| format!("tokenizing failed: {e}"))?;
        let ids: Vec<&[u32]> = enc.iter().map(|e| e.get_ids()).collect();
        let mut order: Vec<usize> = (0..ids.len()).collect();
        order.sort_by_key(|&i| ids[i].len());
        // Batches of BATCH, or smaller ones so that every worker has one when there are few items.
        let size = BATCH.min(ids.len().div_ceil(self.sessions.len())).max(1);
        let chunks: Vec<&[usize]> = order.chunks(size).collect();
        let w = self.sessions.len().min(chunks.len()).max(1);
        // Worker k takes chunks k, k + w, k + 2w, … on its own session.
        let done: Vec<Result<Vec<(usize, Vec<f32>)>, String>> = std::thread::scope(|scope| {
            let jobs: Vec<_> = (0..w).map(|k| {
                let (chunks, ids, session) = (&chunks, &ids, &self.sessions[k]);
                scope.spawn(move || {
                    let mut s = session.lock().unwrap();
                    let mut got = Vec::new();
                    for chunk in chunks.iter().skip(k).step_by(w) {
                        got.extend(batch(&mut s, self.types, &self.spec.pooling, ids, chunk)?);
                    }
                    Ok(got)
                })
            }).collect();
            jobs.into_iter().map(|j| j.join().unwrap_or_else(|_| Err("a worker failed".into()))).collect()
        });
        let mut rows: Vec<Vec<f32>> = vec![Vec::new(); ids.len()];
        for part in done { for (i, v) in part? { rows[i] = v; } }
        Ok(rows.concat())
    }
}

/// One batch through one session: (item index, unit vector) for each item of the chunk.
fn batch(s: &mut ort::session::Session, types: bool, pooling: &str, ids: &[&[u32]], chunk: &[usize]) -> Result<Vec<(usize, Vec<f32>)>, String> {
    let len = chunk.iter().map(|&i| ids[i].len()).max().unwrap_or(1).max(1);
    let n = chunk.len();
    let (mut input, mut mask) = (vec![0i64; n * len], vec![0i64; n * len]);
    for (r, &i) in chunk.iter().enumerate() {
        for (c, &id) in ids[i].iter().enumerate() {
            input[r * len + c] = id as i64;
            mask[r * len + c] = 1;
        }
    }
    let e = |e: ort::Error| format!("the model failed: {e}");
    let t = |v: Vec<i64>| ort::value::Tensor::from_array(([n, len], v));
    let mut feed = vec![
        ("input_ids".to_string(), ort::session::SessionInputValue::from(t(input).map_err(e)?)),
        ("attention_mask".to_string(), ort::session::SessionInputValue::from(t(mask.clone()).map_err(e)?)),
    ];
    if types {
        feed.push(("token_type_ids".to_string(), ort::session::SessionInputValue::from(t(vec![0i64; n * len]).map_err(e)?)));
    }
    let outputs = s.run(feed).map_err(e)?;
    let (shape, h) = outputs[0].try_extract_tensor::<f32>().map_err(e)?;
    let dim = *shape.last().unwrap_or(&0) as usize;
    if shape.len() != 3 || dim == 0 { return Err(format!("the model answered a shape this engine doesn't read: {shape:?}")) }
    let mut out = Vec::with_capacity(n);
    for (r, &i) in chunk.iter().enumerate() {
        let mut v = vec![0f32; dim];
        if pooling == "cls" {
            v.copy_from_slice(&h[r * len * dim..r * len * dim + dim]);
        } else {
            let mut count = 0f32;
            for c in 0..len {
                if mask[r * len + c] == 0 { continue }
                count += 1.0;
                let at = (r * len + c) * dim;
                for d in 0..dim { v[d] += h[at + d]; }
            }
            for x in v.iter_mut() { *x /= count.max(1.0); }
        }
        let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt().max(1e-12);
        for x in v.iter_mut() { *x /= norm; }
        out.push((i, v));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_names_only() {
        assert!(plain("all-MiniLM-L6-v2.onnx").is_ok());
        assert!(plain("../x").is_err());
        assert!(plain("a/b").is_err());
        assert!(plain(".hidden").is_err());
    }

    #[test]
    fn config_reads_and_checks_its_format() {
        let dir = std::env::temp_dir().join(format!("traum-engine-cfg-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(Config::read(&dir).is_err());
        std::fs::write(dir.join("engine.json"), r#"{"format":"traumerei-engine/9"}"#).unwrap();
        assert!(Config::read(&dir).unwrap_err().contains("traumerei-engine/1"));
        std::fs::write(dir.join("engine.json"), r#"{"format":"traumerei-engine/1","embed":{"name":"m","model":"m.onnx","model_sha256":"x","tokenizer":"t.json","tokenizer_sha256":"y"}}"#).unwrap();
        let c = Config::read(&dir).unwrap();
        let e = c.embed.unwrap();
        assert_eq!((e.pooling.as_str(), e.max_tokens, e.prefix.as_str(), e.workers), ("mean", 128, "", None));
        assert_eq!(workers(Some(9), &e), MOST_WORKERS);
        assert_eq!(workers(None, &EmbedSpec { workers: Some(2), ..e.clone() }), 2);
        assert_eq!(workers(Some(1), &EmbedSpec { workers: Some(3), ..e.clone() }), 1);
        std::fs::write(dir.join("m.onnx"), b"abc").unwrap();
        assert!(checked(&dir, "m.onnx", "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad").is_ok());
        assert!(checked(&dir, "m.onnx", "00").unwrap_err().contains("checksum"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
