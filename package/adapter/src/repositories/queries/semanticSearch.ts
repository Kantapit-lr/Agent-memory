import driver from "@/src/db"
import type { SemanticSearchInput, SemanticSearchResult } from "@/src/types/queries/semanticSearch"

// ค้นหา Chunk ที่ใกล้เคียงกับ queryEmbedding มากที่สุด โดยใช้ cosine similarity
// พร้อม filter activeOnly, clearanceLevel, langFilter ตาม spec
//
// หมายเหตุ: Neo4j ต้องมี vector index ชื่อ "chunk_embedding" ก่อนถึงจะรันได้
// ถ้ายังไม่มีให้รันใน Neo4j Browser:
//   CREATE VECTOR INDEX chunk_embedding IF NOT EXISTS
//   FOR (c:Chunk) ON c.embedding
//   OPTIONS { indexConfig: { `vector.dimensions`: 1024, `vector.similarity_function`: 'cosine' } }
// (setup-indexes.ts จะสร้างให้อัตโนมัติ)
export async function semanticSearch(data: SemanticSearchInput): Promise<SemanticSearchResult[]> {
  const session = driver.session()

  const limit = data.limit ?? 5
  const activeOnly = data.activeOnly ?? false
  const minClearanceLevel = data.minClearanceLevel ?? 4

  try {
    const result = await session.run(
      `
      CALL db.index.vector.queryNodes('chunk_embedding', $limit, $queryEmbedding)
      YIELD node AS c, score

      WHERE c.organizationId = $organizationId

      // filter langFilter: ถ้าส่งมา จะ join Document แล้วเช็ค language
      OPTIONAL MATCH (doc:Document {organizationId: $organizationId})-[:HAS_CHUNK]->(c)
      WITH c, score, doc
      WHERE $langFilter IS NULL OR doc.language = $langFilter OR doc IS NULL

      // หา source (document หรือ episode)
      OPTIONAL MATCH (ep:Episode {organizationId: $organizationId})-[:EXTRACTED_DURING]->(c)

      // หา entity ที่ถูก mention พร้อม filter activeOnly + clearance
      OPTIONAL MATCH (c)-[mention:MENTIONS]->(e:Entity {organizationId: $organizationId})
      WHERE ($activeOnly = false OR mention.valid_to IS NULL)
        AND mention.clearance_level <= $minClearanceLevel

      RETURN
        c.id AS chunkId,
        c.text AS text,
        score AS similarityScore,
        c.source_type AS sourceType,
        c.source_id AS sourceId,
        doc.title AS documentTitle,
        collect(
          CASE WHEN e IS NOT NULL
            THEN { entityId: e.id, entityName: e.name, entityType: e.type }
            ELSE null
          END
        ) AS mentionedEntities
      ORDER BY similarityScore DESC
      `,
      {
        organizationId: data.organizationId,
        queryEmbedding: data.queryEmbedding,
        limit,
        activeOnly,
        minClearanceLevel,
        langFilter: data.langFilter ?? null
      }
    )

    return result.records.map((record: any): SemanticSearchResult => ({
      chunkId: record.get("chunkId") as string,
      text: record.get("text") as string,
      similarityScore: record.get("similarityScore") as number,
      sourceType: record.get("sourceType") as string | null,
      sourceId: record.get("sourceId") as string | null,
      documentTitle: record.get("documentTitle") as string | null,
      mentionedEntities: (record.get("mentionedEntities") as any[])
        .filter(Boolean)
        .map((e) => ({
          entityId: e.entityId as string,
          entityName: e.entityName as string,
          entityType: e.entityType as string
        }))
    }))
  } finally {
    await session.close()
  }
}
