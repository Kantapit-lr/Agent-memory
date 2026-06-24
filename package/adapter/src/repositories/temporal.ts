import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { checkEpisodeExists } from "@/src/repositories/nodes/checkEpisode"
import { OrganizationNotFoundError, EpisodeNotFoundError } from "@/src/types/errors"
import type { LinkChunkToEpisodeInput } from "@/src/types/edges/temporal"


export async function linkChunkToEpisode(data: LinkChunkToEpisodeInput): Promise<void> {
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
    await session.run(
      `
      MATCH (e:Episode {organizationId: $organizationId, id: $episodeId})
      MATCH (c:Chunk {organizationId: $organizationId, id: $chunkId})
      MERGE (e)-[:EXTRACTED_DURING]->(c)
      `,
      { 
        organizationId: data.organizationId, 
        episodeId: data.episodeId, 
        chunkId: data.chunkId 
      }
    )
  } finally {
    await session.close()
  }
}