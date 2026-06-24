import driver from "@/src/db"
import type { Episode } from "@/src/types/nodes/episode"
import { checkOrganizationExists } from "./checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"

export async function saveEpisode(data: Episode) {
  const orgExists = await checkOrganizationExists({ 
    organizationId: data.organizationId 
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const session = driver.session()
  try {
    const result = await session.run(
      `
      MERGE (e:Episode {organizationId: $organizationId, id: $id})
      SET e.timestamp = datetime($timestamp),
          e.source = $source,
          e.summary = $summary
      `,
      {
        organizationId: data.organizationId,
        id: data.id,
        timestamp: data.timestamp,
        source: data.source,
        summary: data.summary
      }
    )
    return result
  } finally {
    await session.close()
  }
}