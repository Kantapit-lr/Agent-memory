import driver from "@/src/db"
import type { CheckEntityInput, CheckEntitiesExistInput } from "@/src/types/nodes/entity"

// ตัวเดียว: รับ data object
export async function checkEntityExists(data: CheckEntityInput): Promise<boolean> {
  const foundIds = await checkEntitiesExist({
    organizationId: data.organizationId,
    entityIds: [data.entityId]
  })
  return foundIds.length > 0
}

// หลายตัว: รับ data object (ตัวนี้คือตัวที่จะไปใช้ใน saveChunk ของมึง)
export async function checkEntitiesExist(data: CheckEntitiesExistInput): Promise<string[]> {
  const { organizationId, entityIds } = data
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (e:Entity {organizationId: $organizationId}) WHERE e.id IN $entityIds RETURN e.id as id`,
      { organizationId, entityIds }
    )
    return result.records.map(r => r.get("id"))
  } finally {
    await session.close()
  }
}