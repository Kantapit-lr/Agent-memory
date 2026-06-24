import pdfParse from "pdf-parse";
import { chunkText, ChunkObject } from "./chunker";

export async function processPDF(arrayBuffer: ArrayBuffer): Promise<ChunkObject[]> {
  const buffer = Buffer.from(arrayBuffer);
  
  const textResult = await pdfParse(buffer);
  const extractedText = textResult.text || String(textResult);

  return chunkText(extractedText, 2000, 200);
}