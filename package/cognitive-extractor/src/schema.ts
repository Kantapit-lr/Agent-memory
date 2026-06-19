import { z } from "zod";

const IntentCategory = z.enum(["FACT", "POLICY", "DECISION", "OPINION", "TASK"]);
const Sentiment = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);
const EntityType = z.enum(["Person", "Org", "Feature", "Function"]);

export const EntitySchema = z.object({
  id: z.string().describe("รหัสเฉพาะ เช่น org_ttb, person_thaveesin"),
  name: z.string().describe("ชื่อที่ปรากฏในเอกสาร"),
  type: EntityType,
  description: z.string().describe("คำอธิบายสั้นๆ"),
  organizationId: z.string().describe("รหัส ID ขององค์กรเจ้าของข้อมูล")
});

export const RelationshipSchema = z.object({
  source_id: z.string(),
  target_id: z.string(),
  type: z.string().describe("ตัวพิมพ์ใหญ่คั่นด้วย Underscore"),
  valid_from: z.string().datetime(),
  valid_to: z.string().datetime().nullable(),
  confidence_score: z.number(),
  intent_category: IntentCategory,
  criticality_score: z.number(),
  sentiment: Sentiment,
  clearance_level: z.number().int(),
  expires_at: z.string().datetime().nullable(),
  justification: z.string(),
  organizationId: z.string().describe("รหัส ID ขององค์กรเจ้าของข้อมูล")
});

export const GraphExtractionSchema = z.object({
  entities: z.array(EntitySchema),
  relationships: z.array(RelationshipSchema)
});