import Groq from "groq-sdk";
import { generateEmbeddings } from "./vector";
import "dotenv/config";
import { extractTextFromDocument } from "./docling";
import { isDuplicateEntity } from "./resolution";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function extractGraphData(text: string, organizationId: string) {
  const prompt = `You are a Cognitive 4D Memory Extractor for an Enterprise Architecture.
Extract entities and relationships from the text and output ONLY valid JSON.

CRITICAL RULES:
1. OUTPUT FORMAT: Your response must strictly match this exact JSON structure. Do NOT add extra nested keys like "properties":
{
  "entities": [
    { "id": "unique_string_id", "name": "String", "type": "Person|Org|Feature|Function", "description": "String" }
  ],
  "relationships": [
    { 
      "source_id": "id1", 
      "target_id": "id2", 
      "type": "UPPERCASE_STRING", 
      "valid_from": "ISO_DATE", 
      "valid_to": null, 
      "confidence_score": 0.9, 
      "intent_category": "FACT", 
      "criticality_score": 0.8, 
      "sentiment": "NEUTRAL", 
      "clearance_level": 1, 
      "expires_at": null, 
      "justification": "String" 
    }
  ]
}
2. DIMENSIONS: Provide ALL 8 dimensions for relationships exactly as named above.
3. INTENT CATEGORY: MUST be one of "FACT", "POLICY", "DECISION", "OPINION", or "TASK".

Text to analyze: "${text}"`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  return chatCompletion.choices?.[0]?.message?.content || "{}";
}

async function runPipeline() {
  const targetFilePath = "./sample_policy.txt";
  const currentOrgId = "org_technova_001";

  try {
    const extractedText = await extractTextFromDocument(targetFilePath);
    console.log(`✅ [Docling] ย่อยเอกสารสำเร็จ! ความยาว: ${extractedText.length} ตัวอักษร\n`);

    console.log("1️⃣ [Transform]: ส่งเนื้อหาเอกสารให้ Groq สกัดข้อมูล...");
    const rawResult = await extractGraphData(extractedText, currentOrgId);
    const graphData = JSON.parse(rawResult);
    console.log(`✅ สกัดข้อมูลสำเร็จ พบ Entities: ${graphData.entities?.length} โหนด`);

    console.log("2️⃣ [Transform]: กำลังส่ง Entities ให้ Cohere สร้าง Vector...");
    const textsToEmbed = graphData.entities.map(
      (e: any) => `${e.name}: ${e.description || ""}`
    );

    if (textsToEmbed.length > 0) {
      const embeddings = await generateEmbeddings(textsToEmbed);
      graphData.entities.forEach((entity: any, index: number) => {
        entity.embedding = embeddings[index];
      });
      console.log("✅ ฝัง Vector สำเร็จครบทุกโหนด!\n");
    }

    console.log("3️⃣ [Entity Resolution]: จำลองการตรวจสอบกราฟขยะ (Graph Noise)...");

    const dbMockText = ["คุณสมชาย: ผู้บริหารระดับสูงแผนกความปลอดภัยไซเบอร์"];
    const dbMockEmbedding = await generateEmbeddings(dbMockText);

    const newPersonNode = graphData.entities.find((e: any) => e.type === "Person");

    if (newPersonNode && dbMockEmbedding.length > 0) {
      console.log(`   กำลังเทียบโหนดใหม่: "${newPersonNode.name}" กับ โหนดใน DB: "คุณสมชาย"`);

      const isDup = isDuplicateEntity(newPersonNode.embedding || [], dbMockEmbedding[0] || [], 0.85);

      if (isDup) {
        console.log("   💡 สรุป: เป็นคนเดียวกัน! ระบบจะสั่ง MERGE เข้าโหนดเดิม ไม่สร้างโหนดขยะเพิ่ม");
      } else {
        console.log("   💡 สรุป: เป็นคนละคนกัน! ระบบจะสั่ง CREATE โหนดใหม่");
      }
    }

  } catch (error) {
    console.error("❌ Pipeline Error:", error);
  }
}

runPipeline();