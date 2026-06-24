import driver from "@/src/db"
import type { Chunk } from "@/src/types/nodes/chunk"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkEntitiesExist } from "@/src/repositories/nodes/checkEntity"
import { OrganizationNotFoundError, EntityNotFoundError } from "@/src/types/errors"
import { syncChunkMention } from "@/src/repositories/semantic"
import { linkChunkToDocument, linkNextChunk } from "@/src/repositories/structural"
import { linkChunkToEpisode } from "@/src/repositories/temporal"

export async function saveChunk(data: Chunk) {
  // 1. ตรวจสอบความปลอดภัยเบื้องต้น (Guard Clauses)
  const orgExists = await checkOrganizationExists({ 
    organizationId: data.organizationId 
  })

  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

// ท่อนที่เช็ก Entity ใน saveChunk.ts (แทนที่ loop เดิม)
if (data.mentioned_entities.length > 0) {
  const entityIds = data.mentioned_entities.map(m => m.entity_id);
  
  // แก้บรรทัดนี้: ส่งเป็น Object ตามมาตรฐานใหม่
  const foundIds = await checkEntitiesExist({ 
    organizationId: data.organizationId, 
    entityIds: entityIds 
  });

  if (foundIds.length !== entityIds.length) {
    const missingId = entityIds.find(id => !foundIds.includes(id));
    throw new EntityNotFoundError(missingId || "Unknown Entity");
  }
}

  const session = driver.session()
  try {
    // 2. สร้างหรืออัปเดตตัวตนของ Chunk Node
    await session.run(
      `
      MERGE (c:Chunk {organizationId: $organizationId, id: $chunk_id})
      SET c.text = $text,
          c.sequence_order = $sequence_order,
          c.embedding = $embedding,
          c.source_type = $source_type,
          c.source_id = $source_id
      `,
      {
        organizationId: data.organizationId,
        chunk_id: data.id,
        text: data.text,
        sequence_order: data.sequence_order,
        embedding: data.embedding,
        source_type: data.source_type,
        source_id: data.source_id
      }
    )

    // 3. กลไกสร้างกิ่งก้าน [:NEXT_CHUNK] อัตโนมัติ (ขยับดักเช็ก Type ป้องกันไฟแดงเตือนที่เลข [0])
    if (data.sequence_order > 1) {
      const prevOrder = data.sequence_order - 1
      
      const findPrevQuery = `
        MATCH (prev:Chunk {organizationId: $organizationId, source_id: $source_id, source_type: $source_type, sequence_order: $prevOrder})
        RETURN prev.id AS prevId
      `
      
      const prevResult = await session.run(findPrevQuery, {
        organizationId: data.organizationId,
        source_id: data.source_id,
        source_type: data.source_type,
        prevOrder: prevOrder
      })

      const prevRecords = prevResult.records
      const firstPrevRecord = prevRecords[0]

      // ดักเช็กโครงสร้างข้อมูลอาร์เรย์และเรคคอร์ดแรกแบบปลอดภัยสูงสุด
      if (prevRecords.length > 0 && firstPrevRecord) {
        const prevChunkId = firstPrevRecord.get("prevId")
        
        await linkNextChunk({
          organizationId: data.organizationId,
          fromChunkId: prevChunkId,
          toChunkId: data.id
        })
      }
    }

  } finally {
    await session.close()
  }

  // 4. เชื่อมสัมพันธ์ฝั่ง Semantic (Entities Mentioned)
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

  // 5. เชื่อมสัมพันธ์ฝั่ง Structural หรือ Temporal ตามประเภทข้อกำหนด
  if (data.source_type === "document") {
    await linkChunkToDocument({
      organizationId: data.organizationId,
      documentId: data.source_id,
      chunkId: data.id
    })
  } else if (data.source_type === "episode") {
    await linkChunkToEpisode({
      organizationId: data.organizationId,
      episodeId: data.source_id,
      chunkId: data.id
    })
  }
}