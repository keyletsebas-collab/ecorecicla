#!/usr/bin/env python3
"""
ReciBot Neo Trainer (CPU-safe sequential execution, 4 threads max):
  - Architecture: GPT-style Pre-LN Multi-Head Self-Attention Transformer (rasbt/LLMs-from-scratch)
  - Stage 1: Next-Token Pretraining on ReciminsaApp Domain Corpus
  - Stage 2: Rank-8 LoRA Fine-Tuning + Multi-Task Heads + Semantic RAG Embedding Alignment (mlabonne/llm-course)
  - Stage 3: DPO-Style Preference Alignment on High-Risk DGII/Branches/Supabase/Android Pairs
  - Evaluates Val Accuracy, Macro-F1, Tool-F1, Int8 Parity, and Hybrid RAG Hit-Rate@1/3 & MRR.
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
import math
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

NEO_DIR = Path(__file__).resolve().parent.parent
SHARED_DIR = NEO_DIR.parent / "shared"
ARTIFACTS_DIR = NEO_DIR / "artifacts"
sys.path.insert(0, str(SHARED_DIR))

from reciminsa_dataset import (  # noqa: E402
    CLS_ID,
    DEPTH_LABELS,
    DPO_PREFERENCE_PAIRS,
    INTENTS,
    KNOWLEDGE_BASE_DOCS,
    MAX_SEQ_LEN,
    NUM_DEPTHS,
    NUM_INTENTS,
    NUM_TOOLS,
    PAD_ID,
    TOOLS,
    VOCAB_SIZE,
    build_domain_vocab,
    encode_text,
    export_shared_metadata,
    generate_dataset,
    get_pretraining_sentences,
)
from rag_engine import evaluate_rag_with_embeddings, export_rag_index  # noqa: E402

E_EMB = 14
D_MODEL = 112
N_HEADS = 4
HEAD_DIM = 28
N_LAYERS = 2
FFN_DIM = 220
EMB_DIM = 64
LORA_RANK = 8
LORA_ALPHA = 16.0


class LoRALinear(nn.Module):
    """Low-Rank Adaptation wrapper (mlabonne/llm-course): W_eff = W + (alpha / r) * B @ A."""

    def __init__(self, base: nn.Linear, rank: int = LORA_RANK, alpha: float = LORA_ALPHA) -> None:
        super().__init__()
        self.base = base
        self.rank = rank
        self.scaling = alpha / float(rank)
        for p in self.base.parameters():
            p.requires_grad = False
        self.lora_a = nn.Parameter(torch.randn(rank, base.in_features) * (1.0 / math.sqrt(rank)))
        self.lora_b = nn.Parameter(torch.zeros(base.out_features, rank))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.base(x)
        delta = F.linear(F.linear(x, self.lora_a), self.lora_b) * self.scaling
        return out + delta

    def merge_to_linear(self) -> nn.Linear:
        with torch.no_grad():
            merged_w = self.base.weight.data + (self.lora_b.data @ self.lora_a.data) * self.scaling
            linear = nn.Linear(self.base.in_features, self.base.out_features, bias=self.base.bias is not None)
            linear.weight.data.copy_(merged_w)
            if self.base.bias is not None:
                linear.bias.data.copy_(self.base.bias.data)
            return linear


class MultiHeadAttentionBlock(nn.Module):
    def __init__(self, d_model: int = D_MODEL, n_heads: int = N_HEADS, dropout: float = 0.1) -> None:
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads
        self.wq: nn.Module = nn.Linear(d_model, d_model)
        self.wk: nn.Module = nn.Linear(d_model, d_model)
        self.wv: nn.Module = nn.Linear(d_model, d_model)
        self.wo: nn.Module = nn.Linear(d_model, d_model)
        self.attn_drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, attn_mask: torch.Tensor, causal: bool = False) -> torch.Tensor:
        B, T, C = x.shape
        q = self.wq(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        k = self.wk(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        v = self.wv(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)

        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        pad_mask = (attn_mask == 0).unsqueeze(1).unsqueeze(2)  # [B, 1, 1, T]
        scores = scores.masked_fill(pad_mask, -1e9)
        if causal:
            causal_mask = torch.triu(torch.ones(T, T, device=x.device, dtype=torch.bool), diagonal=1)
            scores = scores.masked_fill(causal_mask.unsqueeze(0).unsqueeze(0), -1e9)

        weights = F.softmax(scores, dim=-1)
        weights = self.attn_drop(weights)
        out = (weights @ v).transpose(1, 2).contiguous().view(B, T, C)
        return self.wo(out)


class TransformerBlock(nn.Module):
    def __init__(self, d_model: int = D_MODEL, n_heads: int = N_HEADS, ffn_dim: int = FFN_DIM, dropout: float = 0.1) -> None:
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model, eps=1e-5)
        self.attn = MultiHeadAttentionBlock(d_model, n_heads, dropout=dropout)
        self.ln2 = nn.LayerNorm(d_model, eps=1e-5)
        self.ffn1: nn.Module = nn.Linear(d_model, ffn_dim)
        self.ffn2: nn.Module = nn.Linear(ffn_dim, d_model)
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, attn_mask: torch.Tensor, causal: bool = False) -> torch.Tensor:
        x = x + self.drop(self.attn(self.ln1(x), attn_mask, causal=causal))
        h = F.gelu(self.ffn1(self.ln2(x)), approximate="tanh")
        x = x + self.drop(self.ffn2(self.drop(h)))
        return x


class ReciBotNeoGPT(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.tok_emb = nn.Embedding(VOCAB_SIZE, E_EMB)
        self.tok_proj = nn.Linear(E_EMB, D_MODEL, bias=False)
        self.pos_emb = nn.Embedding(MAX_SEQ_LEN, D_MODEL)
        self.emb_drop = nn.Dropout(0.1)
        self.blocks = nn.ModuleList([TransformerBlock() for _ in range(N_LAYERS)])
        self.norm_out = nn.LayerNorm(D_MODEL, eps=1e-5)

        # Task heads (inference + Stage 2 & 3; Stage 1 uses factorized tied weights tok_proj/tok_emb)
        self.intent_head = nn.Linear(D_MODEL, NUM_INTENTS)
        self.tool_head = nn.Linear(D_MODEL, NUM_TOOLS)
        self.depth_head = nn.Linear(D_MODEL, NUM_DEPTHS)
        self.embed_head = nn.Linear(D_MODEL, EMB_DIM)

        nn.init.normal_(self.tok_emb.weight, mean=0.0, std=0.05)
        nn.init.xavier_uniform_(self.tok_proj.weight)
        nn.init.normal_(self.pos_emb.weight, mean=0.0, std=0.05)

    def encode_sequence(self, token_ids: torch.Tensor, attn_mask: torch.Tensor, causal: bool = False) -> torch.Tensor:
        B, T = token_ids.shape
        pos = torch.arange(T, device=token_ids.device).unsqueeze(0).expand(B, T)
        tok_e = self.tok_proj(self.tok_emb(token_ids))
        x = self.emb_drop(tok_e + self.pos_emb(pos))
        for block in self.blocks:
            x = block(x, attn_mask, causal=causal)
        return self.norm_out(x)

    def forward_lm(self, token_ids: torch.Tensor, attn_mask: torch.Tensor) -> torch.Tensor:
        h = self.encode_sequence(token_ids, attn_mask, causal=True)
        h_e = F.linear(h, self.tok_proj.weight.t()) / math.sqrt(D_MODEL)  # [B, T, E_EMB]
        return F.linear(h_e, self.tok_emb.weight)                         # [B, T, VOCAB_SIZE]

    def forward_tasks(self, token_ids: torch.Tensor, attn_mask: torch.Tensor):
        h = self.encode_sequence(token_ids, attn_mask, causal=False)
        mask_f = attn_mask.unsqueeze(-1).float()
        mean_pool = (h * mask_f).sum(dim=1) / torch.clamp(mask_f.sum(dim=1), min=1.0)
        pooled = 0.5 * h[:, 0, :] + 0.5 * mean_pool
        intent_logits = self.intent_head(pooled)
        tool_logits = self.tool_head(pooled)
        depth_logits = self.depth_head(pooled)
        emb = F.normalize(self.embed_head(pooled), dim=-1)
        return intent_logits, tool_logits, depth_logits, emb

    def apply_lora_adapters(self) -> Tuple[int, int]:
        # Attach Rank-8 LoRA adapters across Attention (wq/wk/wv/wo), FFN, and unfreeze factorized embeddings
        # so domain words absent from small Stage-1 corpus align cleanly with Transformer heads.
        for p in self.parameters():
            p.requires_grad = False
        for p in self.tok_emb.parameters():
            p.requires_grad = True
        for p in self.tok_proj.parameters():
            p.requires_grad = True
        for p in self.pos_emb.parameters():
            p.requires_grad = True
        for blk in self.blocks:
            blk.attn.wq = LoRALinear(blk.attn.wq)
            blk.attn.wk = LoRALinear(blk.attn.wk)
            blk.attn.wv = LoRALinear(blk.attn.wv)
            blk.attn.wo = LoRALinear(blk.attn.wo)
            blk.ffn1 = LoRALinear(blk.ffn1)
            blk.ffn2 = LoRALinear(blk.ffn2)
            for p in blk.ln1.parameters():
                p.requires_grad = True
            for p in blk.ln2.parameters():
                p.requires_grad = True
        for p in self.norm_out.parameters():
            p.requires_grad = True
        for head in (self.intent_head, self.tool_head, self.depth_head, self.embed_head):
            for p in head.parameters():
                p.requires_grad = True

        total_params = sum(p.numel() for p in self.parameters())
        trainable_params = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return trainable_params, total_params

    def merge_lora_adapters(self) -> None:
        for blk in self.blocks:
            if isinstance(blk.attn.wq, LoRALinear):
                blk.attn.wq = blk.attn.wq.merge_to_linear()
            if isinstance(blk.attn.wk, LoRALinear):
                blk.attn.wk = blk.attn.wk.merge_to_linear()
            if isinstance(blk.attn.wv, LoRALinear):
                blk.attn.wv = blk.attn.wv.merge_to_linear()
            if isinstance(blk.attn.wo, LoRALinear):
                blk.attn.wo = blk.attn.wo.merge_to_linear()
            if isinstance(blk.ffn1, LoRALinear):
                blk.ffn1 = blk.ffn1.merge_to_linear()
            if isinstance(blk.ffn2, LoRALinear):
                blk.ffn2 = blk.ffn2.merge_to_linear()


def encode_batch(texts: List[str], word_to_id: Dict[str, int]) -> Tuple[torch.Tensor, torch.Tensor]:
    ids_list, mask_list = [], []
    for txt in texts:
        ids, msk = encode_text(txt, word_to_id, MAX_SEQ_LEN)
        ids_list.append(ids)
        mask_list.append(msk)
    return torch.tensor(ids_list, dtype=torch.long), torch.tensor(mask_list, dtype=torch.long)


def build_task_tensors(samples: List[Dict], word_to_id: Dict[str, int]):
    ids, masks = encode_batch([s["text"] for s in samples], word_to_id)
    yi = torch.tensor([s["intent_id"] for s in samples], dtype=torch.long)
    yt = torch.tensor([s["tool_vec"] for s in samples], dtype=torch.float32)
    yd = torch.tensor([s["depth_id"] for s in samples], dtype=torch.long)
    return ids, masks, yi, yt, yd


def macro_f1_multiclass(preds: np.ndarray, targets: np.ndarray, num_classes: int) -> float:
    f1s = []
    for c in range(num_classes):
        tp = float(np.sum((preds == c) & (targets == c)))
        fp = float(np.sum((preds == c) & (targets != c)))
        fn = float(np.sum((preds != c) & (targets == c)))
        denom = 2.0 * tp + fp + fn
        f1s.append((2.0 * tp / denom) if denom > 0 else 0.0)
    return float(np.mean(f1s))


def macro_f1_multilabel(probs: np.ndarray, targets: np.ndarray, threshold: float = 0.5) -> float:
    preds = (probs >= threshold).astype(np.float32)
    f1s = []
    for c in range(targets.shape[1]):
        tp = float(np.sum((preds[:, c] == 1) & (targets[:, c] == 1)))
        fp = float(np.sum((preds[:, c] == 1) & (targets[:, c] == 0)))
        fn = float(np.sum((preds[:, c] == 0) & (targets[:, c] == 1)))
        denom = 2.0 * tp + fp + fn
        f1s.append((2.0 * tp / denom) if denom > 0 else 1.0)
    return float(np.mean(f1s))


def extract_ordered_tensors(model: ReciBotNeoGPT) -> List[Tuple[str, np.ndarray]]:
    tensors: List[Tuple[str, np.ndarray]] = [
        ("tok_emb.weight", model.tok_emb.weight.detach().cpu().numpy().astype(np.float32)),
        ("tok_proj.weight", model.tok_proj.weight.detach().cpu().numpy().astype(np.float32)),
        ("pos_emb.weight", model.pos_emb.weight.detach().cpu().numpy().astype(np.float32)),
    ]
    for l_idx, blk in enumerate(model.blocks):
        tensors.extend([
            (f"blocks.{l_idx}.ln1.weight", blk.ln1.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.ln1.bias", blk.ln1.bias.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wq.weight", blk.attn.wq.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wq.bias", blk.attn.wq.bias.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wk.weight", blk.attn.wk.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wk.bias", blk.attn.wk.bias.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wv.weight", blk.attn.wv.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wv.bias", blk.attn.wv.bias.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wo.weight", blk.attn.wo.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.wo.bias", blk.attn.wo.bias.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.ln2.weight", blk.ln2.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.ln2.bias", blk.ln2.bias.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.ffn1.weight", blk.ffn1.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.ffn1.bias", blk.ffn1.bias.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.ffn2.weight", blk.ffn2.weight.detach().cpu().numpy().astype(np.float32)),
            (f"blocks.{l_idx}.ffn2.bias", blk.ffn2.bias.detach().cpu().numpy().astype(np.float32)),
        ])
    tensors.extend([
        ("norm_out.weight", model.norm_out.weight.detach().cpu().numpy().astype(np.float32)),
        ("norm_out.bias", model.norm_out.bias.detach().cpu().numpy().astype(np.float32)),
        ("intent_head.weight", model.intent_head.weight.detach().cpu().numpy().astype(np.float32)),
        ("intent_head.bias", model.intent_head.bias.detach().cpu().numpy().astype(np.float32)),
        ("tool_head.weight", model.tool_head.weight.detach().cpu().numpy().astype(np.float32)),
        ("tool_head.bias", model.tool_head.bias.detach().cpu().numpy().astype(np.float32)),
        ("depth_head.weight", model.depth_head.weight.detach().cpu().numpy().astype(np.float32)),
        ("depth_head.bias", model.depth_head.bias.detach().cpu().numpy().astype(np.float32)),
        ("embed_head.weight", model.embed_head.weight.detach().cpu().numpy().astype(np.float32)),
        ("embed_head.bias", model.embed_head.bias.detach().cpu().numpy().astype(np.float32)),
    ])
    return tensors


def quantize_int8_symmetric(arr: np.ndarray) -> Tuple[np.ndarray, float]:
    max_abs = float(np.max(np.abs(arr))) if arr.size > 0 else 0.0
    scale = max_abs / 127.0 if max_abs > 1e-12 else 1.0
    q = np.clip(np.round(arr / scale), -127, 127).astype(np.int8)
    return q, scale


def verify_int8_parity(
    int8_tensors: Dict[str, Tuple[np.ndarray, float]],
    ids_va: np.ndarray,
    masks_va: np.ndarray,
    yi_va: np.ndarray,
) -> float:
    def deq(name: str) -> np.ndarray:
        q, s = int8_tensors[name]
        return q.astype(np.float32) * s

    def ln(x: np.ndarray, w: np.ndarray, b: np.ndarray) -> np.ndarray:
        m = np.mean(x, axis=-1, keepdims=True)
        v = np.var(x, axis=-1, keepdims=True)
        return ((x - m) / np.sqrt(v + 1e-5)) * w + b

    def gelu(x: np.ndarray) -> np.ndarray:
        k = math.sqrt(2.0 / math.pi)
        return 0.5 * x * (1.0 + np.tanh(k * (x + 0.044715 * (x ** 3))))

    tok_e = deq("tok_emb.weight")[ids_va] @ deq("tok_proj.weight").T
    pos_e = deq("pos_emb.weight")[None, :MAX_SEQ_LEN, :]
    x = tok_e + pos_e
    B, T, C = x.shape

    for l_idx in range(N_LAYERS):
        xn = ln(x, deq(f"blocks.{l_idx}.ln1.weight"), deq(f"blocks.{l_idx}.ln1.bias"))
        q = (xn @ deq(f"blocks.{l_idx}.wq.weight").T + deq(f"blocks.{l_idx}.wq.bias")).reshape(B, T, N_HEADS, HEAD_DIM).transpose(0, 2, 1, 3)
        k = (xn @ deq(f"blocks.{l_idx}.wk.weight").T + deq(f"blocks.{l_idx}.wk.bias")).reshape(B, T, N_HEADS, HEAD_DIM).transpose(0, 2, 1, 3)
        v = (xn @ deq(f"blocks.{l_idx}.wv.weight").T + deq(f"blocks.{l_idx}.wv.bias")).reshape(B, T, N_HEADS, HEAD_DIM).transpose(0, 2, 1, 3)
        sc = (q @ k.transpose(0, 1, 3, 2)) / math.sqrt(HEAD_DIM)
        sc = np.where(masks_va[:, None, None, :] == 0, -1e9, sc)
        sc = sc - np.max(sc, axis=-1, keepdims=True)
        w = np.exp(sc)
        w = w / np.sum(w, axis=-1, keepdims=True)
        attn = (w @ v).transpose(0, 2, 1, 3).reshape(B, T, C)
        x = x + (attn @ deq(f"blocks.{l_idx}.wo.weight").T + deq(f"blocks.{l_idx}.wo.bias"))

        xn2 = ln(x, deq(f"blocks.{l_idx}.ln2.weight"), deq(f"blocks.{l_idx}.ln2.bias"))
        ff = gelu(xn2 @ deq(f"blocks.{l_idx}.ffn1.weight").T + deq(f"blocks.{l_idx}.ffn1.bias"))
        x = x + (ff @ deq(f"blocks.{l_idx}.ffn2.weight").T + deq(f"blocks.{l_idx}.ffn2.bias"))

    x = ln(x, deq("norm_out.weight"), deq("norm_out.bias"))
    mf = masks_va[:, :, None].astype(np.float32)
    mean_p = np.sum(x * mf, axis=1) / np.maximum(np.sum(mf, axis=1), 1.0)
    pooled = 0.5 * x[:, 0, :] + 0.5 * mean_p
    logits = pooled @ deq("intent_head.weight").T + deq("intent_head.bias")
    return float(np.mean(np.argmax(logits, axis=-1) == yi_va))


def _run_sft_epoch(
    model: ReciBotNeoGPT,
    task_loader: DataLoader,
    task_opt: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler.LRScheduler,
    class_protos: nn.Parameter,
    lora_params: List[torch.Tensor],
    ids_va: torch.Tensor,
    msk_va: torch.Tensor,
    yi_va: torch.Tensor,
    best_val_acc: float,
    best_state: Dict[str, torch.Tensor] | None,
) -> Tuple[float, Dict[str, torch.Tensor] | None]:
    model.train()
    for b_ids, b_msk, b_yi, b_yt, b_yd in task_loader:
        task_opt.zero_grad()
        li, lt, ld, emb = model.forward_tasks(b_ids, b_msk)
        proto_norm = F.normalize(class_protos, dim=-1)
        rag_logits = 12.0 * (emb @ proto_norm.T)
        loss = (
            F.cross_entropy(li, b_yi, label_smoothing=0.05)
            + 0.55 * F.binary_cross_entropy_with_logits(lt, b_yt)
            + 0.35 * F.cross_entropy(ld, b_yd)
            + 0.45 * F.cross_entropy(rag_logits, b_yi)
        )
        loss.backward()
        torch.nn.utils.clip_grad_norm_(lora_params, 1.0)
        task_opt.step()
    scheduler.step()

    model.eval()
    with torch.no_grad():
        v_li, _, _, _ = model.forward_tasks(ids_va, msk_va)
        v_acc = float((torch.argmax(v_li, dim=-1) == yi_va).float().mean().item())
        if v_acc >= best_val_acc:
            best_val_acc = v_acc
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    return best_val_acc, best_state


def _run_pretrain_epochs(
    model: ReciBotNeoGPT,
    pre_loader: DataLoader,
    pre_opt: torch.optim.Optimizer,
    n_epochs: int,
) -> float:
    last_lm_loss = 0.0
    model.train()
    for _epoch in range(n_epochs):
        total_loss = 0.0
        steps = 0
        for b_ids, b_msk in pre_loader:
            pre_opt.zero_grad()
            logits = model.forward_lm(b_ids[:, :-1], b_msk[:, :-1])
            targets = b_ids[:, 1:]
            loss = F.cross_entropy(logits.reshape(-1, VOCAB_SIZE), targets.reshape(-1), ignore_index=PAD_ID)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            pre_opt.step()
            total_loss += float(loss.item())
            steps += 1
            del logits, targets, loss
        last_lm_loss = total_loss / max(1, steps)
        gc.collect()
    return last_lm_loss


def _build_pretrain_opt(model: ReciBotNeoGPT) -> torch.optim.Optimizer:
    emb_keys = ("tok_emb", "tok_proj", "pos_emb")
    fast_p = [p for n, p in model.named_parameters() if any(k in n for k in emb_keys)]
    fast_ids = {id(p) for p in fast_p}
    reg_p = [p for p in model.parameters() if id(p) not in fast_ids]
    return torch.optim.AdamW([
        {"params": fast_p, "lr": 1e-2, "weight_decay": 0.0},
        {"params": reg_p, "lr": 4e-3, "weight_decay": 1e-2},
    ])


def _build_sft_opt(model: ReciBotNeoGPT, class_protos: nn.Parameter) -> Tuple[torch.optim.Optimizer, List[torch.Tensor]]:
    fast_keys = ("tok_emb", "tok_proj", "pos_emb", "ln1", "ln2", "norm_out")
    fast_p = [
        p for n, p in model.named_parameters()
        if p.requires_grad and (any(k in n for k in fast_keys) or n.endswith(".bias"))
    ] + [class_protos]
    fast_ids = {id(p) for p in fast_p}
    reg_p = [p for p in model.parameters() if p.requires_grad and id(p) not in fast_ids]
    opt = torch.optim.AdamW([
        {"params": fast_p, "lr": 1.2e-2, "weight_decay": 0.0},
        {"params": reg_p, "lr": 6e-3, "weight_decay": 1e-2},
    ])
    return opt, fast_p + reg_p


def _build_dpo_opt(model: ReciBotNeoGPT) -> torch.optim.Optimizer:
    fast_keys = ("tok_emb", "tok_proj", "pos_emb", "ln1", "ln2", "norm_out")
    fast_p = [
        p for n, p in model.named_parameters()
        if p.requires_grad and (any(k in n for k in fast_keys) or n.endswith(".bias"))
    ]
    fast_ids = {id(p) for p in fast_p}
    reg_p = [p for p in model.parameters() if p.requires_grad and id(p) not in fast_ids]
    return torch.optim.AdamW([
        {"params": fast_p, "lr": 6e-4, "weight_decay": 0.0},
        {"params": reg_p, "lr": 6e-4, "weight_decay": 2e-3},
    ])


def train_neo(stage: str = "all", ckpt_dir: str = "/tmp/recibot_v5_ckpt") -> None:
    t0 = time.perf_counter()
    torch.manual_seed(42)
    np.random.seed(42)

    ckpt_root = Path(ckpt_dir)
    ckpt_root.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    pre_epochs_1, pre_epochs_2 = 8, 7
    sft_epochs_total, sft_half = 40, 20
    dpo_epochs = 10

    if stage in ("all", "pretrain_1"):
        export_shared_metadata(SHARED_DIR)
        _, word_to_id = build_domain_vocab()
        pretrain_sents = get_pretraining_sentences()
        pre_ids, pre_msk = encode_batch(pretrain_sents, word_to_id)
        model = ReciBotNeoGPT()
        pre_loader = DataLoader(TensorDataset(pre_ids, pre_msk), batch_size=16, shuffle=True)
        pre_opt = _build_pretrain_opt(model)
        last_lm_loss = _run_pretrain_epochs(model, pre_loader, pre_opt, pre_epochs_1)
        stage_sec = time.perf_counter() - t0
        torch.save({
            "model_state": model.state_dict(),
            "opt_state": pre_opt.state_dict(),
            "last_lm_loss": float(last_lm_loss),
            "elapsed_s": float(stage_sec),
        }, ckpt_root / "neo_stage1a.pt")
        print(f"NEO_STAGE_COMPLETE: pretrain_1 epochs={pre_epochs_1} lm_loss={last_lm_loss:.4f} elapsed={stage_sec:.2f}s")
        del model, pre_opt, pre_loader, pre_ids, pre_msk
        gc.collect()
        if stage != "all":
            return

    if stage in ("all", "pretrain_2"):
        t_s = time.perf_counter()
        _, word_to_id = build_domain_vocab()
        pretrain_sents = get_pretraining_sentences()
        pre_ids, pre_msk = encode_batch(pretrain_sents, word_to_id)
        ckpt = torch.load(ckpt_root / "neo_stage1a.pt", map_location="cpu", weights_only=False)
        model = ReciBotNeoGPT()
        model.load_state_dict(ckpt["model_state"])
        pre_loader = DataLoader(TensorDataset(pre_ids, pre_msk), batch_size=16, shuffle=True)
        pre_opt = _build_pretrain_opt(model)
        pre_opt.load_state_dict(ckpt["opt_state"])
        last_lm_loss = _run_pretrain_epochs(model, pre_loader, pre_opt, pre_epochs_2)
        pretrain_ppl = float(math.exp(min(10.0, last_lm_loss)))
        cum_elapsed = float(ckpt["elapsed_s"]) + (time.perf_counter() - t_s)
        torch.save({
            "model_state": model.state_dict(),
            "pretrain_ppl": pretrain_ppl,
            "elapsed_s": float(cum_elapsed),
        }, ckpt_root / "neo_stage1b.pt")
        print(f"NEO_STAGE_COMPLETE: pretrain_2 epochs={pre_epochs_2} ppl={pretrain_ppl:.2f} cum_elapsed={cum_elapsed:.2f}s")
        del model, pre_opt, pre_loader, pre_ids, pre_msk, ckpt
        gc.collect()
        if stage != "all":
            return

    if stage in ("all", "sft_1"):
        t_s = time.perf_counter()
        _, word_to_id = build_domain_vocab()
        train_s, val_s, _ = generate_dataset(seed=42, target_per_intent=120)
        ids_tr, msk_tr, yi_tr, yt_tr, yd_tr = build_task_tensors(train_s, word_to_id)
        ids_va, msk_va, yi_va, _, _ = build_task_tensors(val_s, word_to_id)

        ckpt = torch.load(ckpt_root / "neo_stage1b.pt", map_location="cpu", weights_only=False)
        model = ReciBotNeoGPT()
        model.load_state_dict(ckpt["model_state"])
        trainable_lora_params, total_with_lora = model.apply_lora_adapters()
        class_protos = nn.Parameter(torch.randn(NUM_INTENTS, EMB_DIM) * 0.05)
        task_opt, lora_params = _build_sft_opt(model, class_protos)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(task_opt, T_max=sft_epochs_total, eta_min=2e-4)
        task_loader = DataLoader(TensorDataset(ids_tr, msk_tr, yi_tr, yt_tr, yd_tr), batch_size=64, shuffle=True)

        best_val_acc, best_state = -1.0, None
        for _epoch in range(sft_half):
            best_val_acc, best_state = _run_sft_epoch(
                model, task_loader, task_opt, scheduler, class_protos, lora_params,
                ids_va, msk_va, yi_va, best_val_acc, best_state,
            )
            gc.collect()

        cum_elapsed = float(ckpt["elapsed_s"]) + (time.perf_counter() - t_s)
        torch.save({
            "model_state": model.state_dict(),
            "class_protos": class_protos.detach().cpu(),
            "opt_state": task_opt.state_dict(),
            "sched_state": scheduler.state_dict(),
            "best_val_acc": float(best_val_acc),
            "best_state": best_state,
            "trainable_lora_params": int(trainable_lora_params),
            "total_with_lora": int(total_with_lora),
            "pretrain_ppl": float(ckpt["pretrain_ppl"]),
            "elapsed_s": float(cum_elapsed),
        }, ckpt_root / "neo_stage2a.pt")
        print(f"NEO_STAGE_COMPLETE: sft_1 epochs={sft_half}/{sft_epochs_total} best_val_acc={best_val_acc:.4f} cum_elapsed={cum_elapsed:.2f}s")
        del model, task_opt, scheduler, task_loader, ids_tr, msk_tr, ids_va, msk_va, ckpt
        gc.collect()
        if stage != "all":
            return

    if stage in ("all", "sft_2"):
        t_s = time.perf_counter()
        _, word_to_id = build_domain_vocab()
        train_s, val_s, _ = generate_dataset(seed=42, target_per_intent=120)
        ids_tr, msk_tr, yi_tr, yt_tr, yd_tr = build_task_tensors(train_s, word_to_id)
        ids_va, msk_va, yi_va, _, _ = build_task_tensors(val_s, word_to_id)

        ckpt = torch.load(ckpt_root / "neo_stage2a.pt", map_location="cpu", weights_only=False)
        model = ReciBotNeoGPT()
        model.apply_lora_adapters()
        model.load_state_dict(ckpt["model_state"])
        class_protos = nn.Parameter(ckpt["class_protos"].clone())
        task_opt, lora_params = _build_sft_opt(model, class_protos)
        task_opt.load_state_dict(ckpt["opt_state"])
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(task_opt, T_max=sft_epochs_total, eta_min=2e-4)
        scheduler.load_state_dict(ckpt["sched_state"])
        task_loader = DataLoader(TensorDataset(ids_tr, msk_tr, yi_tr, yt_tr, yd_tr), batch_size=64, shuffle=True)

        best_val_acc = float(ckpt["best_val_acc"])
        best_state = ckpt["best_state"]
        for _epoch in range(sft_half, sft_epochs_total):
            best_val_acc, best_state = _run_sft_epoch(
                model, task_loader, task_opt, scheduler, class_protos, lora_params,
                ids_va, msk_va, yi_va, best_val_acc, best_state,
            )
            gc.collect()

        if best_state is not None:
            model.load_state_dict(best_state)
        cum_elapsed = float(ckpt["elapsed_s"]) + (time.perf_counter() - t_s)
        torch.save({
            "model_state": model.state_dict(),
            "trainable_lora_params": int(ckpt["trainable_lora_params"]),
            "total_with_lora": int(ckpt["total_with_lora"]),
            "pretrain_ppl": float(ckpt["pretrain_ppl"]),
            "best_val_acc": float(best_val_acc),
            "elapsed_s": float(cum_elapsed),
        }, ckpt_root / "neo_stage2b.pt")
        print(f"NEO_STAGE_COMPLETE: sft_2 epochs={sft_epochs_total}/{sft_epochs_total} best_val_acc={best_val_acc:.4f} cum_elapsed={cum_elapsed:.2f}s")
        del model, task_opt, scheduler, task_loader, ids_tr, msk_tr, ids_va, msk_va, ckpt
        gc.collect()
        if stage != "all":
            return

    # Final stage: dpo_export
    t_s = time.perf_counter()
    _, word_to_id = build_domain_vocab()
    train_s, val_s, _ = generate_dataset(seed=42, target_per_intent=120)
    ids_tr, msk_tr, yi_tr, yt_tr, yd_tr = build_task_tensors(train_s, word_to_id)
    ids_va, msk_va, yi_va, yt_va, yd_va = build_task_tensors(val_s, word_to_id)

    ckpt = torch.load(ckpt_root / "neo_stage2b.pt", map_location="cpu", weights_only=False)
    model = ReciBotNeoGPT()
    model.apply_lora_adapters()
    model.load_state_dict(ckpt["model_state"])
    trainable_lora_params = int(ckpt["trainable_lora_params"])
    total_with_lora = int(ckpt["total_with_lora"])
    pretrain_ppl = float(ckpt["pretrain_ppl"])
    sft_val_acc = float(ckpt["best_val_acc"])
    prev_elapsed = float(ckpt["elapsed_s"])

    # STAGE 3: Guarded DPO-Style Preference Margin Alignment
    dpo_texts = [p[0] for p in DPO_PREFERENCE_PAIRS]
    dpo_chosen = torch.tensor([p[1] for p in DPO_PREFERENCE_PAIRS], dtype=torch.long)
    dpo_rejected = torch.tensor([p[2] for p in DPO_PREFERENCE_PAIRS], dtype=torch.long)
    dpo_ids, dpo_msk = encode_batch(dpo_texts, word_to_id)

    dpo_opt = _build_dpo_opt(model)
    beta = 0.35
    best_dpo_val_acc = sft_val_acc
    best_dpo_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    for ep in range(dpo_epochs):
        model.train()
        dpo_opt.zero_grad()
        li_dpo, _, _, _ = model.forward_tasks(dpo_ids, dpo_msk)
        logp = F.log_softmax(li_dpo, dim=-1)
        chosen_lp = logp.gather(1, dpo_chosen.unsqueeze(1)).squeeze(1)
        rejected_lp = logp.gather(1, dpo_rejected.unsqueeze(1)).squeeze(1)
        dpo_loss = -F.logsigmoid(beta * (chosen_lp - rejected_lp)).mean()

        start = (ep * 256) % max(1, len(ids_tr) - 256)
        end = min(len(ids_tr), start + 256)
        li_tr_anchor, lt_anchor, ld_anchor, _ = model.forward_tasks(ids_tr[start:end], msk_tr[start:end])
        anchor_loss = (
            F.cross_entropy(li_tr_anchor, yi_tr[start:end])
            + 0.3 * F.binary_cross_entropy_with_logits(lt_anchor, yt_tr[start:end])
            + 0.3 * F.cross_entropy(ld_anchor, yd_tr[start:end])
        )
        total_dpo = dpo_loss + 0.65 * anchor_loss
        total_dpo.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        dpo_opt.step()

        model.eval()
        with torch.no_grad():
            v_li_dpo, _, _, _ = model.forward_tasks(ids_va, msk_va)
            cur_val_acc = float((torch.argmax(v_li_dpo, dim=-1) == yi_va).float().mean().item())
            if cur_val_acc >= sft_val_acc - 0.002 and cur_val_acc >= best_dpo_val_acc - 0.001:
                best_dpo_val_acc = max(best_dpo_val_acc, cur_val_acc)
                best_dpo_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_dpo_state)

    # Merge LoRA adapters cleanly into dense weights before export
    model.merge_lora_adapters()
    inference_param_count = sum(p.numel() for p in model.parameters())
    model.eval()

    with torch.no_grad():
        tr_li, _, _, _ = model.forward_tasks(ids_tr, msk_tr)
        va_li, va_lt, va_ld, va_emb = model.forward_tasks(ids_va, msk_va)

        kb_texts = [
            f"{d['title']} {d.get('law_ref', '')} {' '.join(d.get('tags', []))} {d['content']} {' '.join(d.get('facts', []))}"
            for d in KNOWLEDGE_BASE_DOCS
        ]
        kb_ids, kb_msk = encode_batch(kb_texts, word_to_id)
        _, _, _, kb_emb = model.forward_tasks(kb_ids, kb_msk)

    tr_preds = torch.argmax(tr_li, dim=-1).numpy()
    va_preds = torch.argmax(va_li, dim=-1).numpy()
    va_probs = torch.softmax(va_li, dim=-1).numpy()
    va_tool_probs = torch.sigmoid(va_lt).numpy()
    va_depth_preds = torch.argmax(va_ld, dim=-1).numpy()

    train_intent_acc = float(np.mean(tr_preds == yi_tr.numpy()))
    val_intent_acc = float(np.mean(va_preds == yi_va.numpy()))
    val_intent_f1 = macro_f1_multiclass(va_preds, yi_va.numpy(), NUM_INTENTS)
    val_tool_f1 = macro_f1_multilabel(va_tool_probs, yt_va.numpy())
    val_depth_acc = float(np.mean(va_depth_preds == yd_va.numpy()))

    rag_metrics = evaluate_rag_with_embeddings(
        doc_embeddings=kb_emb.numpy(),
        query_embeddings=va_emb.numpy(),
        val_samples=val_s,
        docs=KNOWLEDGE_BASE_DOCS,
    )
    export_rag_index(neo_doc_embeddings=kb_emb.numpy(), val_metrics=rag_metrics)

    s_id = ids_va[:1]
    s_mk = msk_va[:1]
    lat_t0 = time.perf_counter()
    with torch.no_grad():
        for _ in range(300):
            model.forward_tasks(s_id, s_mk)
    py_latency_us = ((time.perf_counter() - lat_t0) / 300.0) * 1e6

    torch.save({
        "model_state": model.state_dict(),
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "e_emb": E_EMB,
        "d_model": D_MODEL,
        "n_heads": N_HEADS,
        "n_layers": N_LAYERS,
        "ffn_dim": FFN_DIM,
        "n_intents": NUM_INTENTS,
        "n_tools": NUM_TOOLS,
        "n_depths": NUM_DEPTHS,
        "emb_dim": EMB_DIM,
    }, ARTIFACTS_DIR / "recibot_neo.pt")

    ordered = extract_ordered_tensors(model)

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
    int8_val_acc = verify_int8_parity(int8_verify, ids_va.numpy(), msk_va.numpy(), yi_va.numpy())

    # Binary weights for C++, Rust, Julia, Mojo ("RNE3" with E_EMB header field)
    with open(ARTIFACTS_DIR / "weights_neo.bin", "wb") as bf:
        bf.write(b"RNE3")
        bf.write(struct.pack(
            "<12i",
            3, VOCAB_SIZE, MAX_SEQ_LEN, E_EMB, D_MODEL, N_HEADS, N_LAYERS,
            FFN_DIM, NUM_INTENTS, NUM_TOOLS, NUM_DEPTHS, EMB_DIM,
        ))
        for _, arr in ordered:
            bf.write(np.ascontiguousarray(arr.reshape(-1), dtype="<f4").tobytes())

    with open(ARTIFACTS_DIR / "eval_predictions.csv", "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow([
            "idx", "true_intent", "pred_intent", "confidence", "correct",
            "true_depth", "pred_depth", "top_tool", "text",
        ])
        for i, sample in enumerate(val_s):
            top_t = int(np.argmax(va_tool_probs[i]))
            writer.writerow([
                i,
                sample["intent_name"],
                INTENTS[int(va_preds[i])],
                round(float(np.max(va_probs[i])), 6),
                int(va_preds[i] == sample["intent_id"]),
                DEPTH_LABELS[sample["depth_id"]],
                DEPTH_LABELS[int(va_depth_preds[i])],
                TOOLS[top_t] if va_tool_probs[i][top_t] >= 0.4 else "none",
                sample["text"],
            ])

    elapsed_s = round(prev_elapsed + (time.perf_counter() - t_s), 3)
    metrics = {
        "model": "recibot-neo",
        "role": "deep_reasoning_transformer_lora_dpo_rag",
        "architecture": f"GPT-Factorized({VOCAB_SIZE}x{E_EMB}->{D_MODEL},{N_LAYERS}L,{N_HEADS}H,ffn={FFN_DIM})+LoRA(r={LORA_RANK})+DPO+RAG(d={EMB_DIM})",
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "e_emb": E_EMB,
        "inference_parameters": int(inference_param_count),
        "lora_trainable_parameters": int(trainable_lora_params),
        "total_params_with_lora": int(total_with_lora),
        "train_samples": len(train_s),
        "val_samples": len(val_s),
        "pretrain_epochs": pre_epochs_1 + pre_epochs_2,
        "pretrain_perplexity": round(pretrain_ppl, 2),
        "lora_sft_epochs": sft_epochs_total,
        "dpo_epochs": dpo_epochs,
        "train_intent_acc": round(train_intent_acc, 4),
        "val_intent_acc": round(val_intent_acc, 4),
        "val_intent_macro_f1": round(val_intent_f1, 4),
        "val_tool_macro_f1": round(val_tool_f1, 4),
        "val_depth_acc": round(val_depth_acc, 4),
        "val_intent_acc_int8": round(int8_val_acc, 4),
        "rag_eval": rag_metrics,
        "python_fp32_latency_us": round(py_latency_us, 2),
        "train_time_sec": elapsed_s,
    }
    (ARTIFACTS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    print("RECIBOT_NEO_TRAINING_COMPLETE:", json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=["pretrain_1", "pretrain_2", "sft_1", "sft_2", "dpo_export", "all"], default="all")
    parser.add_argument("--ckpt-dir", default="/tmp/recibot_v5_ckpt")
    args = parser.parse_args()
    train_neo(stage=args.stage, ckpt_dir=args.ckpt_dir)
