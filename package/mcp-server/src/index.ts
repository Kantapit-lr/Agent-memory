import { Elysia } from "elysia";
import OpenAI from "openai";

import { chunkText, processPDF } from "../../parser/src"; 
import { extractGraphData, generateEmbeddings } from "../../cognitive-extractor/src";

import driver from "../../adapter/src/db";
import { saveOrganization } from "../../adapter/src/repositories/nodes/saveOrganization";
import { saveDocument } from "../../adapter/src/repositories/nodes/saveDocument";
import { saveChunk } from "../../adapter/src/repositories/nodes/saveChunk";
import { syncRelationship } from "../../adapter/src/repositories/semantic";

const aiClient = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY
});

const executeWithRetry = async <T>(operation: () => Promise<T>, retries = 3, delay = 3000): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
};

const resolveAndSaveEntity = async (session: any, organizationId: string, entity: any, preCalculatedEmbedding: number[]): Promise<string> => {
  if (!preCalculatedEmbedding || preCalculatedEmbedding.length === 0) {
    await session.run(
      `
      MERGE (e:Entity {id: $id, organizationId: $orgId})
      SET e.name = $name, e.type = $type, e.description = $desc
      `,
      { id: entity.id, orgId: organizationId, name: entity.name, type: entity.type.toUpperCase(), desc: entity.description || "" }
    );
    return entity.id;
  }

  const searchResult = await session.run(
    `
    MATCH (e:Entity {organizationId: $orgId, type: $type})
    WHERE e.embedding IS NOT NULL
    WITH e, vector.similarity.cosine(e.embedding, $embedding) AS score
    WHERE score >= 0.90
    ORDER BY score DESC
    LIMIT 1
    RETURN e.id AS matched_id
    `,
    { orgId: organizationId, type: entity.type.toUpperCase(), embedding: preCalculatedEmbedding }
  );

  if (searchResult.records.length > 0) {
    return searchResult.records[0].get('matched_id');
  }

  await session.run(
    `
    MERGE (e:Entity {id: $id, organizationId: $orgId})
    SET e.name = $name, e.type = $type, e.description = $desc, e.embedding = $embedding
    `,
    { id: entity.id, orgId: organizationId, name: entity.name, type: entity.type.toUpperCase(), desc: entity.description || "", embedding: preCalculatedEmbedding }
  );

  return entity.id;
};

const app = new Elysia();

