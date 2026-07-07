import driver from "@/src/db"
import type { GetEntityRelationsInput, EntityRelationResponse } from "@/src/types/queries/entityRelations"
import { EntityNotFoundError } from "@/src/types/errors"

export async function getEntityRelations(data: GetEntityRelationsInput): Promise<EntityRelationResponse[]> {
  const session = driver.session()

  try {
    // citation: หา chunk ที่เป็นที่มาของ relationship แบบ fallback 2 ชั้น
    // ชั้น 1 (เข้มงวด): หา chunk ที่ MENTIONS ทั้ง source และ target พร้อมกัน
    // ชั้น 2 (fallback): ถ้าไม่เจอ → ใช้ chunk ที่ MENTIONS แค่ source ฝั่งเดียวแทน
    // ดีกว่าคืน null เสมอ เพราะ Agent ยังรู้ที่มาบางส่วนได้
    const query = `
      MATCH (e:Entity {organizationId: $organizationId, id: $entityId})
      OPTIONAL MATCH (e)-[r]->(target:Entity {organizationId: $organizationId})
      OPTIONAL MATCH (bothChunk:Chunk {organizationId: $organizationId})-[:MENTIONS]->(e)
        WHERE (bothChunk)-[:MENTIONS]->(target)
      OPTIONAL MATCH (singleChunk:Chunk {organizationId: $organizationId})-[:MENTIONS]->(e)
      WITH e, r, target,
           CASE WHEN bothChunk IS NOT NULL THEN bothChunk ELSE singleChunk END AS chunk
      OPTIONAL MATCH (doc:Document {organizationId: $organizationId})-[:HAS_CHUNK]->(chunk)
      RETURN
        e IS NOT NULL AS entityExists,
        type(r) AS relationType,
        target.id AS targetId,
        target.name AS targetName,
        toString(r.valid_from) AS valid_from,
        toString(r.valid_to) AS valid_to,
        r.confidence_score AS confidence_score,
        r.intent_category AS intent_category,
        chunk.id AS source_chunk_id,
        doc.id AS source_document_id
    `

    const result = await session.run(query, {
      organizationId: data.organizationId,
      entityId: data.entityId
    })

    const [firstRecord] = result.records
    if (!firstRecord || !firstRecord.get("entityExists")) {
      throw new EntityNotFoundError(data.entityId)
    }

    return result.records
      .filter((record) => record.get("relationType") !== null)
      .map((record): EntityRelationResponse => ({
        relationType: record.get("relationType") as string,
        targetId: record.get("targetId") as string,
        targetName: record.get("targetName") as string,
        valid_from: record.get("valid_from") as string,
        valid_to: record.get("valid_to") as string | null,
        confidence_score: record.get("confidence_score") as number,
        intent_category: record.get("intent_category") as string,
        source_chunk_id: record.get("source_chunk_id") as string | null,
        source_document_id: record.get("source_document_id") as string | null,
      }))

  } catch (error) {
    throw error
  } finally {
    await session.close()
  }
}