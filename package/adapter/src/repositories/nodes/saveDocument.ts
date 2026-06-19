import driver from "@/src/db"
import type { Document } from "@/src/types/nodes/document"
import { checkOrganizationExists } from "./checkOrganization"
import { OrganizationNotFoundError } from "@/src/types/errors"

export async function saveDocument(data: Document) {
  const orgExists = await checkOrganizationExists(data.organizationId)
  if (!orgExists) {
    throw new OrganizationNotFoundError(data.organizationId)
  }

  const session = driver.session()
  try {
    const result = await session.run(
      `
      MERGE (d:Document {organizationId: $organizationId, id: $id})
      SET d.title = $title,
          d.type = $type,
          d.language = $language,
          d.authors = $authors
      `,
      {
        organizationId: data.organizationId,
        id: data.id,
        title: data.title,
        type: data.type,
        language: data.language,
        authors: data.authors
      }
    )
    return result
  } finally {
    await session.close()
  }
}