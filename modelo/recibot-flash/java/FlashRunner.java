import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

/**
 * ReciBot Flash Java Fast Router & Lightweight Consistency Check.
 */
public class FlashRunner {
    public static void main(String[] args) throws IOException {
        String evalPath = "modelo/recibot-flash/artifacts/eval_predictions.csv";
        String metricsPath = "modelo/recibot-flash/artifacts/metrics.json";
        long t0 = System.nanoTime();
        List<String> lines = Files.readAllLines(Paths.get(evalPath), StandardCharsets.UTF_8);

        int total = Math.max(0, lines.size() - 1);
        int correct = 0;
        double confSum = 0.0;
        for (int i = 1; i < lines.size(); i++) {
            String[] cols = lines.get(i).split(",", 7);
            if (cols.length >= 5) {
                confSum += Double.parseDouble(cols[3]);
                if ("1".equals(cols[4])) correct++;
            }
        }
        double ms = (System.nanoTime() - t0) / 1e6;
        System.out.println("=== RECIBOT FLASH JAVA FAST RUNNER ===");
        System.out.printf("Eval rows: %d | Distilled Val Acc: %.4f | Avg Conf: %.4f | Parse time: %.2f ms%n",
                total, total > 0 ? (correct / (double) total) : 0.0, total > 0 ? (confSum / total) : 0.0, ms);
        System.out.println("Metrics JSON present: " + Files.exists(Paths.get(metricsPath)));
    }
}
