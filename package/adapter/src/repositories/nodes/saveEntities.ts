import type { Entity } from "@/src/types/nodes/entity"
import { saveEntity } from "@/src/repositories/nodes/saveEntity"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"

export interface SaveEntitiesResult {
  saved: number
  failed: { id: string; error: string }[]
}

// Batch version ของ saveEntity — รับ Entity[] แล้วประมวลผลทีละตัว
// Entity Resolution ต้องทำทีละตัวเพราะต้องเช็ค vector similarity กับ graph จริงๆ
// ถ้า entity ตัวไหน error จะเก็บไว้ใน failed แล้วดำเนินการต่อ (ไม่หยุดทั้งหมด)
export async function saveEntities(entities: Entity[]): Promise<SaveEntitiesResult> {
  if (entities.length === 0) return { saved: 0, failed: [] }

  // เช็ค org ครั้งเดียวก่อน ไม่ต้องเช็คทุก entity
  const orgExists = await checkOrganizationExists({ organizationId: entities[0]!.organizationId })
  if (!orgExists) throw new OrganizationNotFoundError(entities[0]!.organizationId)

  const failed: { id: string; error: string }[] = []
  let saved = 0

  for (const entity of entities) {
    try {
      await saveEntity(entity)
      saved++
    } catch (error) {
      failed.push({
        id: entity.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return { saved, failed }
}
