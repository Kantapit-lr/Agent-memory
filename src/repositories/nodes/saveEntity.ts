import driver from "@/src/db"
import type { Entity } from "@/src/types/nodes/entity"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"

export async function saveEntity(data: Entity) {
  const orgExists = await checkOrganizationExists(data.organizationId)
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }
  const session = driver.session()
  try {
    const result = await session.run(
      `
      MERGE (e:Entity {organizationId: $organizationId, id: $id})
      SET e.name = $name,
          e.type = $type,
          e.description = $description
      `,
      {
        organizationId: data.organizationId,
        id: data.id,
        name: data.name,
        type: data.type,
        description: data.description
      }
    )
    return result
  } finally {
    await session.close()
  }
}