import { Queue, Worker } from 'bullmq';
import { saveEntities } from "../../adapter/src/repositories/nodes/saveEntities";
import { saveChunks } from "../../adapter/src/repositories/nodes/saveChunks";
import { syncRelationship } from "../../adapter/src/repositories/semantic";

const connectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379
};

export const ingestionQueue = new Queue('ingestion', { 
  connection: connectionOptions 
});

const worker = new Worker('ingestion', async job => {
  const { organizationId, chunks, entities, relationships } = job.data;

  if (entities && entities.length > 0) {
    const formattedEntities = entities.map((entity: any) => ({
      organizationId,
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description || "",
      embedding: entity.embedding || []
    }));
    
    const entityResult = await saveEntities(formattedEntities);
    
    if (entityResult?.failed && entityResult.failed.length > 0) {
      console.error(`Failed to save entities:`, entityResult.failed);
    }
  }

  if (chunks && chunks.length > 0) {
    const formattedChunks = chunks.map((chunk: any) => ({
      organizationId,
      id: chunk.id,
      source_type: chunk.source_type,
      source_id: chunk.source_id,
      text: chunk.text,
      sequence_order: chunk.sequence_order,
      embedding: chunk.embedding,
      mentioned_entities: chunk.mentioned_entities
    }));
    
    const chunkResult = await saveChunks(formattedChunks);
    
    if (chunkResult?.failed && chunkResult.failed.length > 0) {
      console.error(`Failed to save chunks:`, chunkResult.failed);
    }
  }

  if (relationships && relationships.length > 0) {
    for (const rel of relationships) {
      await syncRelationship({
        organizationId,
        source_id: rel.source_id,
        target_id: rel.target_id,
        type: rel.type,
        valid_from: rel.valid_from,
        valid_to: rel.valid_to,
        confidence_score: rel.confidence_score,
        intent_category: rel.intent_category,
        criticality_score: rel.criticality_score,
        sentiment: rel.sentiment,
        clearance_level: rel.clearance_level,
        expires_at: rel.expires_at,
        justification: rel.justification
      });
    }
  }

  return { status: "success", processed_chunks: chunks?.length || 0 };
}, { 
  connection: connectionOptions,
  concurrency: 5 
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});