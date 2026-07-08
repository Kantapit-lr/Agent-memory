import driver from "@/src/db"

export interface SimilarEntityResult {
  id: string
  name: string
  type: string
  similarityScore: number
}

// ค้นหา Entity ที่ vector ใกล้เคียงกับ embedding ที่ส่งมา
// ใช้ใน Entity Resolution ก่อน saveEntity เพื่อกันสร้าง node ซ้ำ
// threshold default 0.92 — ปรับได้ตามความต้องการ
// (0.92 = ใกล้เคียงมากพอที่จะถือว่าเป็นสิ่งเดียวกัน เช่น "กทม." กับ "Bangkok")
export async function findSimilarEntity(data: {
  organizationId: string
  embedding: number[]
  // กรองเฉพาะ entity ประเภทเดียวกัน กัน PERSON merge กับ ORGANIZATION
  type?: string
  threshold?: number
  limit?: number
}): Promise<SimilarEntityResult | null> {
  const session = driver.session()
  const threshold = data.threshold ?? 0.92
  const limit = data.limit ?? 1

  try {
    // ต้องมี vector index "entity_embedding" ก่อน
    // setup-indexes.ts จะสร้างให้อัตโนมัติ
    const result = await session.run(
      `
      CALL db.index.vector.queryNodes('entity_embedding', $limit, $embedding)
      YIELD node AS e, score
      WHERE e.organizationId = $organizationId
        AND score >= $threshold
        AND ($type IS NULL OR e.type = $type)
      RETURN e.id AS id, e.name AS name, e.type AS type, score AS similarityScore
      ORDER BY similarityScore DESC
      LIMIT 1
      `,
      {
        organizationId: data.organizationId,
        embedding: data.embedding,
        threshold,
        limit,
        type: data.type ?? null
      }
    )

    if (result.records.length === 0) return null

    const record = result.records[0]
    return {
      id: record.get("id") as string,
      name: record.get("name") as string,
      type: record.get("type") as string,
      similarityScore: record.get("similarityScore") as number
    }
  } finally {
    await session.close()
  }
}
