import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError, ChunkNotFoundError } from "@/src/types/errors"
import type { DeleteChunkInput, DeleteResult } from "@/src/types/nodes/delete"

// Chunk ถือเป็น Immutable ตาม spec แต่ "ลบ" ยังจำเป็นต้องมีไว้กรณีข้อมูลผิด/ต้องการ GDPR-style erase
// ลบ Chunk เดี่ยว พร้อมเส้นทุกเส้นที่ผูกกับมัน (HAS_CHUNK, NEXT_CHUNK ทั้งสองทิศทาง, MENTIONS, EXTRACTED_DURING)
// หมายเหตุ: ฟังก์ชันนี้ "ไม่" ซ่อมต่อ NEXT_CHUNK ของก้อนข้างเคียงให้อัตโนมัติ
// (เช่น chunk_01 -> chunk_02 -> chunk_03 ถ้าลบ chunk_02 ลำดับจะขาดตอน)
// ถ้าต้องการ auto-reconnect ให้แจ้งเพิ่ม เพราะมีผลกับ sequence_order โดยตรง
export async function deleteChunk(data: DeleteChunkInput): Promise<DeleteResult> {
  const orgExists = await checkOrganizationExists({
    organizationId: data.organizationId
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const session = driver.session()
  try {
    const checkResult = await session.run(
      `MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId}) RETURN c`,
      { organizationId: data.organizationId, chunkId: data.chunkId }
    )
    if (checkResult.records.length === 0) {
      throw new ChunkNotFoundError(data.chunkId)
    }

    const result = await session.run(
      `
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId})
      DETACH DELETE c
      `,
      { organizationId: data.organizationId, chunkId: data.chunkId }
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
