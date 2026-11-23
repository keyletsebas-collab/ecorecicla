// ReciBot Neo C++17 Transformer Inference Engine (Binary "RNE3" Factorized Embeddings)
// Executes exact UTF-8 accent-folding + domain vocab/FNV-1a tokenizer + Factorized 20k->14->112 + 2-Layer Multi-Head Attention + GELU + Multi-Task Heads.

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

struct NeoWeights {
    int32_t ver = 0, vocab = 0, max_seq = 0, e_emb = 0, d_model = 0, n_heads = 0, n_layers = 0;
    int32_t ffn_dim = 0, n_intents = 0, n_tools = 0, n_depths = 0, emb_dim = 0;
    std::vector<float> tok_emb, tok_proj, pos_emb;
    struct Layer {
        std::vector<float> ln1_w, ln1_b, wq_w, wq_b, wk_w, wk_b, wv_w, wv_b, wo_w, wo_b;
        std::vector<float> ln2_w, ln2_b, ffn1_w, ffn1_b, ffn2_w, ffn2_b;
    };
    std::vector<Layer> layers;
    std::vector<float> norm_out_w, norm_out_b;
    std::vector<float> intent_w, intent_b, tool_w, tool_b, depth_w, depth_b, embed_w, embed_b;
};

static bool read_floats(std::ifstream& in, std::vector<float>& dst, size_t n) {
    dst.resize(n);
    return static_cast<bool>(in.read(reinterpret_cast<char*>(dst.data()), static_cast<std::streamsize>(n * sizeof(float))));
}

static bool load_neo_weights(const std::string& path, NeoWeights& w) {
    std::ifstream in(path, std::ios::binary);
    if (!in) return false;
    char magic[4] = {0};
    in.read(magic, 4);
    if (std::memcmp(magic, "RNE3", 4) != 0) return false;
    int32_t hdr[12] = {0};
    in.read(reinterpret_cast<char*>(hdr), sizeof(hdr));
    w.ver = hdr[0]; w.vocab = hdr[1]; w.max_seq = hdr[2]; w.e_emb = hdr[3]; w.d_model = hdr[4];
    w.n_heads = hdr[5]; w.n_layers = hdr[6]; w.ffn_dim = hdr[7];
    w.n_intents = hdr[8]; w.n_tools = hdr[9]; w.n_depths = hdr[10]; w.emb_dim = hdr[11];

    size_t E = static_cast<size_t>(w.e_emb);
    size_t D = static_cast<size_t>(w.d_model);
    size_t F = static_cast<size_t>(w.ffn_dim);
    read_floats(in, w.tok_emb, static_cast<size_t>(w.vocab) * E);
    read_floats(in, w.tok_proj, D * E);
    read_floats(in, w.pos_emb, static_cast<size_t>(w.max_seq) * D);
    w.layers.resize(w.n_layers);
    for (int i = 0; i < w.n_layers; ++i) {
        auto& L = w.layers[i];
        read_floats(in, L.ln1_w, D); read_floats(in, L.ln1_b, D);
        read_floats(in, L.wq_w, D * D); read_floats(in, L.wq_b, D);
        read_floats(in, L.wk_w, D * D); read_floats(in, L.wk_b, D);
        read_floats(in, L.wv_w, D * D); read_floats(in, L.wv_b, D);
        read_floats(in, L.wo_w, D * D); read_floats(in, L.wo_b, D);
        read_floats(in, L.ln2_w, D); read_floats(in, L.ln2_b, D);
        read_floats(in, L.ffn1_w, F * D); read_floats(in, L.ffn1_b, F);
        read_floats(in, L.ffn2_w, D * F); read_floats(in, L.ffn2_b, D);
    }
    read_floats(in, w.norm_out_w, D); read_floats(in, w.norm_out_b, D);
    read_floats(in, w.intent_w, static_cast<size_t>(w.n_intents) * D); read_floats(in, w.intent_b, w.n_intents);
    read_floats(in, w.tool_w, static_cast<size_t>(w.n_tools) * D); read_floats(in, w.tool_b, w.n_tools);
    read_floats(in, w.depth_w, static_cast<size_t>(w.n_depths) * D); read_floats(in, w.depth_b, w.n_depths);
    read_floats(in, w.embed_w, static_cast<size_t>(w.emb_dim) * D); read_floats(in, w.embed_b, w.emb_dim);
    return static_cast<bool>(in);
}

