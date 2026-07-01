import pdfParse from "pdf-parse";
import * as webTreeSitter from "web-tree-sitter";
import path from "path";

const Parser = webTreeSitter as any;

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

export async function processCode(code: string): Promise<ChunkObject[]> {
  await Parser.init();
  const parser = new Parser();
  
  const wasmPath = path.join(__dirname, "tree-sitter-javascript.wasm");
  const Lang = await Parser.Language.load(wasmPath);
  
  parser.setLanguage(Lang);
  const tree = parser.parse(code);
  
  const chunks: ChunkObject[] = [];
  let sequence = 1;

  for (let i = 0; i < tree.rootNode.childCount; i++) {
    const child = tree.rootNode.child(i);
    const text = child?.text;
    if (text && text.trim() !== "") {
      chunks.push({
        id: `chunk_${Date.now()}_${sequence}`,
        text: text.trim(),
        sequence_order: sequence
      });
      sequence++;
    }
  }

  return chunks;
}

export async function processImage(base64Image: string, mimeType: string, apiKey: string): Promise<ChunkObject[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Extract all text from this image and maintain layout as Markdown. Return only the extracted text." },
          { inline_data: { mime_type: mimeType, data: base64Image } }
        ]
      }]
    })
  });

  const data = await response.json();
  const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return chunkText(extractedText, 2000, 200);
}