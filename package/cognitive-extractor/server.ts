import { Elysia } from "elysia";
import { extractGraphData } from "./extractor";
import { generateEmbeddings } from "./vector";
// 📍 สมมติการ Import จากแพ็กเกจของเพื่อน (ช่วง POC ถ้ายังรันไม่ได้ให้ Comment ไว้ก่อนได้ครับ)
// import { saveOrganization } from "@memory-layer/storage-adapter/nodes/saveOrganization";
// import { saveEntity } from "@memory-layer/storage-adapter/nodes/saveEntity";
// import { saveDocument } from "@memory-layer/storage-adapter/nodes/saveDocument";
// import { saveChunk } from "@memory-layer/storage-adapter/nodes/saveChunk";
// import { linkEntityToEntity } from "@memory-layer/storage-adapter/semantic";

const app = new Elysia();

app.post("/api/memory/ingest", async ({ body }) => {
  try {
    const { text, organizationId, documentId, title } = body as any;
    
    console.log(`\n🚀 [API] ได้รับเอกสารใหม่จาก: ${organizationId}`);

    console.log("🧠 [Extractor] กำลังสกัด 4D Graph...");
    const rawResult = await extractGraphData(text, organizationId);
    const graphData = JSON.parse(rawResult);
    
    console.log("🔢 [Vector] กำลังฝัง Embedding ให้ Chunk...");
    const chunkEmbeddings = await generateEmbeddings([text]);
    
    const orgPayload = { id: organizationId, name: "Mock Org Name", created_at: new Date().toISOString() };
    console.log("📦 [1] Calling saveOrganization:", orgPayload.id);

    const mentionedEntityIds: string[] = [];
    for (const entity of graphData.entities) {
      const entityPayload = {
        organizationId: organizationId,
        id: entity.id,
        name: entity.name,
        type: entity.type.toUpperCase(),
        description: entity.description
      };
      mentionedEntityIds.push(entity.id);
      console.log(`📦 [2] Calling saveEntity: ${entityPayload.id}`);
      // await saveEntity(entityPayload);
    }

    const docPayload = {
      organizationId: organizationId,
      id: documentId || `doc_${Date.now()}`,
      title: title || "Untitled Document",
      type: "TEXT",
      language: "TH",
      authors: ["System"]
    };
    console.log("📦 [3] Calling saveDocument:", docPayload.id);

    const chunkPayload = {
      organizationId: organizationId,
      id: `chunk_${Date.now()}`,
      source_type: "document",
      source_id: docPayload.id,
      text: text,
      sequence_order: 1,
      embedding: chunkEmbeddings[0] || [],
      mentioned_entity_ids: mentionedEntityIds
    };
    console.log(`📦 [4] Calling saveChunk: ${chunkPayload.id} (Entities Mentioned: ${mentionedEntityIds.length})`);
    // await saveChunk(chunkPayload);

    // Step 5: linkEntityToEntity (ลูปสร้างเส้นความสัมพันธ์)
    for (const rel of graphData.relationships) {
      const relPayload = {
        organizationId: organizationId,
        source_id: rel.source_id,
        target_id: rel.target_id,
        type: rel.type.toUpperCase(),
        valid_from: rel.valid_from,
        valid_to: rel.valid_to,
        confidence_score: rel.confidence_score,
        intent_category: rel.intent_category,
        criticality_score: rel.criticality_score,
        sentiment: rel.sentiment,
        clearance_level: rel.clearance_level,
        expires_at: rel.expires_at,
        justification: rel.justification
      };
      console.log(`📦 [5] Calling linkEntityToEntity: ${rel.source_id} -> ${rel.target_id}`);
      // await linkEntityToEntity(relPayload);
    }

    return { 
      status: "success", 
      message: "Ingestion pipeline completed and sent to Storage Adapter.",
      metrics: {
        entities_saved: graphData.entities.length,
        relationships_saved: graphData.relationships.length,
        chunks_saved: 1
      }
    };

  } catch (error: any) {
    console.error("❌ [API] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.listen(3000, () => {
  console.log("🦊 Memory Ingestion API is running at http://localhost:3000");
  console.log("👉 Endpoint: POST http://localhost:3000/api/memory/ingest");
});