# @memory-layer/storage-adapter

Package สำหรับจัดการข้อมูลใน Neo4j (Graph Database) รองรับ Multi-tenant และ Bi-Temporal
(เก็บประวัติการเปลี่ยนแปลงของความสัมพันธ์ตามเวลา)

---

## 🚀 Setup ก่อนใช้งาน

1. ติดตั้ง dependencies
```bash
bun install
```

2. สร้างไฟล์ `.env` จาก `.env.example` แล้วใส่ค่าให้ตรงกับ Neo4j ที่ใช้งานจริง
```env
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

---

## 📋 Function ที่ต้องเรียกใช้ (Public API)

มี 6 function หลักที่ต้องเรียกใช้ตามลำดับด้านล่างนี้เท่านั้น
ฟังก์ชันอื่นที่ไม่อยู่ในลิสต์นี้เป็น internal function ห้ามเรียกตรงๆ (ดูหัวข้อ "คำเตือนสำคัญ" ด้านล่าง)

### ลำดับการเรียกใช้ (สำคัญมาก ต้องเรียงตามนี้)

```
1. saveOrganization     ← ต้องเรียกก่อนสุดเสมอ (ครั้งเดียวตอนสร้างองค์กร)
2. saveEntity            ← ต้องสร้างก่อนจะสร้าง Relationship หรือ Chunk ที่ mention ถึง
3. saveDocument           ← ใช้สร้าง Document Node | หาก Chunk มี source_type = "document" จะต้องมี Document นี้อยู่ก่อน
4. saveEpisode             ← ใช้สร้าง Episode Node | หาก Chunk มี source_type = "episode"จะต้องมี Episode นี้อยู่ก่อน
5. saveChunk                ← ต้องมี Document/Episode หรือ Entity ที่เกี่ยวข้องอยู่แล้ว
6. syncRelationship          ← สร้าง/อัปเดตความสัมพันธ์ระหว่าง Entity-Entity
```

---

### 1. `saveOrganization`

สร้างองค์กร (ต้องเรียกก่อนทุกฟังก์ชันอื่น)

```typescript
import { saveOrganization } from "@memory-layer/storage-adapter/nodes/saveOrganization"

