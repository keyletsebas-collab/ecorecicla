#!/usr/bin/env python3
"""
ReciBot Flash Trainer — Fast Knowledge-Distilled Model (runs AFTER ReciBot Neo completes).
Distills soft intent distributions, tool probabilities, and 64-dim RAG embeddings from frozen ReciBotNeoGPT.
"""

from __future__ import annotations

import os

os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

import argparse
import base64
import csv
import gc
import json
import struct
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset

torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "2")))

FLASH_DIR = Path(__file__).resolve().parent.parent
NEO_DIR = FLASH_DIR.parent / "recibot-neo"
SHARED_DIR = FLASH_DIR.parent / "shared"
ARTIFACTS_DIR = FLASH_DIR / "artifacts"

sys.path.insert(0, str(SHARED_DIR))
sys.path.insert(0, str(NEO_DIR / "python"))

from reciminsa_dataset import (  # noqa: E402
    INTENTS,
    KNOWLEDGE_BASE_DOCS,
    MAX_SEQ_LEN,
    NUM_INTENTS,
    NUM_TOOLS,
    TOOLS,
    VOCAB_SIZE,
    build_domain_vocab,
    generate_dataset,
)
from rag_engine import evaluate_rag_with_embeddings, export_rag_index  # noqa: E402
from train_neo import (  # noqa: E402
    ReciBotNeoGPT,
    build_task_tensors,
    encode_batch,
    macro_f1_multiclass,
    macro_f1_multilabel,
    quantize_int8_symmetric,
)

D_EMB = 8
HIDDEN_DIM = 88
EMB_DIM = 64
DISTILL_TEMP = 2.5


class ReciBotFlashNet(nn.Module):
    """Lightweight fast student: Embedding(20000,8) -> Mean+Max Pool (16) -> ReLU Linear(16,88) -> Heads."""

    def __init__(self) -> None:
        super().__init__()
        self.tok_emb = nn.Embedding(VOCAB_SIZE, D_EMB)
        self.fc1 = nn.Linear(D_EMB * 2, HIDDEN_DIM)
        self.intent_head = nn.Linear(HIDDEN_DIM, NUM_INTENTS)
        self.tool_head = nn.Linear(HIDDEN_DIM, NUM_TOOLS)
        self.embed_head = nn.Linear(HIDDEN_DIM, EMB_DIM)
        nn.init.normal_(self.tok_emb.weight, mean=0.0, std=0.05)

    def forward(self, token_ids: torch.Tensor, attn_mask: torch.Tensor):
        emb = self.tok_emb(token_ids)  # [B, T, 48]
        mask_f = attn_mask.unsqueeze(-1).float()
        mean_pool = (emb * mask_f).sum(dim=1) / torch.clamp(mask_f.sum(dim=1), min=1.0)
        masked_for_max = emb.masked_fill(mask_f == 0, -1e9)
        max_pool = torch.max(masked_for_max, dim=1).values
        feat = torch.cat([mean_pool, max_pool], dim=-1)  # [B, 96]
        h = F.relu(self.fc1(feat))
        intent_logits = self.intent_head(h)
        tool_logits = self.tool_head(h)
        vec = F.normalize(self.embed_head(h), dim=-1)
        return intent_logits, tool_logits, vec


def extract_ordered_flash_tensors(model: ReciBotFlashNet) -> List[Tuple[str, np.ndarray]]:
    return [
        ("tok_emb.weight", model.tok_emb.weight.detach().cpu().numpy().astype(np.float32)),
        ("fc1.weight", model.fc1.weight.detach().cpu().numpy().astype(np.float32)),
        ("fc1.bias", model.fc1.bias.detach().cpu().numpy().astype(np.float32)),
        ("intent_head.weight", model.intent_head.weight.detach().cpu().numpy().astype(np.float32)),
        ("intent_head.bias", model.intent_head.bias.detach().cpu().numpy().astype(np.float32)),
        ("tool_head.weight", model.tool_head.weight.detach().cpu().numpy().astype(np.float32)),
        ("tool_head.bias", model.tool_head.bias.detach().cpu().numpy().astype(np.float32)),
        ("embed_head.weight", model.embed_head.weight.detach().cpu().numpy().astype(np.float32)),
        ("embed_head.bias", model.embed_head.bias.detach().cpu().numpy().astype(np.float32)),
    ]


