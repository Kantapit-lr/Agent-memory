export interface MentionedEntity {
  entity_id: string
  valid_from: string
  valid_to: string | null
  confidence_score: number
  intent_category: string
  criticality_score: number
  sentiment: string
  clearance_level: number
  expires_at: string | null
  justification: string
}

export interface Chunk {
  organizationId: string
  id: string
  source_type: "document" | "episode"
  source_id: string
  text: string
  sequence_order: number
  embedding: number[]
  mentioned_entities: MentionedEntity[]
}