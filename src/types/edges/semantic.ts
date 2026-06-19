import type { MentionedEntity } from "@/src/types/nodes/chunk"


export interface RelationshipInput {
  organizationId: string
  source_id: string
  target_id: string
  type: string
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

export interface LinkChunkToEntityInput extends MentionedEntity {
  organizationId: string
  chunk_id: string
}

export interface ActiveRelationship {
  type: string
  properties: Record<string, any>
}

// types/edges/semantic.ts (เพิ่มเข้าไป)
export interface CheckActiveRelationshipInput {
  organizationId: string
  source_id: string
  target_id: string
}

export interface EndRelationshipInput {
  organizationId: string
  source_id: string
  target_id: string
  type: string
  ended_at: string
}

export interface CheckActiveChunkToEntityInput {
  organizationId: string,
  chunkId: string,
  entityId: string
}

// export interface EndChunkMentionInput {
//   organizationId: string
//   chunk_id: string
//   entity_id: string
//   ended_at: string
// }