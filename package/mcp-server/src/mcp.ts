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

// 1. ประกาศรายชื่อเครื่องมือทั้งหมด (ของเดิม + ของใหม่)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // --- เครื่องมือเดิมที่มีอยู่แล้ว ---
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
        name: "get_timeline",
        description: "ดึงข้อมูลประวัติและไทม์ไลน์เหตุการณ์ทั้งหมดที่เกี่ยวข้องกับ Entity นั้นๆ",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string", description: "ชื่อ Entity ที่ต้องการดูประวัติ (ควรค้นหาจาก discover_nodes ก่อน)" }
          },
          required: ["entityName"]
        }
      },
      // --- เครื่องมือใหม่ 4 ตัวตาม Spec ---
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
            keyword: { type: "string", description: "คำค้นหาสั้นๆ" }
          },
          required: ["keyword"]
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
            context: { type: "string" }
          },
          required: ["subject", "predicate", "object", "context"]
        }
      },
      {
        name: "log_episode",
        description: "บันทึกเหตุการณ์ ประวัติการแชท หรือ Episode ลงในระบบความจำ",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "สรุปเหตุการณ์" },
            source: { type: "string", description: "แหล่งที่มาของเหตุการณ์ (เช่น chat)" }
          },
          required: ["summary"]
        }
      }
    ]
  };
});

// 2. จัดการเมื่อ Agent สั่งเรียกใช้เครื่องมือ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // --- ของเดิม ---
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

    else if (name === "get_timeline") {
      const response = await fetch(`${API_BASE_URL}/entity/${encodeURIComponent(String(args?.entityName))}/timeline`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // --- ของใหม่ ---
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
      // ใช้ POST ตาม API ที่เราเพิ่งสร้างใหม่ไป
      const response = await fetch(`${API_BASE_URL}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: args?.keyword })
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
          context: args?.context
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
          source: args?.source || "chat"
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