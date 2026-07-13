import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"
import type { GetOrganizationStatsInput, OrganizationStats } from "@/src/types/queries/organizationStats"

// ดึงสถิติภาพรวมของ org ทั้งหมด
// ใช้สำหรับ monitoring, debug และ Sprint 4 stress test
export async function getOrganizationStats(data: GetOrganizationStatsInput): Promise<OrganizationStats> {
  const orgExists = await checkOrganizationExists({ organizationId: data.organizationId })
  if (!orgExists) throw new OrganizationNotFoundError(data.organizationId)

  const session = driver.session()
  try {
    // ยิง query แยกกัน 3 รอบ เพราะแต่ละอย่าง aggregate คนละแบบ
    // รวมเป็น query เดียวได้แต่จะซับซ้อนและ debug ยากกว่า

    // 1. Node counts + relationship counts
    const countResult = await session.run(
      `
      MATCH (org:Organization {id: $organizationId})
      OPTIONAL MATCH (e:Entity {organizationId: $organizationId})
      OPTIONAL MATCH (d:Document {organizationId: $organizationId})
      OPTIONAL MATCH (ep:Episode {organizationId: $organizationId})
      OPTIONAL MATCH (c:Chunk {organizationId: $organizationId})
      OPTIONAL MATCH (e1:Entity {organizationId: $organizationId})-[r]->(e2:Entity {organizationId: $organizationId})
      OPTIONAL MATCH (e3:Entity {organizationId: $organizationId})-[ra]->(e4:Entity {organizationId: $organizationId})
        WHERE ra.valid_to IS NULL
      OPTIONAL MATCH (e5:Entity {organizationId: $organizationId})-[re]->(e6:Entity {organizationId: $organizationId})
        WHERE re.expires_at IS NOT NULL AND datetime(re.expires_at) < datetime() AND re.valid_to IS NULL
      OPTIONAL MATCH (ch:Chunk {organizationId: $organizationId})-[m:MENTIONS]->(en:Entity {organizationId: $organizationId})
      RETURN
        count(DISTINCT e) AS entityCount,
        count(DISTINCT d) AS documentCount,
        count(DISTINCT ep) AS episodeCount,
        count(DISTINCT c) AS chunkCount,
        count(DISTINCT r) AS relationshipCount,
        count(DISTINCT ra) AS activeRelationshipCount,
        count(DISTINCT re) AS expiredRelationshipCount,
        count(DISTINCT m) AS mentionCount
      `,
      { organizationId: data.organizationId }
    )

    // 2. Entity breakdown by type
    const entityByTypeResult = await session.run(
      `
      MATCH (e:Entity {organizationId: $organizationId})
      RETURN e.type AS type, count(e) AS count
      ORDER BY count DESC
      `,
      { organizationId: data.organizationId }
    )

    // 3. Document breakdown by language
    const docByLangResult = await session.run(
      `
      MATCH (d:Document {organizationId: $organizationId})
      RETURN d.language AS language, count(d) AS count
      ORDER BY count DESC
      `,
      { organizationId: data.organizationId }
    )

    const counts = countResult.records[0]

    return {
      organizationId: data.organizationId,
      entityCount: counts.get("entityCount").toNumber(),
      documentCount: counts.get("documentCount").toNumber(),
      episodeCount: counts.get("episodeCount").toNumber(),
      chunkCount: counts.get("chunkCount").toNumber(),
      relationshipCount: counts.get("relationshipCount").toNumber(),
      activeRelationshipCount: counts.get("activeRelationshipCount").toNumber(),
      expiredRelationshipCount: counts.get("expiredRelationshipCount").toNumber(),
      mentionCount: counts.get("mentionCount").toNumber(),
      entityByType: entityByTypeResult.records.map((r: any) => ({
        type: r.get("type") as string,
        count: r.get("count").toNumber()
      })),
      documentByLanguage: docByLangResult.records.map((r: any) => ({
        language: r.get("language") as string,
        count: r.get("count").toNumber()
      }))
    }
  } finally {
    await session.close()
  }
}
