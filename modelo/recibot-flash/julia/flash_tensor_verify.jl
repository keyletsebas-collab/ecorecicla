# ReciBot Flash Julia Binary Weight Loader & Compression Analyzer
# Run with: julia modelo/recibot-flash/julia/flash_tensor_verify.jl

function load_flash_bin(path::String)
    open(path, "r") do io
        magic = String(read(io, 4))
        magic == "RFL2" || error("Invalid magic: $magic")
        hdr = reinterpret(Int32, read(io, 32))
        raw = reinterpret(Float32, read(io))
        return hdr, raw
    end
end

hdr, raw = load_flash_bin("modelo/recibot-flash/artifacts/weights_flash.bin")
println("ReciBot Flash Julia Verifier | Header=", collect(hdr), " | Float32 count=", length(raw))
