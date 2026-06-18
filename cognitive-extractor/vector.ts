import { CohereClient } from "cohere-ai";
import "dotenv/config";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || "dummy_key_for_mocking_mode",
});

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  //โหมดจำลอง (Mock Mode)
  if (process.env.USE_MOCK_AI === "true") {
    console.log("⚠️ [MOCK MODE] กำลังจำลอง Vector 1024 มิติ...");
    return texts.map(() => Array.from({ length: 1024 }, () => Math.random() * 0.1));
  }

  //โหมดใช้งานจริง (ยิงเข้า Cohere API)
  try {
    const response = await cohere.embed({
      texts: texts,
      model: "embed-multilingual-v3.0",
      inputType: "search_document",
    });

    return response.embeddings as any;
  } catch (error) {
    console.error("❌ Cohere API Error:", error);
    return [];
  }
}