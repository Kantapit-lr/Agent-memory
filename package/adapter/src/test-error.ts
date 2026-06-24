import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization" // หรือ path จริงที่มึงเก็บไฟล์ฟังก์ชันนี้
import { OrganizationNotFoundError } from "@/src/types/errors" // Path ที่เก็บ Error Class

// ใน test-error.ts ของมึง

async function testErrorHandling() {
  console.log("--- เริ่มรัน Test ---");
  const fakeId = "NON_EXISTENT_ID";
  
  try {
    const orgExists = await checkOrganizationExists({ organizationId: fakeId });
    
    if (!orgExists) {
      console.log("พบว่าไม่มีองค์กร... กำลังโยน Error...");
      throw new OrganizationNotFoundError(fakeId);
    }
    
    console.log("❌ Test Failed: โค้ดควรจะ Error แต่ดันผ่านไปได้");
  } catch (error) {
    if (error instanceof OrganizationNotFoundError) {
      console.log("✅ SUCCESS: ระบบจับ Error ได้จริง!");
      console.error("Error Message:", error.message);
      console.error("Error Code:", error.code);
    } else {
      console.log("❌ ERROR: ได้ Error ที่ไม่คาดคิด:", error);
    }
  }
  process.exit(0);
}

testErrorHandling();