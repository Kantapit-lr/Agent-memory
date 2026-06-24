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
}