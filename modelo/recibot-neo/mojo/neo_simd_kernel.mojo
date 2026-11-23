# ReciBot Neo SIMD-Vectorized LayerNorm + GELU Transformer Kernel in Mojo
# Designed to operate directly on "RNE2" float32 buffers via SIMD<DType.float32, 8>.

from math import sqrt, tanh
from sys.info import simdwidthof

alias SIMD_W = 8
alias D_MODEL = 112

@always_inline
fn gelu_tanh_scalar(x: Float32) -> Float32:
    var k: Float32 = 0.79788456
    return 0.5 * x * (1.0 + tanh(k * (x + 0.044715 * x * x * x)))

fn layernorm_row_simd(x: UnsafePointer[Float32], w: UnsafePointer[Float32], b: UnsafePointer[Float32], out: UnsafePointer[Float32]):
    var mean: Float32 = 0.0
    for d in range(0, D_MODEL, SIMD_W):
        mean += x.load[width=SIMD_W](d).reduce_add()
    mean /= Float32(D_MODEL)

    var var_sum: Float32 = 0.0
    for d in range(0, D_MODEL, SIMD_W):
        var diff = x.load[width=SIMD_W](d) - mean
        var_sum += (diff * diff).reduce_add()

    var inv_std: Float32 = 1.0 / sqrt(var_sum / Float32(D_MODEL) + 1e-5)
    for d in range(0, D_MODEL, SIMD_W):
        var xv = x.load[width=SIMD_W](d)
        var wv = w.load[width=SIMD_W](d)
        var bv = b.load[width=SIMD_W](d)
        out.store[width=SIMD_W](d, ((xv - mean) * inv_std) * wv + bv)

fn main():
    print("ReciBot Neo Mojo SIMD Kernel ready (D_MODEL=112, SIMD_W=8).")
