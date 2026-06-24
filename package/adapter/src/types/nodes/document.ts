export interface Document {
  organizationId: string
  id: string
  title: string
  type: string
  language: string
  authors: string[]
}

export interface CheckDocumentInput {
  organizationId: string
  documentId: string
}

export interface CheckDocumentsExistInput {
  organizationId: string
  documentIds: string[]
}