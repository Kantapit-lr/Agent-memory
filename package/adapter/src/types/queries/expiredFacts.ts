export interface GetExpiredFactsInput {
  organizationId: string
  // ถ้าไม่ส่งมาจะใช้เวลาปัจจุบัน
  asOf?: string
}

export interface ExpiredFactResult {
  sourceId: string
  sourceName: string
  targetId: string
  targetName: string
  relationshipType: string
  expires_at: string
  valid_from: string
  valid_to: string | null
}

export interface PurgeExpiredFactsInput {
  organizationId: string
  // ถ้าไม่ส่งมาจะใช้เวลาปัจจุบัน
  asOf?: string
  // true = ลบ relationship ทิ้งเลย (hard delete)
  // false (default) = ปิด relationship โดย set valid_to (soft delete ตาม bi-temporal)
  hardDelete?: boolean
}

export interface PurgeExpiredFactsResult {
  purgedCount: number
  purgedAt: string
}
