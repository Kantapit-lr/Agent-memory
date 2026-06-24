export interface DiscoverEntitiesInput {
  organizationId: string
  keyword: string
}

export interface DiscoverEntitiesResponse {
  id: string
  name: string
  type: string
}