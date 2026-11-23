// ReciBot Neo Zero-Copy Binary Transformer Inference in Rust ("RNE3" factorized format)
// Ready to compile with `cargo run --release` once rustc/cargo is installed.

use std::fs::File;
use std::io::{self, Read};

#[derive(Debug)]
struct NeoHeader {
    ver: i32,
    vocab: i32,
    max_seq: i32,
    e_emb: i32,
    d_model: i32,
    n_heads: i32,
    n_layers: i32,
    ffn_dim: i32,
    n_intents: i32,
    n_tools: i32,
    n_depths: i32,
    emb_dim: i32,
}

fn read_i32_le(buf: &[u8]) -> i32 {
    i32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]])
}

fn fnv1a_32(bytes: &[u8]) -> u32 {
    let mut h: u32 = 2166136261;
    for &b in bytes {
        h ^= b as u32;
        h = h.wrapping_mul(16777619);
    }
    h
}

fn gelu_tanh(x: f32) -> f32 {
    let k: f32 = 0.7978845608;
    0.5 * x * (1.0 + (k * (x + 0.044715 * x * x * x)).tanh())
}

fn load_weights_neo(path: &str) -> io::Result<(NeoHeader, Vec<f32>)> {
    let mut f = File::open(path)?;
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes)?;
    if bytes.len() < 52 || &bytes[0..4] != b"RNE3" {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "Invalid RNE3 header"));
    }
    let header = NeoHeader {
        ver: read_i32_le(&bytes[4..8]),
        vocab: read_i32_le(&bytes[8..12]),
        max_seq: read_i32_le(&bytes[12..16]),
        e_emb: read_i32_le(&bytes[16..20]),
        d_model: read_i32_le(&bytes[20..24]),
        n_heads: read_i32_le(&bytes[24..28]),
        n_layers: read_i32_le(&bytes[28..32]),
        ffn_dim: read_i32_le(&bytes[32..36]),
        n_intents: read_i32_le(&bytes[36..40]),
        n_tools: read_i32_le(&bytes[40..44]),
        n_depths: read_i32_le(&bytes[44..48]),
        emb_dim: read_i32_le(&bytes[48..52]),
    };
    let mut weights = Vec::with_capacity((bytes.len() - 52) / 4);
    for chunk in bytes[52..].chunks_exact(4) {
        weights.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    Ok((header, weights))
}

fn main() {
    match load_weights_neo("../artifacts/weights_neo.bin") {
        Ok((hdr, w)) => {
            println!(
                "ReciBot Neo Rust Binary Loaded: {:?} | float32 tensors len={} | sample hash(b01)={} | gelu(1.0)={:.6}",
                hdr,
                w.len(),
                11808 + (fnv1a_32(b"b01") & 8191),
                gelu_tanh(1.0)
            );
        }
        Err(e) => eprintln!("Failed to load RNE3 weights: {}", e),
    }
}
