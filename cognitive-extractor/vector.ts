import { CohereClient } from "cohere-ai";
import "dotenv/config";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

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