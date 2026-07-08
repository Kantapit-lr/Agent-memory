import driver from "../../../adapter/src/db";
import { randomUUID } from "crypto";

export interface EpisodePayload {
  summary: string;
  timestamp?: string; // ปล่อยว่างได้ จะใช้เวลาปัจจุบัน
  source?: string;    // ปล่อยว่างได้ ค่าเริ่มต้นจะเป็น 'chat'
}

export async function logEpisode(payload: EpisodePayload) {
  const session = driver.session();
  
  try {
    // ยิง Cypher สร้างโหนด Episode พร้อม Properties ตามที่ระบุในเอกสาร
    const result = await session.run(
      `
      CREATE (e:Episode {
        id: $id,
        timestamp: $timestamp,
        source: $source,
        summary: $summary
      })
      RETURN e.id AS id, e.timestamp AS timestamp, e.source AS source, e.summary AS summary
      `,
      {
        id: `ep_${randomUUID()}`,
        timestamp: payload.timestamp || new Date().toISOString(),
        source: payload.source || 'chat',
        summary: payload.summary
      }
    );

    const record = result.records[0];
    return {
      message: "Episode logged successfully",
      saved_data: {
        id: record.get("id"),
        timestamp: record.get("timestamp"),
        source: record.get("source"),
        summary: record.get("summary")
      }
    };
  } catch (error) {
    console.error("Error in logEpisode:", error);
    throw error;
  } finally {
    await session.close();
  }
}