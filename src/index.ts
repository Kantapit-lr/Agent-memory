import { saveOrganization } from "@/src/repositories/nodes/saveOrganization"
import { saveEntity } from "@/src/repositories/nodes/saveEntity"
import { saveDocument } from "@/src/repositories/nodes/saveDocument"
import { saveEpisode } from "@/src/repositories/nodes/saveEpisode"
import { saveChunk } from "@/src/repositories/nodes/saveChunk"
import { linkEntityToEntity, syncRelationship } from "@/src/repositories/semantic"

async function main() {
  try {
    // 1. สร้าง Organization ก่อน
    await saveOrganization({
      id: "org_001",
      name: "Technova",
      created_at: "2024-01-01T00:00:00Z"
    })

    // 2. สร้าง Entity ทั้งสอง
    await saveEntity({
      organizationId: "org_001",
      id: "person_01",
      name: "ทวีสิน",
      description: "พนักงานฝ่าย IT",
      type: "PERSON"
    })

    await saveEntity({
      organizationId: "org_001",
      id: "org_01",
      name: "บริษัท A",
      description: "บริษัทเทคโนโลยี",
      type: "ORGANIZATION"
    })

    // 3. สร้าง Relationship เชื่อมทั้งสอง
    await linkEntityToEntity({
      organizationId: "org_001",
      source_id: "person_01",
      target_id: "org_01",
      type: "BOARD_MEMBER",
      valid_from: "2024-01-01T00:00:00Z",
      valid_to: null,
      confidence_score: 0.8,
      intent_category: "FACT",
      criticality_score: 0.6,
      sentiment: "NEUTRAL",
      clearance_level: 2,
      expires_at: null,
      justification: "ทดสอบบันทึกข้อมูล"
    })

    // 4. สร้าง Document
    await saveDocument({
      organizationId: "org_001",
      id: "doc_01",
      title: "เอกสารทดสอบ",
      type: "PDF",
      language: "TH",
      authors: ["สมชาย"]
    })

    // 5. สร้าง Chunk เชื่อมกับ Document พร้อม mentioned entities
    await saveChunk({
      organizationId: "org_001",
      id: "chunk_01",
      source_type: "document",
      source_id: "doc_01",
      text: "ทวีสินทำงานที่บริษัท A",
      sequence_order: 1,
      embedding: [0.1, 0.2, 0.3],
      mentioned_entities: [
        {
          entity_id: "person_01",
          valid_from: "2024-01-01T00:00:00Z",
          valid_to: null,
          confidence_score: 0.9,
          intent_category: "FACT",
          criticality_score: 0.5,
          sentiment: "NEUTRAL",
          clearance_level: 1,
          expires_at: null,
          justification: "Chunk mentions ทวีสิน"
        },
        {
          entity_id: "org_01",
          valid_from: "2024-01-01T00:00:00Z",
          valid_to: null,
          confidence_score: 0.9,
          intent_category: "FACT",
          criticality_score: 0.5,
          sentiment: "NEUTRAL",
          clearance_level: 1,
          expires_at: null,
          justification: "Chunk mentions บริษัท A"
        }
      ]
    })

    // 6. สร้าง Episode (เหตุการณ์จากแชท)
    await saveEpisode({
      organizationId: "org_001",
      id: "episode_01",
      timestamp: "2024-06-17T10:00:00Z",
      source: "chat",
      summary: "ผู้ใช้คุยเรื่องงานกับ AI"
    })

    // 7. สร้าง Chunk เชื่อมกับ Episode (ไม่ใช่ Document)
    await saveChunk({
      organizationId: "org_001",
      id: "chunk_02",
      source_type: "episode",
      source_id: "episode_01",
      text: "ช่วยทำระบบ Agent Memory ภายในสัปดาห์นี้",
      sequence_order: 1,
      embedding: [0.4, 0.5, 0.6],
      mentioned_entities: [
        {
          entity_id: "person_01",
          valid_from: "2024-01-01T00:00:00Z",
          valid_to: null,
          confidence_score: 0.9,
          intent_category: "FACT",
          criticality_score: 0.5,
          sentiment: "NEUTRAL",
          clearance_level: 1,
          expires_at: null,
          justification: "Chunk mentions ทวีสิน"
        },
      ]
    })

    await syncRelationship({
      organizationId: "org_001",
      source_id: "person_01",
      target_id: "org_01",
      type: "ADVISOR",  // เปลี่ยนจาก BOARD_MEMBER เป็น ADVISOR
      valid_from: "2026-06-18T00:00:00Z",
      valid_to: null,
      confidence_score: 0.9,
      intent_category: "FACT",
      criticality_score: 0.5,
      sentiment: "NEUTRAL",
      clearance_level: 2,
      expires_at: null,
      justification: "ทดสอบ Time Traveling - เปลี่ยนตำแหน่ง"
    })

    console.log("ทดสอบ syncRelationship สำเร็จ!")
    console.log("บันทึกสำเร็จ!")
  } catch (error) {
    if (error instanceof Error) {
      console.error("เกิดข้อผิดพลาด:", error.message)
      if ("code" in error) {
        console.error("Error code:", error.code)
      }
    } else {
      console.error("เกิดข้อผิดพลาด:", error)
    }
  }
  process.exit(0)
}

main()