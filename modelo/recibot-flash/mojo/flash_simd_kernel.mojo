# ReciBot Flash SIMD-Vectorized Mean/Max Pool + ReLU Kernel in Mojo
# Designed to operate directly on "RFL2" float32 buffers via SIMD<DType.float32, 8>.

alias SIMD_W = 8
alias D_EMB = 8
alias HIDDEN_DIM = 88

@always_inline
fn relu_vec(v: SIMD[DType.float32, SIMD_W]) -> SIMD[DType.float32, SIMD_W]:
    return max(v, SIMD[DType.float32, SIMD_W](0.0))

fn flash_dense_dot(x: UnsafePointer[Float32], w_row: UnsafePointer[Float32], in_dim: Int) -> Float32:
    var acc: Float32 = 0.0
    for i in range(0, in_dim, SIMD_W):
        acc += (x.load[width=SIMD_W](i) * w_row.load[width=SIMD_W](i)).reduce_add()
    return acc

fn main():
    print("ReciBot Flash Mojo SIMD Kernel ready (D_EMB=48, HIDDEN_DIM=72, SIMD_W=8).")
