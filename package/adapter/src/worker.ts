import { Worker, type Job } from "bullmq"
import type { IngestionJobData } from "@/src/queue"
import { saveEntity } from "@/src/repositories/nodes/saveEntity"
import { saveChunk } from "@/src/repositories/nodes/saveChunk"
import { syncRelationship } from "@/src/repositories/semantic"
import driver from "@/src/db"

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
}

const worker = new Worker<IngestionJobData>(
  "ingestion",
  async (job: Job<IngestionJobData>) => {
    const { organizationId, chunks, entities, relationships } = job.data

    console.log(`📥 [Worker] รับ job ${job.id} | org: ${organizationId}`)

    for (const entity of entities) {
      await saveEntity({
        organizationId,
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        embedding: entity.embedding,  // ส่ง embedding มาด้วยเพื่อให้ Entity Resolution ทำงานได้
      })
    }
    console.log(`   ✅ saveEntity x${entities.length}`)

    for (const chunk of chunks) {
      await saveChunk({
        organizationId,
        id: chunk.id,
        source_type: chunk.source_type,
        source_id: chunk.source_id,
        text: chunk.text,
        sequence_order: chunk.sequence_order,
        embedding: chunk.embedding,
        mentioned_entities: chunk.mentioned_entities,
      })
    }
    console.log(`   ✅ saveChunk x${chunks.length}`)

    for (const rel of relationships) {
      await syncRelationship({
        organizationId,
        source_id: rel.source_id,
        target_id: rel.target_id,
        type: rel.type,
        valid_from: rel.valid_from,
        valid_to: rel.valid_to,
        confidence_score: rel.confidence_score,
        intent_category: rel.intent_category,
        criticality_score: rel.criticality_score,
        sentiment: rel.sentiment,
        clearance_level: rel.clearance_level,
        expires_at: rel.expires_at,
        justification: rel.justification,
      })
    }
    console.log(`   ✅ syncRelationship x${relationships.length}`)
    console.log(`🎉 [Worker] job ${job.id} เสร็จแล้ว`)
  },
  { connection }
)

worker.on("failed", (job: Job<IngestionJobData> | undefined, error: Error) => {
  console.error(`❌ [Worker] job ${job?.id} failed:`, error.message)
})

worker.on("ready", () => {
  console.log("🚀 [Worker] พร้อมรับ job แล้วครับ")
})

process.on("SIGTERM", async () => {
  await worker.close()
  await driver.close()
  process.exit(0)
})