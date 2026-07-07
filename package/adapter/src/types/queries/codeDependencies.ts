export interface GetCodeDependenciesInput {
  organizationId: string
  // id ของ Entity ที่เป็น FUNCTION หรือ MODULE ที่อยากรู้ dependency
  entityId: string
  // "outgoing" = หาว่า entity นี้เรียกใคร/import อะไร (downstream)
  // "incoming" = หาว่าใครเรียก/import entity นี้ (upstream)
  // "both" (default) = ทั้งสองทิศ
  direction?: "outgoing" | "incoming" | "both"
  // จำกัดความลึกของการไต่กราฟ (default 3 ชั้น กันวนลูปไม่รู้จบ)
  maxDepth?: number
}

export interface CodeDependencyNode {
  entityId: string
  entityName: string
  entityType: string  // "FUNCTION" | "MODULE" | "CLASS"
  // ความสัมพันธ์กับ node ก่อนหน้าในเส้นทาง
  relationshipType: string  // "CALLS" | "IMPORTS"
  // ชั้นที่เจอ node นี้ (1 = direct dependency, 2 = transitive ฯลฯ)
  depth: number
  // Citation
  source_chunk_id: string | null
  source_document_id: string | null
}

export interface GetCodeDependenciesResult {
  // entity ต้นทางที่ถามเข้ามา
  rootEntityId: string
  rootEntityName: string
  direction: string
  dependencies: CodeDependencyNode[]
}
