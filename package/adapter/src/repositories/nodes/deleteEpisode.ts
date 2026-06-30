import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkEpisodeExists } from "@/src/repositories/nodes/checkEpisode"
import { OrganizationNotFoundError, EpisodeNotFoundError } from "@/src/types/errors"
import type { DeleteEpisodeInput, DeleteResult } from "@/src/types/nodes/delete"

// ลบ Episode
// force = false (default): ถ้ายังมี Chunk แขวนอยู่ใต้ Episode นี้ (ผ่าน EXTRACTED_DURING) -> โยน error กันลบพลาด
// force = true: ลบ Episode พร้อม Chunk ทุกก้อนที่แขวนอยู่ แบบ atomic
export async function deleteEpisode(data: DeleteEpisodeInput): Promise<DeleteResult> {
  const orgExists = await checkOrganizationExists({
    organizationId: data.organizationId
  })
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const episodeExists = await checkEpisodeExists({
    organizationId: data.organizationId,
    episodeId: data.episodeId
  })
  if (!episodeExists) {
    throw new EpisodeNotFoundError(data.episodeId)
  }

  const session = driver.session()
  try {
    if (!data.force) {
      const chunkCheck = await session.run(
        `
        MATCH (e:Episode {organizationId: $organizationId, id: $episodeId})-[:EXTRACTED_DURING]->(c:Chunk)
        RETURN count(c) as chunkCount
        `,
        { organizationId: data.organizationId, episodeId: data.episodeId }
      )
      const chunkCount = chunkCheck.records[0].get("chunkCount").toNumber()
      if (chunkCount > 0) {
        throw new Error(
          `EpisodeID: "${data.episodeId}" ยังมี Chunk แขวนอยู่ ${chunkCount} ก้อน กรุณาลบ Chunk ก่อน หรือเรียกด้วย force: true เพื่อ cascade delete`
        )
      }
    }

    const result = await session.run(
      `
      MATCH (e:Episode {organizationId: $organizationId, id: $episodeId})
      OPTIONAL MATCH (e)-[:EXTRACTED_DURING]->(c:Chunk)
      DETACH DELETE e, c
      `,
      { organizationId: data.organizationId, episodeId: data.episodeId }
    )

    return {
      deleted: true,
      nodesDeleted: result.summary.counters.updates().nodesDeleted,
      relationshipsDeleted: result.summary.counters.updates().relationshipsDeleted
    }
  } finally {
    await session.close()
  }
}
