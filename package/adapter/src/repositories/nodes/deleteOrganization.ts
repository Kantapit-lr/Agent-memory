import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError, OrganizationNotEmptyError } from "@/src/types/errors"
import type { DeleteOrganizationInput, DeleteResult } from "@/src/types/nodes/delete"

// ลบ Organization — อันตรายที่สุดในระบบ เพราะเป็น root ของ multi-tenant isolation
// force = false (default): ถ้ายังมี Node ใดๆ (Entity, Document, Episode, Chunk) แขวนอยู่ -> โยน error
//   ป้องกันการลบองค์กรทั้งก้อนโดยไม่ตั้งใจ
// force = true: ลบทุก Node ที่มี organizationId ตรงกันทั้งหมด ในคำสั่งเดียว (atomic transaction)
//   รวมถึงเส้นความสัมพันธ์ทุกเส้นที่ผูกอยู่กับ node เหล่านั้นด้วย
// คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้ (irreversible) แนะนำให้ฝั่งที่เรียกใช้ (เช่น MCP tool)
// ทำ confirmation step กับผู้ใช้ก่อนเรียกด้วย force: true เสมอ
export async function deleteOrganization(data: DeleteOrganizationInput): Promise<DeleteResult> {
  const orgExists = await checkOrganizationExists({
    organizationId: data.organizationId
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const session = driver.session()
  try {
    if (!data.force) {
      const nodeCheck = await session.run(
        `
        MATCH (n {organizationId: $organizationId})
        WHERE NOT n:Organization
        RETURN count(n) as nodeCount
        `,
        { organizationId: data.organizationId }
      )
      const nodeCount = nodeCheck.records[0].get("nodeCount").toNumber()
      if (nodeCount > 0) {
        throw new OrganizationNotEmptyError(data.organizationId, nodeCount)
      }
    }

    // ลบ node ลูกทุกชนิดที่แท็ก organizationId ตรงกัน (Entity, Document, Episode, Chunk)
    // แล้วค่อยลบตัว Organization node เอง (ที่ key เป็น id ไม่ใช่ organizationId)
    const result = await session.run(
      `
      MATCH (n {organizationId: $organizationId})
      DETACH DELETE n
      WITH count(n) as dummy
      MATCH (org:Organization {id: $organizationId})
      DETACH DELETE org
      `,
      { organizationId: data.organizationId }
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
