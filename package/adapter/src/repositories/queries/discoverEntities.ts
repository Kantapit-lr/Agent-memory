// repositories/nodes/discoverEntities.ts
import driver from "@/src/db"
import type { DiscoverEntitiesInput, DiscoverEntitiesResponse } from "@/src/types/queries/discoverEntities"

export async function discoverEntities(data: DiscoverEntitiesInput): Promise<DiscoverEntitiesResponse[]> {
  const session = driver.session()

  try {
    // toLower() ทั้งสองฝั่ง = case-insensitive search
    // รองรับทั้ง "Bangkok", "bangkok", "BANGKOK" และภาษาไทย
    const query = `
      MATCH (e:Entity {organizationId: $organizationId})
      WHERE toLower(e.name) CONTAINS toLower($keyword)
      RETURN e.id AS id, e.name AS name, e.type AS type
      LIMIT 20
    `
    const result = await session.run(query, {
      organizationId: data.organizationId,
      keyword: data.keyword
    })

    return result.records.map((record): DiscoverEntitiesResponse => ({
      id: record.get("id") as string,
      name: record.get("name") as string,
      type: record.get("type") as string
    }))
  } catch (error) {
    throw error
  } finally {
    await session.close()
  }
}