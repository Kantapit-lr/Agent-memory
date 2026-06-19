import driver from "@/src/db"
import type { Chunk } from "@/src/types/nodes/chunk"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkEntityExists } from "@/src/repositories/nodes/checkEntity"
import { OrganizationNotFoundError, EntityNotFoundError } from "@/src/types/errors"
import { syncChunkMention } from "@/src/repositories/semantic"
import { linkChunkToDocument } from "@/src/repositories/structural"
import { linkChunkToEpisode } from "@/src/repositories/temporal"

export async function saveChunk(data: Chunk) {
  const orgExists = await checkOrganizationExists(data.organizationId)
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  for (const mention of data.mentioned_entities) {
    const entityExists = await checkEntityExists(data.organizationId, mention.entity_id)
    if (!entityExists) {
      throw new EntityNotFoundError(mention.entity_id)
    }
  }

  const session = driver.session()
  try {
    // สร้าง Chunk node
    await session.run(
      `
      MERGE (c:Chunk {organizationId: $organizationId, id: $chunk_id})
      SET c.text = $text,
          c.sequence_order = $sequence_order,
          c.embedding = $embedding
      `,
      {
        organizationId: data.organizationId,
        chunk_id: data.id,
        text: data.text,
        sequence_order: data.sequence_order,
        embedding: data.embedding
      }
    )

  } finally {
    await session.close()
  }


  // เชื่อมกับ source แยกตามประเภท (เป็น function แยกที่เปิด session ของตัวเอง)
  for (const mention of data.mentioned_entities) {
  await syncChunkMention({
    organizationId: data.organizationId,
    chunk_id: data.id,
    entity_id: mention.entity_id,
    valid_from: mention.valid_from,
    valid_to: mention.valid_to,
    confidence_score: mention.confidence_score,
    intent_category: mention.intent_category,
    criticality_score: mention.criticality_score,
    sentiment: mention.sentiment,
    clearance_level: mention.clearance_level,
    expires_at: mention.expires_at,
    justification: mention.justification
  })
}
  if (data.source_type === "document") {
    await linkChunkToDocument(data.organizationId, data.source_id, data.id)
  } else if (data.source_type === "episode") {
    await linkChunkToEpisode(data.organizationId, data.source_id, data.id)
  }
}