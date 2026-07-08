import { saveOrganization } from "@/src/repositories/nodes/saveOrganization"
import { saveEntity } from "@/src/repositories/nodes/saveEntity"
import { saveDocument } from "@/src/repositories/nodes/saveDocument"
import { saveEpisode } from "@/src/repositories/nodes/saveEpisode"
import { saveChunk } from "@/src/repositories/nodes/saveChunk"
import { linkEntityToEntity, syncRelationship } from "@/src/repositories/semantic"
import { getDocumentTree } from "@/src/repositories/queries/getDocumentTree"
import { getChunkSource } from "@/src/repositories/queries/getChunkSource"
import { getEntityTimeline } from "@/src/repositories/queries/getEntityTimeline"
import { getEntityRelations } from "@/src/repositories/queries/getEntityRelations"
import { discoverEntities } from "@/src/repositories/queries/discoverEntities"
import { deleteChunk } from "@/src/repositories/nodes/deleteChunk"
import { deleteDocument } from "@/src/repositories/nodes/deleteDocument"
import { deleteEpisode } from "@/src/repositories/nodes/deleteEpisode"
import { deleteEntity } from "@/src/repositories/nodes/deleteEntity"
import { deleteOrganization } from "@/src/repositories/nodes/deleteOrganization"
import { semanticSearch } from "@/src/repositories/queries/semanticSearch"
import { findSimilarEntity } from "@/src/repositories/nodes/findSimilarEntity"
import { getExpiredFacts, purgeExpiredFacts } from "@/src/repositories/queries/expiredFacts"
import { getCodeDependencies } from "@/src/repositories/queries/getCodeDependencies"
import driver from "@/src/db"

