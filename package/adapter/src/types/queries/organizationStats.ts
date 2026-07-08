export interface GetOrganizationStatsInput {
  organizationId: string
}

export interface OrganizationStats {
  organizationId: string
  // Node counts
  entityCount: number
  documentCount: number
  episodeCount: number
  chunkCount: number
  // Relationship counts
  relationshipCount: number
  activeRelationshipCount: number  // valid_to IS NULL
  expiredRelationshipCount: number // expires_at ผ่านไปแล้ว + valid_to IS NULL
  mentionCount: number             // MENTIONS relationships
  // Entity breakdown by type
  entityByType: { type: string; count: number }[]
  // Document breakdown by language
  documentByLanguage: { language: string; count: number }[]
}
