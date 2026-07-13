# Agent-memory
=======
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
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

REDIS_HOST=localhost
REDIS_PORT=6379
```

3. สร้าง Index ใน Neo4j (รันครั้งเดียวตอน setup หรือหลัง wipe database)
```bash
bun --env-file=.env src/setup-indexes.ts
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

### 3. `saveDocument`

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

### 4. `saveEpisode`

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
ฟังก์ชันนี้จะสร้างความเชื่อมโยงให้อัตโนมัติ (HAS_CHUNK, NEXT_CHUNK, EXTRACTED_DURING, MENTIONS) ไม่ต้องเรียกเองแยก

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
  mentioned_entities: []
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
| mentioned_entities | MentionedEntity[] | รายการ Entity ที่ถูกพูดถึงใน chunk นี้ |

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

## 🔍 Read / Query Functions

ฟังก์ชันสำหรับดึงข้อมูลออกจาก Graph ทุกตัวรับ object เดียวและคืน object/array กลับมา

---

### 1. `getDocumentTree`

ดึงเอกสารทั้งฉบับพร้อม Chunk ทุกก้อนเรียงตามลำดับ (Deterministic ใช้ `ORDER BY sequence_order` + `.sort()` double-check)

```typescript
import { getDocumentTree } from "@memory-layer/storage-adapter/queries/getDocumentTree"

const result = await getDocumentTree({
  organizationId: "org_001",
  documentId: "doc_01"
})

// result = null ถ้าไม่เจอ document
// result = { document: {...}, chunks: [...] } ถ้าเจอ
```

**Response:**
| Field | Type | คำอธิบาย |
|---|---|---|
| document | Document | metadata ของเอกสาร |
| chunks | Chunk[] | ทุก chunk เรียงตาม sequence_order (ไม่มี embedding) |

---

### 2. `getChunkSource`

ดึงว่า chunk นี้มาจาก document หรือ episode ไหน ใช้สำหรับ Citation/Traceability

```typescript
import { getChunkSource } from "@memory-layer/storage-adapter/queries/getChunkSource"

const result = await getChunkSource({
  organizationId: "org_001",
  chunkId: "chunk_01"
})
// result = { chunkId, sourceType: "document", sourceId: "doc_01" }
```

**⚠️ Error ที่อาจเกิดขึ้น:** `ChunkNotFoundError`

---

### 3. `discoverEntities`

ค้นหา Entity จาก keyword (case-insensitive, partial match) คืน list ไว้ให้ Agent ยืนยันตัวตนก่อนค้นต่อ ป้องกัน Hallucination จากการสะกดผิด

```typescript
import { discoverEntities } from "@memory-layer/storage-adapter/queries/discoverEntities"

const results = await discoverEntities({
  organizationId: "org_001",
  keyword: "ทวีสิน"
})
// results = [{ id, name, type }]
```

---

#### 4. `getEntityRelations`

ดึง Relation ทั้งหมดที่ Entity นี้มีกับ Entity อื่น พร้อม Citation fields

```typescript
const results = await getEntityRelations({
  organizationId: "org_001",
  entityId: "person_01"
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| relationType | string | ประเภทความสัมพันธ์ |
| targetId | string | รหัส Entity ปลายทาง |
| targetName | string | ชื่อ Entity ปลายทาง |
| valid_from | string | เริ่มเป็นจริงเมื่อไหร่ |
| valid_to | string \| null | สิ้นสุดเมื่อไหร่ |
| confidence_score | number | ความมั่นใจ (0.0 - 1.0) |
| intent_category | string | FACT, POLICY, DECISION, OPINION, TASK |
| source_chunk_id | string \| null | Citation: chunk ที่เป็นแหล่งที่มาของความรู้นี้ |
| source_document_id | string \| null | Citation: document ที่ chunk นั้นอยู่ |

**⚠️ Error ที่อาจเกิดขึ้น:** `EntityNotFoundError`

---

### 5. `getEntityTimeline`

ดึง Timeline ประวัติความสัมพันธ์ของ Entity เรียงตาม `valid_from ASC`

```typescript
// ดึงทุก type
const timeline = await getEntityTimeline({
  organizationId: "org_001",
  entityId: "person_01"
})