async function main() {
  const orgId = "org_002"
  const docId = "doc_02"
  const episodeId = "episode_02"

  const pipelineStart = performance.now()

  try {
    // ─────────────────────────────────────────
    // WRITE PIPELINE
    // ─────────────────────────────────────────
    console.log("⏳ เริ่มต้นทดสอบ Write Pipeline...")

    const t1 = performance.now()
    await saveOrganization({ id: orgId, name: "CyberCore Systems", created_at: "2026-01-01T00:00:00Z" })
    console.log(`   ⏱️  [Step 1] saveOrganization สำเร็จใน ${(performance.now() - t1).toFixed(2)} ms`)

    const t2 = performance.now()
    await saveEntity({ organizationId: orgId, id: "person_02", name: "กานต์ธนภัทร", description: "Data Analyst", type: "PERSON", embedding: new Array(1024).fill(0.1) })
    await saveEntity({ organizationId: orgId, id: "org_02_business", name: "บริษัทนวัตกรรม B", description: "ผู้พัฒนา AI สถาปัตยกรรมกราฟ", type: "ORGANIZATION", embedding: new Array(1024).fill(0.9) })
    console.log(`   ⏱️  [Step 2] saveEntity x2 สำเร็จใน ${(performance.now() - t2).toFixed(2)} ms`)

    const t3 = performance.now()
    await linkEntityToEntity({
      organizationId: orgId, source_id: "person_02", target_id: "org_02_business",
      type: "SOFTWARE_DEVELOPER", valid_from: "2026-01-01T00:00:00Z", valid_to: null,
      confidence_score: 0.95, intent_category: "FACT", criticality_score: 0.7,
      sentiment: "POSITIVE", clearance_level: 3, expires_at: null, justification: "บันทึกสัญญาจ้างงานใหม่ v2"
    })
    console.log(`   ⏱️  [Step 3] linkEntityToEntity สำเร็จใน ${(performance.now() - t3).toFixed(2)} ms`)

    const t4 = performance.now()
    await saveDocument({ organizationId: orgId, id: docId, title: "คู่มือระบบ Agent Memory v2", type: "MARKDOWN", language: "TH", authors: ["กานต์ธนภัทร"] })
    console.log(`   ⏱️  [Step 4] saveDocument สำเร็จใน ${(performance.now() - t4).toFixed(2)} ms`)

    const t5 = performance.now()
    await saveChunk({
      organizationId: orgId, id: "chunk_v2_01", source_type: "document", source_id: docId,
      text: "กานต์ธนภัทรได้เริ่มออกแบบโครงสร้างกราฟเลเยอร์", sequence_order: 1,
      embedding: new Array(1024).fill(0.2),
      mentioned_entities: [{
        entity_id: "person_02", valid_from: "2026-01-01T00:00:00Z", valid_to: null,
        confidence_score: 0.99, intent_category: "FACT", criticality_score: 0.8,
        sentiment: "NEUTRAL", clearance_level: 2, expires_at: null, justification: "Mention คนออกแบบ"
      }]
    })
    await saveChunk({
      organizationId: orgId, id: "chunk_v2_02", source_type: "document", source_id: docId,
      text: "โดยใช้ระบบคิวรี่ Cypher เพื่อดึงข้อมูลแบบลำดับเส้นตรง", sequence_order: 2,
      embedding: new Array(1024).fill(0.22), mentioned_entities: []
    })
    await saveChunk({
      organizationId: orgId, id: "chunk_v2_03", source_type: "document", source_id: docId,
      text: "และทดสอบรันด้วย Bun รันไทม์ได้ความเร็วเฉลี่ยต่ำกว่า 20 มิลลิวินาที", sequence_order: 3,
      embedding: new Array(1024).fill(0.25), mentioned_entities: []
    })
    console.log(`   ⏱️  [Step 5] saveChunk x3 + NEXT_CHUNK สำเร็จใน ${(performance.now() - t5).toFixed(2)} ms`)

    const t6 = performance.now()
    await saveEpisode({ organizationId: orgId, id: episodeId, timestamp: "2026-06-23T12:00:00Z", source: "terminal", summary: "เทสระบบท่อข้อมูลรอบสอง" })
    await saveChunk({
      organizationId: orgId, id: "chunk_v2_time_01", source_type: "episode", source_id: episodeId,
      text: "สั่งยิงคำสั่งวิเคราะห์ความเร็วของ Write-Pipeline สู่ฐานข้อมูลกราฟ", sequence_order: 1,
      embedding: new Array(1024).fill(0.5), mentioned_entities: []
    })
    console.log(`   ⏱️  [Step 6] saveEpisode + saveChunk สำเร็จใน ${(performance.now() - t6).toFixed(2)} ms`)

    const t7 = performance.now()
    await syncRelationship({
      organizationId: orgId, source_id: "person_02", target_id: "org_02_business",
      type: "CHIEF_TECHNOLOGY_OFFICER", valid_from: "2026-06-24T00:00:00Z", valid_to: null,
      confidence_score: 0.95, intent_category: "FACT", criticality_score: 0.9,
      sentiment: "POSITIVE", clearance_level: 3, expires_at: null, justification: "เลื่อนตำแหน่งเป็น CTO"
    })
    console.log(`   ⏱️  [Step 7] syncRelationship (Bi-Temporal) สำเร็จใน ${(performance.now() - t7).toFixed(2)} ms`)

    console.log(`\n✅ Write Pipeline สำเร็จ (${(performance.now() - pipelineStart).toFixed(2)} ms)`)

    // ─────────────────────────────────────────
    // READ PIPELINE
    // ─────────────────────────────────────────
    console.log("\n🔍 เริ่มต้นทดสอบ Read Pipeline...")

    const tTree = performance.now()
    const treeResult = await getDocumentTree({ organizationId: orgId, documentId: docId })
    if (treeResult) {
      console.log(`\n   📄 [getDocumentTree] "${treeResult.document.title}" — ${treeResult.chunks.length} chunks`)
      treeResult.chunks.forEach((c) => console.log(`      [${c.sequence_order}] ${c.text}`))
    }
    console.log(`   ⏱️  ${(performance.now() - tTree).toFixed(2)} ms`)

    const tChunk = performance.now()
    const chunkSource = await getChunkSource({ organizationId: orgId, chunkId: "chunk_v2_01" })
    console.log(`\n   🔗 [getChunkSource] chunk_v2_01 → sourceType: "${chunkSource.sourceType}", sourceId: "${chunkSource.sourceId}"`)
    console.log(`   ⏱️  ${(performance.now() - tChunk).toFixed(2)} ms`)

    const tDiscover = performance.now()
    const entities = await discoverEntities({ organizationId: orgId, keyword: "กานต์" })
    console.log(`\n   🔎 [discoverEntities] keyword="กานต์" → พบ ${entities.length} entity`)
    entities.forEach((e) => console.log(`      - ${e.name} (${e.type}) id: ${e.id}`))
    console.log(`   ⏱️  ${(performance.now() - tDiscover).toFixed(2)} ms`)

    const tRelations = performance.now()
    const relations = await getEntityRelations({ organizationId: orgId, entityId: "person_02" })
    console.log(`\n   🕸️  [getEntityRelations] person_02 → ${relations.length} relations`)
    relations.forEach((r) => console.log(`      - ${r.relationType} → ${r.targetName} | chunk: ${r.source_chunk_id ?? "-"}, doc: ${r.source_document_id ?? "-"}`))
    console.log(`   ⏱️  ${(performance.now() - tRelations).toFixed(2)} ms`)

    const tTimeline = performance.now()
    const timeline = await getEntityTimeline({ organizationId: orgId, entityId: "person_02" })
    console.log(`\n   📅 [getEntityTimeline] person_02 → ${timeline.length} entries`)
    timeline.forEach((t) => console.log(`      - ${t.valid_from} | ${t.relationshipType} → ${t.targetEntityName} | chunk: ${t.source_chunk_id ?? "-"}, doc: ${t.source_document_id ?? "-"}`))
    console.log(`   ⏱️  ${(performance.now() - tTimeline).toFixed(2)} ms`)

    const tTimelineFilter = performance.now()
    const timelineFiltered = await getEntityTimeline({ organizationId: orgId, entityId: "person_02", relationshipType: "CHIEF_TECHNOLOGY_OFFICER" })
    console.log(`\n   📅 [getEntityTimeline + filter] CHIEF_TECHNOLOGY_OFFICER → ${timelineFiltered.length} entries`)
    timelineFiltered.forEach((t) => console.log(`      - ${t.valid_from} | ${t.relationshipType} → ${t.targetEntityName}`))
    console.log(`   ⏱️  ${(performance.now() - tTimelineFilter).toFixed(2)} ms`)

    console.log(`\n🎉 ทดสอบสำเร็จสมบูรณ์ (รวม: ${(performance.now() - pipelineStart).toFixed(2)} ms)`)

    // ─────────────────────────────────────────
    // ENTITY RESOLUTION PIPELINE
    // ─────────────────────────────────────────
    console.log("\n🧩 เริ่มต้นทดสอบ Entity Resolution Pipeline...")

    // ทดสอบว่า "กรุงเทพมหานคร" (vector ใกล้กับ person_02) จะถูก merge เข้ากับ person_02 ไหม
    // ใช้ vector เดียวกัน (0.1) เพื่อจำลองว่าเป็นสิ่งเดียวกัน
    const tResolution = performance.now()
    const similar = await findSimilarEntity({ organizationId: orgId, embedding: new Array(1024).fill(0.1), type: "PERSON" })
    console.log(`\n   🧩 [findSimilarEntity] vector เหมือน person_02 (type=PERSON) → ${similar ? `พบ: ${similar.name} (score: ${similar.similarityScore.toFixed(4)})` : "ไม่พบ"}`)
    console.log(`   ⏱️  ${(performance.now() - tResolution).toFixed(2)} ms`)

    // ทดสอบ saveEntity ที่มี embedding ใกล้เคียงกับ person_02 → ควร merge ไม่สร้างใหม่
    const tMerge = performance.now()
    await saveEntity({ organizationId: orgId, id: "person_02_duplicate", name: "กานต์ ธนภัทร", description: "Data Analyst (ซ้ำ)", type: "PERSON", embedding: new Array(1024).fill(0.1) })
    const afterMerge = await findSimilarEntity({ organizationId: orgId, embedding: new Array(1024).fill(0.1) })
    console.log(`\n   🧩 [saveEntity duplicate] ผลหลัง merge → id: ${afterMerge?.id ?? "null"} (ควรเป็น person_02 ไม่ใช่ person_02_duplicate)`)
    console.log(`   ⏱️  ${(performance.now() - tMerge).toFixed(2)} ms`)

    // ─────────────────────────────────────────
    // EXPIRED FACTS PIPELINE
    // ─────────────────────────────────────────
    console.log("\n⏰ เริ่มต้นทดสอบ Expired Facts Pipeline...")

    // สร้าง relationship ที่หมดอายุแล้ว (expires_at ในอดีต)
    await linkEntityToEntity({
      organizationId: orgId,
      source_id: "person_02",
      target_id: "org_02_business",
      type: "FORMER_EMPLOYEE",
      valid_from: "2025-01-01T00:00:00Z",
      valid_to: null,
      confidence_score: 0.9,
      intent_category: "FACT",
      criticality_score: 0.5,
      sentiment: "NEUTRAL",
      clearance_level: 1,
      expires_at: "2025-12-31T00:00:00Z",  // หมดอายุแล้ว
      justification: "สัญญาจ้างหมดอายุ"
    })

    const tExpired = performance.now()
    const expiredFacts = await getExpiredFacts({ organizationId: orgId })
    console.log(`\n   ⏰ [getExpiredFacts] พบ ${expiredFacts.length} relationship ที่หมดอายุ`)
    expiredFacts.forEach((f) => console.log(`      - ${f.sourceName} -[${f.relationshipType}]-> ${f.targetName} | expires: ${f.expires_at}`))
    console.log(`   ⏱️  ${(performance.now() - tExpired).toFixed(2)} ms`)

    const tPurge = performance.now()
    const purgeResult = await purgeExpiredFacts({ organizationId: orgId })
    console.log(`\n   🧹 [purgeExpiredFacts] ปิดไปแล้ว ${purgeResult.purgedCount} relationship (soft close)`)
    console.log(`   ⏱️  ${(performance.now() - tPurge).toFixed(2)} ms`)

    // ตรวจสอบว่าหลัง purge แล้วไม่มีของหมดอายุเหลือ
    const afterPurge = await getExpiredFacts({ organizationId: orgId })
    console.log(`\n   ✅ หลัง purge: พบ ${afterPurge.length} relationship ที่หมดอายุ (ควรเป็น 0)`)

    // ─────────────────────────────────────────
    // SEMANTIC SEARCH PIPELINE
    // ─────────────────────────────────────────
    console.log("\n🔍 เริ่มต้นทดสอบ Semantic Search Pipeline...")

    const tSemantic = performance.now()
    // ใช้ mock vector เดียวกับ chunk_v2_01 (0.2) เพื่อให้ได้ผลลัพธ์
    const semanticResults = await semanticSearch({
      organizationId: orgId,
      queryEmbedding: new Array(1024).fill(0.2),
      limit: 3,
      activeOnly: false,
      minClearanceLevel: 4
    })
    console.log(`\n   🔎 [semanticSearch] พบ ${semanticResults.length} chunks`)
    semanticResults.forEach((r) => console.log(`      - [${r.chunkId}] score: ${r.similarityScore?.toFixed(4) ?? "N/A"} | ${r.text.substring(0, 50)}...`))
    console.log(`   ⏱️  ${(performance.now() - tSemantic).toFixed(2)} ms`)

    // ─────────────────────────────────────────
    // CODE DEPENDENCIES PIPELINE
    // ─────────────────────────────────────────
    console.log("\n🔗 เริ่มต้นทดสอบ Code Dependencies Pipeline...")

    // สร้าง mock code entities ก่อนทดสอบ
    await saveEntity({ organizationId: orgId, id: "ent_func_validateToken", name: "validateToken", description: "Auth validation function", type: "FUNCTION" })
    await saveEntity({ organizationId: orgId, id: "ent_func_hashPassword", name: "hashPassword", description: "Password hashing function", type: "FUNCTION" })
    await saveEntity({ organizationId: orgId, id: "ent_module_bcrypt", name: "bcrypt", description: "Crypto module", type: "MODULE" })

    // สร้าง relationship CALLS และ IMPORTS
    const codeRelBase = { organizationId: orgId, valid_from: "2026-01-01T00:00:00Z", valid_to: null, confidence_score: 1.0, intent_category: "FACT" as const, criticality_score: 0.8, sentiment: "NEUTRAL" as const, clearance_level: 1, expires_at: null }
    await linkEntityToEntity({ ...codeRelBase, source_id: "ent_func_validateToken", target_id: "ent_func_hashPassword", type: "CALLS", justification: "AST Function Call" })
    await linkEntityToEntity({ ...codeRelBase, source_id: "ent_func_validateToken", target_id: "ent_module_bcrypt", type: "IMPORTS", justification: "AST Import" })

    const tCodeDep = performance.now()
    const codeDeps = await getCodeDependencies({ organizationId: orgId, entityId: "ent_func_validateToken", direction: "outgoing" })
    console.log(`\n   🕸️  [getCodeDependencies] ${codeDeps.rootEntityName} (outgoing) → ${codeDeps.dependencies.length} dependencies`)
    codeDeps.dependencies.forEach((d) => console.log(`      [depth ${d.depth}] ${d.relationshipType} → ${d.entityName} (${d.entityType})`))
    console.log(`   ⏱️  ${(performance.now() - tCodeDep).toFixed(2)} ms`)

    // ─────────────────────────────────────────
    // DELETE PIPELINE
    // ─────────────────────────────────────────
    console.log("\n🗑️  เริ่มต้นทดสอบ Delete Pipeline...")

    const tDelChunk = performance.now()
    const delChunkResult = await deleteChunk({ organizationId: orgId, chunkId: "chunk_v2_time_01" })
    console.log(`\n   🗑️  [deleteChunk] chunk_v2_time_01 → ${JSON.stringify(delChunkResult)}`)
    console.log(`   ⏱️  ${(performance.now() - tDelChunk).toFixed(2)} ms`)

    // ลบ Episode ที่เพิ่งหลุด Chunk ไปแล้ว ไม่ต้อง force
    const tDelEpisode = performance.now()
    const delEpisodeResult = await deleteEpisode({ organizationId: orgId, episodeId })
    console.log(`\n   🗑️  [deleteEpisode] ${episodeId} (ไม่มี Chunk เหลือ) → ${JSON.stringify(delEpisodeResult)}`)
    console.log(`   ⏱️  ${(performance.now() - tDelEpisode).toFixed(2)} ms`)

    // ลบ Document ที่ยังมี Chunk เหลืออยู่ 3 ก้อน → ต้อง force: true
    const tDelDocument = performance.now()
    const delDocumentResult = await deleteDocument({ organizationId: orgId, documentId: docId, force: true })
    console.log(`\n   🗑️  [deleteDocument] ${docId} (force cascade) → ${JSON.stringify(delDocumentResult)}`)
    console.log(`   ⏱️  ${(performance.now() - tDelDocument).toFixed(2)} ms`)

    // person_02 ยังมีความสัมพันธ์ active กับ org_02_business → ต้อง force: true
    const tDelEntity = performance.now()
    const delEntityResult = await deleteEntity({ organizationId: orgId, entityId: "person_02", force: true })
    console.log(`\n   🗑️  [deleteEntity] person_02 (force) → ${JSON.stringify(delEntityResult)}`)
    console.log(`   ⏱️  ${(performance.now() - tDelEntity).toFixed(2)} ms`)

    // ปิดท้าย: ลบทั้งองค์กรแบบ force (org_02_business ยังเหลืออยู่)
    const tDelOrg = performance.now()
    const delOrgResult = await deleteOrganization({ organizationId: orgId, force: true })
    console.log(`\n   🗑️  [deleteOrganization] ${orgId} (force) → ${JSON.stringify(delOrgResult)}`)
    console.log(`   ⏱️  ${(performance.now() - tDelOrg).toFixed(2)} ms`)

    console.log(`\n🎉 Delete Pipeline สำเร็จสมบูรณ์ (รวมทั้งหมด: ${(performance.now() - pipelineStart).toFixed(2)} ms)`)

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error)
  } finally {
    await driver.close()
  }
  process.exit(0)
}

main()