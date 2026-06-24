export interface LinkChunkToDocumentInput {
  organizationId: string
  documentId: string
  chunkId: string
}

// เอาไว้สร้างเส้นเชื่อมระหว่าง Chunk ลูกโซ่
export interface LinkNextChunkInput {
  organizationId: string
  fromChunkId: string
  toChunkId: string
}