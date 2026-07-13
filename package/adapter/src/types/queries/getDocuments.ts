export interface GetDocumentsInput {
  organizationId: string
  // กรองตาม type เช่น "PDF", "MARKDOWN", "DOCX" (optional)
  type?: string
  // กรองตาม language เช่น "TH", "EN" (optional)
  language?: string
}

export interface DocumentSummary {
  id: string
  title: string
  type: string
  language: string
  authors: string[]
  // จำนวน Chunk ทั้งหมดที่แขวนอยู่ใต้ Document นี้
  chunkCount: number
}