static std::string read_file_str(const std::string& path) {
    std::ifstream in(path);
    std::ostringstream ss;
    ss << in.rdbuf();
    return ss.str();
}

static std::unordered_map<std::string, int> load_word_to_id(const std::string& vocab_json_path) {
    std::unordered_map<std::string, int> mp;
    std::string s = read_file_str(vocab_json_path);
    size_t pos = s.find("\"word_to_id\"");
    if (pos == std::string::npos) return mp;
    size_t start = s.find('{', pos);
    size_t end = s.find('}', start);
    if (start == std::string::npos || end == std::string::npos) return mp;
    size_t i = start + 1;
    while (i < end) {
        size_t q1 = s.find('"', i);
        if (q1 == std::string::npos || q1 >= end) break;
        size_t q2 = s.find('"', q1 + 1);
        if (q2 == std::string::npos || q2 >= end) break;
        std::string key = s.substr(q1 + 1, q2 - q1 - 1);
        size_t colon = s.find(':', q2);
        if (colon == std::string::npos || colon >= end) break;
        size_t val_start = colon + 1;
        while (val_start < end && !std::isdigit(static_cast<unsigned char>(s[val_start]))) ++val_start;
        size_t val_end = val_start;
        while (val_end < end && std::isdigit(static_cast<unsigned char>(s[val_end]))) ++val_end;
        if (val_start < val_end) {
            mp[key] = std::stoi(s.substr(val_start, val_end - val_start));
        }
        i = val_end;
    }
    return mp;
}

static std::vector<std::string> load_intents(const std::string& tax_json_path) {
    std::vector<std::string> out;
    std::string s = read_file_str(tax_json_path);
    size_t intents_pos = s.find("\n  \"intents\":");
    size_t pos = (intents_pos != std::string::npos) ? intents_pos : 0;
    size_t tools_pos = s.find("\n  \"tools\":");
    if (tools_pos == std::string::npos) tools_pos = s.size();
    while ((pos = s.find("\"name\": \"", pos)) != std::string::npos && pos < tools_pos) {
        pos += 9;
        size_t end = s.find('"', pos);
        if (end != std::string::npos) out.push_back(s.substr(pos, end - pos));
    }
    return out;
}

static int load_json_int_field(const std::string& json_path, const std::string& field, int fallback) {
    std::string s = read_file_str(json_path);
    std::string pat = "\"" + field + "\"";
    size_t pos = s.find(pat);
    if (pos == std::string::npos) return fallback;
    size_t colon = s.find(':', pos + pat.size());
    if (colon == std::string::npos) return fallback;
    size_t i = colon + 1;
    while (i < s.size() && !std::isdigit(static_cast<unsigned char>(s[i]))) ++i;
    size_t j = i;
    while (j < s.size() && std::isdigit(static_cast<unsigned char>(s[j]))) ++j;
    return (i < j) ? std::stoi(s.substr(i, j - i)) : fallback;
}

static char fold_utf8_c3(uint8_t b2) {
    switch (b2) {
        case 0xA1: case 0x81: case 0xA0: case 0x80: case 0xA4: case 0x84: case 0xA2: case 0x82: return 'a';
        case 0xA9: case 0x89: case 0xA8: case 0x88: case 0xAB: case 0x8B: case 0xAA: case 0x8A: return 'e';
        case 0xAD: case 0x8D: case 0xAC: case 0x8C: case 0xAF: case 0x8F: case 0xAE: case 0x8E: return 'i';
        case 0xB3: case 0x93: case 0xB2: case 0x92: case 0xB6: case 0x96: case 0xB4: case 0x94: return 'o';
        case 0xBA: case 0x9A: case 0xB9: case 0x99: case 0xBC: case 0x9C: case 0xBB: case 0x9B: return 'u';
        case 0xB1: case 0x91: return 'n';
        case 0xA7: case 0x87: return 'c';
        default: return ' ';
    }
}

