import driver from "@/src/db"
import type { CheckOrganizationInput } from "@/src/types/nodes/organization"

export async function checkOrganizationExists(data: CheckOrganizationInput): Promise<boolean> {
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (org:Organization {id: $organizationId}) RETURN org`,
      { organizationId: data.organizationId }
    )
    return result.records.length > 0
  } finally {
    await session.close()
  }
}