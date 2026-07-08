import { Elysia } from "elysia";
import OpenAI from "openai";
import { Queue } from "bullmq";

import { chunkText, processPDF, processCode} from "../../parser/src";
import { extractGraphData, generateEmbeddings } from "../../cognitive-extractor/src";
import driver from "../../adapter/src/db";
import { saveOrganization } from "../../adapter/src/repositories/nodes/saveOrganization";
import { saveDocument } from "../../adapter/src/repositories/nodes/saveDocument";
import { saveChunk } from "../../adapter/src/repositories/nodes/saveChunk";
import { saveEntity } from "../../adapter/src/repositories/nodes/saveEntity";
import { syncRelationship } from "../../adapter/src/repositories/semantic";
import { saveEpisode } from "../../adapter/src/repositories/nodes/saveEpisode";
import { getDocumentTree } from "../../adapter/src/repositories/queries/getDocumentTree";
import { discoverEntities } from "../../adapter/src/repositories/queries/discoverEntities";
import { getEntityTimeline } from "../../adapter/src/repositories/queries/getEntityTimeline";
import { justifyIntent } from "./tools/justifyIntent";
import { discoverNodes } from "./tools/discoverNodes";
import { memorizeFact } from "./tools/memorizeFact";
import { logEpisode } from "./tools/logEpisode";

const isMock = process.env.USE_MOCK_AI === "true";

const safeExtractGraphData = async (text: string, orgId: string) => {
  if (isMock) {
    const timestamp = Date.now();
    return JSON.stringify({
      entities: [
        { id: `ent_${timestamp}_1`, name: "ทวีสิน", type: "PERSON", description: "พนักงานฝ่าย IT", valid_from: new Date().toISOString() },
        { id: `ent_${timestamp}_2`, name: "ฝ่าย IT", type: "ORG", description: "แผนกไอที", valid_from: new Date().toISOString() }
      ],
      relationships: [
        { source_id: `ent_${timestamp}_1`, target_id: `ent_${timestamp}_2`, type: "WORKS_AT", valid_from: new Date().toISOString() }
      ]
    });
  }
  return extractGraphData(text, orgId);
};

const safeGenerateEmbeddings = async (texts: string[]) => {
  if (isMock) {
    return texts.map(() => Array(1024).fill(0.123));
  }
  return generateEmbeddings(texts);
};

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

const QUEUE_NAME = "ingestion";
const ingestQueue = new Queue(QUEUE_NAME, {
  connection: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379
  }
});

const app = new Elysia();

app.post("/api/memory/ingest", async ({ body }) => {
  try {
    const { text, organizationId, documentId, title, language, clearance_level } = body as any;
    const chunks = chunkText(text, 2000, 200);

    await saveOrganization({ id: organizationId, name: "Organization", created_at: new Date().toISOString() });
    const docId = documentId || `doc_${Date.now()}`;
    const docLang = language || "TH";
    const cLevel = clearance_level !== undefined ? Number(clearance_level) : 1;

    await saveDocument({ organizationId, id: docId, title: title || "Untitled Document", type: "TEXT", language: docLang, authors: ["System"] });

    const allEntities: any[] = [];
    const allChunks: any[] = [];
    const allRelationships: any[] = [];
    const CONCURRENCY_LIMIT = 4;

    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(async (chunk) => {
        try {
          const [rawResult, chunkEmbeddings] = await Promise.all([
            executeWithRetry(() => safeExtractGraphData(chunk.text, organizationId)),
            executeWithRetry(() => safeGenerateEmbeddings([chunk.text]))
          ]);

          const graphData = JSON.parse(rawResult);
          const mentionedEntitiesForChunk: any[] = [];
          const entities = graphData.entities || [];
          const relationships = graphData.relationships || [];

          for (const entity of entities) {
            allEntities.push(entity);
            mentionedEntitiesForChunk.push({
              entity_id: entity.id,
              valid_from: entity.valid_from || new Date().toISOString(),
              valid_to: entity.valid_to || null,
              confidence_score: entity.confidence_score ?? 0.9,
              intent_category: entity.intent_category || "FACT",
              criticality_score: entity.criticality_score ?? 0.5,
              sentiment: entity.sentiment || "NEUTRAL",
              clearance_level: cLevel,
              expires_at: entity.expires_at || null,
              justification: entity.justification || `Extracted chunk: ${chunk.id}`
            });
          }

          allChunks.push({
            id: chunk.id, source_type: "document", source_id: docId, text: chunk.text, sequence_order: chunk.sequence_order,
            embedding: chunkEmbeddings[0] || [], mentioned_entities: mentionedEntitiesForChunk
          });

          for (const rel of relationships) {
            allRelationships.push({
              source_id: rel.source_id, target_id: rel.target_id, type: rel.type.toUpperCase(),
              valid_from: rel.valid_from || new Date().toISOString(), valid_to: rel.valid_to || null,
              confidence_score: rel.confidence_score ?? 0.9, intent_category: rel.intent_category || "FACT", criticality_score: rel.criticality_score ?? 0.5, sentiment: rel.sentiment || "NEUTRAL", clearance_level: cLevel, expires_at: rel.expires_at || null, justification: rel.justification || "Extracted relationship"
            });
          }
        } catch (error) {}
      }));
    }

    const job = await ingestQueue.add("ingest-text-job", {
      organizationId,
      chunks: allChunks,
      entities: allEntities,
      relationships: allRelationships
    });

    return { status: "processing", message: "Processing completed and sent to worker", job_id: job.id };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
});

