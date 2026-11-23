# ReciBot Neo Julia Binary Weight Loader & Int8 Quantization SNR Verifier
# Run with: julia modelo/recibot-neo/julia/neo_tensor_verify.jl

using LinearAlgebra

function load_neo_bin(path::String)
    open(path, "r") do io
        magic = String(read(io, 4))
        magic == "RNE2" || error("Invalid magic: $magic")
        hdr = reinterpret(Int32, read(io, 44))
        raw = reinterpret(Float32, read(io))
        return hdr, raw
    end
end

function verify_int8_snr(weights::AbstractVector{Float32})
    max_abs = maximum(abs.(weights))
    scale = max_abs > 1f-12 ? max_abs / 127f0 : 1f0
    q = clamp.(round.(weights ./ scale), -127f0, 127f0)
    deq = q .* scale
    sig_pow = sum(abs2, weights)
    err_pow = sum(abs2, weights .- deq)
    snr_db = 10f0 * log10(sig_pow / max(err_pow, 1f-12))
    return snr_db
end

hdr, raw = load_neo_bin("modelo/recibot-neo/artifacts/weights_neo.bin")
snr = verify_int8_snr(raw)
println("ReciBot Neo Julia Verifier | Header=", collect(hdr), " | Float32 count=", length(raw), " | Int8 Quant SNR(dB)=", round(snr, digits=2))
