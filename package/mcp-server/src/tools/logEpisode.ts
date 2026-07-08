import { randomUUID } from "crypto";
import { saveEpisode } from "../../../adapter/src/repositories/nodes/saveEpisode";

export interface EpisodePayload {
  summary: string;
  timestamp?: string; 
  source?: string;    
  organizationId?: string;
}

export async function logEpisode(payload: EpisodePayload) {
  const orgId = payload.organizationId || "org_001";
  const episodeId = `ep_${randomUUID()}`;
  const timestamp = payload.timestamp || new Date().toISOString();
  const source = payload.source || 'chat';

  try {
    await saveEpisode({
      organizationId: orgId,
      id: episodeId,
      timestamp: timestamp,
      source: source,
      summary: payload.summary
    });

    return {
      message: "Episode logged successfully via Storage Adapter",
      saved_data: {
        organizationId: orgId,
        id: episodeId,
        timestamp: timestamp,
        source: source,
        summary: payload.summary
      }
    };
  } catch (error) {
    console.error("Error in logEpisode:", error);
    throw error;
  }
}