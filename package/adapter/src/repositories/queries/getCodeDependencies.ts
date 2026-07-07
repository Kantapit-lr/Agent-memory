import driver from "@/src/db"
import { EntityNotFoundError } from "@/src/types/errors"
import type { GetCodeDependenciesInput, GetCodeDependenciesResult, CodeDependencyNode } from "@/src/types/queries/codeDependencies"

// ไต่กราฟ [:CALLS] และ [:IMPORTS] เพื่อหา dependency ของ Function/Module
// ใช้ Cypher Variable Length Path แทน for-loop เพื่อให้ deterministic 100% ตาม spec
// ไม่ใช้ LLM ในการหาความสัมพันธ์เลย
export async function getCodeDependencies(data: GetCodeDependenciesInput): Promise<GetCodeDependenciesResult> {
  const session = driver.session()
  const maxDepth = data.maxDepth ?? 3
  const direction = data.direction ?? "both"

  try {
    // เช็คว่า root entity มีอยู่จริง
    const checkResult = await session.run(
      `MATCH (e:Entity {organizationId: $organizationId, id: $entityId})
       WHERE e.type IN ['FUNCTION', 'MODULE', 'CLASS']
       RETURN e.id AS id, e.name AS name, e.type AS type`,
      { organizationId: data.organizationId, entityId: data.entityId }
    )

    if (checkResult.records.length === 0) {
      throw new EntityNotFoundError(data.entityId)
    }

    const root = checkResult.records[0]
    const rootName = root.get("name") as string

    // สร้าง query ตาม direction
    // ใช้ Variable Length Path [:CALLS|IMPORTS*1..maxDepth] ให้ Neo4j ไต่เองทั้งหมด
    let matchPattern: string
    if (direction === "outgoing") {
      matchPattern = `MATCH path = (root:Entity {organizationId: $organizationId, id: $entityId})-[:CALLS|IMPORTS*1..${maxDepth}]->(dep:Entity {organizationId: $organizationId})`
    } else if (direction === "incoming") {
      matchPattern = `MATCH path = (dep:Entity {organizationId: $organizationId})-[:CALLS|IMPORTS*1..${maxDepth}]->(root:Entity {organizationId: $organizationId, id: $entityId})`
    } else {
      // both — union outgoing + incoming
      matchPattern = `MATCH path = (root:Entity {organizationId: $organizationId, id: $entityId})-[:CALLS|IMPORTS*1..${maxDepth}]-(dep:Entity {organizationId: $organizationId})`
    }

    const result = await session.run(
      `
      ${matchPattern}
      WHERE dep.type IN ['FUNCTION', 'MODULE', 'CLASS']
        AND dep.id <> $entityId
      WITH dep,
           length(path) AS depth,
           last(relationships(path)) AS rel
      OPTIONAL MATCH (chunk:Chunk {organizationId: $organizationId})-[:MENTIONS]->(dep)
      OPTIONAL MATCH (doc:Document {organizationId: $organizationId})-[:HAS_CHUNK]->(chunk)
      RETURN
        dep.id AS entityId,
        dep.name AS entityName,
        dep.type AS entityType,
        type(rel) AS relationshipType,
        depth,
        chunk.id AS source_chunk_id,
        doc.id AS source_document_id
      ORDER BY depth ASC, dep.name ASC
      `,
      { organizationId: data.organizationId, entityId: data.entityId }
    )

    const dependencies: CodeDependencyNode[] = result.records.map((record: any): CodeDependencyNode => ({
      entityId: record.get("entityId") as string,
      entityName: record.get("entityName") as string,
      entityType: record.get("entityType") as string,
      relationshipType: record.get("relationshipType") as string,
      depth: record.get("depth").toNumber(),
      source_chunk_id: record.get("source_chunk_id") as string | null,
      source_document_id: record.get("source_document_id") as string | null
    }))

    return {
      rootEntityId: data.entityId,
      rootEntityName: rootName,
      direction,
      dependencies
    }
  } finally {
    await session.close()
  }
}
