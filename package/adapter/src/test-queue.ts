import { ingestionQueue } from "@/src/queue"
import type { IngestionJobData } from "@/src/queue"

const baseJob: IngestionJobData = {
  organizationId: "org_002",
  documentId: "doc_02",
  entities: [
    {
      id: "person_03",
      name: "ทดสอบ Worker",
      type: "PERSON",
      description: "ทดสอบส่ง job ผ่าน queue",
    }
  ],
  chunks: [
    {
      id: "chunk_queue_01",
      source_type: "document",
      source_id: "doc_02",
      text: "ทดสอบการส่งข้อมูลผ่าน BullMQ queue",
      sequence_order: 99,
      embedding: new Array(1024).fill(0.1),
      mentioned_entities: []
    }
  ],
  relationships: []
}

async function main() {
  // ─────────────────────────────────────────
  // Case 1: Single job
  // ─────────────────────────────────────────
  console.log("📤 [Case 1] ส่ง job เดียว...")
  const single = await ingestionQueue.add("ingest", baseJob)
  console.log(`✅ ส่งแล้ว job id: ${single.id}`)

  // ─────────────────────────────────────────
  // Case 2: Concurrent jobs (5 พร้อมกัน)
  // ─────────────────────────────────────────
  console.log("\n📤 [Case 2] ส่ง 5 job พร้อมกัน...")
  const jobs = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      ingestionQueue.add("ingest", {
        ...baseJob,
        chunks: [{
          ...baseJob.chunks[0]!,
          id: `chunk_concurrent_0${i}`,
          sequence_order: i,
        }]
      })
    )
  )
  console.log(`✅ ส่งแล้ว ${jobs.length} jobs: ${jobs.map(j => j.id).join(", ")}`)

  await ingestionQueue.close()
  process.exit(0)
}

main()