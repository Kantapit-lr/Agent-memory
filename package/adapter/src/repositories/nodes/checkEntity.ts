import driver from "@/src/db"

export async function checkEntityExists(organizationId: string, entityId: string): Promise<boolean> {
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (e:Entity {organizationId: $organizationId, id: $entityId}) RETURN e`,
      { organizationId, entityId }
    )
    return result.records.length > 0
  } finally {
    await session.close()
  }
}