import driver from "@/src/db"
import type { Document } from "@/src/types/nodes/document"
import type { Chunk } from "@/src/types/nodes/chunk"
import type { GetDocumentTreeInput, DocumentTreeResponse } from "@/src/types/queries/documentTree"
import type { Record as Neo4jRecord, Node } from "neo4j-driver"

/**
 * ดึงโครงสร้างเอกสารและ Chunk ทุกก้อนเรียงตามลำดับ (Deterministic)
 * ใช้ HAS_CHUNK + ORDER BY sequence_order แทน NEXT_CHUNK traversal
 */
export async function getDocumentTree(data: GetDocumentTreeInput): Promise<DocumentTreeResponse | null> {
  const session = driver.session()

  try {
    const query = `
      MATCH (d:Document {organizationId: $organizationId, id: $documentId})
      OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
      RETURN d AS document, c AS chunk
      ORDER BY c.sequence_order ASC
    `

    const result = await session.run(query, {
      organizationId: data.organizationId,
      documentId: data.documentId
    })

    const records: Neo4jRecord[] = result.records

    if (!records || records.length === 0) return null

    const firstRecord = records[0]

    // แก้จุดที่ 1: Ghost Document
    // ดึง document node ออกมาก่อน ถ้า null = document ไม่มีใน DB จริงๆ
    // ป้องกัน crash ที่ documentNode.organizationId ถ้า node ถูกลบระหว่าง query
    const rawDocNode = firstRecord?.get("document") as Node | null
    if (!rawDocNode) return null

    const documentNode = rawDocNode.properties
    const document: Document = {
      organizationId: documentNode.organizationId,
      id: documentNode.id,
      title: documentNode.title,
      type: documentNode.type,
      language: documentNode.language,
      authors: documentNode.authors || [],
    }

    const chunkMap = new Map<string, Omit<Chunk, "embedding">>()

    for (const record of records) {
      const chunkNode = record.get("chunk") as Node | null
      if (!chunkNode) continue

      const props = chunkNode.properties
      const chunkId = props.id as string

      if (chunkMap.has(chunkId)) continue

      // แก้จุดที่ 3: mentioned_entities
      // เช็ก typeof ก่อน parse แทน try-catch
      // ลด overhead กรณีข้อมูลปกติ (ไม่ต้องเข้า try ทุก record)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mentionedEntities: any[] = []
      const raw = props.mentioned_entities
      if (Array.isArray(raw)) {
        mentionedEntities = raw
      } else if (typeof raw === "string" && raw.length > 0) {
        try {
          const parsed = JSON.parse(raw)
          mentionedEntities = Array.isArray(parsed) ? parsed : []
        } catch {
          mentionedEntities = []
        }
      }

      chunkMap.set(chunkId, {
        organizationId: props.organizationId,
        id: chunkId,
        source_type: props.source_type,
        source_id: props.source_id,
        text: props.text,
        sequence_order: Number(props.sequence_order),
        mentioned_entities: mentionedEntities,
      })
    }

    // แก้จุดที่ 2: chunkMap sort
    // sort อีกรอบหลัง Map เพื่อการันตีลำดับ 100%
    // แม้ ORDER BY ใน Cypher จะถูกแล้ว แต่ Map insertion order
    // อาจไม่เชื่อได้ในทุก runtime
    const chunks = Array.from(chunkMap.values())
      .sort((a, b) => a.sequence_order - b.sequence_order)

    return { document, chunks }

  } catch (error) {
    console.error("Error in getDocumentTree:", error)
    throw error
  } finally {
    await session.close()
  }
}