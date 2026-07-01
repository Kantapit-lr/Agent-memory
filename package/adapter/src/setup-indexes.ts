// setup-indexes.ts
// รันครั้งเดียวตอนตั้งค่าระบบครั้งแรก หรือหลัง wipe database
// คำสั่ง: bun --env-file=.env src/setup-indexes.ts

import driver from "@/src/db"

async function setupIndexes() {
  const session = driver.session()
  console.log("⏳ กำลังสร้าง Index...")

  try {
    const indexes = [
      // Node indexes — ใช้ทุก query ที่ filter ด้วย organizationId + id
      { name: "chunk_org_id",        label: "Chunk",        props: "(n.organizationId, n.id)" },
      { name: "entity_org_id",       label: "Entity",       props: "(n.organizationId, n.id)" },
      { name: "document_org_id",     label: "Document",     props: "(n.organizationId, n.id)" },
      { name: "episode_org_id",      label: "Episode",      props: "(n.organizationId, n.id)" },
      { name: "organization_id",     label: "Organization", props: "(n.id)" },

      // เพิ่ม index สำหรับ saveChunk ที่ค้นหา prev chunk ด้วย source_id + sequence_order
      { name: "chunk_source_seq",    label: "Chunk",        props: "(n.organizationId, n.source_id, n.source_type, n.sequence_order)" },
    ]

    for (const idx of indexes) {
      await session.run(
        `CREATE INDEX ${idx.name} IF NOT EXISTS FOR (n:${idx.label}) ON ${idx.props}`
      )
      console.log(`   ✅ ${idx.name} (${idx.label})`)
    }

    console.log("\n🎉 สร้าง Index ครบแล้ว")
  } finally {
    await session.close()
    await driver.close()
  }

  process.exit(0)
}

setupIndexes()
