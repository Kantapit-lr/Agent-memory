import driver from "@/src/db"

export async function checkOrganizationExists(organizationId: string): Promise<boolean> {
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (org:Organization {id: $organizationId}) RETURN org`,
      { organizationId }
    )
    return result.records.length > 0
  } finally {
    await session.close()
  }
}