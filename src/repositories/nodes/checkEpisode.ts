import driver from "@/src/db"

export async function checkEpisodeExists(organizationId: string, episodeId: string): Promise<boolean> {
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (e:Episode {organizationId: $organizationId, id: $episodeId}) RETURN e`,
      { organizationId, episodeId }
    )
    return result.records.length > 0
  } finally {
    await session.close()
  }
}