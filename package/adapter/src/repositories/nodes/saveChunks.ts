import type { Chunk } from "@/src/types/nodes/chunk"
import { saveChunk } from "@/src/repositories/nodes/saveChunk"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"

export interface SaveChunksResult {
  saved: number
  failed: { id: string; error: string }[]
}

// Batch version ของ saveChunk — รับ Chunk[] แล้วประมวลผลตามลำดับ sequence_order
// สำคัญ: ต้องเรียงตาม sequence_order ก่อนประมวลผล
// เพราะ NEXT_CHUNK ต้องการให้ prev chunk มีอยู่ใน graph ก่อนถึงจะ link ได้
// ถ้า chunk ตัวไหน error จะเก็บไว้ใน failed แล้วดำเนินการต่อ (ไม่หยุดทั้งหมด)
export async function saveChunks(chunks: Chunk[]): Promise<SaveChunksResult> {
  if (chunks.length === 0) return { saved: 0, failed: [] }

  // เช็ค org ครั้งเดียวก่อน
  const orgExists = await checkOrganizationExists({ organizationId: chunks[0]!.organizationId })
  if (!orgExists) throw new OrganizationNotFoundError(chunks[0]!.organizationId)

  // เรียง sequence_order ก่อนเสมอ กัน NEXT_CHUNK ขาดตอน
  const sorted = [...chunks].sort((a, b) => a.sequence_order - b.sequence_order)

  const failed: { id: string; error: string }[] = []
  let saved = 0

  for (const chunk of sorted) {
    try {
      await saveChunk(chunk)
      saved++
    } catch (error) {
      failed.push({
        id: chunk.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return { saved, failed }
}
