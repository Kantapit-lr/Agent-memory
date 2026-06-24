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
        name: "discover_entity",
        description: "ค้นหารายชื่อบริษัท, บุคคล, หรือ Entity ที่มีอยู่ในระบบจาก Keyword สั้นๆ เพื่อดึง ID ที่ถูกต้อง",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "คำค้นหาสั้นๆ (เช่น โฟร์ยูทู)" },
            orgId: { type: "string", description: "รหัสองค์กร (ใส่หรือไม่ใส่ก็ได้)" }
          },
          required: ["keyword"]
        }
      },
      {
        name: "get_timeline",
        description: "ดึงข้อมูลประวัติและไทม์ไลน์เหตุการณ์ทั้งหมดที่เกี่ยวข้องกับ Entity นั้นๆ",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string", description: "ชื่อ Entity ที่ต้องการดูประวัติ (ควรค้นหาจาก discover_entity ก่อน)" }
          },
          required: ["entityName"]
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
    
    else if (name === "discover_entity") {
      const url = new URL(`${API_BASE_URL}/discover`);
      url.searchParams.append("keyword", String(args?.keyword));
      if (args?.orgId) url.searchParams.append("orgId", String(args?.orgId));
      
      const response = await fetch(url.toString());
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    else if (name === "get_timeline") {
      const response = await fetch(`${API_BASE_URL}/entity/${encodeURIComponent(String(args?.entityName))}/timeline`);
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