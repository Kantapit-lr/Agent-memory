import driver from "@/src/db"
import { checkDocumentExists } from "@/src/repositories/nodes/checkDocument"
import { DocumentNotFoundError } from "@/src/types/errors"

export async function linkChunkToDocument(organizationId: string, documentId: string, chunkId: string) {
  const docExists = await checkDocumentExists(organizationId, documentId)
  if (!docExists) {
    throw new DocumentNotFoundError(documentId)
  }

  const session = driver.session()
  try {
    await session.run(
      `
      MATCH (d:Document {organizationId: $organizationId, id: $documentId})
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId})
      MERGE (d)-[:HAS_CHUNK]->(c)
      `,
      { organizationId, documentId, chunkId }
    )
  } finally {
    await session.close()
  }
}