app.post("/api/memory/ingest/pdf", async ({ body }) => {
  try {
    const { file, organizationId, title, language, clearance_level } = body as any;
    if (!file) return new Response(JSON.stringify({ error: "Missing PDF file" }), { status: 400 });

    const orgId = organizationId || "org_pdf_default";
    const docLang = language || "TH";
    const cLevel = clearance_level !== undefined ? Number(clearance_level) : 1;
    const arrayBuffer = await file.arrayBuffer();
    const chunks = await processPDF(arrayBuffer);

    await saveOrganization({ id: orgId, name: "Organization", created_at: new Date().toISOString() });
    const docId = `doc_pdf_${Date.now()}`;
    await saveDocument({ organizationId: orgId, id: docId, title: title || file.name || "Untitled PDF", type: "PDF", language: docLang, authors: ["System"] });

    const allEntities: any[] = [];
    const allChunks: any[] = [];
    const allRelationships: any[] = [];
    const CONCURRENCY_LIMIT = 4;

    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(async (chunk) => {
        try {
          const [rawResult, chunkEmbeddings] = await Promise.all([
            executeWithRetry(() => safeExtractGraphData(chunk.text, orgId)),
            executeWithRetry(() => safeGenerateEmbeddings([chunk.text]))
          ]);

          const graphData = JSON.parse(rawResult);
          const mentionedEntitiesForChunk: any[] = [];
          const entities = graphData.entities || [];
          const relationships = graphData.relationships || [];

          for (const entity of entities) {
            allEntities.push(entity);
            mentionedEntitiesForChunk.push({
              entity_id: entity.id, valid_from: entity.valid_from || new Date().toISOString(), valid_to: entity.valid_to || null,
              confidence_score: entity.confidence_score ?? 0.9, intent_category: entity.intent_category || "FACT", criticality_score: entity.criticality_score ?? 0.5, sentiment: entity.sentiment || "NEUTRAL", clearance_level: cLevel, expires_at: entity.expires_at || null, justification: entity.justification || `Extracted chunk: ${chunk.id}`
            });
          }

          allChunks.push({
            id: chunk.id, source_type: "document", source_id: docId, text: chunk.text, sequence_order: chunk.sequence_order,
            embedding: chunkEmbeddings[0] || [], mentioned_entities: mentionedEntitiesForChunk
          });

          for (const rel of relationships) {
            allRelationships.push({
              source_id: rel.source_id, target_id: rel.target_id, type: rel.type.toUpperCase(),
              valid_from: rel.valid_from || new Date().toISOString(), valid_to: rel.valid_to || null,
              confidence_score: rel.confidence_score ?? 0.9, intent_category: rel.intent_category || "FACT", criticality_score: rel.criticality_score ?? 0.5, sentiment: rel.sentiment || "NEUTRAL", clearance_level: cLevel, expires_at: rel.expires_at || null, justification: rel.justification || "Extracted relationship"
            });
          }
        } catch (error) {}
      }));
    }

    const job = await ingestQueue.add("ingest-pdf-job", {
      organizationId: orgId,
      chunks: allChunks,
      entities: allEntities,
      relationships: allRelationships
    });

    return { status: "processing", message: "Processing completed and sent to worker", job_id: job.id };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
});

