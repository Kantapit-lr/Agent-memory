export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface CheckOrganizationInput {
  organizationId: string
}