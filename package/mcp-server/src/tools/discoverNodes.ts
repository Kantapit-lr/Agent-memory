import driver from "../../../adapter/src/db"; 

export interface DiscoveredNode {
  id: string;
  name: string;
  type: string;
  description: string;
}

export async function discoverNodes(keyword: string): Promise<DiscoveredNode[]> {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `
      MATCH (e:Entity)
      WHERE toLower(e.name) CONTAINS toLower($keyword)
      RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description
      LIMIT 10
      `,
      { keyword }
    );

    const nodes: DiscoveredNode[] = result.records.map(record => ({
      id: record.get("id"),
      name: record.get("name"),
      type: record.get("type") || "Unknown",
      description: record.get("description") || "No description available"
    }));

    return nodes;
  } catch (error) {
    console.error("Error in discoverNodes:", error);
    return [];
  } finally {
    await session.close();
  }
}