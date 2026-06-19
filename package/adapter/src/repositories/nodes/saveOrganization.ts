import driver from "@/src/db"
import type { Organization } from "@/src/types/nodes/organization"

export async function saveOrganization(data: Organization) {
  const session = driver.session()
  try {
    const result = await session.run(
      `
      MERGE (org:Organization {id: $id})
      SET org.name = $name,
          org.created_at = datetime($created_at)
      `,
      {
        id: data.id,
        name: data.name,
        created_at: data.created_at
      }
    )
    return result
  } finally {
    await session.close()
  }
}