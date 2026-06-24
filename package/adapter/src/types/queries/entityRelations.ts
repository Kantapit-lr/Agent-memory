export interface GetEntityRelationsInput {
  organizationId: string
  entityId: string
}

export interface EntityRelationResponse {
  relationType: string
  targetId: string
  targetName: string

  valid_from: string
  valid_to: string | null
  confidence_score: number
  intent_category: string

  // Citation: ความรู้นี้มาจาก chunk ไหน document ไหน
  source_chunk_id: string | null
  source_document_id: string | null
}