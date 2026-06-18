export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = vecA[i] || 0;
    const valB = vecB[i] || 0;

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  const similarity = dotProduct / (normA * normB);

  console.log(`      📊 [Math] Dot Product (A·B): ${dotProduct.toFixed(4)}`);
  console.log(`      📊 [Math] Magnitude A (||A||): ${normA.toFixed(4)}`);
  console.log(`      📊 [Math] Magnitude B (||B||): ${normB.toFixed(4)}`);
  console.log(`      📊 [Math] สูตร: ${dotProduct.toFixed(4)} / (${normA.toFixed(4)} * ${normB.toFixed(4)})`);
  console.log(`      🔍 [Resolution] ผลลัพธ์ความเหมือน: ${(similarity * 100).toFixed(2)}%`);

  return similarity;
}

export function isDuplicateEntity(
  newEmbedding: number[],
  existingEmbedding: number[],
  threshold: number = 0.85
): boolean {
  const similarity = calculateCosineSimilarity(newEmbedding, existingEmbedding);
  return similarity >= threshold;
}