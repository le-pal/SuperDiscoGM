import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

// Extraction de texte des fichiers uploadés [Q13b] — images/cartes ignorées en V1, seul le
// texte alimente Scenario.rawContent. pdf-parse v2 API (PDFParse class, pas la v1 fonctionnelle).
export async function extractText(data: Buffer, mimeType: string, filename: string): Promise<string> {
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    const parser = new PDFParse({ data });
    const result = await parser.getText();
    return result.text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value;
  }

  // markdown / texte brut — lu directement
  return data.toString("utf-8");
}
