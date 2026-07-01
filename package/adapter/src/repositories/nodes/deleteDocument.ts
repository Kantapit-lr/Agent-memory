import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkDocumentExists } from "@/src/repositories/nodes/checkDocument"
import { OrganizationNotFoundError, DocumentNotFoundError } from "@/src/types/errors"
import type { DeleteDocumentInput, DeleteResult } from "@/src/types/nodes/delete"

// ลบ Document
// force = false (default): ถ้ายังมี Chunk แขวนอยู่ใต้ Document นี้ -> โยน error กันลบพลาด
// force = true: ลบ Document พร้อม Chunk ทุกก้อนที่แขวนอยู่ (cascade ผ่าน HAS_CHUNK) แบบเดียวคำสั่งเดียวจบ (atomic)
export async function deleteDocument(data: DeleteDocumentInput): Promise<DeleteResult> {
  const orgExists = await checkOrganizationExists({
    organizationId: data.organizationId
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const docExists = await checkDocumentExists({
    organizationId: data.organizationId,
    documentId: data.documentId
  })
  if (!docExists) {
    throw new DocumentNotFoundError(data.documentId)
  }

  const session = driver.session()
  try {
    if (!data.force) {
      const chunkCheck = await session.run(
        `
        MATCH (d:Document {organizationId: $organizationId, id: $documentId})-[:HAS_CHUNK]->(c:Chunk)
        RETURN count(c) as chunkCount
        `,
        { organizationId: data.organizationId, documentId: data.documentId }
      )
      const chunkCount = chunkCheck.records[0].get("chunkCount").toNumber()
      if (chunkCount > 0) {
        throw new Error(
          `DocumentID: "${data.documentId}" ยังมี Chunk แขวนอยู่ ${chunkCount} ก้อน กรุณาลบ Chunk ก่อน หรือเรียกด้วย force: true เพื่อ cascade delete`
        )
      }
    }

    // force=true หรือไม่มี chunk ค้าง -> DETACH DELETE ทั้ง Document + Chunk ลูกในคำสั่งเดียว (atomic)
    const result = await session.run(
      `
      MATCH (d:Document {organizationId: $organizationId, id: $documentId})
      OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
      DETACH DELETE d, c
      `,
      { organizationId: data.organizationId, documentId: data.documentId }
    )

    return {
      deleted: true,
      nodesDeleted: result.summary.counters.updates().nodesDeleted,
      relationshipsDeleted: result.summary.counters.updates().relationshipsDeleted
    }
  } finally {
    await session.close()
  }
}
