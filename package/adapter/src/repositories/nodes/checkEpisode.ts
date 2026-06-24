import driver from "@/src/db"
import type { CheckEpisodeInput, CheckEpisodesExistInput } from "@/src/types/nodes/episode"

export async function checkEpisodeExists(data: CheckEpisodeInput): Promise<boolean> {
  const foundIds = await checkEpisodesExist({
    organizationId: data.organizationId,
    episodeIds: [data.episodeId]
  })
  return foundIds.length > 0
}

export async function checkEpisodesExist(data: CheckEpisodesExistInput): Promise<string[]> {
  const { organizationId, episodeIds } = data
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (e:Episode {organizationId: $organizationId}) WHERE e.id IN $episodeIds RETURN e.id as id`,
      { organizationId, episodeIds }
    )
    return result.records.map(r => r.get("id"))
  } finally {
    await session.close()
  }
}