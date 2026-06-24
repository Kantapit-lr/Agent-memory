import driver from "@/src/db"
import { checkDocumentExists } from "@/src/repositories/nodes/checkDocument"
import { DocumentNotFoundError } from "@/src/types/errors"
import type { LinkChunkToDocumentInput, LinkNextChunkInput } from "@/src/types/edges/structural"

export async function linkChunkToDocument(data: LinkChunkToDocumentInput): Promise<void> {
const docExists = await checkDocumentExists({ 
  organizationId: data.organizationId, 
  documentId: data.documentId 
})
if (!docExists) {
  throw new DocumentNotFoundError(data.documentId)
}

  const session = driver.session()
  try {
    await session.run(
      `
      MATCH (d:Document {organizationId: $organizationId, id: $documentId})
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId})
      MERGE (d)-[:HAS_CHUNK]->(c)
      `,
      { 
        organizationId: data.organizationId, 
        documentId: data.documentId, 
        chunkId: data.chunkId 
      }
    )
  } finally {
    await session.close()
  }
}

/**
 * ลากเส้นความสัมพันธ์ [:NEXT_CHUNK] เชื่อมโยง Chunk ก่อนหน้า ไปหา Chunk ถัดไป
 */
export async function linkNextChunk(data: LinkNextChunkInput): Promise<void> {
  const session = driver.session()
  try {
    await session.run(
      `
      MATCH (from:Chunk {organizationId: $organizationId, id: $fromChunkId})
      MATCH (to:Chunk {organizationId: $organizationId, id: $toChunkId})
      MERGE (from)-[:NEXT_CHUNK]->(to)
      `,
      {
        organizationId: data.organizationId,
        fromChunkId: data.fromChunkId,
        toChunkId: data.toChunkId
      }
    )
  } finally {
    await session.close()
  }
}