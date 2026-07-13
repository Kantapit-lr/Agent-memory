import driver from "@/src/db"
import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"
import type {
  GetExpiredFactsInput,
  ExpiredFactResult,
  PurgeExpiredFactsInput,
  PurgeExpiredFactsResult
} from "@/src/types/queries/expiredFacts"

// ดึง relationship ทั้งหมดที่ expires_at ผ่านไปแล้ว
// ใช้สำหรับ monitoring และ debug ก่อนจะรัน purge
export async function getExpiredFacts(data: GetExpiredFactsInput): Promise<ExpiredFactResult[]> {
  const orgExists = await checkOrganizationExists({ organizationId: data.organizationId })
  if (!orgExists) throw new OrganizationNotFoundError(data.organizationId)

  const asOf = data.asOf ?? new Date().toISOString()
  const session = driver.session()

  try {
    const result = await session.run(
      `
      MATCH (source:Entity {organizationId: $organizationId})-[r]->(target:Entity {organizationId: $organizationId})
      WHERE r.expires_at IS NOT NULL
        AND datetime(r.expires_at) < datetime($asOf)
        AND r.valid_to IS NULL
      RETURN
        source.id AS sourceId,
        source.name AS sourceName,
        target.id AS targetId,
        target.name AS targetName,
        type(r) AS relationshipType,
        toString(r.expires_at) AS expires_at,
        toString(r.valid_from) AS valid_from,
        toString(r.valid_to) AS valid_to
      ORDER BY r.expires_at ASC
      `,
      { organizationId: data.organizationId, asOf }
    )

    return result.records.map((record: any): ExpiredFactResult => ({
      sourceId: record.get("sourceId") as string,
      sourceName: record.get("sourceName") as string,
      targetId: record.get("targetId") as string,
      targetName: record.get("targetName") as string,
      relationshipType: record.get("relationshipType") as string,
      expires_at: record.get("expires_at") as string,
      valid_from: record.get("valid_from") as string,
      valid_to: record.get("valid_to") as string | null
    }))
  } finally {
    await session.close()
  }
}

// ปิดหรือลบ relationship ที่หมดอายุแล้ว
// hardDelete = false (default): set valid_to = asOf (bi-temporal soft close ข้อมูลเก่าไม่หาย)
// hardDelete = true: ลบ relationship ทิ้งเลย (ใช้กรณี GDPR หรือต้องการ cleanup จริงๆ)
export async function purgeExpiredFacts(data: PurgeExpiredFactsInput): Promise<PurgeExpiredFactsResult> {
  const orgExists = await checkOrganizationExists({ organizationId: data.organizationId })
  if (!orgExists) throw new OrganizationNotFoundError(data.organizationId)

  const asOf = data.asOf ?? new Date().toISOString()
  const hardDelete = data.hardDelete ?? false
  const session = driver.session()

  try {
    let result
    if (hardDelete) {
      result = await session.run(
        `
        MATCH (source:Entity {organizationId: $organizationId})-[r]->(target:Entity {organizationId: $organizationId})
        WHERE r.expires_at IS NOT NULL
          AND datetime(r.expires_at) < datetime($asOf)
          AND r.valid_to IS NULL
        DELETE r
        RETURN count(r) as purgedCount
        `,
        { organizationId: data.organizationId, asOf }
      )
    } else {
      // soft close — set valid_to = asOf เพื่อรักษา bi-temporal history ไว้
      result = await session.run(
        `
        MATCH (source:Entity {organizationId: $organizationId})-[r]->(target:Entity {organizationId: $organizationId})
        WHERE r.expires_at IS NOT NULL
          AND datetime(r.expires_at) < datetime($asOf)
          AND r.valid_to IS NULL
        SET r.valid_to = datetime($asOf)
        RETURN count(r) as purgedCount
        `,
        { organizationId: data.organizationId, asOf }
      )
    }

    const purgedCount = result.records[0]?.get("purgedCount")?.toNumber() ?? 0

    return {
      purgedCount,
      purgedAt: asOf
    }
  } finally {
    await session.close()
  }
}
