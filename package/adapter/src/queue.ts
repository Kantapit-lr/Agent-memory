import { Queue } from "bullmq"

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
}

export const ingestionQueue = new Queue("ingestion", { connection })

export interface IngestionJobData {
  organizationId: string
  documentId: string
  episodeId?: string
  chunks: Array<{
    id: string
    source_type: "document" | "episode"
    source_id: string
    text: string
    sequence_order: number
    embedding: number[]
    mentioned_entities: Array<{
      entity_id: string
      valid_from: string
      valid_to: string | null
      confidence_score: number
      intent_category: string
      criticality_score: number
      sentiment: string
      clearance_level: number
      expires_at: string | null
      justification: string
    }>
  }>
  entities: Array<{
    id: string
    name: string
    type: string
    description: string
  }>
  relationships: Array<{
    source_id: string
    target_id: string
    type: string
    valid_from: string
    valid_to: string | null
    confidence_score: number
    intent_category: string
    criticality_score: number
    sentiment: string
    clearance_level: number
    expires_at: string | null
    justification: string
  }>
}