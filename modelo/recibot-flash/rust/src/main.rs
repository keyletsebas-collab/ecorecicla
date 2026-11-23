// ReciBot Flash Distilled Binary Inference in Rust ("RFL2" format)
// Ready to compile with `cargo run --release` once rustc/cargo is installed.

use std::fs::File;
use std::io::{self, Read};

#[derive(Debug)]
struct FlashHeader {
    ver: i32,
    vocab: i32,
    max_seq: i32,
    d_emb: i32,
    hidden: i32,
    n_intents: i32,
    n_tools: i32,
    emb_dim: i32,
}

fn read_i32_le(buf: &[u8]) -> i32 {
    i32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]])
}

fn load_weights_flash(path: &str) -> io::Result<(FlashHeader, Vec<f32>)> {
    let mut f = File::open(path)?;
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes)?;
    if bytes.len() < 36 || &bytes[0..4] != b"RFL2" {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "Invalid RFL2 header"));
    }
    let header = FlashHeader {
        ver: read_i32_le(&bytes[4..8]),
        vocab: read_i32_le(&bytes[8..12]),
        max_seq: read_i32_le(&bytes[12..16]),
        d_emb: read_i32_le(&bytes[16..20]),
        hidden: read_i32_le(&bytes[20..24]),
        n_intents: read_i32_le(&bytes[24..28]),
        n_tools: read_i32_le(&bytes[28..32]),
        emb_dim: read_i32_le(&bytes[32..36]),
    };
    let mut weights = Vec::with_capacity((bytes.len() - 36) / 4);
    for chunk in bytes[36..].chunks_exact(4) {
        weights.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    Ok((header, weights))
}

fn main() {
    match load_weights_flash("../artifacts/weights_flash.bin") {
        Ok((hdr, w)) => println!("ReciBot Flash Rust Binary Loaded: {:?} | float32 count={}", hdr, w.len()),
        Err(e) => eprintln!("Failed to load RFL2 weights: {}", e),
    }
}