def verify_flash_int8_parity(
    int8_tensors: Dict[str, Tuple[np.ndarray, float]],
    ids_va: np.ndarray,
    masks_va: np.ndarray,
    yi_va: np.ndarray,
) -> float:
    def deq(name: str) -> np.ndarray:
        q, s = int8_tensors[name]
        return q.astype(np.float32) * s

    emb = deq("tok_emb.weight")[ids_va]  # [B, T, 48]
    mf = masks_va[:, :, None].astype(np.float32)
    mean_p = np.sum(emb * mf, axis=1) / np.maximum(np.sum(mf, axis=1), 1.0)
    max_p = np.max(np.where(mf == 0, -1e9, emb), axis=1)
    feat = np.concatenate([mean_p, max_p], axis=-1)
    h = np.maximum(0.0, feat @ deq("fc1.weight").T + deq("fc1.bias"))
    logits = h @ deq("intent_head.weight").T + deq("intent_head.bias")
    return float(np.mean(np.argmax(logits, axis=-1) == yi_va))


def _build_flash_opt(student: ReciBotFlashNet) -> torch.optim.Optimizer:
    fast_p = [
        p for n, p in student.named_parameters()
        if ("tok_emb" in n or n.endswith(".bias"))
    ]
    fast_ids = {id(p) for p in fast_p}
    reg_p = [p for p in student.parameters() if id(p) not in fast_ids]
    return torch.optim.AdamW([
        {"params": fast_p, "lr": 1.5e-2, "weight_decay": 0.0},
        {"params": reg_p, "lr": 8e-3, "weight_decay": 1e-2},
    ])


def _run_flash_epoch(
    student: ReciBotFlashNet,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler.LRScheduler,
    ids_va: torch.Tensor,
    msk_va: torch.Tensor,
    yi_va: torch.Tensor,
    best_val_acc: float,
    best_state: Dict[str, torch.Tensor] | None,
) -> Tuple[float, Dict[str, torch.Tensor] | None]:
    student.train()
    for b_ids, b_msk, b_yi, b_yt, b_soft_i, b_soft_t, b_t_emb in loader:
        optimizer.zero_grad()
        s_li, s_lt, s_emb = student(b_ids, b_msk)
        ce_loss = F.cross_entropy(s_li, b_yi, label_smoothing=0.03)
        kd_loss = (DISTILL_TEMP ** 2) * F.kl_div(
            F.log_softmax(s_li / DISTILL_TEMP, dim=-1),
            b_soft_i,
            reduction="batchmean",
        )
        tool_loss = 0.5 * F.binary_cross_entropy_with_logits(s_lt, b_yt) + 0.5 * F.binary_cross_entropy_with_logits(s_lt, b_soft_t)
        emb_loss = (1.0 - (s_emb * b_t_emb).sum(dim=-1)).mean()
        loss = 0.55 * ce_loss + 0.45 * kd_loss + 0.45 * tool_loss + 0.35 * emb_loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(student.parameters(), 1.0)
        optimizer.step()
    scheduler.step()

    student.eval()
    with torch.no_grad():
        v_li, _, _ = student(ids_va, msk_va)
        v_acc = float((torch.argmax(v_li, dim=-1) == yi_va).float().mean().item())
        if v_acc >= best_val_acc:
            best_val_acc = v_acc
            best_state = {k: v.detach().cpu().clone() for k, v in student.state_dict().items()}
    return best_val_acc, best_state


