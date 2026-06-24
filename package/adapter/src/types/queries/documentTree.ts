import type { Document } from "../nodes/document"
import type { Chunk } from "../nodes/chunk"

// อินพุตรับเข้าตามสไตล์ data: ตัวแปร มาตรฐานของมึง
export interface GetDocumentTreeInput {
  organizationId: string
  documentId: string
}

// เอาต์พุตส่งออกที่ Omit เอาคีย์ embedding ออกเพื่อไม่ให้ memory บวม
export interface DocumentTreeResponse {
  document: Document
  chunks: Omit<Chunk, "embedding">[]
}