static uint32_t fnv1a_32(const std::string& s) {
    uint32_t h = 2166136261u;
    for (uint8_t b : s) {
        h ^= b;
        h *= 16777619u;
    }
    return h;
}

static void encode_query(const std::string& text, const std::unordered_map<std::string, int>& w2i, int max_seq,
                         int oov_start, int oov_buckets, std::vector<int>& ids, std::vector<int>& mask) {
    std::string norm;
    norm.reserve(text.size());
    const uint8_t* raw = reinterpret_cast<const uint8_t*>(text.data());
    for (size_t i = 0; i < text.size(); ++i) {
        uint8_t b = raw[i];
        if (b == 0xC3 && i + 1 < text.size()) {
            norm.push_back(fold_utf8_c3(raw[i + 1]));
            ++i;
            continue;
        }
        if (b >= 'A' && b <= 'Z') norm.push_back(static_cast<char>(b + 32));
        else if ((b >= 'a' && b <= 'z') || (b >= '0' && b <= '9')) norm.push_back(static_cast<char>(b));
        else norm.push_back(' ');
    }

    ids.assign(max_seq, 0);
    mask.assign(max_seq, 0);
    ids[0] = 2; // <CLS>
    mask[0] = 1;
    int len = 1;
    uint32_t oov_mask = static_cast<uint32_t>(std::max(1, oov_buckets) - 1);
    std::istringstream iss(norm);
    std::string tok;
    while (iss >> tok) {
        if (len >= max_seq - 1) break;
        auto it = w2i.find(tok);
        int tid = (it != w2i.end()) ? it->second : (oov_start + static_cast<int>(fnv1a_32(tok) & oov_mask));
        ids[len] = tid;
        mask[len] = 1;
        ++len;
    }
    if (len < max_seq) {
        ids[len] = 3; // <SEP>
        mask[len] = 1;
    }
}

static inline float gelu_tanh(float x) {
    constexpr float k = 0.7978845608028654f; // sqrt(2/pi)
    float inner = k * (x + 0.044715f * x * x * x);
    return 0.5f * x * (1.0f + std::tanh(inner));
}

static void layernorm_seq(const float* in, const float* w, const float* b, float* out, int T, int D) {
    for (int t = 0; t < T; ++t) {
        const float* row = in + t * D;
        float* orow = out + t * D;
        float mean = 0.0f;
        for (int d = 0; d < D; ++d) mean += row[d];
        mean /= static_cast<float>(D);
        float var = 0.0f;
        for (int d = 0; d < D; ++d) {
            float diff = row[d] - mean;
            var += diff * diff;
        }
        float inv_std = 1.0f / std::sqrt(var / static_cast<float>(D) + 1e-5f);
        for (int d = 0; d < D; ++d) {
            orow[d] = ((row[d] - mean) * inv_std) * w[d] + b[d];
        }
    }
}

static void linear_proj(const float* in, const float* W, const float* b, float* out, int T, int in_d, int out_d) {
    for (int t = 0; t < T; ++t) {
        const float* x = in + t * in_d;
        float* y = out + t * out_d;
        for (int o = 0; o < out_d; ++o) {
            const float* wrow = W + o * in_d;
            float acc = b[o];
            for (int i = 0; i < in_d; ++i) acc += x[i] * wrow[i];
            y[o] = acc;
        }
    }
}

struct NeoPrediction {
    int intent_id;
    float confidence;
    int depth_id;
};

