export interface SemanticSearchInput {
  organizationId: string
  // Vector 1024 มิติที่แปลงมาจาก query text แล้ว (Cohere embed-multilingual-v3)
  // ฝั่งที่เรียกต้องทำ embedding เองก่อนส่งมา adapter ไม่ได้ทำให้
  queryEmbedding: number[]
  // จำนวน chunk สูงสุดที่จะคืนกลับ (default 5)
  limit?: number
  // true = เอาเฉพาะ MENTIONS ที่ valid_to IS NULL (ความสัมพันธ์ที่ยังเป็นจริงอยู่)
  activeOnly?: boolean
  // กรองเฉพาะ clearance_level <= ค่านี้ (default 4 = เห็นทุกระดับ)
  minClearanceLevel?: number
  // กรองภาษาของ Document ต้นทาง เช่น "TH", "EN" (optional)
  langFilter?: string
}

export interface SemanticSearchResult {
  chunkId: string
  text: string
  similarityScore: number
  // Citation
  sourceType: string | null       // "document" หรือ "episode"
  sourceId: string | null         // id ของ document/episode ต้นทาง
  documentTitle: string | null    // ชื่อ document (ถ้า source เป็น document)
  // Entity ที่ถูก mention ใน chunk นี้ (เฉพาะที่ผ่าน filter activeOnly + clearance)
  mentionedEntities: {
    entityId: string
    entityName: string
    entityType: string
  }[]
}