app.post("/api/memory/ingest", async ({ body }) => {
  try {
    const { text, organizationId, documentId, title } = body as any;
    console.log(`\n🚀 [API] ได้รับเอกสารใหม่ (TEXT) จาก: ${organizationId}`);

    const chunks = chunkText(text, 2000, 200);
    console.log(`✂️ หั่นเอกสารได้ทั้งหมด: ${chunks.length} Chunks`);

    await saveOrganization({ id: organizationId, name: "Organization", created_at: new Date().toISOString() });

    const docPayload = {
      organizationId: organizationId, id: documentId || `doc_${Date.now()}`,
      title: title || "Untitled Document", type: "TEXT", language: "TH", authors: ["System"]
    };
    await saveDocument(docPayload);

    let totalEntities = 0, totalRels = 0;
    const CONCURRENCY_LIMIT = 4;

    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      console.log(`\n⚡ กำลังประมวลผลแบบขนานก้อนที่ ${i + 1} ถึง ${Math.min(i + CONCURRENCY_LIMIT, chunks.length)} จากทั้งหมด ${chunks.length} Chunks...`);

      await Promise.all(batch.map(async (chunk) => {
        const chunkSession = driver.session();
        try {
          const [rawResult, chunkEmbeddings] = await Promise.all([
            executeWithRetry(() => extractGraphData(chunk.text, organizationId)),
            executeWithRetry(() => generateEmbeddings([chunk.text]))
          ]);

          const graphData = JSON.parse(rawResult);
          const entityNames = graphData.entities.map((e: any) => e.name);
          let entityEmbeddings: number[][] = [];
          
          if (entityNames.length > 0) {
            const COHERE_LIMIT = 90;
            for (let j = 0; j < entityNames.length; j += COHERE_LIMIT) {
              const batchNames = entityNames.slice(j, j + COHERE_LIMIT);
              const batchEmbeddings = await executeWithRetry(() => generateEmbeddings(batchNames));
              entityEmbeddings = entityEmbeddings.concat(batchEmbeddings);
            }
          }

          const mentionedEntitiesForChunk: any[] = [];
          const entityIdMap = new Map<string, string>();

          for (let k = 0; k < graphData.entities.length; k++) {
            const entity = graphData.entities[k];
            const embedding = entityEmbeddings[k] || [];

            const resolvedId = await executeWithRetry(() => resolveAndSaveEntity(chunkSession, organizationId, entity, embedding));
            entityIdMap.set(entity.id, resolvedId);

            mentionedEntitiesForChunk.push({
              entity_id: resolvedId, valid_from: entity.valid_from || new Date().toISOString(),
              valid_to: entity.valid_to || null, confidence_score: 0.9, intent_category: "FACT",
              criticality_score: 0.5, sentiment: "NEUTRAL", clearance_level: 1, expires_at: null,
              justification: `Extracted from text chunk: ${chunk.id}`
            });
          }

          await saveChunk({
            organizationId, id: chunk.id, source_type: "document", source_id: docPayload.id,
            text: chunk.text, sequence_order: chunk.sequence_order, embedding: chunkEmbeddings[0] || [],
            mentioned_entities: mentionedEntitiesForChunk
          });

          for (const rel of graphData.relationships) {
            await syncRelationship({
              organizationId, ...rel,
              source_id: entityIdMap.get(rel.source_id) || rel.source_id,
              target_id: entityIdMap.get(rel.target_id) || rel.target_id,
              type: rel.type.toUpperCase()
            });
          }

          totalEntities += graphData.entities.length;
          totalRels += graphData.relationships.length;
        } catch (chunkError) {
          console.error(`❌ [Chunk Error] ข้ามการประมวลผล Chunk ${chunk.id}:`, chunkError);
        } finally {
          await chunkSession.close();
        }
      }));
    }
    console.log(`\n🎉 [Pipeline] ประมวลผลและบันทึกข้อมูลเสร็จสิ้นทั้งหมด!`);
    return { status: "success", metrics: { chunks: chunks.length, entities: totalEntities, relationships: totalRels } };

  } catch (error: any) {
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
    const chunks = await processPDF(arrayBuffer);
    
    console.log(`✂️ หั่นเอกสาร PDF ได้ทั้งหมด: ${chunks.length} Chunks`);

    await saveOrganization({ id: orgId, name: "Organization", created_at: new Date().toISOString() });

    const docPayload = {
      organizationId: orgId, id: `doc_pdf_${Date.now()}`,
      title: title || file.name || "Untitled PDF", type: "PDF", language: "TH", authors: ["System"]
    };
    await saveDocument(docPayload);

    let totalEntities = 0, totalRels = 0;
    const CONCURRENCY_LIMIT = 4;

    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      console.log(`\n⚡ กำลังประมวลผลแบบขนานก้อนที่ ${i + 1} ถึง ${Math.min(i + CONCURRENCY_LIMIT, chunks.length)} จากทั้งหมด ${chunks.length} Chunks...`);

      await Promise.all(batch.map(async (chunk) => {
        const chunkSession = driver.session();
        try {
          const [rawResult, chunkEmbeddings] = await Promise.all([
            executeWithRetry(() => extractGraphData(chunk.text, orgId)),
            executeWithRetry(() => generateEmbeddings([chunk.text]))
          ]);

          const graphData = JSON.parse(rawResult);
          const entityNames = graphData.entities.map((e: any) => e.name);
          let entityEmbeddings: number[][] = [];
          
          if (entityNames.length > 0) {
            const COHERE_LIMIT = 90;
            for (let j = 0; j < entityNames.length; j += COHERE_LIMIT) {
              const batchNames = entityNames.slice(j, j + COHERE_LIMIT);
              const batchEmbeddings = await executeWithRetry(() => generateEmbeddings(batchNames));
              entityEmbeddings = entityEmbeddings.concat(batchEmbeddings);
            }
          }

          const mentionedEntitiesForChunk: any[] = [];
          const entityIdMap = new Map<string, string>();

          for (let k = 0; k < graphData.entities.length; k++) {
            const entity = graphData.entities[k];
            const embedding = entityEmbeddings[k] || [];

            const resolvedId = await executeWithRetry(() => resolveAndSaveEntity(chunkSession, orgId, entity, embedding));
            entityIdMap.set(entity.id, resolvedId);

            mentionedEntitiesForChunk.push({
              entity_id: resolvedId, valid_from: entity.valid_from || new Date().toISOString(),
              valid_to: entity.valid_to || null, confidence_score: 0.9, intent_category: "FACT",
              criticality_score: 0.5, sentiment: "NEUTRAL", clearance_level: 1, expires_at: null,
              justification: `Extracted from PDF chunk: ${chunk.id}`
            });
          }

          await saveChunk({
            organizationId: orgId, id: chunk.id, source_type: "document", source_id: docPayload.id,
            text: chunk.text, sequence_order: chunk.sequence_order, embedding: chunkEmbeddings[0] || [],
            mentioned_entities: mentionedEntitiesForChunk
          });

          for (const rel of graphData.relationships) {
            await syncRelationship({
              organizationId: orgId, ...rel,
              source_id: entityIdMap.get(rel.source_id) || rel.source_id,
              target_id: entityIdMap.get(rel.target_id) || rel.target_id,
              type: rel.type.toUpperCase()
            });
          }

          totalEntities += graphData.entities.length;
          totalRels += graphData.relationships.length;
        } catch (chunkError) {
          console.error(`❌ [Chunk Error] ข้ามการประมวลผล Chunk ${chunk.id}:`, chunkError);
        } finally {
          await chunkSession.close();
        }
      }));
    }
    return { status: "success", message: "บันทึก PDF ลง Graph DB สำเร็จ", metrics: { chunks: chunks.length, entities: totalEntities, relationships: totalRels } };

  } catch (error: any) {
    console.error("❌ [PDF API] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.post("/api/memory/query", async ({ body }) => {
  try {
    const { question, organizationId, activeOnly = false, clearanceLevel = 4 } = body as any;

    if (!question || question.trim() === "") {
      return new Response(JSON.stringify({ error: "กรุณาส่งฟิลด์ 'question' มาใน JSON Body ด้วยครับ" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`\n🔍 [API Query] คำถาม: "${question}" | องค์กร: ${organizationId}`);
    const queryEmbeddings = await executeWithRetry(() => generateEmbeddings([question]));

    let answer = "", retrievedContext = "";
    let rawResults: any[] = [];
    const session = driver.session();

    try {
      const result = await session.run(
        `
        MATCH (c:Chunk) 
        WHERE c.organizationId = $orgId AND c.embedding IS NOT NULL AND size(c.embedding) = size($queryEmbedding)
        WITH c, vector.similarity.cosine(c.embedding, $queryEmbedding) AS score
        ORDER BY score DESC LIMIT 5
        OPTIONAL MATCH (d:Document)-[:HAS_CHUNK]->(c)
        WITH c, score, coalesce(c.source_id, c.sourceId, d.id, "unknown_doc") AS document_id
        OPTIONAL MATCH (e1:Entity)-[r]->(e2:Entity)
        WHERE e1.organizationId = $orgId AND c.text CONTAINS e1.name 
          AND ($activeOnly = false OR r.valid_to IS NULL OR r.valid_to = "")
          AND (r.clearance_level IS NULL OR r.clearance_level <= $clearanceLevel)
        RETURN c.id AS chunk_id, document_id, c.text AS chunkText, score,
               collect(DISTINCT e1.name + " [" + type(r) + "] " + e2.name) AS graph_facts
        `,
        { orgId: organizationId, queryEmbedding: queryEmbeddings[0], activeOnly: activeOnly === true || activeOnly === "true", clearanceLevel: Number(clearanceLevel) }
      );

      rawResults = result.records.map((record: any) => {
        const facts = record.get('graph_facts') || [];
        return {
          chunk_id: record.get('chunk_id'), document_id: record.get('document_id'),
          text: record.get('chunkText'), similarity_score: record.get('score'),
          graph_facts: facts.filter((f: string) => f !== null && f.trim() !== "")
        };
      });

      retrievedContext = rawResults.length > 0 ? rawResults.map(r => {
        let block = `[${r.chunk_id}] เนื้อหา: ${r.text}`;
        if (r.graph_facts && r.graph_facts.length > 0) block += `\n   -> [Graph Knowledge]: ${r.graph_facts.join(", ")}`;
        return block;
      }).join("\n---\n") : "";

      if (!retrievedContext) return { status: "success", question, answer: "ไม่พบข้อมูลที่ตรงกับคำถามครับ", citations: [], raw_query_result: [] };

      const aiResponse = await executeWithRetry(() => aiClient.chat.completions.create({
        model: "anthropic/claude-sonnet-4-6", temperature: 0.1,
        messages: [
          { role: "system", content: "คุณคือผู้ช่วย AI ที่เชี่ยวชาญการตอบคำถาม จงตอบโดยอิงจาก 'ข้อมูลอ้างอิง' เท่านั้น และต้องใส่รหัสอ้างอิง [chunk_id] ต่อท้ายประโยคเสมอ" },
          { role: "user", content: `ข้อมูลอ้างอิง:\n${retrievedContext}\n\nคำถาม: ${question}` }
        ]
      }));

      answer = aiResponse.choices[0]?.message?.content || "AI ไม่สามารถสร้างคำตอบได้";
    } catch (dbOrAiError) {
      console.error("❌ [Process Error]:", dbOrAiError);
      answer = "เกิดข้อผิดพลาดในการดึงข้อมูลจาก DB";
    } finally {
      await session.close();
    }
    return { status: "success", question, answer, citations: rawResults.map((r: any) => ({ document_id: r.document_id, chunk_id: r.chunk_id, text_preview: r.text.substring(0, 50) + "..." })), raw_query_result: rawResults };

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.get("/api/memory/document/:documentId/tree", async ({ params }) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (d:Document)-[:HAS_CHUNK]->(c:Chunk) 
       WHERE d.id = $docId 
       RETURN c.id AS chunk_id, c.sequence_order AS sequence_order, c.text AS text 
       ORDER BY c.sequence_order ASC`, 
      { docId: params.documentId }
    );
    const chunks = result.records.map((record: any) => {
      const seq = record.get('sequence_order');
      return {
        chunk_id: record.get('chunk_id'),
        sequence_order: seq && typeof seq.toNumber === 'function' ? seq.toNumber() : seq,
        text: record.get('text')
      };
    });
    return { status: "success", document_id: params.documentId, total_chunks: chunks.length, chunks: chunks };
  } finally {
    await session.close();
  }
});

app.get("/api/memory/entity/:entityName/timeline", async ({ params }) => {
  const session = driver.session();
  try {
    const result = await session.run(`MATCH (e:Entity)-[r]-(other) WHERE toLower(e.name) CONTAINS toLower($entityName) RETURN e.name AS matched_entity, type(r) AS relationship, other.name AS related_to, toString(r.valid_from) AS valid_from ORDER BY r.valid_from ASC`, { entityName: params.entityName });
    const timeline = result.records.map((record: any) => ({ matched_entity: record.get('matched_entity'), date: record.get('valid_from'), event: record.get('relationship'), related_entity: record.get('related_to') }));
    return { status: "success", search_keyword: params.entityName, timeline: timeline };
  } finally { await session.close(); }
});

app.get("/api/memory/documents", async ({ query }) => {
  const orgId = query.orgId as string | undefined;
  const session = driver.session();
  try {
    const cypherQuery = orgId
      ? `MATCH (d:Document {organizationId: $orgId}) OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk) RETURN d.id AS id, d.title AS title, d.type AS type, count(c) AS total_chunks ORDER BY d.id DESC`
      : `MATCH (d:Document) OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk) RETURN d.id AS id, d.title AS title, d.organizationId AS organizationId, d.type AS type, count(c) AS total_chunks ORDER BY d.id DESC`;
    const result = await session.run(cypherQuery, orgId ? { orgId } : {});
    const documents = result.records.map((record: any) => {
      const doc: any = { document_id: record.get('id'), title: record.get('title'), type: record.get('type'), total_chunks: record.get('total_chunks').toNumber() };
      if (!orgId) doc.organizationId = record.get('organizationId');
      return doc;
    });
    return { status: "success", total_documents: documents.length, documents: documents };
  } finally { await session.close(); }
});

app.get("/api/memory/discover", async ({ query }) => {
  const keyword = query.keyword as string;
  const orgId = query.orgId as string | undefined;
  const session = driver.session();
  if (!keyword || keyword.trim() === "") return new Response(JSON.stringify({ error: "กรุณาระบุ keyword เพื่อค้นหา (เช่น ?keyword=โฟร์ยูทู)" }), { status: 400 });
  try {
    const cypherQuery = orgId
      ? `MATCH (e:Entity {organizationId: $orgId}) WHERE toLower(e.name) CONTAINS toLower($keyword) RETURN e.id AS id, e.name AS name, e.type AS type LIMIT 10`
      : `MATCH (e:Entity) WHERE toLower(e.name) CONTAINS toLower($keyword) RETURN e.id AS id, e.name AS name, e.type AS type, e.organizationId AS organizationId LIMIT 10`;
    const result = await executeWithRetry(() => session.run(cypherQuery, { keyword, orgId }));
    const entities = result.records.map((record: any) => {
      const entityDoc: any = { entity_id: record.get('id'), name: record.get('name'), type: record.get('type') };
      if (!orgId) entityDoc.organizationId = record.get('organizationId');
      return entityDoc;
    });
    return { status: "success", search_keyword: keyword, total_found: entities.length, results: entities };
  } finally { await session.close(); }
});

app.delete("/api/memory/document/:documentId", async ({ params }) => {
  const session = driver.session();
  try {
    const checkResult = await session.run(`MATCH (d:Document {id: $docId}) RETURN d.id AS id`, { docId: params.documentId });
    if (checkResult.records.length === 0) return new Response(JSON.stringify({ status: "not_found", message: "ไม่พบไฟล์" }), { status: 404 });
    await session.run(`MATCH (d:Document {id: $docId}) OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk) DETACH DELETE d, c`, { docId: params.documentId });
    return { status: "success", message: `ลบ ${params.documentId} สำเร็จ` };
  } finally { await session.close(); }
});

app.listen(3000, () => {
  console.log("🦊 Memory Ingestion API is running at http://localhost:3000");
});