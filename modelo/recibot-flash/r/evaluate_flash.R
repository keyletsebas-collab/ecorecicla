# ReciBot Flash R Distilled Evaluation & Teacher Parity Report
# Run with: Rscript modelo/recibot-flash/r/evaluate_flash.R

flash_df <- read.csv("modelo/recibot-flash/artifacts/eval_predictions.csv", stringsAsFactors = FALSE)
neo_df <- read.csv("modelo/recibot-neo/artifacts/eval_predictions.csv", stringsAsFactors = FALSE)

flash_acc <- mean(flash_df$correct == 1)
agreement <- mean(flash_df$pred_intent == neo_df$pred_intent)
cat(sprintf("ReciBot Flash Distilled Val Accuracy: %.4f | Agreement vs Neo Teacher: %.4f\n", flash_acc, agreement))
