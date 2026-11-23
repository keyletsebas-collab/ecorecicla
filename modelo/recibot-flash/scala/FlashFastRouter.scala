// ReciBot Flash Scala Fast Router Evaluator
// Reads modelo/recibot-flash/artifacts/eval_predictions.csv

import scala.io.Source

object FlashFastRouter {
  def main(args: Array[String]): Unit = {
    val src = Source.fromFile("modelo/recibot-flash/artifacts/eval_predictions.csv", "UTF-8")
    try {
      val lines = src.getLines().drop(1).toVector
      val correct = lines.count { l =>
        val cols = l.split(",", 7)
        cols.length >= 5 && cols(4) == "1"
      }
      val acc = correct.toDouble / math.max(1, lines.size)
      println(f"[ReciBot Flash Scala] Fast Distilled Samples=${lines.size} Acc=${acc * 100}%.2f%%")
    } finally {
      src.close()
    }
  }
}
