import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkEntityExists } from "@/src/repositories/nodes/checkEntity"
import { OrganizationNotFoundError, EntityNotFoundError, EntityHasActiveRelationshipsError } from "@/src/types/errors"
import type { DeleteEntityInput, DeleteResult } from "@/src/types/nodes/delete"

// ลบ Entity
// force = false (default): ถ้ายังมีความสัมพันธ์ active อยู่ (MENTIONS จาก Chunk หรือ Entity-Entity ใดๆ
//   ที่ valid_to IS NULL) -> โยน EntityHasActiveRelationshipsError กันลบพลาด เพราะ Entity มักถูกอ้างอิง
//   จากหลายที่ ลบทิ้งเฉยๆ จะทำให้ความสัมพันธ์ที่เหลือชี้ไปยัง node ที่ไม่มีอยู่จริง (dangling reference)
// force = true: ลบ Entity พร้อมเส้นความสัมพันธ์ทุกเส้นที่ผูกกับมันทั้งหมด (ทั้ง active และ closed)
export async function deleteEntity(data: DeleteEntityInput): Promise<DeleteResult> {
  const orgExists = await checkOrganizationExists({
    organizationId: data.organizationId
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const entityExists = await checkEntityExists({
    organizationId: data.organizationId,
    entityId: data.entityId
  })
  if (!entityExists) {
    throw new EntityNotFoundError(data.entityId)
  }

  const session = driver.session()
  try {
    if (!data.force) {
      const relCheck = await session.run(
        `
        MATCH (e:Entity {organizationId: $organizationId, id: $entityId})-[rel]-()
        WHERE rel.valid_to IS NULL
        RETURN count(rel) as activeCount
        `,
        { organizationId: data.organizationId, entityId: data.entityId }
      )
      const activeCount = relCheck.records[0].get("activeCount").toNumber()
      if (activeCount > 0) {
        throw new EntityHasActiveRelationshipsError(data.entityId, activeCount)
      }
    }

    const result = await session.run(
      `
      MATCH (e:Entity {organizationId: $organizationId, id: $entityId})
      DETACH DELETE e
      `,
      { organizationId: data.organizationId, entityId: data.entityId }
    )

    return {
      deleted: true,
      nodesDeleted: result.summary.counters.updates().nodesDeleted,
      relationshipsDeleted: result.summary.counters.updates().relationshipsDeleted
    }
  } finally {
    await session.close()
  }
}
