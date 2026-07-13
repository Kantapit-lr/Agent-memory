import { Worker, type Job } from "bullmq"
import type { IngestionJobData } from "@/src/queue"
import { saveEntities } from "@/src/repositories/nodes/saveEntities"
import { saveChunks } from "@/src/repositories/nodes/saveChunks"
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

    const entityResult = await saveEntities(entities.map(e => ({ ...e, organizationId })))
    console.log(`   ✅ saveEntity x${entities.length} (failed: ${entityResult.failed.length})`)

    const chunkResult = await saveChunks(chunks.map(c => ({ ...c, organizationId })))
    console.log(`   ✅ saveChunk x${chunks.length} (failed: ${chunkResult.failed.length})`)

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
    const summary = {
      saved: {
        entities: entityResult.saved,
        chunks: chunkResult.saved,
        relationships: relationships.length
      },
      failed: {
        entities: entityResult.failed,
        chunks: chunkResult.failed
      }
    }

    if (entityResult.failed.length > 0 || chunkResult.failed.length > 0) {
      console.warn(`⚠️  [Worker] job ${job.id} เสร็จแต่มี error บางส่วน:`, JSON.stringify(summary.failed))
    } else {
      console.log(`🎉 [Worker] job ${job.id} เสร็จสมบูรณ์`)
    }

    // return summary เพื่อให้ BullMQ เก็บไว้ใน job.returnvalue
    // ดูได้ภายหลังผ่าน queue.getJob(jobId) หรือ BullMQ Dashboard
    return summary
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