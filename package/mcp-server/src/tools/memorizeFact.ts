import { randomUUID } from "crypto";
import { saveEntity } from "../../../adapter/src/repositories/nodes/saveEntity";
import { syncRelationship } from "../../../adapter/src/repositories/semantic";
import OpenAI from "openai";

export interface FactPayload {
  subject: string;
  predicate: string;
  object: string;
  context: string;
  organizationId?: string;
}

const generateId = (prefix: string, name: string) => 
  `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

export async function memorizeFact(payload: FactPayload) {
  const orgId = payload.organizationId || "org_001";
  const relType = payload.predicate.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');

  const subjectId = generateId("ent_mem", payload.subject);
  const objectId = generateId("ent_mem", payload.object);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const [subEmbedRes, objEmbedRes] = await Promise.all([
      openai.embeddings.create({ model: "text-embedding-3-small", input: payload.subject }),
      openai.embeddings.create({ model: "text-embedding-3-small", input: payload.object })
    ]);

    const subjectEmbedding = subEmbedRes.data[0].embedding;
    const objectEmbedding = objEmbedRes.data[0].embedding;

    await saveEntity({
      organizationId: orgId,
      id: subjectId,
      name: payload.subject,
      type: "CONCEPT",
      description: "Entity ที่ถูกสร้างจาก memorize_fact",
      embedding: subjectEmbedding
    });

    await saveEntity({
      organizationId: orgId,
      id: objectId,
      name: payload.object,
      type: "CONCEPT",
      description: "Entity ที่ถูกสร้างจาก memorize_fact",
      embedding: objectEmbedding
    });

    await syncRelationship({
      organizationId: orgId,
      source_id: subjectId,
      target_id: objectId,
      type: relType,
      valid_from: new Date().toISOString(),
      valid_to: null,
      confidence_score: 1.0,
      intent_category: "FACT",
      criticality_score: 0.5,
      sentiment: "NEUTRAL",
      clearance_level: 1,
      expires_at: null,
      justification: payload.context
    });

    return {
      message: "Fact memorized successfully with Entity Resolution",
      saved_data: {
        subject: payload.subject,
        relation: relType,
        object: payload.object,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("Error in memorizeFact:", error);
    throw error;
  }
}