app.post("/api/memory/ingest/image", async ({ body }) => {
  try {
    const { file, organizationId, title, language, clearance_level } = body as any;
    if (!file) return new Response(JSON.stringify({ error: "Missing image file" }), { status: 400 });

    const orgId = organizationId || "org_image_default";
    const docLang = language || "TH";
    const cLevel = clearance_level !== undefined ? Number(clearance_level) : 1;

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    await saveOrganization({ id: orgId, name: "Organization", created_at: new Date().toISOString() });
    const docId = `doc_img_${Date.now()}`;
    await saveDocument({ organizationId: orgId, id: docId, title: title || file.name || "Untitled Image", type: "IMAGE", language: docLang, authors: ["System"] });

    let extractedGraph: any = { text: "ไม่สามารถสกัดข้อความได้", entities: [], relationships: [] };

    if (!isMock) {
      const aiResponse = await executeWithRetry(() => aiClient.chat.completions.create({
        model: "anthropic/claude-sonnet-5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `คุณคือผู้เชี่ยวชาญด้านการสกัดข้อมูล จงทำ 2 อย่างจากภาพนี้:
                1. อ่านข้อความทั้งหมดในภาพ (OCR)
                2. สกัด Entities (PERSON, ORG, LOCATION, CONCEPT) และ Relationships (WORKS_AT, PART_OF, RELATED_TO ฯลฯ)พร้อมมิติการรับรู้
                
                จงตอบกลับมาเป็น JSON Format รูปแบบนี้เท่านั้น ห้ามมีข้อความอื่นปน:
                {
                  "text": "ข้อความที่อ่านได้ทั้งหมด",
                  "entities": [{ "id": "ent_1", "name": "...", "type": "...", "description": "...", "confidence_score": 0.9, "intent_category": "FACT", "criticality_score": 0.5, "sentiment": "NEUTRAL", "expires_at": null, "justification": "..." }],
                  "relationships": [{ "source_id": "ent_1", "target_id": "ent_2", "type": "...", "confidence_score": 0.9, "intent_category": "FACT", "criticality_score": 0.5, "sentiment": "NEUTRAL", "expires_at": null, "justification": "..." }]
                }`
              },
              {
                type: "image_url",
                image_url: { url: dataUrl }
              }
            ]
          }
        ]
      }));

      const content = aiResponse.choices[0]?.message?.content || "{}";
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedGraph = JSON.parse(cleanJson);
    }

    const chunkText = extractedGraph.text || "Image content";
    const chunkEmbeddings = await executeWithRetry(() => safeGenerateEmbeddings([chunkText]));

    const mentionedEntitiesForChunk: any[] = [];
    const entities = extractedGraph.entities || [];
    const relationships = extractedGraph.relationships || [];

    for (const entity of entities) {
      entity.id = entity.id.startsWith("ent_") ? `${entity.id}_${Date.now()}` : `ent_${Date.now()}`;
      mentionedEntitiesForChunk.push({
        entity_id: entity.id, valid_from: entity.valid_from || new Date().toISOString(), valid_to: entity.valid_to || null,
        confidence_score: entity.confidence_score ?? 0.9, intent_category: entity.intent_category || "FACT", criticality_score: entity.criticality_score ?? 0.5, sentiment: entity.sentiment || "NEUTRAL", clearance_level: cLevel, expires_at: entity.expires_at || null, justification: entity.justification || `Extracted from Image`
      });
    }

    const chunks = [{
      id: `chunk_img_${Date.now()}`, source_type: "document", source_id: docId, text: chunkText, sequence_order: 1,
      embedding: chunkEmbeddings[0] || [], mentioned_entities: mentionedEntitiesForChunk
    }];

    const formattedRelationships = relationships.map((rel: any) => ({
      ...rel,
      source_id: entities.find((e: any) => e.id.includes(rel.source_id))?.id || rel.source_id,
      target_id: entities.find((e: any) => e.id.includes(rel.target_id))?.id || rel.target_id,
      type: rel.type.toUpperCase(),
      valid_from: rel.valid_from || new Date().toISOString(), valid_to: rel.valid_to || null,
      confidence_score: rel.confidence_score ?? 0.9, intent_category: rel.intent_category || "FACT", criticality_score: rel.criticality_score ?? 0.5, sentiment: rel.sentiment || "NEUTRAL", clearance_level: cLevel, expires_at: rel.expires_at || null, justification: rel.justification || "Extracted from Image"
    }));

    const job = await ingestQueue.add("ingest-image-job", {
      organizationId: orgId,
      chunks: chunks,
      entities: entities,
      relationships: formattedRelationships
    });

    return { status: "processing", message: "Processing completed and sent to worker", job_id: job.id };
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.post("/api/memory/ingest/code", async ({ body }) => {
  try {
    const { code, fileName, organizationId, clearance_level } = body as any;
    if (!code) return new Response(JSON.stringify({ error: "Missing code field" }), { status: 400 });

    const orgId = organizationId || "org_code_default";
    const cLevel = clearance_level !== undefined ? Number(clearance_level) : 1;
    const docId = `doc_code_${Date.now()}`;

    await saveOrganization({ id: orgId, name: "Organization", created_at: new Date().toISOString() });
    await saveDocument({ organizationId: orgId, id: docId, title: fileName || "Untitled_Code.js", type: "CODE", language: "CODE", authors: ["System"] });

    const chunks = await processCode(code);

    const allEntities: any[] = [];
    const allChunks: any[] = [];
    const allRelationships: any[] = [];

    const CONCURRENCY_LIMIT = 4;
    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(async (chunk) => {
        try {
          const chunkEmbeddings = await executeWithRetry(() => safeGenerateEmbeddings([chunk.text]));

          const mentionedEntitiesForChunk: any[] = [];
          const ast = chunk.ast_metadata;

          if (ast) {
            const subjectId = `ent_code_${ast.name || chunk.id}`;
            if (ast.name) {
              allEntities.push({
                id: subjectId, name: ast.name, type: ast.type === "class" ? "CLASS" : "FUNCTION", description: `Code block from ${fileName || "file"}`,
                valid_from: new Date().toISOString(), valid_to: null
              });
              mentionedEntitiesForChunk.push({
                entity_id: subjectId, valid_from: new Date().toISOString(), valid_to: null,
                confidence_score: 1.0, intent_category: "FACT", criticality_score: 0.8, sentiment: "NEUTRAL", clearance_level: cLevel, expires_at: null, justification: "AST Extraction"
              });
            }

            if (ast.imports && ast.imports.length > 0) {
              ast.imports.forEach((imp: string) => {
                const targetId = `ent_module_${imp.replace(/[^a-zA-Z0-9]/g, "_")}`;
                allEntities.push({ id: targetId, name: imp, type: "MODULE", description: "Imported dependency", valid_from: new Date().toISOString(), valid_to: null });
                allRelationships.push({
                  source_id: subjectId, target_id: targetId, type: "IMPORTS", valid_from: new Date().toISOString(), valid_to: null,
                  confidence_score: 1.0, intent_category: "FACT", criticality_score: 0.8, sentiment: "NEUTRAL", clearance_level: cLevel, expires_at: null, justification: "AST Import"
                });
              });
            }

            if (ast.calls && ast.calls.length > 0) {
              ast.calls.forEach((funcCall: string) => {
                const targetId = `ent_func_${funcCall}`;
                allEntities.push({ id: targetId, name: funcCall, type: "FUNCTION", description: "Called function", valid_from: new Date().toISOString(), valid_to: null });
                allRelationships.push({
                  source_id: subjectId, target_id: targetId, type: "CALLS", valid_from: new Date().toISOString(), valid_to: null,
                  confidence_score: 1.0, intent_category: "FACT", criticality_score: 0.8, sentiment: "NEUTRAL", clearance_level: cLevel, expires_at: null, justification: "AST Function Call"
                });
              });
            }
          }

          allChunks.push({
            id: chunk.id, source_type: "document", source_id: docId, text: chunk.text, sequence_order: chunk.sequence_order,
            embedding: chunkEmbeddings[0] || [], mentioned_entities: mentionedEntitiesForChunk
          });
        } catch (error) {}
      }));
    }

    const job = await ingestQueue.add("ingest-code-job", {
      organizationId: orgId,
      chunks: allChunks,
      entities: allEntities,
      relationships: allRelationships
    });

    return { status: "processing", message: "AST Code Extraction completed without LLM and sent to worker", job_id: job.id };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
});

app.post("/api/memory/chat", async ({ body }) => {
  try {
    const { message, organizationId, summary, clearance_level } = body as any;
    if (!message) return new Response(JSON.stringify({ error: "Missing message field" }), { status: 400 });

    const orgId = organizationId || "org_chat_default";
    const cLevel = clearance_level !== undefined ? Number(clearance_level) : 1;
    await saveOrganization({ id: orgId, name: "Organization", created_at: new Date().toISOString() });

    const episodeId = `ep_${Date.now()}`;
    await saveEpisode({ organizationId: orgId, id: episodeId, timestamp: new Date().toISOString(), source: "chat", summary: summary || "User chat interaction" });

    const [rawResult, chunkEmbeddings] = await Promise.all([
      executeWithRetry(() => safeExtractGraphData(message, orgId)),
      executeWithRetry(() => safeGenerateEmbeddings([message]))
    ]);

    const graphData = JSON.parse(rawResult);
    const mentionedEntitiesForChunk: any[] = [];
    const entities = graphData.entities || [];
    const relationships = graphData.relationships || [];

    for (let k = 0; k < entities.length; k++) {
      const entity = entities[k];
      await executeWithRetry(() => saveEntity({ organizationId: orgId, id: entity.id, name: entity.name, type: entity.type.toUpperCase(), description: entity.description || "" }));
      mentionedEntitiesForChunk.push({
        entity_id: entity.id, valid_from: entity.valid_from || new Date().toISOString(), valid_to: entity.valid_to || null,
        confidence_score: entity.confidence_score ?? 0.9, intent_category: entity.intent_category || "FACT", criticality_score: entity.criticality_score ?? 0.5, sentiment: entity.sentiment || "NEUTRAL", clearance_level: cLevel, expires_at: entity.expires_at || null, justification: entity.justification || `Extracted from chat`
      });
    }

    const chunkId = `chunk_ep_${Date.now()}`;
    await executeWithRetry(() => saveChunk({ organizationId: orgId, id: chunkId, source_type: "episode", source_id: episodeId, text: message, sequence_order: 1, embedding: chunkEmbeddings[0] || [], mentioned_entities: mentionedEntitiesForChunk }));

    for (const rel of relationships) {
      await executeWithRetry(() => syncRelationship({ organizationId: orgId, source_id: rel.source_id, target_id: rel.target_id, type: rel.type.toUpperCase(), valid_from: rel.valid_from || new Date().toISOString(), valid_to: rel.valid_to || null, confidence_score: rel.confidence_score ?? 0.9, intent_category: rel.intent_category || "FACT", criticality_score: rel.criticality_score ?? 0.5, sentiment: rel.sentiment || "NEUTRAL", clearance_level: cLevel, expires_at: rel.expires_at || null, justification: rel.justification || "Learned from chat" }));
    }

    return { status: "success", message: "Processing completed", episode_id: episodeId, metrics: { entities: entities.length, relationships: relationships.length } };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
});

app.post("/api/memory/query", async ({ body }) => {
  const session = driver.session();
  try {
    const { question, organizationId, activeOnly = false, clearanceLevel = 4, language } = body as any;
    if (!question || question.trim() === "") return new Response(JSON.stringify({ error: "Missing 'question' field" }), { status: 400 });

    const queryEmbeddings = await executeWithRetry(() => safeGenerateEmbeddings([question]));

    let answer = "", retrievedContext = "";
    let rawResults: any[] = [];

    const result = await session.run(
      `MATCH (c:Chunk) WHERE c.organizationId = $orgId AND c.embedding IS NOT NULL AND size(c.embedding) = size($queryEmbedding)
       WITH c, vector.similarity.cosine(c.embedding, $queryEmbedding) AS score 
       MATCH (d:Document) 
       WHERE d.id = coalesce(c.source_id, c.sourceId) 
         AND ($language IS NULL OR d.language = $language)
       WITH c, d, score ORDER BY score DESC LIMIT 5
       OPTIONAL MATCH (e1:Entity)-[r]->(e2:Entity)
       WHERE e1.organizationId = $orgId AND c.text CONTAINS e1.name AND ($activeOnly = false OR r.valid_to IS NULL OR r.valid_to = "") AND (r.clearance_level IS NULL OR r.clearance_level <= $clearanceLevel)
       RETURN c.id AS chunk_id, d.id AS document_id, c.text AS chunkText, score, collect(DISTINCT e1.name + " [" + type(r) + "] " + e2.name) AS graph_facts`,
      {
        orgId: organizationId,
        queryEmbedding: queryEmbeddings[0],
        activeOnly: activeOnly === true || activeOnly === "true",
        clearanceLevel: Number(clearanceLevel),
        language: language || null
      }
    );

    rawResults = result.records.map((record: any) => ({
      chunk_id: record.get('chunk_id'), document_id: record.get('document_id'), text: record.get('chunkText'), similarity_score: record.get('score'),
      graph_facts: (record.get('graph_facts') || []).filter((f: string) => f !== null && f.trim() !== "")
    }));

    retrievedContext = rawResults.length > 0 ? rawResults.map(r => `[${r.chunk_id}] ${r.text}` + (r.graph_facts.length > 0 ? `\n[Graph]: ${r.graph_facts.join(", ")}` : "")).join("\n---\n") : "";

    if (!retrievedContext) return { status: "success", question, answer: "Not found", citations: [], raw_query_result: [] };

    if (isMock) {
      answer = `[MOCK MODE] นี่คือคำตอบจำลองครับ! ข้อมูลอ้างอิงหลักที่เจอคือ [${rawResults[0]?.chunk_id || 'ไม่มี'}]`;
    } else {
      const aiResponse = await executeWithRetry(() => aiClient.chat.completions.create({
        model: "anthropic/claude-sonnet-4-6", temperature: 0.1,
        messages: [{ role: "system", content: "คุณคือผู้ช่วย AI จงตอบโดยอิงจากข้อมูลอ้างอิงเท่านั้น และต้องใส่รหัสอ้างอิง [chunk_id] ต่อท้ายประโยคเสมอ" }, { role: "user", content: `ข้อมูลอ้างอิง:\n${retrievedContext}\n\nคำถาม: ${question}` }]
      }));
      answer = aiResponse.choices[0]?.message?.content || "No generated answer";
    }

    return { status: "success", question, answer, citations: rawResults.map((r: any) => ({ document_id: r.document_id, chunk_id: r.chunk_id, text_preview: r.text.substring(0, 50) + "..." })), raw_query_result: rawResults };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
  finally { await session.close(); }
});

app.get("/api/memory/document/:documentId/tree", async ({ params, query }) => {
  try {
    const orgId = query.orgId as string || "org_pdf_default";
    const result = await getDocumentTree({ organizationId: orgId, documentId: params.documentId });
    if (!result) return new Response(JSON.stringify({ status: "not_found", chunks: [] }), { status: 404 });
    return { status: "success", document_id: params.documentId, total_chunks: result.chunks.length, chunks: result.chunks };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
});

app.get("/api/memory/entity/:entityName/timeline", async ({ params, query }) => {
  try {
    const orgId = query.orgId as string || "org_001";
    const decodedEntityName = decodeURIComponent(params.entityName);
    const discoverResults = await discoverEntities({
      organizationId: orgId,
      keyword: decodedEntityName
    });

    if (!discoverResults || discoverResults.length === 0) {
      return {
        status: "success",
        search_keyword: decodedEntityName,
        timeline: []
      };
    }

    const timeline = await getEntityTimeline({
      organizationId: orgId,
      entityId: discoverResults[0].id
    });

    return {
      status: "success",
      search_keyword: decodedEntityName,
      timeline: timeline
    };
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.get("/api/memory/discover", async ({ query }) => {
  try {
    const keyword = query.keyword as string;
    const orgId = query.orgId as string || "org_pdf_default";
    if (!keyword || keyword.trim() === "") return new Response(JSON.stringify({ error: "Missing keyword parameter" }), { status: 400 });
    const results = await discoverEntities({ organizationId: orgId, keyword: keyword });
    return { status: "success", search_keyword: keyword, total_found: results.length, results: results };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
});

app.get("/api/memory/documents", async ({ query }) => {
  const session = driver.session();
  try {
    const orgId = query.orgId as string | undefined;
    const cypherQuery = orgId ? `MATCH (d:Document {organizationId: $orgId}) OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk) RETURN d.id AS id, d.title AS title, d.type AS type, count(c) AS total_chunks ORDER BY d.id DESC` : `MATCH (d:Document) OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk) RETURN d.id AS id, d.title AS title, d.organizationId AS organizationId, d.type AS type, count(c) AS total_chunks ORDER BY d.id DESC`;
    const result = await session.run(cypherQuery, orgId ? { orgId } : {});
    const documents = result.records.map((record: any) => {
      const doc: any = { document_id: record.get('id'), title: record.get('title'), type: record.get('type'), total_chunks: record.get('total_chunks').toNumber() };
      if (!orgId) doc.organizationId = record.get('organizationId'); return doc;
    });
    return { status: "success", total_documents: documents.length, documents: documents };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
  finally { await session.close(); }
});

app.delete("/api/memory/document/:documentId", async ({ params }) => {
  const session = driver.session();
  try {
    const checkResult = await session.run(`MATCH (d:Document {id: $docId}) RETURN d.id AS id`, { docId: params.documentId });
    if (checkResult.records.length === 0) return new Response(JSON.stringify({ status: "not_found" }), { status: 404 });
    await session.run(`MATCH (d:Document {id: $docId}) OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk) DETACH DELETE d, c`, { docId: params.documentId });
    return { status: "success" };
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
  finally { await session.close(); }
});

app.post("/api/memory/intent", async ({ body }) => {
  try {
    const { query } = body as any;
    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query field" }), { status: 400 });
    }

    const intentResult = await justifyIntent(query);
    return {
      status: "success",
      intent: intentResult
    };
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.post("/api/memory/discover", async ({ body }) => {
  try {
    const { keyword } = body as any;
    
    if (!keyword) {
      return new Response(JSON.stringify({ error: "Missing keyword field" }), { status: 400 });
    }

    const nodes = await discoverNodes(keyword);
    
    return {
      status: "success",
      results: nodes,
      message: nodes.length > 0 ? "Entities found. Please select the correct ID." : "No matching entities found."
    };
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.post("/api/memory/memorize", async ({ body }) => {
  try {
    const payload = body as any;
    
    if (!payload.subject || !payload.predicate || !payload.object || !payload.context) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields. Please provide subject, predicate, object, and context." 
      }), { status: 400 });
    }

    const result = await memorizeFact(payload);
    
    return {
      status: "success",
      ...result
    };
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.post("/api/memory/episode", async ({ body }) => {
  try {
    const payload = body as any;
    
    if (!payload.summary) {
      return new Response(JSON.stringify({ 
        error: "Missing required field: summary" 
      }), { status: 400 });
    }

    const result = await logEpisode(payload);
    
    return {
      status: "success",
      ...result
    };
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

app.listen(3000, () => {
  console.log("Memory Ingestion API is running at http://localhost:3000");
});