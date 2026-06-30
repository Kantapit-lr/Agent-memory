// types/nodes/delete.ts
// รวม Input types สำหรับ Delete API ทั้งหมด (5 ฟังก์ชัน)

export interface DeleteChunkInput {
  organizationId: string
  chunkId: string
}

export interface DeleteDocumentInput {
  organizationId: string
  documentId: string
  // true = ลบ Chunk ทุกก้อนที่แขวนอยู่ใต้ Document นี้ไปด้วย (cascade)
  // false (default) = ถ้ายังมี Chunk ค้างอยู่ จะโยน error แทนการลบ
  force?: boolean
}

export interface DeleteEpisodeInput {
  organizationId: string
  episodeId: string
  // true = ลบ Chunk ทุกก้อนที่แขวนอยู่ใต้ Episode นี้ไปด้วย (cascade)
  force?: boolean
}

export interface DeleteEntityInput {
  organizationId: string
  entityId: string
  // true = ลบความสัมพันธ์ (MENTIONS / Entity-Entity) ที่เกี่ยวข้องทั้งหมดไปด้วย
  // false (default) = ถ้ายังมีความสัมพันธ์ active อยู่ จะโยน error แทนการลบ
  force?: boolean
}

export interface DeleteOrganizationInput {
  organizationId: string
  // true = ลบทุก Node ภายใต้ organization นี้ทั้งหมด (Entity, Document, Episode, Chunk + เส้นทุกเส้น)
  // false (default) = ถ้ายังมี Node ค้างอยู่ จะโยน error แทนการลบ
  force?: boolean
}

export interface DeleteResult {
  deleted: boolean
  // จำนวน node/relationship ที่ถูกลบจริง (เผื่อใช้ log หรือ debug)
  nodesDeleted: number
  relationshipsDeleted: number
}
