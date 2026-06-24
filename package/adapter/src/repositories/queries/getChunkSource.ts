// repositories/nodes/getChunkSource.ts
import driver from "@/src/db"
import type { GetChunkSourceInput, ChunkSourceResponse } from "@/src/types/queries/chunkSource"
import { ChunkNotFoundError } from "@/src/types/errors"

export async function getChunkSource(data: GetChunkSourceInput): Promise<ChunkSourceResponse> {
  const session = driver.session()

  try {
    // เอาตัวแปรนี้กลับมาวาง
    const query = `
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId})
      RETURN c.source_type AS sourceType, c.source_id AS sourceId
    `

    const result = await session.run(query, {
      organizationId: data.organizationId,
      chunkId: data.chunkId
    })

    const [record] = result.records;

    if (!record) {
      throw new ChunkNotFoundError(data.chunkId)
    }

    return {
      chunkId: data.chunkId,
      sourceType: record.get("sourceType") as string,
      sourceId: record.get("sourceId") as string
    }
  } catch (error) {
    throw error 
  } finally {
    await session.close()
  }
}