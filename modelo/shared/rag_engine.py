#!/usr/bin/env python3
"""
ReciBot Hybrid RAG Engine (BM25 + Dense Semantic Embeddings + Reciprocal/Hybrid Fusion)
Modeled after DataTalksClub/llm-zoomcamp retrieval & evaluation architecture.
"""

from __future__ import annotations

import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

SHARED_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SHARED_DIR))

from reciminsa_dataset import (  # noqa: E402
    INTENTS,
    KNOWLEDGE_BASE_DOCS,
    build_domain_vocab,
    encode_text,
    generate_dataset,
    tokenize_ascii,
)


class HybridBM25:
    def __init__(self, docs: List[Dict], k1: float = 1.5, b: float = 0.75) -> None:
        self.docs = docs
        self.k1 = k1
        self.b = b
        self.N = max(1, len(docs))
        self.doc_tokens: List[List[str]] = []
        self.doc_tf: List[Counter] = []
        self.df: Counter = Counter()

        total_len = 0
        for d in docs:
            law_ref = d.get("law_ref", "")
            facts_str = " ".join(d.get("facts", []))
            full = (
                f"{d['title']} {d['title']} {law_ref} {law_ref} "
                f"{' '.join(d.get('tags', []))} {' '.join(d.get('tags', []))} "
                f"{d['content']} {facts_str}"
            )
            toks = [t for t in tokenize_ascii(full) if len(t) >= 2]
            self.doc_tokens.append(toks)
            tf = Counter(toks)
            self.doc_tf.append(tf)
            total_len += len(toks)
            for term in tf.keys():
                self.df[term] += 1

        self.avgdl = total_len / self.N if total_len > 0 else 1.0
        self.idf: Dict[str, float] = {
            term: math.log(1.0 + (self.N - df + 0.5) / (df + 0.5))
            for term, df in self.df.items()
        }

    def score_all(self, query: str) -> np.ndarray:
        q_toks = [t for t in tokenize_ascii(query) if len(t) >= 2]
        scores = np.zeros(self.N, dtype=np.float32)
        if not q_toks:
            return scores
        for i in range(self.N):
            dl = max(1, len(self.doc_tokens[i]))
            tf = self.doc_tf[i]
            s = 0.0
            for t in q_toks:
                if t not in tf:
                    continue
                f = tf[t]
                idf = self.idf.get(t, 0.0)
                s += idf * (f * (self.k1 + 1.0)) / (f + self.k1 * (1.0 - self.b + self.b * (dl / self.avgdl)))
            scores[i] = s
        return scores


def _minmax_norm(arr: np.ndarray) -> np.ndarray:
    if arr.size == 0:
        return arr
    lo = float(np.min(arr))
    hi = float(np.max(arr))
    if hi - lo < 1e-8:
        return np.zeros_like(arr)
    return (arr - lo) / (hi - lo)


