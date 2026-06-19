// types/errors.ts
export class OrganizationNotFoundError extends Error {
  code: string
  constructor(organizationId: string) {
    super(`OrganizationID: "${organizationId}" not found. Please create it first.`)
    this.name = "OrganizationNotFoundError"
    this.code = "ORG_NOT_FOUND"
  }
}

export class DocumentNotFoundError extends Error {
  code: string
  constructor(documentId: string) {
    super(`DocumentID: "${documentId}" not found. Please create it first.`)
    this.name = "DocumentNotFoundError"
    this.code = "DOCUMENT_NOT_FOUND"
  }
}

export class EntityNotFoundError extends Error {
  code: string
  constructor(entityId: string) {
    super(`EntityID: "${entityId}" not found. Please create it first.`)
    this.name = "EntityNotFoundError"
    this.code = "ENTITY_NOT_FOUND"
  }
}

export class EpisodeNotFoundError extends Error {
  code: string
  constructor(episodeId: string) {
    super(`EpisodeID: "${episodeId}" not found. Please create it first.`)
    this.name = "EpisodeNotFoundError"
    this.code = "EPISODE_NOT_FOUND"
  }
}