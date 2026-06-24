import driver from "@/src/db"
import type { CheckDocumentInput, CheckDocumentsExistInput } from "@/src/types/nodes/document"

// ตัวเดียว: เปลี่ยนมารับ data object
export async function checkDocumentExists(data: CheckDocumentInput): Promise<boolean> {
  const foundIds = await checkDocumentsExist({
    organizationId: data.organizationId,
    documentIds: [data.documentId]
  })
  return foundIds.length > 0
}

// หลายตัว: ใช้ Bulk
export async function checkDocumentsExist(data: CheckDocumentsExistInput): Promise<string[]> {
  const { organizationId, documentIds } = data
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (d:Document {organizationId: $organizationId}) WHERE d.id IN $documentIds RETURN d.id as id`,
      { organizationId, documentIds }
    )
    return result.records.map(r => r.get("id"))
  } finally {
    await session.close()
  }
}