def evaluate_rag_with_embeddings(
    doc_embeddings: np.ndarray,
    query_embeddings: np.ndarray,
    val_samples: List[Dict],
    docs: Optional[List[Dict]] = None,
    dense_weight: float = 0.55,
    bm25_weight: float = 0.45,
) -> Dict:
    docs = docs if docs is not None else KNOWLEDGE_BASE_DOCS
    bm25 = HybridBM25(docs)

    doc_norms = np.linalg.norm(doc_embeddings, axis=1, keepdims=True) + 1e-8
    norm_docs = doc_embeddings / doc_norms

    hits_at_1 = 0
    hits_at_3 = 0
    rr_sum = 0.0
    bm25_hits_at_1 = 0
    dense_hits_at_1 = 0

    for i, sample in enumerate(val_samples):
        target_intent = sample["intent_name"]
        q_emb = query_embeddings[i]
        q_emb = q_emb / (np.linalg.norm(q_emb) + 1e-8)

        dense_raw = norm_docs @ q_emb
        bm25_raw = bm25.score_all(sample["text"])

        dense_order = np.argsort(-dense_raw)
        bm25_order = np.argsort(-bm25_raw)
        if docs[int(dense_order[0])]["intent"] == target_intent:
            dense_hits_at_1 += 1
        if docs[int(bm25_order[0])]["intent"] == target_intent:
            bm25_hits_at_1 += 1

        hybrid = dense_weight * _minmax_norm(dense_raw) + bm25_weight * _minmax_norm(bm25_raw)
        order = np.argsort(-hybrid)

        top3_intents = [docs[int(idx)]["intent"] for idx in order[:3]]
        if top3_intents and top3_intents[0] == target_intent:
            hits_at_1 += 1
        if target_intent in top3_intents:
            hits_at_3 += 1

        for rank, idx in enumerate(order, start=1):
            if docs[int(idx)]["intent"] == target_intent:
                rr_sum += 1.0 / rank
                break

    total = max(1, len(val_samples))
    return {
        "queries_evaluated": len(val_samples),
        "kb_docs_count": len(docs),
        "bm25_hit_rate_at_1": round(bm25_hits_at_1 / total, 4),
        "dense_hit_rate_at_1": round(dense_hits_at_1 / total, 4),
        "hybrid_hit_rate_at_1": round(hits_at_1 / total, 4),
        "hybrid_hit_rate_at_3": round(hits_at_3 / total, 4),
        "hybrid_mrr": round(rr_sum / total, 4),
    }


def export_rag_index(
    neo_doc_embeddings: np.ndarray,
    flash_doc_embeddings: Optional[np.ndarray] = None,
    val_metrics: Optional[Dict] = None,
    out_dir: Path = SHARED_DIR,
) -> Path:
    bm25 = HybridBM25(KNOWLEDGE_BASE_DOCS)
    payload_docs = []
    for i, d in enumerate(KNOWLEDGE_BASE_DOCS):
        entry = {
            "id": d["id"],
            "intent": d["intent"],
            "title": d["title"],
            "module": d["module"],
            "category": d.get("category", "app"),
            "law_ref": d.get("law_ref", ""),
            "tags": d["tags"],
            "content": d["content"],
            "facts": d.get("facts", []),
            "tf": dict(bm25.doc_tf[i]),
            "dl": len(bm25.doc_tokens[i]),
            "neo_vec": [round(float(x), 5) for x in neo_doc_embeddings[i].tolist()],
        }
        if flash_doc_embeddings is not None:
            entry["flash_vec"] = [round(float(x), 5) for x in flash_doc_embeddings[i].tolist()]
        payload_docs.append(entry)

    index_payload = {
        "k1": bm25.k1,
        "b": bm25.b,
        "avgdl": round(float(bm25.avgdl), 4),
        "idf": {k: round(float(v), 5) for k, v in bm25.idf.items()},
        "docs": payload_docs,
    }
    (out_dir / "rag_index.json").write_text(json.dumps(index_payload, ensure_ascii=False), encoding="utf-8")
    if val_metrics is not None:
        (out_dir / "rag_metrics.json").write_text(json.dumps(val_metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    return out_dir / "rag_index.json"


if __name__ == "__main__":
    # Quick standalone BM25 sanity baseline before neural embeddings
    _, val_s, _ = generate_dataset()
    bm25 = HybridBM25(KNOWLEDGE_BASE_DOCS)
    hits1 = 0
    hits3 = 0
    for s in val_s:
        sc = bm25.score_all(s["text"])
        order = np.argsort(-sc)
        top3 = [KNOWLEDGE_BASE_DOCS[int(idx)]["intent"] for idx in order[:3]]
        if top3 and top3[0] == s["intent_name"]:
            hits1 += 1
        if s["intent_name"] in top3:
            hits3 += 1
    print("BM25_BASELINE_ONLY:", json.dumps({
        "bm25_hit_rate_at_1": round(hits1 / len(val_s), 4),
        "bm25_hit_rate_at_3": round(hits3 / len(val_s), 4),
    }))