def train_flash(stage: str = "all", ckpt_dir: str = "/tmp/recibot_v5_ckpt") -> None:
    t0 = time.perf_counter()
    torch.manual_seed(108)
    np.random.seed(108)

    ckpt_root = Path(ckpt_dir)
    ckpt_root.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    epochs_total, epochs_half = 60, 30
    _, word_to_id = build_domain_vocab()
    train_s, val_s, _ = generate_dataset(seed=42, target_per_intent=120)
    ids_tr, msk_tr, yi_tr, yt_tr, _ = build_task_tensors(train_s, word_to_id)
    ids_va, msk_va, yi_va, yt_va, _ = build_task_tensors(val_s, word_to_id)

    kb_texts = [
        f"{d['title']} {d.get('law_ref', '')} {' '.join(d.get('tags', []))} {d['content']} {' '.join(d.get('facts', []))}"
        for d in KNOWLEDGE_BASE_DOCS
    ]
    kb_ids, kb_msk = encode_batch(kb_texts, word_to_id)

    if stage in ("all", "distill_1"):
        neo_ckpt_path = NEO_DIR / "artifacts" / "recibot_neo.pt"
        if not neo_ckpt_path.exists():
            raise RuntimeError("ReciBot Neo checkpoint missing! Train ReciBot Neo first before training Flash.")

        ckpt = torch.load(neo_ckpt_path, map_location="cpu", weights_only=False)
        teacher = ReciBotNeoGPT()
        teacher.load_state_dict(ckpt["model_state"])
        teacher.eval()
        for p in teacher.parameters():
            p.requires_grad = False

        t_li_chunks, t_lt_chunks, t_emb_chunks = [], [], []
        with torch.no_grad():
            for i in range(0, len(ids_tr), 128):
                li_b, lt_b, _, emb_b = teacher.forward_tasks(ids_tr[i:i + 128], msk_tr[i:i + 128])
                t_li_chunks.append(F.softmax(li_b / DISTILL_TEMP, dim=-1))
                t_lt_chunks.append(torch.sigmoid(lt_b))
                t_emb_chunks.append(emb_b)
            t_tr_soft_i = torch.cat(t_li_chunks, dim=0)
            t_tr_soft_t = torch.cat(t_lt_chunks, dim=0)
            t_tr_emb = torch.cat(t_emb_chunks, dim=0)

            t_va_chunks = []
            for i in range(0, len(ids_va), 128):
                li_b, _, _, _ = teacher.forward_tasks(ids_va[i:i + 128], msk_va[i:i + 128])
                t_va_chunks.append(li_b)
            t_va_preds = torch.argmax(torch.cat(t_va_chunks, dim=0), dim=-1).numpy()

            _, _, _, neo_kb_emb = teacher.forward_tasks(kb_ids, kb_msk)

        del teacher, ckpt, t_li_chunks, t_lt_chunks, t_emb_chunks, t_va_chunks
        gc.collect()

        student = ReciBotFlashNet()
        optimizer = _build_flash_opt(student)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs_total, eta_min=2e-4)
        loader = DataLoader(
            TensorDataset(ids_tr, msk_tr, yi_tr, yt_tr, t_tr_soft_i, t_tr_soft_t, t_tr_emb),
            batch_size=64,
            shuffle=True,
        )

        best_state = None
        best_val_acc = -1.0
        for _epoch in range(epochs_half):
            best_val_acc, best_state = _run_flash_epoch(
                student, loader, optimizer, scheduler, ids_va, msk_va, yi_va, best_val_acc, best_state
            )
            gc.collect()

        stage_sec = time.perf_counter() - t0
        torch.save({
            "model_state": student.state_dict(),
            "opt_state": optimizer.state_dict(),
            "sched_state": scheduler.state_dict(),
            "best_val_acc": float(best_val_acc),
            "best_state": best_state,
            "t_tr_soft_i": t_tr_soft_i,
            "t_tr_soft_t": t_tr_soft_t,
            "t_tr_emb": t_tr_emb,
            "t_va_preds": t_va_preds,
            "neo_kb_emb": neo_kb_emb,
            "elapsed_s": float(stage_sec),
        }, ckpt_root / "flash_stage1.pt")
        print(f"FLASH_STAGE_COMPLETE: distill_1 epochs={epochs_half}/{epochs_total} best_val_acc={best_val_acc:.4f} elapsed={stage_sec:.2f}s")
        del student, optimizer, scheduler, loader
        gc.collect()
        if stage != "all":
            return

    # Final stage: distill_2_export
    t_s = time.perf_counter()
    f_ckpt = torch.load(ckpt_root / "flash_stage1.pt", map_location="cpu", weights_only=False)
    student = ReciBotFlashNet()
    student.load_state_dict(f_ckpt["model_state"])
    param_count = sum(p.numel() for p in student.parameters())
    optimizer = _build_flash_opt(student)
    optimizer.load_state_dict(f_ckpt["opt_state"])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs_total, eta_min=2e-4)
    scheduler.load_state_dict(f_ckpt["sched_state"])

    t_tr_soft_i = f_ckpt["t_tr_soft_i"]
    t_tr_soft_t = f_ckpt["t_tr_soft_t"]
    t_tr_emb = f_ckpt["t_tr_emb"]
    t_va_preds = f_ckpt["t_va_preds"]
    neo_kb_emb = f_ckpt["neo_kb_emb"]
    best_val_acc = float(f_ckpt["best_val_acc"])
    best_state = f_ckpt["best_state"]
    prev_elapsed = float(f_ckpt["elapsed_s"])

    loader = DataLoader(
        TensorDataset(ids_tr, msk_tr, yi_tr, yt_tr, t_tr_soft_i, t_tr_soft_t, t_tr_emb),
        batch_size=64,
        shuffle=True,
    )
    for _epoch in range(epochs_half, epochs_total):
        best_val_acc, best_state = _run_flash_epoch(
            student, loader, optimizer, scheduler, ids_va, msk_va, yi_va, best_val_acc, best_state
        )
        gc.collect()

    if best_state is not None:
        student.load_state_dict(best_state)
    student.eval()

    with torch.no_grad():
        tr_li, _, _ = student(ids_tr, msk_tr)
        va_li, va_lt, va_emb = student(ids_va, msk_va)
        _, _, flash_kb_emb = student(kb_ids, kb_msk)

    tr_preds = torch.argmax(tr_li, dim=-1).numpy()
    va_preds = torch.argmax(va_li, dim=-1).numpy()
    va_probs = torch.softmax(va_li, dim=-1).numpy()
    va_tool_probs = torch.sigmoid(va_lt).numpy()

    train_acc = float(np.mean(tr_preds == yi_tr.numpy()))
    val_acc = float(np.mean(va_preds == yi_va.numpy()))
    val_f1 = macro_f1_multiclass(va_preds, yi_va.numpy(), NUM_INTENTS)
    val_tool_f1 = macro_f1_multilabel(va_tool_probs, yt_va.numpy())
    teacher_agreement = float(np.mean(va_preds == t_va_preds))

    flash_rag_metrics = evaluate_rag_with_embeddings(
        doc_embeddings=flash_kb_emb.numpy(),
        query_embeddings=va_emb.numpy(),
        val_samples=val_s,
        docs=KNOWLEDGE_BASE_DOCS,
    )

    # Also update shared rag_index.json to include BOTH neo_vec and flash_vec!
    neo_metrics = json.loads((NEO_DIR / "artifacts" / "metrics.json").read_text(encoding="utf-8"))
    export_rag_index(
        neo_doc_embeddings=neo_kb_emb.numpy(),
        flash_doc_embeddings=flash_kb_emb.numpy(),
        val_metrics={"neo_rag": neo_metrics.get("rag_eval"), "flash_rag": flash_rag_metrics},
    )

    # Single-query latency benchmark in PyTorch CPU
    s_id = ids_va[:1]
    s_mk = msk_va[:1]
    lat_t0 = time.perf_counter()
    with torch.no_grad():
        for _ in range(500):
            student(s_id, s_mk)
    py_latency_us = ((time.perf_counter() - lat_t0) / 500.0) * 1e6

    torch.save({
        "model_state": student.state_dict(),
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "d_emb": D_EMB,
        "hidden_dim": HIDDEN_DIM,
        "n_intents": NUM_INTENTS,
        "n_tools": NUM_TOOLS,
        "emb_dim": EMB_DIM,
    }, ARTIFACTS_DIR / "recibot_flash.pt")

    ordered = extract_ordered_flash_tensors(student)

    f32_dict = {}
    for name, arr in ordered:
        f32_dict[name] = {"shape": list(arr.shape), "data": [round(float(v), 6) for v in arr.reshape(-1)]}
    (ARTIFACTS_DIR / "weights_f32.json").write_text(json.dumps(f32_dict), encoding="utf-8")

    int8_dict = {}
    int8_verify = {}
    for name, arr in ordered:
        q, scale = quantize_int8_symmetric(arr)
        int8_verify[name] = (q, scale)
        int8_dict[name] = {
            "shape": list(arr.shape),
            "scale": round(float(scale), 8),
            "q_b64": base64.b64encode(q.reshape(-1).tobytes()).decode("ascii"),
        }
    (ARTIFACTS_DIR / "weights_int8.json").write_text(json.dumps(int8_dict), encoding="utf-8")
    int8_val_acc = verify_flash_int8_parity(int8_verify, ids_va.numpy(), msk_va.numpy(), yi_va.numpy())

    # Binary weights "RFL2"
    with open(ARTIFACTS_DIR / "weights_flash.bin", "wb") as bf:
        bf.write(b"RFL2")
        bf.write(struct.pack("<8i", 2, VOCAB_SIZE, MAX_SEQ_LEN, D_EMB, HIDDEN_DIM, NUM_INTENTS, NUM_TOOLS, EMB_DIM))
        for _, arr in ordered:
            bf.write(np.ascontiguousarray(arr.reshape(-1), dtype="<f4").tobytes())

    with open(ARTIFACTS_DIR / "eval_predictions.csv", "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow(["idx", "true_intent", "pred_intent", "confidence", "correct", "top_tool", "text"])
        for i, sample in enumerate(val_s):
            top_t = int(np.argmax(va_tool_probs[i]))
            writer.writerow([
                i,
                sample["intent_name"],
                INTENTS[int(va_preds[i])],
                round(float(np.max(va_probs[i])), 6),
                int(va_preds[i] == sample["intent_id"]),
                TOOLS[top_t] if va_tool_probs[i][top_t] >= 0.4 else "none",
                sample["text"],
            ])

    elapsed_s = round(prev_elapsed + (time.perf_counter() - t_s), 3)
    speedup_vs_neo_py = round(neo_metrics["python_fp32_latency_us"] / max(1.0, py_latency_us), 2)
    metrics = {
        "model": "recibot-flash",
        "role": "fast_distilled_low_latency",
        "architecture": f"Embedding({VOCAB_SIZE},{D_EMB})+MeanMaxPool({D_EMB*2})+ReLU({HIDDEN_DIM})+DistillFromNeo(T={DISTILL_TEMP})",
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "parameters": int(param_count),
        "param_reduction_vs_neo": round(neo_metrics["inference_parameters"] / max(1, param_count), 2),
        "train_samples": len(train_s),
        "val_samples": len(val_s),
        "epochs": epochs_total,
        "train_intent_acc": round(train_acc, 4),
        "val_intent_acc": round(val_acc, 4),
        "val_intent_macro_f1": round(val_f1, 4),
        "val_tool_macro_f1": round(val_tool_f1, 4),
        "teacher_agreement": round(teacher_agreement, 4),
        "val_intent_acc_int8": round(int8_val_acc, 4),
        "rag_eval": flash_rag_metrics,
        "python_fp32_latency_us": round(py_latency_us, 2),
        "speedup_vs_neo_py": speedup_vs_neo_py,
        "train_time_sec": elapsed_s,
    }
    (ARTIFACTS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    print("RECIBOT_FLASH_TRAINING_COMPLETE:", json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=["distill_1", "distill_2_export", "all"], default="all")
    parser.add_argument("--ckpt-dir", default="/tmp/recibot_v5_ckpt")
    args = parser.parse_args()
    train_flash(stage=args.stage, ckpt_dir=args.ckpt_dir)
