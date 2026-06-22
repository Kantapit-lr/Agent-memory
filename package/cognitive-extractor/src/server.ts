import { Elysia } from "elysia";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { extractGraphData } from "./extractor";
import { generateEmbeddings } from "./vector";
import { chunkText } from "./chunker";
import driver from "../../adapter/src/db";

import { saveOrganization } from "../../adapter/src/repositories/nodes/saveOrganization";
import { saveEntity } from "../../adapter/src/repositories/nodes/saveEntity";
import { saveDocument } from "../../adapter/src/repositories/nodes/saveDocument";
import { saveChunk } from "../../adapter/src/repositories/nodes/saveChunk";
import { syncRelationship } from "../../adapter/src/repositories/semantic";

const aiClient = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY
});

const app = new Elysia();

app.post("/api/memory/ingest", async ({ body }) => {
  try {
    const { text, organizationId, documentId, title } = body as any;
    console.log(`\n🚀 [API] ได้รับเอกสารใหม่ (TEXT) จาก: ${organizationId}`);

    const chunks = chunkText(text, 2000, 200);
    console.log(`✂️ หั่นเอกสารได้ทั้งหมด: ${chunks.length} Chunks`);

    await saveOrganization({ id: organizationId, name: "Organization", created_at: new Date().toISOString() });

    const docPayload = {
      organizationId: organizationId,
      id: documentId || `doc_${Date.now()}`,
      title: title || "Untitled Document",
      type: "TEXT",
      language: "TH",
      authors: ["System"]
    };
    await saveDocument(docPayload);

    let totalEntities = 0, totalRels = 0;

    for (const chunk of chunks) {
      console.log(`\n🔄 กำลังประมวลผล Chunk ที่ ${chunk.sequence_order}/${chunks.length}...`);

      const rawResult = await extractGraphData(chunk.text, organizationId);
      const graphData = JSON.parse(rawResult);
      const chunkEmbeddings = await generateEmbeddings([chunk.text]);

      const mentionedEntitiesForChunk: any[] = [];

      for (const entity of graphData.entities) {
        await saveEntity({
          organizationId,
          id: entity.id,
          name: entity.name,
          type: entity.type.toUpperCase(),
          description: entity.description
        });

        mentionedEntitiesForChunk.push({
          entity_id: entity.id,
          valid_from: new Date().toISOString(),
          valid_to: null,
          confidence_score: 0.9,
          intent_category: "FACT",
          criticality_score: 0.5,
          sentiment: "NEUTRAL",
          clearance_level: 1,
          expires_at: null,
          justification: `Extracted from text chunk: ${chunk.id}`
        });
      }

      await saveChunk({
        organizationId,
        id: chunk.id,
        source_type: "document",
        source_id: docPayload.id,
        text: chunk.text,
        sequence_order: chunk.sequence_order,
        embedding: chunkEmbeddings[0] || [],
        mentioned_entities: mentionedEntitiesForChunk
      });

      for (const rel of graphData.relationships) {
        await syncRelationship({ organizationId, ...rel, type: rel.type.toUpperCase() });
      }

      totalEntities += graphData.entities.length;
      totalRels += graphData.relationships.length;
    }

    console.log(`\n🎉 [Pipeline] ประมวลผลและบันทึกข้อมูลเสร็จสิ้นทั้งหมด!`);
    console.log(`📊 สรุปผลลัพธ์ที่ได้:`);
    console.log(`   - ✂️ หั่นข้อความได้: ${chunks.length} Chunks`);
    console.log(`   - 🧠 สกัด Entities ได้: ${totalEntities} โหนด`);
    console.log(`   - 🔗 สร้างความสัมพันธ์ได้: ${totalRels} เส้น\n`);

    return { status: "success", message: "บันทึก Text ลง Graph DB สำเร็จ", metrics: { chunks: chunks.length, entities: totalEntities, relationships: totalRels } };

  } catch (error: any) {
    console.error("❌ [API] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.post("/api/memory/ingest/pdf", async ({ body }) => {
  try {
    const { file, organizationId, title } = body as any;
    if (!file) return new Response("กรุณาแนบไฟล์ PDF มาด้วยครับ", { status: 400 });

    const orgId = organizationId || "org_pdf_default";
    console.log(`\n📄 [API] ได้รับไฟล์ PDF จากองค์กร: ${orgId}`);

    const arrayBuffer = await file.arrayBuffer();
    const parser = new PDFParse(new Uint8Array(arrayBuffer));
    const textResult = await parser.getText() as any;
    const extractedText = textResult.text || String(textResult);

    const chunks = chunkText(extractedText, 2000, 200);
    console.log(`✂️ หั่นเอกสาร PDF ได้ทั้งหมด: ${chunks.length} Chunks`);

    await saveOrganization({ id: orgId, name: "Organization", created_at: new Date().toISOString() });

    const docPayload = {
      organizationId: orgId,
      id: `doc_pdf_${Date.now()}`,
      title: title || file.name || "Untitled PDF",
      type: "PDF",
      language: "TH",
      authors: ["System"]
    };
    await saveDocument(docPayload);

    let totalEntities = 0, totalRels = 0;

    for (const chunk of chunks) {
      console.log(`\n🔄 กำลังประมวลผล Chunk ที่ ${chunk.sequence_order}/${chunks.length}...`);

      const rawResult = await extractGraphData(chunk.text, orgId);
      const graphData = JSON.parse(rawResult);
      const chunkEmbeddings = await generateEmbeddings([chunk.text]);

      const mentionedEntitiesForChunk: any[] = [];

      for (const entity of graphData.entities) {
        await saveEntity({
          organizationId: orgId,
          id: entity.id,
          name: entity.name,
          type: entity.type.toUpperCase(),
          description: entity.description
        });

        mentionedEntitiesForChunk.push({
          entity_id: entity.id,
          valid_from: new Date().toISOString(),
          valid_to: null,
          confidence_score: 0.9,
          intent_category: "FACT",
          criticality_score: 0.5,
          sentiment: "NEUTRAL",
          clearance_level: 1,
          expires_at: null,
          justification: `Extracted from PDF chunk: ${chunk.id}`
        });
      }

      await saveChunk({
        organizationId: orgId,
        id: chunk.id,
        source_type: "document",
        source_id: docPayload.id,
        text: chunk.text,
        sequence_order: chunk.sequence_order,
        embedding: chunkEmbeddings[0] || [],
        mentioned_entities: mentionedEntitiesForChunk
      });

      for (const rel of graphData.relationships) {
        await syncRelationship({ organizationId: orgId, ...rel, type: rel.type.toUpperCase() });
      }

      totalEntities += graphData.entities.length;
      totalRels += graphData.relationships.length;
    }

    return { status: "success", message: "บันทึก PDF ลง Graph DB สำเร็จ", metrics: { chunks: chunks.length, entities: totalEntities, relationships: totalRels } };

  } catch (error: any) {
    console.error("❌ [PDF API] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.post("/api/memory/query", async ({ body }) => {
  try {
    const { question, organizationId } = body as any;
    console.log(`\n🔍 [API Query] คำถาม: "${question}" | องค์กร: ${organizationId}`);

    const queryEmbeddings = await generateEmbeddings([question]);

    let answer = "";
    let retrievedContext = "";
    const session = driver.session();

    try {
      console.log("🔮 [DB] กำลังค้นหาข้อมูลจาก Neo4j...");
      const result = await session.run(
        `
        MATCH (c:Chunk) 
        WHERE c.organizationId = $orgId 
        RETURN DISTINCT c.text AS chunkText
        LIMIT 5
        `,
        { orgId: organizationId }
      );

      const chunks = result.records.map((record: any) => record.get('chunkText'));
      retrievedContext = chunks.length > 0 ? chunks.join("\n---\n") : "";

      if (!retrievedContext) {
        return {
          status: "success",
          question: question,
          context: "",
          answer: "ไม่พบข้อมูลขององค์กรนี้ในระบบฐานข้อมูลครับ"
        };
      }

      console.log("🧠 [AI] พบข้อมูลจาก DB ส่งให้ AI สังเคราะห์คำตอบ...");

      const aiResponse = await aiClient.chat.completions.create({
        model: "anthropic/claude-sonnet-4-6",
        messages: [
          {
            role: "system",
            content: "คุณคือผู้ช่วย AI ที่เชี่ยวชาญการตอบคำถามจากบริบทที่กำหนดให้ จงตอบคำถามโดยอิงจาก 'ข้อมูลอ้างอิง' เท่านั้น ตอบให้กระชับและตรงประเด็นที่สุด หากข้อมูลอ้างอิงไม่มีคำตอบที่ตรงกับคำถาม ให้ตอบว่า 'ไม่มีข้อมูลเพียงพอที่จะตอบคำถามนี้'"
          },
          {
            role: "user",
            content: `ข้อมูลอ้างอิง:\n${retrievedContext}\n\nคำถาม: ${question}`
          }
        ],
        temperature: 0.1,
      });

      answer = aiResponse.choices[0]?.message?.content || "AI ไม่สามารถสร้างคำตอบได้";
      console.log("✅ [AI] สร้างคำตอบสำเร็จ");

    } catch (dbOrAiError) {
      console.error("❌ [Process Error]:", dbOrAiError);
      answer = "เกิดข้อผิดพลาดในการดึงข้อมูลจาก DB หรือการเชื่อมต่อกับ AI";
    } finally {
      await session.close();
    }

    return {
      status: "success",
      question: question,
      context: retrievedContext,
      answer: answer
    };

  } catch (error: any) {
    console.error("❌ [API Query] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.listen(3000, () => {
  console.log("🦊 Memory Ingestion API is running at http://localhost:3000");
});