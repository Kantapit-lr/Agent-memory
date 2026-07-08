import { Queue, Worker } from 'bullmq';

const connectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const ingestionQueue = new Queue('document-ingestion', { 
  connection: connectionOptions 
});

const worker = new Worker('document-ingestion', async job => {
  console.log(`👷‍♂️ [Worker] เริ่มประมวลผลเอกสาร: ${job.data.title} (ID: ${job.data.documentId})`);
  
  await new Promise(resolve => setTimeout(resolve, 3000)); 

  console.log(`✅ [Worker] ประมวลผลเอกสาร ${job.data.documentId} เสร็จสมบูรณ์!`);
  return { status: "success", documentId: job.data.documentId };
}, { 
  connection: connectionOptions 
});

worker.on('failed', (job, err) => {
  console.error(`❌ [Worker] งาน ${job?.id} ล้มเหลว:`, err);
});