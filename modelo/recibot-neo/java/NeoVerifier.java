import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

/**
 * ReciBot Neo Java Deep Verifier & Rule Integrity Auditor.
 * Validates Transformer predictions + DGII NCF / RNC / Branch invariants for ReciminsaApp.
 */
public class NeoVerifier {
    static final int MAX_SEQ = 32;
    static final int OOV_START = 11808;
    static final int OOV_BUCKETS = 8192;

    static int fnv1a32(byte[] data) {
        int h = (int) 2166136261L;
        for (byte b : data) {
            h ^= (b & 0xFF);
            h *= 16777619;
        }
        return h;
    }

    static String normalizeAscii(String text) {
        byte[] raw = text.getBytes(StandardCharsets.UTF_8);
        StringBuilder sb = new StringBuilder(raw.length);
        for (int i = 0; i < raw.length; i++) {
            int b = raw[i] & 0xFF;
            if (b == 0xC3 && i + 1 < raw.length) {
                int b2 = raw[++i] & 0xFF;
                char c = ' ';
                if (b2 == 0xA1 || b2 == 0x81 || b2 == 0xA0 || b2 == 0x80 || b2 == 0xA4 || b2 == 0x84) c = 'a';
                else if (b2 == 0xA9 || b2 == 0x89 || b2 == 0xA8 || b2 == 0x88 || b2 == 0xAB || b2 == 0x8B) c = 'e';
                else if (b2 == 0xAD || b2 == 0x8D || b2 == 0xAC || b2 == 0x8C || b2 == 0xAF || b2 == 0x8F) c = 'i';
                else if (b2 == 0xB3 || b2 == 0x93 || b2 == 0xB2 || b2 == 0x92 || b2 == 0xB6 || b2 == 0x96) c = 'o';
                else if (b2 == 0xBA || b2 == 0x9A || b2 == 0xB9 || b2 == 0x99 || b2 == 0xBC || b2 == 0x9C) c = 'u';
                else if (b2 == 0xB1 || b2 == 0x91) c = 'n';
                else if (b2 == 0xA7 || b2 == 0x87) c = 'c';
                sb.append(c);
                continue;
            }
            if (b >= 'A' && b <= 'Z') sb.append((char) (b + 32));
            else if ((b >= 'a' && b <= 'z') || (b >= '0' && b <= '9')) sb.append((char) b);
            else sb.append(' ');
        }
        return sb.toString();
    }

    static boolean verifyDgiiRule(String ncfType, String rnc, int remainingSeq) {
        if (ncfType == null || ncfType.isEmpty()) return true; // Factura comercial sin NCF permitida
        if (remainingSeq <= 0) return false; // Ilegal emitir NCF agotado segun DGII
        if ("B01".equals(ncfType) || "E31".equals(ncfType) || "B14".equals(ncfType) || "B15".equals(ncfType)) {
            String digits = (rnc == null ? "" : rnc).replaceAll("\\D", "");
            return digits.length() == 9 || digits.length() == 11;
        }
        return true;
    }

    static boolean verifyB04ItbisWindow(int days) {
        return days >= 0 && days <= 30; // Regl. 293-11: recuperar ITBIS solo dentro de 30 dias
    }

    static boolean verifyAmlScrapKyc(boolean isCash, String idDoc) {
        if (!isCash) return true;
        String digits = (idDoc == null ? "" : idDoc).replaceAll("\\D", "");
        return digits.length() == 9 || digits.length() == 11; // KYC minimo en compra de chatarra en efectivo
    }

    public static void main(String[] args) throws IOException {
        String evalPath = "modelo/recibot-neo/artifacts/eval_predictions.csv";
        String metricsPath = "modelo/recibot-neo/artifacts/metrics.json";

        List<String> lines = Files.readAllLines(Paths.get(evalPath), StandardCharsets.UTF_8);
        int total = Math.max(0, lines.size() - 1);
        int correct = 0;
        int deepChecks = 0;
        double confSum = 0.0;

        for (int i = 1; i < lines.size(); i++) {
            String[] cols = lines.get(i).split(",", 9);
            if (cols.length >= 7) {
                confSum += Double.parseDouble(cols[3]);
                if ("1".equals(cols[4])) correct++;
                if ("deep_multi_check".equals(cols[6])) deepChecks++;
            }
        }

        // Verify DGII & Corporate Legal invariants
        boolean okB01Valid = verifyDgiiRule("B01", "131999991", 25);
        boolean blockExhausted = !verifyDgiiRule("B01", "131999991", 0);
        boolean blockMissingRnc = !verifyDgiiRule("B01", "123", 10);
        boolean allowCommercialNoNcf = verifyDgiiRule("", "", 0);
        boolean b04WindowOk = verifyB04ItbisWindow(20) && !verifyB04ItbisWindow(45);
        boolean amlKycOk = !verifyAmlScrapKyc(true, "") && verifyAmlScrapKyc(true, "00112345678");
        boolean rulesPass = okB01Valid && blockExhausted && blockMissingRnc && allowCommercialNoNcf && b04WindowOk && amlKycOk;

        String normSample = normalizeAscii("Auditoria NCF DGII y Ley 155-17 Sucursal San Cristobal");
        int sampleHashBucket = OOV_START + (fnv1a32("b01".getBytes(StandardCharsets.US_ASCII)) & (OOV_BUCKETS - 1));

        System.out.println("=== RECIBOT NEO JAVA MULTI-CHECK VERIFIER ===");
        System.out.printf("Eval rows: %d | Verified Val Acc: %.4f | Avg Conf: %.4f | Deep Multi-Check queries: %d%n",
                total, total > 0 ? (correct / (double) total) : 0.0, total > 0 ? (confSum / total) : 0.0, deepChecks);
        System.out.println("ASCII Normalization Parity Sample: \"" + normSample + "\" | OOV Bucket(b01)=" + sampleHashBucket);
        System.out.println("DGII & Corporate Legal Verifier Checks Passed: " + rulesPass);
        System.out.println("Metrics JSON present: " + Files.exists(Paths.get(metricsPath)));
        if (!rulesPass) System.exit(1);
    }
}
