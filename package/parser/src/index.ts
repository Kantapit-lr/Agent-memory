import pdfParse from "pdf-parse";

export interface ChunkObject {
  id: string;
  text: string;
  sequence_order: number;
}

export function chunkText(text: string, maxChunkSize: number = 2000, overlapSize: number = 200): ChunkObject[] {
  if (!text || text.trim() === "") return [];

  const chunks: ChunkObject[] = [];
  let startIndex = 0;
  let sequence = 1;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    
    if (endIndex < text.length) {
      const lastSpace = text.lastIndexOf(" ", endIndex);
      const lastNewline = text.lastIndexOf("\n", endIndex);
      const splitPoint = Math.max(lastSpace, lastNewline);
      
      if (splitPoint > startIndex + overlapSize) {
        endIndex = splitPoint;
      }
    }

    const chunkString = text.substring(startIndex, endIndex).trim();
    if (chunkString) {
      chunks.push({
        id: `chunk_${Date.now()}_${sequence}`,
        text: chunkString,
        sequence_order: sequence
      });
      sequence++;
    }

    startIndex = endIndex - overlapSize;
  }

  return chunks;
}

export async function processPDF(arrayBuffer: ArrayBuffer): Promise<ChunkObject[]> {
  const buffer = Buffer.from(arrayBuffer);
  
  const textResult = await pdfParse(buffer);
  const extractedText = textResult.text || String(textResult);
  
  return chunkText(extractedText, 2000, 200);
}

export function processText(text: string): ChunkObject[] {
  return chunkText(text, 2000, 200);
}