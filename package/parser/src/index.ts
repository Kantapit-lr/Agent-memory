import pdfParse from "pdf-parse";

export interface ASTMetadata {
  type: "import" | "function" | "class" | "unknown";
  name?: string;
  imports?: string[];
  calls?: string[];
}

export interface ChunkObject {
  id: string;
  text: string;
  sequence_order: number;
  ast_metadata?: ASTMetadata;
}

export function chunkText(text: string, maxChunkSize: number = 2000, overlapSize: number = 200): ChunkObject[] {
  if (!text || text.trim() === "") return [];

  const chunks: ChunkObject[] = [];
  let startIndex = 0;
  let sequence = 1;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex < text.length) {
      const splitPoint = Math.max(text.lastIndexOf(" ", endIndex), text.lastIndexOf("\n", endIndex));
      if (splitPoint > startIndex + overlapSize) endIndex = splitPoint;
    }
    const chunkString = text.substring(startIndex, endIndex).trim();
    if (chunkString) {
      chunks.push({ id: `chunk_${Date.now()}_${sequence}`, text: chunkString, sequence_order: sequence });
      sequence++;
    }
    startIndex = endIndex - overlapSize;
  }
  return chunks;
}

export async function processPDF(arrayBuffer: ArrayBuffer): Promise<ChunkObject[]> {
  const buffer = Buffer.from(arrayBuffer);
  const textResult = await pdfParse(buffer);
  return chunkText(textResult.text || String(textResult), 2000, 200);
}

export function processText(text: string): ChunkObject[] {
  return chunkText(text, 2000, 200);
}

// ✨ Custom Regex-based AST Extractor (No C++ Build Required!)
export async function processCode(code: string): Promise<ChunkObject[]> {
  const chunks: ChunkObject[] = [];
  
  // 1. สกัดรายชื่อ Imports
  const imports: string[] = [];
  const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // 2. สกัดชื่อฟังก์ชัน (สมมติว่าเป็น Function Block เดียว)
  let funcName = "anonymous_function";
  const funcRegex = /function\s+([a-zA-Z0-9_]+)/;
  const funcMatch = code.match(funcRegex);
  if (funcMatch) funcName = funcMatch[1];

  // 3. สกัดรายชื่อฟังก์ชันที่ถูกเรียก (Calls)
  const calls: string[] = [];
  const callRegex = /([a-zA-Z0-9_]+)\s*\(/g;
  // กรอง Keyword ของภาษาทิ้งไป
  const reserved = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'import'];
  while ((match = callRegex.exec(code)) !== null) {
    const name = match[1];
    if (!reserved.includes(name) && name !== funcName) {
      calls.push(name);
    }
  }

  chunks.push({
    id: `chunk_code_${Date.now()}_1`,
    text: code.trim(),
    sequence_order: 1,
    ast_metadata: {
      type: "function",
      name: funcName,
      imports: imports.length > 0 ? imports : undefined,
      calls: calls.length > 0 ? Array.from(new Set(calls)) : undefined
    }
  });

  return chunks;
}

export async function processImage(base64Image: string, mimeType: string, apiKey: string): Promise<ChunkObject[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Extract all text from this image and maintain layout as Markdown. Return only the extracted text." }, { inline_data: { mime_type: mimeType, data: base64Image } }] }]
    })
  });
  const data = await response.json();
  return chunkText(data.candidates?.[0]?.content?.parts?.[0]?.text || "", 2000, 200);
}