static NeoPrediction infer_neo(const NeoWeights& w, const std::vector<int>& ids, const std::vector<int>& mask) {
    const int T = w.max_seq;
    const int E = w.e_emb;
    const int D = w.d_model;
    const int H = w.n_heads;
    const int HD = D / H;
    const int F = w.ffn_dim;
    const float inv_sqrt_hd = 1.0f / std::sqrt(static_cast<float>(HD));

    std::vector<float> x(T * D), xn(T * D), Q(T * D), K(T * D), V(T * D), attn_cat(T * D), proj_out(T * D);
    std::vector<float> ff1(T * F), ff2(T * D);
    std::vector<float> scores(T);

    for (int t = 0; t < T; ++t) {
        int tid = ids[t];
        const float* emb_row = &w.tok_emb[tid * E];
        for (int d = 0; d < D; ++d) {
            const float* proj_row = &w.tok_proj[d * E];
            float acc = 0.0f;
            for (int e = 0; e < E; ++e) acc += emb_row[e] * proj_row[e];
            x[t * D + d] = acc + w.pos_emb[t * D + d];
        }
    }

    for (int l = 0; l < w.n_layers; ++l) {
        const auto& L = w.layers[l];
        layernorm_seq(x.data(), L.ln1_w.data(), L.ln1_b.data(), xn.data(), T, D);
        linear_proj(xn.data(), L.wq_w.data(), L.wq_b.data(), Q.data(), T, D, D);
        linear_proj(xn.data(), L.wk_w.data(), L.wk_b.data(), K.data(), T, D, D);
        linear_proj(xn.data(), L.wv_w.data(), L.wv_b.data(), V.data(), T, D, D);

        for (int t1 = 0; t1 < T; ++t1) {
            for (int h = 0; h < H; ++h) {
                int off = h * HD;
                const float* qvec = Q.data() + t1 * D + off;
                float max_s = -1e9f;
                for (int t2 = 0; t2 < T; ++t2) {
                    if (mask[t2] == 0) {
                        scores[t2] = -1e9f;
                    } else {
                        const float* kvec = K.data() + t2 * D + off;
                        float dot = 0.0f;
                        for (int k = 0; k < HD; ++k) dot += qvec[k] * kvec[k];
                        scores[t2] = dot * inv_sqrt_hd;
                    }
                    if (scores[t2] > max_s) max_s = scores[t2];
                }
                float sum_e = 0.0f;
                for (int t2 = 0; t2 < T; ++t2) {
                    scores[t2] = std::exp(scores[t2] - max_s);
                    sum_e += scores[t2];
                }
                float inv_e = 1.0f / sum_e;
                float* out_vec = attn_cat.data() + t1 * D + off;
                for (int k = 0; k < HD; ++k) out_vec[k] = 0.0f;
                for (int t2 = 0; t2 < T; ++t2) {
                    float wt = scores[t2] * inv_e;
                    const float* vvec = V.data() + t2 * D + off;
                    for (int k = 0; k < HD; ++k) out_vec[k] += wt * vvec[k];
                }
            }
        }
        linear_proj(attn_cat.data(), L.wo_w.data(), L.wo_b.data(), proj_out.data(), T, D, D);
        for (size_t i = 0; i < x.size(); ++i) x[i] += proj_out[i];

        layernorm_seq(x.data(), L.ln2_w.data(), L.ln2_b.data(), xn.data(), T, D);
        linear_proj(xn.data(), L.ffn1_w.data(), L.ffn1_b.data(), ff1.data(), T, D, F);
        for (size_t i = 0; i < ff1.size(); ++i) ff1[i] = gelu_tanh(ff1[i]);
        linear_proj(ff1.data(), L.ffn2_w.data(), L.ffn2_b.data(), ff2.data(), T, F, D);
        for (size_t i = 0; i < x.size(); ++i) x[i] += ff2[i];
    }

    layernorm_seq(x.data(), w.norm_out_w.data(), w.norm_out_b.data(), xn.data(), T, D);
    int active_cnt = 0;
    for (int t = 0; t < T; ++t) active_cnt += mask[t];
    float inv_cnt = 1.0f / std::max(1, active_cnt);

    std::vector<float> pooled(D, 0.0f);
    for (int d = 0; d < D; ++d) {
        float sum_m = 0.0f;
        for (int t = 0; t < T; ++t) {
            if (mask[t]) sum_m += xn[t * D + d];
        }
        pooled[d] = 0.5f * xn[d] + 0.5f * (sum_m * inv_cnt);
    }

    std::vector<float> ilogits(w.n_intents);
    linear_proj(pooled.data(), w.intent_w.data(), w.intent_b.data(), ilogits.data(), 1, D, w.n_intents);
    int best_i = 0;
    float max_l = ilogits[0];
    for (int i = 1; i < w.n_intents; ++i) {
        if (ilogits[i] > max_l) { max_l = ilogits[i]; best_i = i; }
    }
    float se = 0.0f;
    for (int i = 0; i < w.n_intents; ++i) se += std::exp(ilogits[i] - max_l);
    float conf = 1.0f / se;

    std::vector<float> dlogits(w.n_depths);
    linear_proj(pooled.data(), w.depth_w.data(), w.depth_b.data(), dlogits.data(), 1, D, w.n_depths);
    int best_d = 0;
    for (int i = 1; i < w.n_depths; ++i) {
        if (dlogits[i] > dlogits[best_d]) best_d = i;
    }

    return {best_i, conf, best_d};
}

