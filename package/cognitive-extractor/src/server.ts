import { Elysia } from "elysia";
import { extractGraphData } from "./extractor";
import { generateEmbeddings } from "./vector";
import { chunkText } from "./chunker"; 

import { saveOrganization } from "../../adapter/src/repositories/nodes/saveOrganization";
import { saveEntity } from "../../adapter/src/repositories/nodes/saveEntity";
import { saveDocument } from "../../adapter/src/repositories/nodes/saveDocument";
import { saveChunk } from "../../adapter/src/repositories/nodes/saveChunk";
import { syncRelationship } from "../../adapter/src/repositories/semantic";

const app = new Elysia();

app.post("/api/memory/ingest", async ({ body }) => {
  try {
    const { text, organizationId, documentId, title } = body as any;
    
    console.log(`\n🚀 [API] ได้รับเอกสารใหม่จาก: ${organizationId}`);

    const chunks = chunkText(text, 2000, 200);
    console.log(`✂️ หั่นเอกสารได้ทั้งหมด: ${chunks.length} Chunks`);

    // 📦 Step 1: saveOrganization
    const orgPayload = { id: organizationId, name: "Mock Org Name", created_at: new Date().toISOString() };
    console.log("📦 [1] Calling saveOrganization:", orgPayload.id);
    await saveOrganization(orgPayload);

    // 📦 Step 3: saveDocument (ทำก่อนข้ามไป Step 2 ตามที่เพื่อนแนะนำ)
    const docPayload = {
      organizationId: organizationId,
      id: documentId || `doc_${Date.now()}`,
      title: title || "Untitled Document",
      type: "TEXT",
      language: "TH",
      authors: ["System"]
    };
    console.log("📦 [3] Calling saveDocument:", docPayload.id);
    await saveDocument(docPayload);

    let totalEntities = 0;
    let totalRels = 0;

    for (const chunk of chunks) {
      console.log(`\n🔄 กำลังประมวลผล Chunk ที่ ${chunk.sequence_order}/${chunks.length}...`);

      const rawResult = await extractGraphData(chunk.text, organizationId);
      const graphData = JSON.parse(rawResult);
      const chunkEmbeddings = await generateEmbeddings([chunk.text]);

      const mentionedEntitiesForChunk: any[] = [];
      
      // 📦 Step 2: saveEntity
      for (const entity of graphData.entities) {
        const entityPayload = {
          organizationId: organizationId,
          id: entity.id,
          name: entity.name,
          type: entity.type.toUpperCase(),
          description: entity.description
        };
        console.log(`   👉 [2] Calling saveEntity: ${entityPayload.name}`);
        await saveEntity(entityPayload);

        // 📍 อัปเดตใหม่! เตรียมข้อมูล 8 มิติให้ Entity ที่ถูกอ้างถึงใน Chunk (ตาม README เพื่อน)
        mentionedEntitiesForChunk.push({
          entity_id: entity.id,
          valid_from: new Date().toISOString(), // ถือว่าข้อมูลเริ่มเป็นจริง ณ วันที่ประมวลผลเอกสาร
          valid_to: null,
          confidence_score: 0.9,
          intent_category: "FACT",
          criticality_score: 0.5,
          sentiment: "NEUTRAL",
          clearance_level: 1,
          expires_at: null,
          justification: `Extracted from document chunk: ${chunk.id}`
        });
      }

      // 📦 Step 5: saveChunk (สเปคใหม่)
      const chunkPayload = {
        organizationId: organizationId,
        id: chunk.id,
        source_type: "document", // ใช้ document ตามสเปคเพื่อน
        source_id: docPayload.id,
        text: chunk.text,
        sequence_order: chunk.sequence_order,
        embedding: chunkEmbeddings[0] || [],
        mentioned_entities: mentionedEntitiesForChunk // 📍 ส่งเป็น Object เต็มๆ ตามที่เพื่อนขอ
      };
      console.log(`   👉 [4] Calling saveChunk: ${chunkPayload.id} (เชื่อม ${mentionedEntitiesForChunk.length} Entities)`);
      await saveChunk(chunkPayload);

      // 📦 Step 6: syncRelationship (เปลี่ยนจาก linkEntityToEntity)
      for (const rel of graphData.relationships) {
        const relPayload = {
          organizationId: organizationId,
          ...rel,
          type: rel.type.toUpperCase()
        };
        console.log(`   👉 [5] Calling syncRelationship: ${rel.source_id} -> ${rel.target_id}`);
        await syncRelationship(relPayload);
      }

      totalEntities += graphData.entities.length;
      totalRels += graphData.relationships.length;
    }

    return { 
      status: "success", 
      message: "Ingestion pipeline completed and sent to Storage Adapter.",
      metrics: { chunks_processed: chunks.length, entities_saved: totalEntities, relationships_saved: totalRels }
    };

  } catch (error: any) {
    console.error("❌ [API] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.listen(3000, () => {
  console.log("🦊 Memory Ingestion API is running at http://localhost:3000");
});