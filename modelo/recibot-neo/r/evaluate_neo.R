# ReciBot Neo R Statistical Evaluation & Expected Calibration Error (ECE)
# Run with: Rscript modelo/recibot-neo/r/evaluate_neo.R

df <- read.csv("modelo/recibot-neo/artifacts/eval_predictions.csv", stringsAsFactors = FALSE)

overall_acc <- mean(df$correct == 1)
cat(sprintf("ReciBot Neo Overall Validation Accuracy: %.4f (%d samples)\n", overall_acc, nrow(df)))

# Per-intent precision, recall, F1
intents <- sort(unique(df$true_intent))
f1_vals <- numeric(length(intents))
for (i in seq_along(intents)) {
  k <- intents[i]
  tp <- sum(df$pred_intent == k & df$true_intent == k)
  fp <- sum(df$pred_intent == k & df$true_intent != k)
  fn <- sum(df$pred_intent != k & df$true_intent == k)
  f1_vals[i] <- ifelse((2 * tp + fp + fn) > 0, (2 * tp) / (2 * tp + fp + fn), 0)
}
cat(sprintf("Macro-F1 across %d intents: %.4f\n", length(intents), mean(f1_vals)))

# Expected Calibration Error (10 bins)
bins <- seq(0, 1, by = 0.1)
ece <- 0
for (b in seq_len(length(bins) - 1)) {
  idx <- which(df$confidence >= bins[b] & df$confidence < bins[b + 1])
  if (length(idx) > 0) {
    ece <- ece + (length(idx) / nrow(df)) * abs(mean(df$correct[idx]) - mean(df$confidence[idx]))
  }
}
cat(sprintf("Expected Calibration Error (ECE): %.4f\n", ece))
