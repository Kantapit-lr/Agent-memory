import driver from "@/src/db"
import type { 
  RelationshipInput,
  LinkChunkToEntityInput,
  ActiveRelationship,
  CheckActiveRelationshipInput,
  EndRelationshipInput,
  CheckActiveChunkToEntityInput }from "@/src/types/edges/semantic"
  // EndChunkMentionInput
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkEntityExists } from "@/src/repositories/nodes/checkEntity"
import { OrganizationNotFoundError, EntityNotFoundError } from "@/src/types/errors"

  // ให้ sync เชคก่อนเรียกเลย ตัวตรวจจับจะถูก comment ไว้ (หากไม่เปิด Comment ไม่ควรเรียก ฟังชั่นลูกโดยตรง)
  // #หมายเหตุ: ควรแจ้งใน README อีกที

//syncRelationship ที่ตัดสินใจเองว่าจะทำอะไร
export async function syncRelationship(data: RelationshipInput) {

  const orgExists = await checkOrganizationExists({ 
    organizationId: data.organizationId 
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const sourceExists = await checkEntityExists({ 
    organizationId: data.organizationId, 
    entityId: data.source_id 
  })
  if (!sourceExists) {
    throw new EntityNotFoundError(data.source_id)
  }

  const targetExists = await checkEntityExists({ 
    organizationId: data.organizationId, 
    entityId: data.target_id 
  })
  if (!targetExists) {
    throw new EntityNotFoundError(data.target_id)
  }

const existing = await getActiveRelationship({
  organizationId: data.organizationId,
  source_id: data.source_id,
  target_id: data.target_id
})

  if (existing) {
    if (existing.type === data.type) {
      // เหมือนเดิมทุกอย่าง ไม่ต้องทำอะไร
      return { status: "unchanged" }
    } else {
      // type เปลี่ยน (เช่น EMPLOYEE -> BOARD_MEMBER) ต้องปิดของเก่าก่อน
      await endRelationship({
        organizationId: data.organizationId,
        source_id: data.source_id,
        target_id: data.target_id,
        type: existing.type,
        ended_at: data.valid_from  // ปิดของเก่า ณ วันที่ของใหม่เริ่ม
      })
    }
  }

  // สร้างความสัมพันธ์ใหม่
  await linkEntityToEntity(data)
  return { status: "created" }
}


// ตัดสินใจว่าจะสร้างใหม่ หรือไม่ต้องทำอะไร (MENTIONS ปกติไม่ค่อยเปลี่ยน type เหมือน semantic อื่น จึงง่ายกว่า)
export async function syncChunkMention(data: LinkChunkToEntityInput) {
  // ปกติถูกเรียกใช้ผ่าน saveChunk
  // const orgExists = await checkOrganizationExists(data.organizationId)
  // if (!orgExists) {
  //   throw new OrganizationNotFoundError(data.organizationId)
  // }

  // const entityExists = await checkEntityExists(data.organizationId, data.entity_id)
  // if (!entityExists) {
  //   throw new EntityNotFoundError(data.entity_id)
  // }

  const isActive = await getActiveChunkMention({
    organizationId: data.organizationId,
    chunkId: data.chunk_id,
    entityId: data.entity_id
})

  if (isActive) {
    return { status: "unchanged" }
  }

  await linkChunkToEntity(data)
  return { status: "created" }
}

//Entity - Entity
export async function linkEntityToEntity(data: RelationshipInput) {

  // const orgExists = await checkOrganizationExists(data.organizationId)
  // if (!orgExists) {
  //   throw new OrganizationNotFoundError(data.organizationId)
  // }

  // const sourceExists = await checkEntityExists(data.organizationId, data.source_id)
  // if (!sourceExists) {
  //   throw new EntityNotFoundError(data.source_id)
  // }

  // const targetExists = await checkEntityExists(data.organizationId, data.target_id)
  // if (!targetExists) {
  //   throw new EntityNotFoundError(data.target_id)
  // }

  const session = driver.session()
  try {
    const result = await session.run(
      `
      MATCH (source:Entity {organizationId: $organizationId, id: $source_id})
      MATCH (target:Entity {organizationId: $organizationId, id: $target_id})

      MERGE (source)-[rel:${data.type}]->(target)

      ON CREATE SET
          rel.valid_from = datetime($valid_from)

      SET rel.organizationId = $organizationId,
          rel.valid_to = $valid_to,
          rel.confidence_score = $confidence,
          rel.intent_category = $intent,
          rel.criticality_score = $criticality_score,
          rel.sentiment = $sentiment,
          rel.clearance_level = $clearance,
          rel.expires_at = $expires_at,
          rel.justification = $justification
      `,
      {
        organizationId: data.organizationId,
        source_id: data.source_id,
        target_id: data.target_id,
        valid_from: data.valid_from,
        valid_to: data.valid_to,
        confidence: data.confidence_score,
        intent: data.intent_category,
        clearance: data.clearance_level,
        criticality_score: data.criticality_score,
        sentiment: data.sentiment,
        expires_at: data.expires_at,
        justification: data.justification
      }
    )
    return result
  } finally {
    await session.close()
  }
}

// Chunk - Entity
export async function linkChunkToEntity(data: LinkChunkToEntityInput) {
  // const orgExists = await checkOrganizationExists(data.organizationId)
  // if (!orgExists) {
  //   throw new OrganizationNotFoundError(data.organizationId)
  // }

  // const entityExists = await checkEntityExists(data.organizationId, data.entity_id)
  // if (!entityExists) {
  //   throw new EntityNotFoundError(data.entity_id)
  // }

  const session = driver.session()
  try {
    await session.run(
      `
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunk_id})
      MATCH (e:Entity {organizationId: $organizationId, id: $entity_id})
      MERGE (c)-[rel:MENTIONS]->(e)

      ON CREATE SET
          rel.valid_from = datetime($valid_from)

      SET rel.organizationId = $organizationId,
          rel.valid_to = $valid_to,
          rel.confidence_score = $confidence,
          rel.intent_category = $intent,
          rel.criticality_score = $criticality_score,
          rel.sentiment = $sentiment,
          rel.clearance_level = $clearance,
          rel.expires_at = $expires_at,
          rel.justification = $justification
      `,
      {
        organizationId: data.organizationId,
        chunk_id: data.chunk_id,
        entity_id: data.entity_id,
        valid_from: data.valid_from,
        valid_to: data.valid_to,
        confidence: data.confidence_score,
        intent: data.intent_category,
        clearance: data.clearance_level,
        criticality_score: data.criticality_score,
        sentiment: data.sentiment,
        expires_at: data.expires_at,
        justification: data.justification
      }
    )
  } finally {
    await session.close()
  }
}

// function เช็คว่ามี relationship active อยู่มั้ย
export async function getActiveRelationship(data: CheckActiveRelationshipInput): Promise<ActiveRelationship | null> {
  const session = driver.session()
  try {
    const result = await session.run(
      `
      MATCH (source:Entity {organizationId: $organizationId, id: $source_id})
            -[rel]->
            (target:Entity {organizationId: $organizationId, id: $target_id})
      WHERE rel.valid_to IS NULL
      RETURN type(rel) as relType, rel
      `,
      {
        organizationId: data.organizationId,
        source_id: data.source_id,
        target_id: data.target_id
      }
    )

    const record = result.records[0]
    if (!record) {
      return null
    }

    return {
      type: record.get("relType") as string,
      properties: record.get("rel").properties as Record<string, any>
    }
  } finally {
    await session.close()
  }
}

//Update valid_to(Entity)
export async function endRelationship(data: EndRelationshipInput) {
  // const orgExists = await checkOrganizationExists(data.organizationId)
  // if (!orgExists) {
  //   throw new OrganizationNotFoundError(data.organizationId)
  // }

  const session = driver.session()
  try {
    const result = await session.run(
      `
      MATCH (source:Entity {organizationId: $organizationId, id: $source_id})
            -[rel:${data.type}]->
            (target:Entity {organizationId: $organizationId, id: $target_id})
      WHERE rel.valid_to IS NULL
      SET rel.valid_to = datetime($ended_at)
      RETURN rel
      `,
      {
        organizationId: data.organizationId,
        source_id: data.source_id,
        target_id: data.target_id,
        ended_at: data.ended_at
      }
    )

    if (result.records.length === 0) {
      throw new Error(`No active relationship found between ${data.source_id} and ${data.target_id}`)
    }

    return result
  } finally {
    await session.close()
  }
}

// เช็คว่ามี Chunk MENTIONS active อยู่มั้ย
export async function getActiveChunkMention(data: CheckActiveChunkToEntityInput): Promise<boolean> {
  const session = driver.session()
  try {
    const result = await session.run(
      `
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId})
            -[rel:MENTIONS]->
            (e:Entity {organizationId: $organizationId, id: $entityId})
      WHERE rel.valid_to IS NULL
      RETURN rel
      `,
      { 
        organizationId: data.organizationId,
        chunkId: data.chunkId,
        entityId: data.entityId 
      }
    )
    return result.records.length > 0
  } finally {
    await session.close()
  }
}

// // สงวนไว้สำหรับการประมวลผล/แก้ไขข้อมูลส่วนย่อยในอนาคต หรือ การเปลี่ยน Chunk เป็น Mutable (ปัจจุบันตีความว่าเป็น Immutable)
// // Reserved for future chunk re-processing / correction
// // ปิด MENTIONS เดิม
// export async function endChunkMention(data: EndChunkMentionInput) {
//   // const orgExists = await checkOrganizationExists(data.organizationId)
//   // if (!orgExists) {
//   //   throw new OrganizationNotFoundError(data.organizationId)
//   // }

//   const session = driver.session()
//   try {
//     const result = await session.run(
//       `
//       MATCH (c:Chunk {organizationId: $organizationId, id: $chunk_id})
//             -[rel:MENTIONS]->
//             (e:Entity {organizationId: $organizationId, id: $entity_id})
//       WHERE rel.valid_to IS NULL
//       SET rel.valid_to = datetime($ended_at)
//       RETURN rel
//       `,
//       {
//         organizationId: data.organizationId,
//         chunk_id: data.chunk_id,
//         entity_id: data.entity_id,
//         ended_at: data.ended_at
//       }
//     )

//     if (result.records.length === 0) {
//       throw new Error(`No active mention found between ${data.chunk_id} and ${data.entity_id}`)
//     }

//     return result
//   } finally {
//     await session.close()
//   }
// }