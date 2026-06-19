import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkEpisodeExists } from "@/src/repositories/nodes/checkEpisode"
import { OrganizationNotFoundError, EpisodeNotFoundError } from "@/src/types/errors"

export async function linkChunkToEpisode(organizationId: string, episodeId: string, chunkId: string) {
  const orgExists = await checkOrganizationExists(organizationId)
  if (!orgExists) {
    throw new OrganizationNotFoundError(organizationId)
  }

  const episodeExists = await checkEpisodeExists(organizationId, episodeId)
  if (!episodeExists) {
    throw new EpisodeNotFoundError(episodeId)
  }

  const session = driver.session()
  try {
    await session.run(
      `
      MATCH (e:Episode {organizationId: $organizationId, id: $episodeId})
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId})
      MERGE (e)-[:EXTRACTED_DURING]->(c)
      `,
      { organizationId, episodeId, chunkId }
    )
  } finally {
    await session.close()
  }
}