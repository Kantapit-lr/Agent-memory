import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface IntentResponse {
  recommended_tool: "semantic_search" | "get_document_tree" | "get_entity_timeline" | "get_code_dependencies" | "discover_nodes" | "unknown";
  confidence: number;
  reason: string;
  extracted_keywords: string[];
}

export async function justifyIntent(userQuery: string): Promise<IntentResponse> {
  const systemPrompt = `
You are the "Dispatcher" for the Cognitive 4D Memory Layer. 
Your job is to analyze the user's query and decide WHICH READ TOOL the AI Agent should use.
You MUST respond in valid JSON format ONLY.

AVAILABLE TOOLS:
1. "get_document_tree": Use when the user asks for structural data, full content, or exact details of a specific document (e.g., "How many sections are in this TOR?", "Summarize this specific PDF").
2. "semantic_search": Use when the user asks for concepts, ideas, or searches across multiple documents (e.g., "Find policies related to Japan", "What is our product roadmap?").
3. "get_entity_timeline": Use when the user asks about the history, timeline, or past events of a specific person, organization, or project (e.g., "When did Mr. A join the board?", "What is the history of this project?").
4. "get_code_dependencies": Use when the user asks about software code impact, AST, or what happens if a function is changed (e.g., "If I rewrite the Auth API, what will break?").
5. "discover_nodes": Use when the user asks to identify a specific entity but the exact name is unclear (e.g., "Who was that IT guy again?").

Respond ONLY with this JSON schema:
{
  "recommended_tool": "<tool_name_from_list>",
  "confidence": <number_between_0.0_and_1.0>,
  "reason": "<short_explanation_why>",
  "extracted_keywords": ["<keyword1>", "<keyword2>"]
}
`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", // ใช้ Sonnet
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: `User Query: "${userQuery}"` }],
    });
    const responseText = (msg.content[0] as any).text;
    const jsonMatch = responseText.match(/\{.*\}/s);
    return JSON.parse(jsonMatch[0]) as IntentResponse;
    
  } catch (error) {
    console.error("Error in justifyIntent:", error);
    return {
      recommended_tool: "unknown",
      confidence: 0,
      reason: "Error processing intent",
      extracted_keywords: []
    };
  }
}