// filter เฉพาะ type ที่ต้องการ
const filtered = await getEntityTimeline({
  organizationId: "org_001",
  entityId: "person_01",
  relationshipType: "BOARD_MEMBER"
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| relationshipType | string | ประเภทความสัมพันธ์ |
| targetEntityId | string | รหัส Entity ปลายทาง |
| targetEntityName | string | ชื่อ Entity ปลายทาง |
| valid_from | string | เริ่มเป็นจริงเมื่อไหร่ |
| valid_to | string \| null | สิ้นสุดเมื่อไหร่ |
| confidence_score | number | ความมั่นใจ (0.0 - 1.0) |
| intent_category | string | FACT, POLICY, DECISION, OPINION, TASK |
| criticality_score | number | ความสำคัญ (0.0 - 1.0) |
| sentiment | string | POSITIVE, NEGATIVE, NEUTRAL |
| clearance_level | number | ระดับการเข้าถึง (1-4) |
| expires_at | string \| null | วันหมดอายุ |
| justification | string | เหตุผลที่สกัดความสัมพันธ์นี้ |
| source_chunk_id | string \| null | Citation: chunk ที่เป็นแหล่งที่มาของความรู้นี้ |
| source_document_id | string \| null | Citation: document ที่ chunk นั้นอยู่ |

**⚠️ Error ที่อาจเกิดขึ้น:** `EntityNotFoundError`

---

### 6. `getDocuments`

ดึงรายชื่อ Document ทั้งหมดใน org พร้อม `chunkCount` ใช้ก่อนเรียก `getDocumentTree` เพื่อให้ Agent รู้ว่ามีเอกสารอะไรบ้าง

```typescript
import { getDocuments } from "@memory-layer/storage-adapter/queries/getDocuments"

const docs = await getDocuments({
  organizationId: "org_001",
  language: "TH",  // optional
  type: "PDF"      // optional
})
```

---

### 7. `semanticSearch`

ค้นหา Chunk ที่ใกล้เคียงกับ query มากที่สุด โดยใช้ Vector Similarity (Cosine) พร้อม filter activeOnly, clearanceLevel, langFilter

**หมายเหตุ:** ฝั่งที่เรียกต้องแปลง query text เป็น Vector ด้วย Cohere ก่อน แล้วค่อยส่ง `queryEmbedding` มา adapter ไม่ได้ทำ embedding เองให้

```typescript
import { semanticSearch } from "@memory-layer/storage-adapter/queries/semanticSearch"

const results = await semanticSearch({
  organizationId: "org_001",
  queryEmbedding: [0.1, 0.2, ...],  // Vector 1024 มิติจาก Cohere
  limit: 5,                           // default 5
  activeOnly: true,                   // เอาเฉพาะ MENTIONS ที่ valid_to IS NULL
  minClearanceLevel: 2,              // เฉพาะ clearance_level <= 2
  langFilter: "TH"                   // กรองเฉพาะ Document ภาษาไทย (optional)
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| chunkId | string | รหัส Chunk |
| text | string | เนื้อหาข้อความ |
| similarityScore | number | คะแนนความใกล้เคียง (0.0 - 1.0) |
| sourceType | string \| null | "document" หรือ "episode" |
| sourceId | string \| null | รหัสต้นทาง |
| documentTitle | string \| null | ชื่อ Document (ถ้า source เป็น document) |
| mentionedEntities | object[] | Entity ที่ถูก mention ใน chunk นี้ (ผ่าน filter แล้ว) |

**⚠️ ต้องรัน `setup-indexes.ts` ก่อน** เพื่อสร้าง Vector Index `chunk_embedding` ใน Neo4j

---

### 7. `getCodeDependencies`

ไต่กราฟ `[:CALLS]` และ `[:IMPORTS]` เพื่อหา dependency ของ Function/Module ใช้ Cypher Variable Length Path ไม่มี LLM เกี่ยวข้อง (Deterministic 100%)

**ต้องการ:** Entity ที่มี `type = "FUNCTION"`, `"MODULE"`, หรือ `"CLASS"` ในระบบ (สร้างโดย `/api/memory/ingest/code`)

```typescript
import { getCodeDependencies } from "@memory-layer/storage-adapter/queries/getCodeDependencies"

const result = await getCodeDependencies({
  organizationId: "org_001",
  entityId: "ent_code_validateToken",
  direction: "outgoing",  // "outgoing" | "incoming" | "both" (default)
  maxDepth: 3             // default 3
})
```

| Field | Type | คำอธิบาย |
|---|---|---|
| rootEntityId | string | Entity ต้นทางที่ถามเข้ามา |
| rootEntityName | string | ชื่อ Entity ต้นทาง |
| direction | string | ทิศทางที่ค้นหา |
| dependencies | CodeDependencyNode[] | รายการ dependency ทั้งหมด |

**`CodeDependencyNode` แต่ละตัวมี:**

| Field | Type | คำอธิบาย |
|---|---|---|
| entityId | string | รหัส Entity |
| entityName | string | ชื่อ Entity |
| entityType | string | FUNCTION, MODULE, CLASS |
| relationshipType | string | CALLS หรือ IMPORTS |
| depth | number | ชั้นที่เจอ (1 = direct, 2 = transitive) |
| source_chunk_id | string \| null | Citation |
| source_document_id | string \| null | Citation |

**⚠️ Error ที่อาจเกิดขึ้น:** `EntityNotFoundError` (ถ้า entity ไม่มีอยู่ หรือ type ไม่ใช่ FUNCTION/MODULE/CLASS)

---

## 📦 Batch Operations

รับ array แทนการเรียกทีละตัว ใช้เมื่อต้องการ ingest ข้อมูลจำนวนมาก

### `saveEntities`
```typescript
import { saveEntities } from "@memory-layer/storage-adapter/nodes/saveEntities"

const result = await saveEntities([
  { organizationId: "org_001", id: "ent_01", name: "สมชาย", type: "PERSON", description: "..." },
  { organizationId: "org_001", id: "ent_02", name: "สมหญิง", type: "PERSON", description: "..." }
])
// คืน: { saved: 2, failed: [] }
```

### `saveChunks`
ระบบจะเรียง `sequence_order` อัตโนมัติก่อนบันทึก กัน `NEXT_CHUNK` ขาดตอน

```typescript
import { saveChunks } from "@memory-layer/storage-adapter/nodes/saveChunks"

const result = await saveChunks([...chunks])
// คืน: { saved: N, failed: [] }
```

**หมายเหตุ:** Entity ที่ error จะถูกเก็บไว้ใน `failed[]` แล้วดำเนินการต่อ ไม่หยุดทั้ง batch

---

## 📊 Organization Stats

ดึงสถิติภาพรวมของ org ใช้สำหรับ monitoring และ stress test

```typescript
import { getOrganizationStats } from "@memory-layer/storage-adapter/queries/getOrganizationStats"

const stats = await getOrganizationStats({ organizationId: "org_001" })
// คืน: entityCount, documentCount, episodeCount, chunkCount,
//       relationshipCount, activeRelationshipCount, expiredRelationshipCount,
//       mentionCount, entityByType[], documentByLanguage[]
```

---

## ⏰ Expired Facts

ระบบจัดการ relationship ที่มี `expires_at` หมดอายุแล้ว มี 2 ฟังก์ชัน:

### `getExpiredFacts`
ดึง relationship ที่หมดอายุแล้วทั้งหมด ใช้สำหรับ monitoring ก่อน purge

```typescript
import { getExpiredFacts } from "@memory-layer/storage-adapter/queries/expiredFacts"

const expired = await getExpiredFacts({
  organizationId: "org_001",
  asOf: "2026-01-01T00:00:00Z"  // optional default = ปัจจุบัน
})
```

### `purgeExpiredFacts`
ปิดหรือลบ relationship ที่หมดอายุ

```typescript
import { purgeExpiredFacts } from "@memory-layer/storage-adapter/queries/expiredFacts"

// soft close (default) — set valid_to รักษา bi-temporal history ไว้
await purgeExpiredFacts({ organizationId: "org_001" })

// hard delete — ลบทิ้งเลย (ใช้กรณี GDPR)
await purgeExpiredFacts({ organizationId: "org_001", hardDelete: true })
```

---

## 🧩 Entity Resolution

ระบบจะทำ Entity Resolution อัตโนมัติทุกครั้งที่เรียก `saveEntity` ที่มี `embedding` ส่งมาด้วย

**หลักการ:**
1. แปลง entity ใหม่เป็น vector ก่อน (ทำโดยฝั่งที่เรียก เช่น cognitive-extractor)
2. ค้นหาใน Neo4j ว่ามี Entity ที่ vector ใกล้เคียงกัน (threshold 0.92) อยู่แล้วไหม
3. ถ้าเจอ → merge เข้ากับตัวเดิม ไม่สร้าง node ใหม่
4. ถ้าไม่เจอ → สร้าง node ใหม่ตามปกติ

**ตัวอย่าง:** "กทม." และ "Bangkok" จะกลายเป็น Entity node เดียวกัน

```typescript
// ส่ง embedding มาด้วยเพื่อให้ Entity Resolution ทำงาน
await saveEntity({
  organizationId: "org_001",
  id: "entity_01",
  name: "กทม.",
  type: "LOCATION",
  description: "กรุงเทพมหานคร",
  embedding: [...] // Vector 1024 มิติจาก Cohere
})
```

**หมายเหตุ:**
- Code entity (`FUNCTION`, `MODULE`, `CLASS`) ไม่ต้องส่ง `embedding` ระบบจะข้าม Entity Resolution ให้อัตโนมัติ
- **ต้องรัน `setup-indexes.ts`** เพื่อสร้าง `entity_embedding` vector index ก่อนใช้งาน

---

## 🗑 Delete API

ฟังก์ชันลบ ทุกตัวรับ object เดียว มี `force` (optional, default = false) ควบคุมว่าจะ cascade delete หรือไม่
ถ้าไม่ใส่ `force` แล้วยังมี Node/Relationship ลูกค้างอยู่ ระบบจะโยน error แทนการลบ เพื่อกันลบข้อมูลพลาด

---

### 1. `deleteChunk`

ลบ Chunk เดี่ยว พร้อมเส้นทุกเส้นที่ผูกกับมัน (HAS_CHUNK, NEXT_CHUNK, MENTIONS, EXTRACTED_DURING)

```typescript
import { deleteChunk } from "@memory-layer/storage-adapter/nodes/deleteChunk"

await deleteChunk({
  organizationId: "org_001",
  chunkId: "chunk_01"
})
```

**⚠️ หมายเหตุสำคัญ:** ฟังก์ชันนี้ไม่ซ่อม `NEXT_CHUNK` ของก้อนข้างเคียงให้อัตโนมัติ
ถ้าลบ chunk ตรงกลาง (เช่น chunk_02 จากสาย chunk_01→chunk_02→chunk_03) ลำดับจะขาดตอน
ต้องจัดการ re-link เองถ้าต้องการ

> **Technical Debt:** ถ้าในอนาคตมีการลบ Chunk ตรงกลาง เนื้อหาเอกสารตอน Agent เรียก `get_document_tree` อาจแหว่งได้ ควรพิจารณาเพิ่ม auto-relink `NEXT_CHUNK` ในภายหลัง

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`, `ChunkNotFoundError`

---

### 2. `deleteDocument`

ลบ Document — ถ้ายังมี Chunk แขวนอยู่ ต้องใส่ `force: true` เพื่อ cascade ลบ Chunk ไปด้วย

```typescript
import { deleteDocument } from "@memory-layer/storage-adapter/nodes/deleteDocument"

// ลบเฉพาะ Document ที่ไม่มี Chunk เหลือแล้ว
await deleteDocument({ organizationId: "org_001", documentId: "doc_01" })

// cascade ลบ Document พร้อม Chunk ทุกก้อนที่แขวนอยู่
await deleteDocument({ organizationId: "org_001", documentId: "doc_01", force: true })
```

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`, `DocumentNotFoundError`, Error (ยังมี Chunk ค้าง ถ้าไม่ส่ง force)

---

### 3. `deleteEpisode`

ลบ Episode — ถ้ายังมี Chunk แขวนอยู่ (ผ่าน EXTRACTED_DURING) ต้องใส่ `force: true`

```typescript
import { deleteEpisode } from "@memory-layer/storage-adapter/nodes/deleteEpisode"

await deleteEpisode({ organizationId: "org_001", episodeId: "episode_01", force: true })
```

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`, `EpisodeNotFoundError`, Error (ยังมี Chunk ค้าง ถ้าไม่ส่ง force)

---

### 4. `deleteEntity`

ลบ Entity — ถ้ายังมีความสัมพันธ์ active อยู่ (MENTIONS จาก Chunk ใดๆ หรือ Entity-Entity ที่ `valid_to IS NULL`)
ต้องใส่ `force: true` เพื่อลบความสัมพันธ์เหล่านั้นไปด้วย

```typescript
import { deleteEntity } from "@memory-layer/storage-adapter/nodes/deleteEntity"

await deleteEntity({ organizationId: "org_001", entityId: "person_01", force: true })
```

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`, `EntityNotFoundError`, `EntityHasActiveRelationshipsError` (ถ้าไม่ส่ง force)

---

### 5. `deleteOrganization`

ลบทั้งองค์กร — **อันตรายที่สุดในระบบ** ลบ Entity, Document, Episode, Chunk และเส้นทุกเส้นที่แท็ก `organizationId` นี้ทั้งหมด
ถ้ายังมี Node ใดๆ ค้างอยู่ ต้องใส่ `force: true` การลบนี้ย้อนกลับไม่ได้ (irreversible)

```typescript
import { deleteOrganization } from "@memory-layer/storage-adapter/nodes/deleteOrganization"

await deleteOrganization({ organizationId: "org_001", force: true })
```

**คำแนะนำ:** ฝั่งที่เรียกใช้ (เช่น MCP tool หรือ UI) ควรมี confirmation step ก่อนเรียกด้วย `force: true` เสมอ

**⚠️ Error ที่อาจเกิดขึ้น:** `OrganizationNotFoundError`, `OrganizationNotEmptyError` (ถ้าไม่ส่ง force)

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
Structural : HAS_CHUNK, NEXT_CHUNK        (Document/Chunk → Chunk)
Semantic   : MENTIONS                      (Chunk → Entity, มี Bi-Temporal 8 properties)
             RELATED_TO/ACTS_AS/etc        (Entity → Entity, มี Bi-Temporal 8 properties)
Temporal   : EXTRACTED_DURING             (Episode → Chunk)
```

### Multi-tenant
ทุก Node และ Edge มี property `organizationId` กำกับไว้เสมอ (Logical Isolation)
เพื่อแยกข้อมูลแต่ละองค์กรออกจากกัน แม้จะใช้ Neo4j database เดียวกัน