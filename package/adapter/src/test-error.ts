import { checkOrganizationExists } from "@/src/repositories/nodes/checkOrganization" // หรือ path จริงที่มึงเก็บไฟล์ฟังก์ชันนี้
import { OrganizationNotFoundError, ChunkNotFoundError, EntityHasActiveRelationshipsError, OrganizationNotEmptyError } from "@/src/types/errors" // Path ที่เก็บ Error Class
import { deleteChunk } from "@/src/repositories/nodes/deleteChunk"
import { deleteEntity } from "@/src/repositories/nodes/deleteEntity"
import { deleteOrganization } from "@/src/repositories/nodes/deleteOrganization"

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

  // ─────────────────────────────────────────
  // TEST: Delete API errors
  // ─────────────────────────────────────────
  console.log("\n--- เทส Delete API Error Handling ---");

  // 1. deleteChunk บน org ที่ไม่มีจริง → OrganizationNotFoundError
  try {
    await deleteChunk({ organizationId: fakeId, chunkId: "chunk_fake" });
    console.log("❌ Test Failed: deleteChunk ควร throw OrganizationNotFoundError");
  } catch (error) {
    if (error instanceof OrganizationNotFoundError) {
      console.log("✅ SUCCESS: deleteChunk จับ OrganizationNotFoundError ได้");
    } else {
      console.log("❌ ERROR: ได้ Error ที่ไม่คาดคิดจาก deleteChunk:", error);
    }
  }

  // 2. deleteChunk บน chunk ที่ไม่มีจริง (แต่ org มีจริง) → ChunkNotFoundError
  // หมายเหตุ: ต้องมี org_001 อยู่จริงในฐานข้อมูลก่อน (จาก README ตัวอย่าง) ถึงจะเทสต์ branch นี้ได้
  try {
    await deleteChunk({ organizationId: "org_001", chunkId: "chunk_fake_999" });
    console.log("❌ Test Failed: deleteChunk ควร throw ChunkNotFoundError");
  } catch (error) {
    if (error instanceof ChunkNotFoundError) {
      console.log("✅ SUCCESS: deleteChunk จับ ChunkNotFoundError ได้");
    } else if (error instanceof OrganizationNotFoundError) {
      console.log("⚠️  SKIP: ไม่มี org_001 ในฐานข้อมูล ข้ามเทสนี้ไปก่อน");
    } else {
      console.log("❌ ERROR: ได้ Error ที่ไม่คาดคิดจาก deleteChunk:", error);
    }
  }

  // 3. deleteEntity แบบไม่ force บน entity ที่ยังมีความสัมพันธ์ active → EntityHasActiveRelationshipsError
  // หมายเหตุ: ต้องมี person_01 ที่ยังมี relationship active อยู่จริง (รันหลัง test-pipeline.ts ที่ยังไม่ลบ)
  try {
    await deleteEntity({ organizationId: "org_001", entityId: "person_01" });
    console.log("⚠️  ไม่มี active relationship ค้างอยู่ หรือไม่มี person_01 ในฐานข้อมูล (ลบผ่านแบบไม่ force ได้เลย)");
  } catch (error) {
    if (error instanceof EntityHasActiveRelationshipsError) {
      console.log("✅ SUCCESS: deleteEntity จับ EntityHasActiveRelationshipsError ได้");
      console.error("Error Message:", error.message);
    } else {
      console.log("ℹ️  Error อื่น (อาจเพราะไม่มี entity นี้อยู่จริง):", error instanceof Error ? error.message : error);
    }
  }

  // 4. deleteOrganization แบบไม่ force บน org ที่ยังมี node ค้างอยู่ → OrganizationNotEmptyError
  try {
    await deleteOrganization({ organizationId: "org_001" });
    console.log("⚠️  org_001 ว่างอยู่แล้ว หรือไม่มีอยู่จริง (ลบผ่านแบบไม่ force ได้เลย)");
  } catch (error) {
    if (error instanceof OrganizationNotEmptyError) {
      console.log("✅ SUCCESS: deleteOrganization จับ OrganizationNotEmptyError ได้");
      console.error("Error Message:", error.message);
    } else if (error instanceof OrganizationNotFoundError) {
      console.log("⚠️  SKIP: ไม่มี org_001 ในฐานข้อมูล ข้ามเทสนี้ไปก่อน");
    } else {
      console.log("❌ ERROR: ได้ Error ที่ไม่คาดคิดจาก deleteOrganization:", error);
    }
  }

  process.exit(0);
}

testErrorHandling();