import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_BASE_URL = "http://localhost:3000/api/memory";

const server = new Server(
  {
    name: "Cognitive-4D-Memory-Gateway",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_memory",
        description: "ค้นหาข้อมูลเชิงลึกและข้อเท็จจริงจากฐานข้อมูลสมองกล (Graph+Vector) เพื่อตอบคำถาม",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string", description: "คำถามที่ต้องการค้นหา" },
            organizationId: { type: "string", description: "รหัสองค์กร (เช่น org_set_company)" }
          },
          required: ["question", "organizationId"]
        }
      },
      {
        name: "get_entity_timeline",
        description: "ดึงข้อมูลประวัติและไทม์ไลน์เหตุการณ์ทั้งหมดที่เกี่ยวข้องกับ Entity นั้นๆ จัดเรียงตามเวลา",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "รหัส ID ของ Entity (ต้องค้นหาจาก discover_nodes ก่อน)" },
            organizationId: { type: "string", description: "รหัสองค์กร (ถ้ามี)" },
            relationshipType: { type: "string", description: "ประเภทความสัมพันธ์ที่ต้องการกรอง (ถ้ามี)" }
          },
          required: ["entityId"]
        }
      },
      {
        name: "justify_intent",
        description: "วิเคราะห์คำถามของผู้ใช้เพื่อตัดสินใจว่า Agent ควรเรียกใช้ Tool อ่านข้อมูลตัวไหน",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "คำถามสดๆ จากผู้ใช้" }
          },
          required: ["query"]
        }
      },
      {
        name: "discover_nodes",
        description: "ค้นหารายชื่อ Entity จาก Keyword สั้นๆ เพื่อดึง ID ที่ถูกต้องก่อนนำไปค้นหาต่อ",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "คำค้นหาสั้นๆ" },
            organizationId: { type: "string", description: "รหัสองค์กร (ถ้ามี)" }
          },
          required: ["keyword"]
        }
      },
      {
        name: "get_code_dependencies",
        description: "ค้นหาความสัมพันธ์และผลกระทบของโค้ด (AST Graph) เช่น ถ้ารื้อฟังก์ชันนี้จะกระทบส่วนไหนบ้าง",
        inputSchema: {
          type: "object",
          properties: {
            organizationId: { type: "string", description: "รหัสองค์กร เช่น org_001" },
            entityId: { type: "string", description: "รหัสของ Function, Module หรือ Class ที่ต้องการค้นหา" },
            direction: { type: "string", description: "ทิศทาง (outgoing, incoming, both)", enum: ["outgoing", "incoming", "both"] },
            maxDepth: { type: "number", description: "ระดับความลึกในการไต่กราฟ (ค่าเริ่มต้น 3)" }
          },
          required: ["organizationId", "entityId"]
        }
      },
      {
        name: "memorize_fact",
        description: "ฝังความจำสั้นๆ หรือข้อเท็จจริงใหม่ลงใน Knowledge Graph",
        inputSchema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            predicate: { type: "string" },
            object: { type: "string" },
            context: { type: "string" },
            organizationId: { type: "string" }
          },
          required: ["subject", "predicate", "object", "context"]
        }
      },
      {
        name: "semantic_search",
        description: "ค้นหาข้อมูล บริบท หรือข้อเท็จจริงในอดีตจากฐานข้อมูล Vector โดยใช้ความหมายที่ใกล้เคียงกับคำถาม",
        inputSchema: {
          type: "object",
          properties: {
            organizationId: { type: "string", description: "รหัสองค์กร เช่น org_001" },
            query: { type: "string", description: "คำถามหรือคีย์เวิร์ดที่ต้องการค้นหา" },
            limit: { type: "number", description: "จำนวนผลลัพธ์ที่ต้องการ (ค่าเริ่มต้น 5)" }
          },
          required: ["organizationId", "query"]
        }
      },
      {
        name: "get_document_tree",
        description: "ดึงโครงสร้างเอกสารทั้งฉบับพร้อม Chunk ข้อความทั้งหมดเรียงตามลำดับ (Deterministic) เพื่อดูเนื้อหาเต็ม",
        inputSchema: {
          type: "object",
          properties: {
            organizationId: { type: "string", description: "รหัสองค์กร (ถ้าไม่ใส่จะใช้ค่าเริ่มต้น)" },
            documentId: { type: "string", description: "รหัสเอกสารต้นฉบับ เช่น doc_01" }
          },
          required: ["documentId"]
        }
      },
      {
        name: "log_episode",
        description: "บันทึกเหตุการณ์ ประวัติการแชท หรือ Episode ลงในระบบความจำ",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "สรุปเหตุการณ์" },
            source: { type: "string", description: "แหล่งที่มาของเหตุการณ์ (เช่น chat)" },
            organizationId: { type: "string", description: "รหัสองค์กร เช่น org_001" }
          },
          required: ["summary"]
        }
      },
      {
        name: "ingest_document",
        description: "อัปโหลดและนำเข้าเอกสาร/ไฟล์เข้าสู่ระบบเพื่อสกัดเป็น Knowledge Graph (ทำงานแบบ Async Background)",
        inputSchema: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
            documentId: { type: "string", description: "ตั้งรหัสให้เอกสาร เช่น doc_002" },
            title: { type: "string", description: "ชื่อเอกสาร" },
            type: { type: "string", description: "ประเภทไฟล์ (เช่น PDF, CODE, DOCX)" },
            file_url: { type: "string", description: "Path หรือ URL ของไฟล์ (ถ้ามี)" }
          },
          required: ["documentId", "title"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "query_memory") {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: args?.question,
          organizationId: args?.organizationId,
          activeOnly: false,
          clearanceLevel: 4
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "get_entity_timeline") {
      const response = await fetch(`${API_BASE_URL}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: args?.entityId,
          organizationId: args?.organizationId,
          relationshipType: args?.relationshipType
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "justify_intent") {
      const response = await fetch(`${API_BASE_URL}/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: args?.query })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "discover_nodes") {
      const response = await fetch(`${API_BASE_URL}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          keyword: args?.keyword,
          organizationId: args?.organizationId
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "memorize_fact") {
      const response = await fetch(`${API_BASE_URL}/memorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: args?.subject,
          predicate: args?.predicate,
          object: args?.object,
          context: args?.context,
          organizationId: args?.organizationId
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "log_episode") {
      const response = await fetch(`${API_BASE_URL}/episode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: args?.summary,
          source: args?.source || "chat",
          organizationId: args?.organizationId
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "get_code_dependencies") {
      const response = await fetch(`${API_BASE_URL}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: args?.organizationId,
          entityId: args?.entityId,
          direction: args?.direction,
          maxDepth: args?.maxDepth
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "semantic_search") {
      const response = await fetch(`${API_BASE_URL}/semantic_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: args?.organizationId,
          query: args?.query,
          limit: args?.limit
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "get_document_tree") {
      const docId = encodeURIComponent(String(args?.documentId));
      let url = `${API_BASE_URL}/document/${docId}/tree`;
      
      if (args?.organizationId) {
        url += `?orgId=${encodeURIComponent(String(args?.organizationId))}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "ingest_document") {
      const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: args?.organizationId,
          documentId: args?.documentId,
          title: args?.title,
          type: args?.type,
          file_url: args?.file_url
        })
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else {
      throw new Error(`ไม่รู้จักเครื่องมือที่ชื่อ: ${name}`);
    }

  } catch (error: any) {
    return {
      content: [{ type: "text", text: `เกิดข้อผิดพลาดในการเรียกใช้ Tool: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🦊 MCP Agent Gateway is running on stdio!");
}

main().catch((error) => {
  console.error("MCP Server Error:", error);
  process.exit(1);
});