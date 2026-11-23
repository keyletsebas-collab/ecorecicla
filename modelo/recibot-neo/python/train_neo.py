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

os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("MKL_NUM_THREADS", "4")

import base64
import csv
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

torch.set_num_threads(4)

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

D_MODEL = 112
N_HEADS = 4
HEAD_DIM = 28
N_LAYERS = 2
FFN_DIM = 224
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
        self.tok_emb = nn.Embedding(VOCAB_SIZE, D_MODEL)
        self.pos_emb = nn.Embedding(MAX_SEQ_LEN, D_MODEL)
        self.emb_drop = nn.Dropout(0.1)
        self.blocks = nn.ModuleList([TransformerBlock() for _ in range(N_LAYERS)])
        self.norm_out = nn.LayerNorm(D_MODEL, eps=1e-5)

        # Pretraining LM head (Stage 1 only)
        self.lm_head = nn.Linear(D_MODEL, VOCAB_SIZE, bias=False)
        # Task heads (Stage 2 & 3 + inference)
        self.intent_head = nn.Linear(D_MODEL, NUM_INTENTS)
        self.tool_head = nn.Linear(D_MODEL, NUM_TOOLS)
        self.depth_head = nn.Linear(D_MODEL, NUM_DEPTHS)
        self.embed_head = nn.Linear(D_MODEL, EMB_DIM)

    def encode_sequence(self, token_ids: torch.Tensor, attn_mask: torch.Tensor, causal: bool = False) -> torch.Tensor:
        B, T = token_ids.shape
        pos = torch.arange(T, device=token_ids.device).unsqueeze(0).expand(B, T)
        x = self.emb_drop(self.tok_emb(token_ids) + self.pos_emb(pos))
        for block in self.blocks:
            x = block(x, attn_mask, causal=causal)
        return self.norm_out(x)

    def forward_lm(self, token_ids: torch.Tensor, attn_mask: torch.Tensor) -> torch.Tensor:
        h = self.encode_sequence(token_ids, attn_mask, causal=True)
        return self.lm_head(h)

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
        # Attach Rank-8 LoRA adapters across Attention (wq/wv/wo), FFN, and unfreeze tok_emb with weight decay
        # so domain words absent from small Stage-1 corpus align cleanly with Transformer heads.
        for p in self.parameters():
            p.requires_grad = False
        for p in self.tok_emb.parameters():
            p.requires_grad = True
        for blk in self.blocks:
            blk.attn.wq = LoRALinear(blk.attn.wq)
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

    tok_e = deq("tok_emb.weight")[ids_va]
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


