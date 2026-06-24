import driver from "@/src/db"
import type { GetEntityTimelineInput, EntityTimelineEntry } from "@/src/types/queries/getEntityTimeline"
import { EntityNotFoundError } from "@/src/types/errors"

export async function getEntityTimeline(data: GetEntityTimelineInput): Promise<EntityTimelineEntry[]> {
  const session = driver.session()

  const baseReturn = `
    RETURN
      e IS NOT NULL AS entityExists,
      type(r) AS relationshipType,
      target.id AS targetEntityId,
      target.name AS targetEntityName,
      toString(r.valid_from) AS valid_from,
      toString(r.valid_to) AS valid_to,
      r.confidence_score AS confidence_score,
      r.intent_category AS intent_category,
      r.criticality_score AS criticality_score,
      r.sentiment AS sentiment,
      r.clearance_level AS clearance_level,
      toString(r.expires_at) AS expires_at,
      r.justification AS justification,
      chunk.id AS source_chunk_id,
      doc.id AS source_document_id
    ORDER BY r.valid_from ASC
  `

  const citationMatch = `
    OPTIONAL MATCH (chunk:Chunk {organizationId: $organizationId})-[:MENTIONS]->(e)
    OPTIONAL MATCH (doc:Document {organizationId: $organizationId})-[:HAS_CHUNK]->(chunk)
  `

  try {
    const query = data.relationshipType
      ? `
        MATCH (e:Entity {organizationId: $organizationId, id: $entityId})
        OPTIONAL MATCH (e)-[r:${data.relationshipType}]->(target:Entity {organizationId: $organizationId})
        WHERE r.valid_from IS NOT NULL
        ${citationMatch}
        ${baseReturn}
      `
      : `
        MATCH (e:Entity {organizationId: $organizationId, id: $entityId})
        OPTIONAL MATCH (e)-[r]->(target:Entity {organizationId: $organizationId})
        WHERE r.valid_from IS NOT NULL
        ${citationMatch}
        ${baseReturn}
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
      .filter((record) => record.get("relationshipType") !== null)
      .map((record): EntityTimelineEntry => ({
        relationshipType: record.get("relationshipType") as string,
        targetEntityId: record.get("targetEntityId") as string,
        targetEntityName: record.get("targetEntityName") as string,
        valid_from: record.get("valid_from") as string,
        valid_to: record.get("valid_to") as string | null,
        confidence_score: record.get("confidence_score") as number,
        intent_category: record.get("intent_category") as string,
        criticality_score: record.get("criticality_score") as number,
        sentiment: record.get("sentiment") as string,
        clearance_level: record.get("clearance_level") as number,
        expires_at: record.get("expires_at") as string | null,
        justification: record.get("justification") as string,
        source_chunk_id: record.get("source_chunk_id") as string | null,
        source_document_id: record.get("source_document_id") as string | null,
      }))

  } catch (error) {
    throw error
  } finally {
    await session.close()
  }
}