int main() {
    const std::string bin_path = "modelo/recibot-neo/artifacts/weights_neo.bin";
    const std::string vocab_path = "modelo/shared/vocab.json";
    const std::string tax_path = "modelo/shared/taxonomy.json";

    NeoWeights w;
    if (!load_neo_weights(bin_path, w)) {
        std::cerr << "Error cargando pesos binarios de " << bin_path << "\n";
        return 1;
    }
    auto w2i = load_word_to_id(vocab_path);
    int oov_start = load_json_int_field(vocab_path, "oov_bucket_start", 11808);
    int oov_buckets = load_json_int_field(vocab_path, "oov_num_buckets", 8192);
    auto intents = load_intents(tax_path);

    const std::vector<std::string> tests = {
        "quien eres y cuantos parametros tienes",
        "revisa toda mi empresa y dime si tengo secuencias ncf vencidas",
        "ver los datos de todas las sucursales en historial",
        "activar en ajustes los botones del centro de control android",
        "si un cliente devuelve mercancia a los 45 dias pierdo el itbis en b04",
        "si abro dos sucursales necesito otro rnc o uso el mismo de la empresa",
        "que riesgos legales tengo si compro cobre en efectivo sin cedula ley 155 17",
    };

    std::vector<int> ids, mask;
    std::cout << "=== RECIBOT NEO C++17 TRANSFORMER INFERENCE ===" << std::endl;
    for (const auto& q : tests) {
        encode_query(q, w2i, w.max_seq, oov_start, oov_buckets, ids, mask);
        auto pred = infer_neo(w, ids, mask);
        std::string iname = (pred.intent_id < static_cast<int>(intents.size())) ? intents[pred.intent_id] : "?";
        std::cout << " - Query: \"" << q << "\" -> intent=" << iname
                  << " conf=" << std::fixed << std::setprecision(4) << pred.confidence
                  << " depth=" << pred.depth_id << "\n";
    }

    encode_query(tests[0], w2i, w.max_seq, oov_start, oov_buckets, ids, mask);
    auto t0 = std::chrono::high_resolution_clock::now();
    volatile int sink = 0;
    for (int i = 0; i < 500; ++i) {
        sink += infer_neo(w, ids, mask).intent_id;
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    double us_per_q = std::chrono::duration<double, std::micro>(t1 - t0).count() / 500.0;
    std::cout << "CPP_NEO_AVG_LATENCY_US: " << std::fixed << std::setprecision(2) << us_per_q << "\n";
    return 0;
}
