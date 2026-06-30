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

// เพิ่มเข้าไปในไฟล์ types/errors.ts ของมึงเลย
export class ChunkNotFoundError extends Error {
  code: string
  constructor(chunkId: string) {
    super(`ChunkID: "${chunkId}" not found. Please verify the Chunk exists in the graph.`)
    this.name = "ChunkNotFoundError"
    this.code = "CHUNK_NOT_FOUND"
  }
}

export class EntityHasActiveRelationshipsError extends Error {
  code: string
  constructor(entityId: string, count: number) {
    super(`EntityID: "${entityId}" still has ${count} active relationship(s)/mention(s). Use force=true to delete anyway, or end relationships first.`)
    this.name = "EntityHasActiveRelationshipsError"
    this.code = "ENTITY_HAS_ACTIVE_RELATIONSHIPS"
  }
}

export class OrganizationNotEmptyError extends Error {
  code: string
  constructor(organizationId: string, nodeCount: number) {
    super(`OrganizationID: "${organizationId}" still has ${nodeCount} node(s) attached. Use force=true to cascade delete, or remove child nodes first.`)
    this.name = "OrganizationNotEmptyError"
    this.code = "ORGANIZATION_NOT_EMPTY"
  }
}