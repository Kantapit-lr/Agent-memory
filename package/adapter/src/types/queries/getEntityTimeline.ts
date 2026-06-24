export interface GetEntityTimelineInput {
  organizationId: string
  entityId: string
  relationshipType?: string
}

export interface EntityTimelineEntry {
  relationshipType: string
  targetEntityId: string
  targetEntityName: string

  valid_from: string
  valid_to: string | null
  confidence_score: number
  intent_category: string
  criticality_score: number
  sentiment: string
  clearance_level: number
  expires_at: string | null
  justification: string

  // Citation: ความรู้นี้มาจาก chunk ไหน document ไหน
  source_chunk_id: string | null
  source_document_id: string | null
}