def train_neo() -> None:
    t0 = time.perf_counter()
    torch.manual_seed(42)
    np.random.seed(42)

    export_shared_metadata(SHARED_DIR)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    _, word_to_id = build_domain_vocab()

    train_s, val_s, _ = generate_dataset(seed=42, target_per_intent=104)
    ids_tr, msk_tr, yi_tr, yt_tr, yd_tr = build_task_tensors(train_s, word_to_id)
    ids_va, msk_va, yi_va, yt_va, yd_va = build_task_tensors(val_s, word_to_id)

    pretrain_sents = get_pretraining_sentences()
    pre_ids, pre_msk = encode_batch(pretrain_sents, word_to_id)

    model = ReciBotNeoGPT()

    # =========================================================
    # STAGE 1: GPT-Style Causal Next-Token Pretraining
    # =========================================================
    pre_loader = DataLoader(TensorDataset(pre_ids, pre_msk), batch_size=64, shuffle=True)
    pre_opt = torch.optim.AdamW(model.parameters(), lr=4e-3, weight_decay=1e-2)
    pre_epochs = 15
    last_lm_loss = 0.0
    model.train()
    for _epoch in range(pre_epochs):
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
        last_lm_loss = total_loss / max(1, steps)
    pretrain_ppl = float(math.exp(min(10.0, last_lm_loss)))

    # =========================================================
    # STAGE 2: LoRA Rank-8 Fine-Tuning + Multi-Task + RAG Embeddings
    # =========================================================
    trainable_lora_params, total_with_lora = model.apply_lora_adapters()
    class_protos = nn.Parameter(torch.randn(NUM_INTENTS, EMB_DIM) * 0.05)

    lora_params = [p for p in model.parameters() if p.requires_grad] + [class_protos]
    task_opt = torch.optim.AdamW(lora_params, lr=6e-3, weight_decay=2e-2)
    sft_epochs = 32
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(task_opt, T_max=sft_epochs)
    task_loader = DataLoader(TensorDataset(ids_tr, msk_tr, yi_tr, yt_tr, yd_tr), batch_size=128, shuffle=True)

    best_state = None
    best_val_acc = -1.0

    for _epoch in range(sft_epochs):
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
                best_state = {k: v.clone() for k, v in model.state_dict().items()}

    if best_state is not None:
        model.load_state_dict(best_state)

    # =========================================================
    # STAGE 3: DPO-Style Preference Margin Alignment
    # =========================================================
    dpo_texts = [p[0] for p in DPO_PREFERENCE_PAIRS]
    dpo_chosen = torch.tensor([p[1] for p in DPO_PREFERENCE_PAIRS], dtype=torch.long)
    dpo_rejected = torch.tensor([p[2] for p in DPO_PREFERENCE_PAIRS], dtype=torch.long)
    dpo_ids, dpo_msk = encode_batch(dpo_texts, word_to_id)

    dpo_opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=1.5e-3, weight_decay=5e-3)
    dpo_epochs = 12
    beta = 0.35
    for _epoch in range(dpo_epochs):
        model.train()
        dpo_opt.zero_grad()
        li_dpo, _, _, _ = model.forward_tasks(dpo_ids, dpo_msk)
        logp = F.log_softmax(li_dpo, dim=-1)
        chosen_lp = logp.gather(1, dpo_chosen.unsqueeze(1)).squeeze(1)
        rejected_lp = logp.gather(1, dpo_rejected.unsqueeze(1)).squeeze(1)
        dpo_loss = -F.logsigmoid(beta * (chosen_lp - rejected_lp)).mean()

        # Rehearsal anchor on training sample slice to avoid forgetting
        li_tr_anchor, lt_anchor, _, _ = model.forward_tasks(ids_tr[:256], msk_tr[:256])
        anchor_loss = F.cross_entropy(li_tr_anchor, yi_tr[:256]) + 0.3 * F.binary_cross_entropy_with_logits(lt_anchor, yt_tr[:256])
        total_dpo = dpo_loss + 0.65 * anchor_loss
        total_dpo.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        dpo_opt.step()

    # Merge LoRA adapters cleanly into dense weights before export
    model.merge_lora_adapters()
    # Drop training-only LM head from parameter count calculation for runtime inference model
    inference_param_count = (
        sum(p.numel() for p in model.parameters()) - sum(p.numel() for p in model.lm_head.parameters())
    )
    model.eval()

    with torch.no_grad():
        tr_li, tr_lt, tr_ld, _ = model.forward_tasks(ids_tr, msk_tr)
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

    # Evaluate Hybrid RAG with trained Transformer embeddings
    rag_metrics = evaluate_rag_with_embeddings(
        doc_embeddings=kb_emb.numpy(),
        query_embeddings=va_emb.numpy(),
        val_samples=val_s,
        docs=KNOWLEDGE_BASE_DOCS,
    )
    export_rag_index(neo_doc_embeddings=kb_emb.numpy(), val_metrics=rag_metrics)

    # Single-query latency benchmark in PyTorch CPU
    s_id = ids_va[:1]
    s_mk = msk_va[:1]
    lat_t0 = time.perf_counter()
    with torch.no_grad():
        for _ in range(300):
            model.forward_tasks(s_id, s_mk)
    py_latency_us = ((time.perf_counter() - lat_t0) / 300.0) * 1e6

    # Save checkpoint (merged inference state + head architecture config)
    torch.save({
        "model_state": model.state_dict(),
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
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

    # Binary weights for C++, Rust, Julia, Mojo ("RNE2")
    with open(ARTIFACTS_DIR / "weights_neo.bin", "wb") as bf:
        bf.write(b"RNE2")
        bf.write(struct.pack(
            "<11i",
            2, VOCAB_SIZE, MAX_SEQ_LEN, D_MODEL, N_HEADS, N_LAYERS,
            FFN_DIM, NUM_INTENTS, NUM_TOOLS, NUM_DEPTHS, EMB_DIM,
        ))
        for _, arr in ordered:
            bf.write(np.ascontiguousarray(arr.reshape(-1), dtype="<f4").tobytes())

    # Predictions CSV for Scala and R scripts
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

    elapsed_s = round(time.perf_counter() - t0, 3)
    metrics = {
        "model": "recibot-neo",
        "role": "deep_reasoning_transformer_lora_dpo_rag",
        "architecture": f"GPT-Transformer({N_LAYERS}L,{N_HEADS}H,d={D_MODEL},ffn={FFN_DIM})+LoRA(r={LORA_RANK})+DPO+RAG(d={EMB_DIM})",
        "vocab_size": VOCAB_SIZE,
        "max_seq_len": MAX_SEQ_LEN,
        "inference_parameters": int(inference_param_count),
        "lora_trainable_parameters": int(trainable_lora_params),
        "total_params_with_lora": int(total_with_lora),
        "train_samples": len(train_s),
        "val_samples": len(val_s),
        "pretrain_epochs": pre_epochs,
        "pretrain_perplexity": round(pretrain_ppl, 2),
        "lora_sft_epochs": sft_epochs,
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
    train_neo()
