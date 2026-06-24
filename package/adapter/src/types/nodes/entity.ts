export interface Entity {
  organizationId: string
  id: string
  name: string
  type: string
  description: string
} 

// เพิ่ม 2 ตัวนี้ครับ เพื่อให้เรียกใช้ checkEntityExists(data) และ checkEntitiesExist(data) ได้
export interface CheckEntityInput {
  organizationId: string
  entityId: string
}

export interface CheckEntitiesExistInput {
  organizationId: string
  entityIds: string[]
}