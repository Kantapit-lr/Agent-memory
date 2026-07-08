import driver from "@/src/db"
import type { Entity } from "@/src/types/nodes/entity"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { findSimilarEntity } from "@/src/repositories/nodes/findSimilarEntity"
import { OrganizationNotFoundError } from "@/src/types/errors"

export async function saveEntity(data: Entity) {
  const orgExists = await checkOrganizationExists({ 
    organizationId: data.organizationId 
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  // Entity Resolution: ถ้ามี embedding ให้เช็คก่อนว่ามี entity ที่ใกล้เคียงอยู่แล้วไหม
  // ถ้าเจอ → merge เข้ากับตัวเดิม ไม่สร้าง node ใหม่
  // ถ้าไม่เจอ หรือไม่มี embedding (เช่น code entity) → สร้างใหม่ตามปกติ
  let resolvedId = data.id
  if (data.embedding && data.embedding.length > 0) {
    const similar = await findSimilarEntity({
      organizationId: data.organizationId,
      embedding: data.embedding,
      type: data.type  // กรองเฉพาะ entity ประเภทเดียวกัน
    })
    if (similar) {
      // พบ entity ที่ใกล้เคียง → ใช้ id ของตัวเดิมแทน
      resolvedId = similar.id
    }
  }

  const session = driver.session()
  try {
    const result = await session.run(
      `
      MERGE (e:Entity {organizationId: $organizationId, id: $resolvedId})
      SET e.name = $name,
          e.type = $type,
          e.description = $description,
          e.embedding = $embedding
      `,
      {
        organizationId: data.organizationId,
        resolvedId,
        name: data.name,
        type: data.type,
        description: data.description,
        embedding: data.embedding ?? null
      }
    )
    return result
  } finally {
    await session.close()
  }
}