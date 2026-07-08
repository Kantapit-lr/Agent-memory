import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"
import type { GetDocumentsInput, DocumentSummary } from "@/src/types/queries/getDocuments"

// ดึงรายชื่อ Document ทั้งหมดใน org พร้อม chunkCount
// ใช้สำหรับ Agent ที่ต้องการ list เอกสารก่อนเรียก getDocumentTree
export async function getDocuments(data: GetDocumentsInput): Promise<DocumentSummary[]> {
  const orgExists = await checkOrganizationExists({ organizationId: data.organizationId })
  if (!orgExists) throw new OrganizationNotFoundError(data.organizationId)

  const session = driver.session()
  try {
    const result = await session.run(
      `
      MATCH (d:Document {organizationId: $organizationId})
      WHERE ($type IS NULL OR d.type = $type)
        AND ($language IS NULL OR d.language = $language)
      OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
      RETURN
        d.id AS id,
        d.title AS title,
        d.type AS type,
        d.language AS language,
        d.authors AS authors,
        count(c) AS chunkCount
      ORDER BY d.title ASC
      `,
      {
        organizationId: data.organizationId,
        type: data.type ?? null,
        language: data.language ?? null
      }
    )

    return result.records.map((record: any): DocumentSummary => ({
      id: record.get("id") as string,
      title: record.get("title") as string,
      type: record.get("type") as string,
      language: record.get("language") as string,
      authors: record.get("authors") as string[],
      chunkCount: record.get("chunkCount").toNumber()
    }))
  } finally {
    await session.close()
  }
}
