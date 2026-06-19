import driver from "@/src/db"

export async function checkDocumentExists(organizationId: string, documentId: string): Promise<boolean> {
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (d:Document {organizationId: $organizationId, id: $documentId}) RETURN d`,
      { organizationId, documentId }
    )
    return result.records.length > 0
  } finally {
    await session.close()
  }
}