await saveOrganization({
  id: "org_001",
  name: "Technova",
  created_at: "2024-01-01T00:00:00Z"
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| id | string | รหัสองค์กร (ต้องไม่ซ้ำ) |
| name | string | ชื่อองค์กร |
| created_at | string | วันเวลาที่สร้าง (ISO format) |

---

### 2. `saveEntity`

สร้าง Entity (นามเฉพาะ เช่น คน, องค์กร, สิ่งของ)

```typescript
import { saveEntity } from "@memory-layer/storage-adapter/nodes/saveEntity"

await saveEntity({
  organizationId: "org_001",
  id: "person_01",
  name: "ทวีสิน",
  type: "PERSON",
  description: "พนักงานฝ่าย IT"
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| organizationId | string | รหัสองค์กร (ต้องมี Organization อยู่จริงก่อน) |
| id | string | รหัส Entity (ไม่ซ้ำภายในองค์กรเดียวกัน) |
| name | string | ชื่อ Entity |
| type | string | ประเภท เช่น Person, Org, Feature, Function |
| description | string | คำอธิบายเพิ่มเติม |

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError` ถ้า `organizationId` ไม่มีอยู่จริง

---

### 3 `saveDocument`

สร้างเอกสารต้นฉบับ (ใช้กับข้อมูลที่มาจากไฟล์ เช่น PDF)

```typescript
import { saveDocument } from "@memory-layer/storage-adapter/nodes/saveDocument"

await saveDocument({
  organizationId: "org_001",
  id: "doc_01",
  title: "เอกสารทดสอบ",
  type: "PDF",
  language: "TH",
  authors: ["สมชาย"]
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| organizationId | string | รหัสองค์กร |
| id | string | รหัสเอกสาร |
| title | string | ชื่อเอกสาร |
| type | string | ประเภทไฟล์ เช่น PDF, DOCX |
| language | string | ภาษาของเอกสาร |
| authors | string[] | รายชื่อผู้เขียน (รองรับหลายคน) |

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`

---

### 4 `saveEpisode`

สร้างเหตุการณ์ (ใช้กับข้อมูลที่มาจากการแชท ไม่ใช่ไฟล์)

```typescript
import { saveEpisode } from "@memory-layer/storage-adapter/nodes/saveEpisode"

await saveEpisode({
  organizationId: "org_001",
  id: "episode_01",
  timestamp: "2024-06-17T10:00:00Z",
  source: "chat",
  summary: "ผู้ใช้คุยเรื่องงานกับ AI"
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| organizationId | string | รหัสองค์กร |
| id | string | รหัสเหตุการณ์ |
| timestamp | string | วันเวลาที่เกิดเหตุการณ์ |
| source | string | แหล่งที่มา เช่น "chat", "upload" |
| summary | string | สรุปเหตุการณ์ |

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`

---

### 5. `saveChunk`

สร้างก้อนเนื้อหา (ข้อความที่หั่นมาจาก Document หรือ Episode)
ฟังก์ชันนี้จะสร้างความเชื่อมโยงให้อัตโนมัติ (HAS_CHUNK, EXTRACTED_DURING, MENTIONS) ไม่ต้องเรียกเองแยก

```typescript
import { saveChunk } from "@memory-layer/storage-adapter/nodes/saveChunk"

// แบบที่ 1: Chunk มาจาก Document
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
    }
  ]
})

// แบบที่ 2: Chunk มาจาก Episode (เช่น จากแชท)
await saveChunk({
  organizationId: "org_001",
  id: "chunk_02",
  source_type: "episode",
  source_id: "episode_01",
  text: "ช่วยทำระบบ Agent Memory ภายในสัปดาห์นี้",
  sequence_order: 1,
  embedding: [0.4, 0.5, 0.6],
  mentioned_entities: []  // ถ้าไม่มี entity ที่ถูกพูดถึง ส่ง array ว่างได้
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| organizationId | string | รหัสองค์กร |
| id | string | รหัส Chunk |
| source_type | "document" \| "episode" | ระบุว่า Chunk นี้มาจากไหน |
| source_id | string | รหัสของ Document หรือ Episode ต้นทาง |
| text | string | เนื้อหาข้อความ |
| sequence_order | number | ลำดับของ chunk ในเอกสาร/เหตุการณ์ |
| embedding | number[] | Vector ที่แปลงจาก text (Cohere 1024 มิติ) |
| mentioned_entities | MentionedEntity[] | รายการ Entity ที่ถูกพูดถึงใน chunk นี้ (ดูรายละเอียดด้านล่าง) |

**`MentionedEntity` แต่ละตัวต้องมี:**

| Field | Type | คำอธิบาย |
|---|---|---|
| entity_id | string | รหัส Entity ที่ถูกพูดถึง (ต้องมีอยู่จริงแล้ว) |
| valid_from | string | เริ่มเป็นจริงเมื่อไหร่ |
| valid_to | string \| null | สิ้นสุดเมื่อไหร่ (null = ยังเป็นจริงอยู่) |
| confidence_score | number | ความมั่นใจ (0.0 - 1.0) |
| intent_category | string | FACT, POLICY, DECISION, OPINION, TASK |
| criticality_score | number | ความสำคัญ (0.0 - 1.0) |
| sentiment | string | POSITIVE, NEGATIVE, NEUTRAL |
| clearance_level | number | ระดับการเข้าถึง (1-4) |
| expires_at | string \| null | วันหมดอายุของข้อมูล (null = ไม่หมดอายุ) |
| justification | string | เหตุผลที่สกัดความสัมพันธ์นี้ |

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`, `DocumentNotFoundError`, `EpisodeNotFoundError`, `EntityNotFoundError`

---

### 6. `syncRelationship`

สร้าง/อัปเดตความสัมพันธ์ระหว่าง Entity กับ Entity (รองรับ Bi-Temporal / Time Traveling)

ฟังก์ชันนี้ฉลาดพอที่จะ:
- ถ้ายังไม่เคยมีความสัมพันธ์นี้มาก่อน → สร้างใหม่
- ถ้ามีความสัมพันธ์แบบเดียวกัน (type เดียวกัน) อยู่แล้ว → ไม่ทำอะไรซ้ำ
- ถ้ามีความสัมพันธ์แบบอื่นอยู่ (type ต่างกัน) → ปิดของเก่าอัตโนมัติ แล้วสร้างความสัมพันธ์ใหม่แทน

```typescript
import { syncRelationship } from "@memory-layer/storage-adapter/semantic"

await syncRelationship({
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
  justification: "สกัดจากเอกสารโครงสร้างองค์กร"
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| organizationId | string | รหัสองค์กร |
| source_id | string | รหัส Entity ต้นทาง |
| target_id | string | รหัส Entity ปลายทาง |
| type | string | ชื่อความสัมพันธ์ เช่น BOARD_MEMBER, RELATED_TO, ACTS_AS (กำหนดได้อิสระ) |
| valid_from | string | เริ่มเป็นจริงเมื่อไหร่ |
| valid_to | string \| null | สิ้นสุดเมื่อไหร่ (null = ยังเป็นจริงอยู่) |
| confidence_score | number | ความมั่นใจ (0.0 - 1.0) |
| intent_category | string | FACT, POLICY, DECISION, OPINION, TASK |
| criticality_score | number | ความสำคัญ (0.0 - 1.0) |
| sentiment | string | POSITIVE, NEGATIVE, NEUTRAL |
| clearance_level | number | ระดับการเข้าถึง (1-4) |
| expires_at | string \| null | วันหมดอายุของข้อมูล |
| justification | string | เหตุผลที่สกัดความสัมพันธ์นี้ |

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`, `EntityNotFoundError` (ทั้ง source และ target)

---

## 🔒 Internal Functions (ห้ามเรียกใช้ตรงๆ)

ฟังก์ชันด้านล่างนี้ถูกเรียกใช้จาก Public API ด้านบนโดยอัตโนมัติแล้ว **ไม่ต้องเรียกเอง**

```
linkEntityToEntity      (ถูกเรียกจาก syncRelationship)
linkChunkToEntity         (ถูกเรียกจาก saveChunk)
linkChunkToDocument         (ถูกเรียกจาก saveChunk)
linkChunkToEpisode            (ถูกเรียกจาก saveChunk)
endRelationship                  (ถูกเรียกจาก syncRelationship)
getActiveRelationship              (ถูกเรียกจาก syncRelationship)
checkOrganizationExists, checkEntityExists, checkDocumentExists, checkEpisodeExists
```

---

## ⚠️ คำเตือนสำคัญเรื่อง Performance

เพื่อความเร็วในการทำงาน ฟังก์ชัน internal (`linkEntityToEntity`, `linkChunkToEntity`)
**ไม่มีการตรวจสอบ Organization/Entity ซ้ำ** เพราะฟังก์ชันที่เรียกมันอยู่แล้ว
(`syncRelationship`, `saveChunk`) ได้ตรวจสอบไปก่อนหน้าแล้ว

**ถ้ามีความจำเป็นต้องเรียก internal function ตรงๆ (ข้าม public API)
ต้องตรวจสอบ Organization/Entity เองก่อนเสมอ หรือยกเลิก Comment ส่วนตรวจเชคข้อมูล** ไม่อย่างนั้นข้อมูลที่ผิดพลาด
อาจถูกบันทึกลง Neo4j แบบไม่มีการแจ้งเตือนใดๆ

**คำแนะนำ:** ใช้แค่ 6 ฟังก์ชันใน "Public API" ด้านบนเท่านั้น
ไม่ต้องยุ่งกับ internal function เลย ระบบจัดการให้ครบถ้วนอยู่แล้ว

---

## 🗂 โครงสร้าง Node และ Edge ทั้งหมดในระบบ

### Nodes (5 ประเภท)
```
Organization, Entity, Document, Episode, Chunk
```

### Edges (3 กลุ่มตาม Cognitive 4D Memory Layer Spec)
```
Structural : HAS_CHUNK            (Document → Chunk)
Semantic   : MENTIONS              (Chunk → Entity, มี Bi-Temporal 8 properties)
             RELATED_TO/ACTS_AS/etc (Entity → Entity, มี Bi-Temporal 8 properties)
Temporal   : EXTRACTED_DURING      (Episode → Chunk)
```

### Multi-tenant
ทุก Node และ Edge มี property `organizationId` กำกับไว้เสมอ (Logical Isolation)
เพื่อแยกข้อมูลแต่ละองค์กรออกจากกัน แม้จะใช้ Neo4j database เดียวกัน
