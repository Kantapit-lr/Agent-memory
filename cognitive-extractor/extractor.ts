import Anthropic from "@anthropic-ai/sdk";
import { generateEmbeddings } from "./vector";
import { extractTextFromDocument } from "./docling";
import { isDuplicateEntity } from "./resolution";
import "dotenv/config";

const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy_key_for_mocking_mode" 
});

export async function extractGraphData(text: string, organizationId: string) {
  //โหมดจำลอง
  if (process.env.USE_MOCK_AI === "true") {
    console.log("⚠️ [MOCK MODE] กำลังจำลองผลลัพธ์การสกัดข้อมูลจาก Claude 3.5 Sonnet...");
    
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    return JSON.stringify({
      "entities": [
        {
          "id": `${organizationId}_mock_person`,
          "name": "นายสมชาย วงศ์สว่าง",
          "type": "PERSON",
          "description": "ข้อมูลจำลอง - ผู้อำนวยการแผนก Cybersecurity",
          "organizationId": organizationId
        },
        {
          "id": `${organizationId}_mock_org`,
          "name": "TechNova Corp",
          "type": "ORG",
          "description": "ข้อมูลจำลอง - บริษัทต้นสังกัด",
          "organizationId": organizationId
        }
      ],
      "relationships": [
        {
          "source_id": `${organizationId}_mock_person`,
          "target_id": `${organizationId}_mock_org`,
          "type": "EMPLOYMENT",
          "valid_from": "2026-07-01T00:00:00Z",
          "valid_to": null,
          "confidence_score": 0.99,
          "intent_category": "FACT",
          "criticality_score": 0.8,
          "sentiment": "NEUTRAL",
          "clearance_level": 3,
          "expires_at": null,
          "justification": "Mock relationship generated for testing without API Key",
          "organizationId": organizationId
        }
      ]
    });
  }

  //โหมดใช้งานจริง (ยิงเข้า Claude 3.5 Sonnet)
  const systemPrompt = `You are a Cognitive 4D Memory Extractor for an Enterprise Architecture.
Extract entities and relationships from the text and output ONLY valid JSON.

CRITICAL RULES:
1. OUTPUT FORMAT: Your response must strictly match this exact JSON structure. Do NOT add extra nested keys like "properties":
{
  "entities": [
    { "id": "unique_string", "name": "String", "type": "PERSON|ORG|FEATURE|FUNCTION", "description": "String", "organizationId": "${organizationId}" }
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
      "justification": "String",
      "organizationId": "${organizationId}"
    }
  ]
}
2. PREFIX IDs: For every entity 'id', you MUST prefix it with the organizationId. (e.g., '${organizationId}_somchai').
3. EXACT 8 DIMENSIONS: Provide ALL 8 dimensions for relationships exactly as named above.
4. INTENT CATEGORY: MUST be one of "FACT", "POLICY", "DECISION", "OPINION", or "TASK".
5. CLEAN OUTPUT: DO NOT wrap the JSON in markdown blocks. Output ONLY raw JSON text.`;

  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
    temperature: 0.1, // บังคับให้ Claude ตอบตรงเป๊ะ ไม่มั่ว
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Text to analyze: "${text}"`
      }
    ]
  });

  let jsonString = "";
  const firstContent = msg.content?.[0];
  
  if (firstContent && firstContent.type === 'text') {
    jsonString = firstContent.text;
  }

  // เคลียร์ Markdown (เผื่อ Claude แอบใส่ ```json มาให้)
  jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();

  return jsonString;
}

async function runPipeline() {
  const targetFilePath = "./sample_policy.txt";
  const currentOrgId = "org_technova_001";

  try {
    const extractedText = await extractTextFromDocument(targetFilePath);
    console.log(`✅ [Docling] ย่อยเอกสารสำเร็จ! ความยาว: ${extractedText.length} ตัวอักษร\n`);

    console.log("1️⃣ [Transform]: ส่งเนื้อหาเอกสารให้ AI สกัดข้อมูล...");
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

    const newPersonNode = graphData.entities.find((e: any) => e.type === "PERSON");

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