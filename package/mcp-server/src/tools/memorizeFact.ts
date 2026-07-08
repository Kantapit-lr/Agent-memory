import driver from "../../../adapter/src/db";
import { randomUUID } from "crypto";

export interface FactPayload {
  subject: string;
  predicate: string;
  object: string;
  context: string;
}

export async function memorizeFact(payload: FactPayload) {
  const session = driver.session();
  
  const relType = payload.predicate.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');

  try {
    const result = await session.run(
      `
      // 1. หาหรือสร้างโหนด Subject
      MERGE (s:Entity {name: $subject})
      ON CREATE SET s.id = $subId, s.type = "Concept"
      
      // 2. หาหรือสร้างโหนด Object
      MERGE (o:Entity {name: $object})
      ON CREATE SET o.id = $objId, o.type = "Concept"
      
      // 3. สร้างเส้นความสัมพันธ์ (พร้อมกฎ 8 มิติ)
      MERGE (s)-[r:${relType}]->(o)
      SET r.valid_from = $validFrom,
          r.valid_to = null,
          r.confidence_score = 1.0,
          r.intent_category = "FACT",
          r.criticality_score = 0.5,
          r.sentiment = "NEUTRAL",
          r.clearance_level = 1,
          r.expires_at = null,
          r.context = $context
          
      RETURN s.name AS subject, type(r) AS relation, o.name AS object, r.valid_from AS timestamp
      `,
      { 
        subject: payload.subject, 
        object: payload.object,
        context: payload.context,
        subId: `ent_mem_${randomUUID()}`,
        objId: `ent_mem_${randomUUID()}`,
        validFrom: new Date().toISOString()
      }
    );

    const record = result.records[0];
    return {
      message: "Fact memorized successfully",
      saved_data: {
        subject: record.get("subject"),
        relation: record.get("relation"),
        object: record.get("object"),
        timestamp: record.get("timestamp").toString()
      }
    };
  } catch (error) {
    console.error("Error in memorizeFact:", error);
    throw error;
  } finally {
    await session.close();
  }
}