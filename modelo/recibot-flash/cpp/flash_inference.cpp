// ReciBot Flash C++17 Distilled Fast Inference Engine (Binary "RFL2")
// Mean+Max Pool + ReLU Dense -> Direct Intent Routing (ultra-low latency)

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

struct FlashWeights {
    int32_t ver = 0, vocab = 0, max_seq = 0, d_emb = 0, hidden = 0, n_intents = 0, n_tools = 0, emb_dim = 0;
    std::vector<float> tok_emb, fc1_w, fc1_b, intent_w, intent_b, tool_w, tool_b, embed_w, embed_b;
};

static bool read_floats(std::ifstream& in, std::vector<float>& dst, size_t n) {
    dst.resize(n);
    return static_cast<bool>(in.read(reinterpret_cast<char*>(dst.data()), static_cast<std::streamsize>(n * sizeof(float))));
}

static bool load_flash_weights(const std::string& path, FlashWeights& w) {
    std::ifstream in(path, std::ios::binary);
    if (!in) return false;
    char magic[4] = {0};
    in.read(magic, 4);
    if (std::memcmp(magic, "RFL2", 4) != 0) return false;
    int32_t hdr[8] = {0};
    in.read(reinterpret_cast<char*>(hdr), sizeof(hdr));
    w.ver = hdr[0]; w.vocab = hdr[1]; w.max_seq = hdr[2]; w.d_emb = hdr[3];
    w.hidden = hdr[4]; w.n_intents = hdr[5]; w.n_tools = hdr[6]; w.emb_dim = hdr[7];

    size_t D = static_cast<size_t>(w.d_emb);
    size_t H = static_cast<size_t>(w.hidden);
    read_floats(in, w.tok_emb, static_cast<size_t>(w.vocab) * D);
    read_floats(in, w.fc1_w, H * (2 * D)); read_floats(in, w.fc1_b, H);
    read_floats(in, w.intent_w, static_cast<size_t>(w.n_intents) * H); read_floats(in, w.intent_b, w.n_intents);
    read_floats(in, w.tool_w, static_cast<size_t>(w.n_tools) * H); read_floats(in, w.tool_b, w.n_tools);
    read_floats(in, w.embed_w, static_cast<size_t>(w.emb_dim) * H); read_floats(in, w.embed_b, w.emb_dim);
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
    size_t start = s.find('{', pos), end = s.find('}', start);
    if (start == std::string::npos || end == std::string::npos) return mp;
    size_t i = start + 1;
    while (i < end) {
        size_t q1 = s.find('"', i); if (q1 == std::string::npos || q1 >= end) break;
        size_t q2 = s.find('"', q1 + 1); if (q2 == std::string::npos || q2 >= end) break;
        std::string key = s.substr(q1 + 1, q2 - q1 - 1);
        size_t vs = s.find(':', q2); if (vs == std::string::npos || vs >= end) break;
        ++vs;
        while (vs < end && !std::isdigit(static_cast<unsigned char>(s[vs]))) ++vs;
        size_t ve = vs;
        while (ve < end && std::isdigit(static_cast<unsigned char>(s[ve]))) ++ve;
        if (vs < ve) mp[key] = std::stoi(s.substr(vs, ve - vs));
        i = ve;
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
    for (uint8_t b : s) { h ^= b; h *= 16777619u; }
    return h;
}

static int encode_query(const std::string& text, const std::unordered_map<std::string, int>& w2i, int max_seq,
                        int oov_start, int oov_buckets, std::vector<int>& ids) {
    std::string norm;
    norm.reserve(text.size());
    const uint8_t* raw = reinterpret_cast<const uint8_t*>(text.data());
    for (size_t i = 0; i < text.size(); ++i) {
        uint8_t b = raw[i];
        if (b == 0xC3 && i + 1 < text.size()) { norm.push_back(fold_utf8_c3(raw[++i])); continue; }
        if (b >= 'A' && b <= 'Z') norm.push_back(static_cast<char>(b + 32));
        else if ((b >= 'a' && b <= 'z') || (b >= '0' && b <= '9')) norm.push_back(static_cast<char>(b));
        else norm.push_back(' ');
    }
    ids.assign(max_seq, 0);
    ids[0] = 2;
    int len = 1;
    uint32_t oov_mask = static_cast<uint32_t>(std::max(1, oov_buckets) - 1);
    std::istringstream iss(norm);
    std::string tok;
    while (iss >> tok) {
        if (len >= max_seq - 1) break;
        auto it = w2i.find(tok);
        ids[len++] = (it != w2i.end()) ? it->second : (oov_start + static_cast<int>(fnv1a_32(tok) & oov_mask));
    }
    if (len < max_seq) ids[len++] = 3;
    return len;
}

struct FlashPrediction {
    int intent_id;
    float confidence;
};

static FlashPrediction infer_flash(const FlashWeights& w, const std::vector<int>& ids, int active_len) {
    const int D = w.d_emb;
    const int F = D * 2;
    const int H = w.hidden;
    std::vector<float> feat(F, 0.0f);
    for (int d = 0; d < D; ++d) feat[D + d] = -1e9f;

    for (int t = 0; t < active_len; ++t) {
        const float* row = w.tok_emb.data() + ids[t] * D;
        for (int d = 0; d < D; ++d) {
            float v = row[d];
            feat[d] += v;
            if (v > feat[D + d]) feat[D + d] = v;
        }
    }
    float inv_len = 1.0f / static_cast<float>(std::max(1, active_len));
    for (int d = 0; d < D; ++d) feat[d] *= inv_len;

    std::vector<float> hid(H);
    for (int h = 0; h < H; ++h) {
        const float* wrow = w.fc1_w.data() + h * F;
        float acc = w.fc1_b[h];
        for (int i = 0; i < F; ++i) acc += feat[i] * wrow[i];
        hid[h] = acc > 0.0f ? acc : 0.0f;
    }

    std::vector<float> ilog(w.n_intents);
    int best_i = 0;
    float max_l = -1e9f;
    for (int c = 0; c < w.n_intents; ++c) {
        const float* wrow = w.intent_w.data() + c * H;
        float acc = w.intent_b[c];
        for (int h = 0; h < H; ++h) acc += hid[h] * wrow[h];
        ilog[c] = acc;
        if (acc > max_l) { max_l = acc; best_i = c; }
    }
    float se = 0.0f;
    for (int c = 0; c < w.n_intents; ++c) se += std::exp(ilog[c] - max_l);
    return {best_i, 1.0f / se};
}

int main() {
    FlashWeights w;
    if (!load_flash_weights("modelo/recibot-flash/artifacts/weights_flash.bin", w)) {
        std::cerr << "Error cargando weights_flash.bin\n";
        return 1;
    }
    auto w2i = load_word_to_id("modelo/shared/vocab.json");
    int oov_start = load_json_int_field("modelo/shared/vocab.json", "oov_bucket_start", 1872);
    int oov_buckets = load_json_int_field("modelo/shared/vocab.json", "oov_num_buckets", 128);
    auto intents = load_intents("modelo/shared/taxonomy.json");

    const std::vector<std::string> tests = {
        "quien eres pulso agil y cuantos parametros tienes",
        "revisa toda mi empresa y dime si tengo secuencias ncf vencidas",
        "ver los datos de todas las sucursales en historial",
        "activar en ajustes los botones del centro de control android",
        "convierte 5000 lbs a kg",
        "si un cliente devuelve mercancia a los 45 dias pierdo el itbis en b04",
        "que riesgos legales tengo si compro cobre en efectivo sin cedula ley 155 17",
    };

    std::vector<int> ids;
    std::cout << "=== RECIBOT FLASH C++17 DISTILLED INFERENCE ===" << std::endl;
    for (const auto& q : tests) {
        int active_len = encode_query(q, w2i, w.max_seq, oov_start, oov_buckets, ids);
        auto pred = infer_flash(w, ids, active_len);
        std::string iname = (pred.intent_id < static_cast<int>(intents.size())) ? intents[pred.intent_id] : "?";
        std::cout << " - Query: \"" << q << "\" -> intent=" << iname
                  << " conf=" << std::fixed << std::setprecision(4) << pred.confidence << "\n";
    }

    int alen = encode_query(tests[0], w2i, w.max_seq, oov_start, oov_buckets, ids);
    auto t0 = std::chrono::high_resolution_clock::now();
    volatile int sink = 0;
    for (int i = 0; i < 2000; ++i) {
        sink += infer_flash(w, ids, alen).intent_id;
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    double us_per_q = std::chrono::duration<double, std::micro>(t1 - t0).count() / 2000.0;
    std::cout << "CPP_FLASH_AVG_LATENCY_US: " << std::fixed << std::setprecision(2) << us_per_q << "\n";
    return 0;
}
