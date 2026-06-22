import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export async function extractGraphData(text: string, organizationId: string) {
  if (process.env.USE_MOCK_AI === "true") {
    console.log("⚠️ [MOCK MODE] กำลังจำลองผลลัพธ์การสกัดข้อมูล...");

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

  const response = await openai.chat.completions.create({
    model: "anthropic/claude-sonnet-4-6",
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Text to analyze: "${text}"` }
    ]
  });

  let jsonString = response.choices?.[0]?.message?.content || "";
  jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
  console.log(`✅ [Extractor] AI ประมวลผลและสกัด Graph Data เสร็จสิ้น`);

  return jsonString;
}