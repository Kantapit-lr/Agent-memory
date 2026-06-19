import { file } from "bun";
import "dotenv/config";

const DOCLING_API_URL = process.env.DOCLING_API_URL || "http://localhost:5000/convert";

export async function extractTextFromDocument(filePath: string): Promise<string> {
  console.log(`📄 [Docling] กำลังโหลดไฟล์: ${filePath} ...`);
  
  const documentFile = file(filePath);
  if (!(await documentFile.exists())) {
    throw new Error(`ไม่พบไฟล์ที่ระบุ: ${filePath}`);
  }

  if (process.env.DOCLING_API_URL) {
    try {
      console.log(`🌐 [Docling] กำลังส่งไฟล์ไปที่ API: ${DOCLING_API_URL}`);
      const formData = new FormData();
      formData.append("file", documentFile);

      const response = await fetch(DOCLING_API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Docling API Error: ${response.statusText}`);
      }

      const result = await response.json() as any; 
      return result.markdown || result.text || "";
    } catch (error) {
      console.error("❌ [Docling] เชื่อมต่อ API ไม่สำเร็จ:", error);
      throw error;
    }
  }

  console.log("⚠️ [Docling] ยังไม่ได้ต่อ API จริง... จะทำการอ่าน Text ตรงๆ จากไฟล์เพื่อจำลองการทำงาน");
  const textContent = await documentFile.text();
  return textContent;
}