// ReciBot Neo Scala Functional Verification Pipeline & Confidence Calibrator
// Reads modelo/recibot-neo/artifacts/eval_predictions.csv

import scala.io.Source

object NeoReasoningPipeline {
  case class EvalRow(
    idx: Int,
    trueIntent: String,
    predIntent: String,
    confidence: Double,
    correct: Boolean,
    trueDepth: String,
    predDepth: String,
    topTool: String
  )

  def parseLine(line: String): Option[EvalRow] = {
    val cols = line.split(",", 9)
    if (cols.length < 8) None
    else Some(EvalRow(
      cols(0).toInt, cols(1), cols(2), cols(3).toDouble,
      cols(4) == "1", cols(5), cols(6), cols(7)
    ))
  }

  def main(args: Array[String]): Unit = {
    val src = Source.fromFile("modelo/recibot-neo/artifacts/eval_predictions.csv", "UTF-8")
    try {
      val rows = src.getLines().drop(1).flatMap(parseLine).toVector
      val acc = rows.count(_.correct).toDouble / math.max(1, rows.size)
      val deepRows = rows.filter(_.predDepth == "deep_multi_check")
      val lowConf = rows.filter(_.confidence < 0.55)
      println(f"[ReciBot Neo Scala] Total=${rows.size} Acc=${acc * 100}%.2f%% DeepChecks=${deepRows.size} EscalatedVerify=${lowConf.size}")
    } finally {
      src.close()
    }
  }
}
