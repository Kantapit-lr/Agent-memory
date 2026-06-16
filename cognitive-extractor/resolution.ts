export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] || 0; 
    const b = vecB[i] || 0; 

    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function isDuplicateEntity(newEmbedding: number[], existingEmbedding: number[], threshold = 0.85): boolean {
  const similarityScore = calculateCosineSimilarity(newEmbedding, existingEmbedding);
  console.log(`🔍 [Resolution] เทียบความเหมือนได้: ${(similarityScore * 100).toFixed(2)}%`);
  return similarityScore >= threshold;
}