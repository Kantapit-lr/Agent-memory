// types/queries/chunkSource.ts
export interface GetChunkSourceInput {
  organizationId: string
  chunkId: string
}

export interface ChunkSourceResponse {
  chunkId: string
  sourceType: string
  sourceId: string
  // ถ้าต้องการข้อมูล Document ต้นทางด้วย ก็ใส่เพิ่มตรงนี้
}