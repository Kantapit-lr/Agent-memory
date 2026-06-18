export interface TextChunk {
  id: string;
  text: string;
  sequence_order: number;
}

/**
 * @param text
 * @param maxChunkSize
 * @param overlapSize
 */

export function chunkText(
  text: string, 
  maxChunkSize: number = 2000, 
  overlapSize: number = 200
): TextChunk[] {
  
  if (!text || text.trim() === "") return [];

  const chunks: TextChunk[] = [];
  let currentStartIndex = 0;
  let sequence = 1;

  while (currentStartIndex < text.length) {
    let currentEndIndex = currentStartIndex + maxChunkSize;

    if (currentEndIndex < text.length) {
      const lastSpaceIndex = text.lastIndexOf(" ", currentEndIndex);
      const lastNewlineIndex = text.lastIndexOf("\n", currentEndIndex);
      
      const bestCutPoint = Math.max(lastSpaceIndex, lastNewlineIndex);
      if (bestCutPoint > currentStartIndex + (maxChunkSize / 2)) {
        currentEndIndex = bestCutPoint;
      }
    }

    const chunkContent = text.substring(currentStartIndex, currentEndIndex).trim();
    
    if (chunkContent.length > 0) {
      chunks.push({
        id: `chunk_${Date.now()}_${sequence}`,
        text: chunkContent,
        sequence_order: sequence
      });
      sequence++;
    }

    currentStartIndex = currentEndIndex - overlapSize;
    
    if (currentStartIndex <= 0 || currentEndIndex >= text.length) {
      currentStartIndex = currentEndIndex; 
    }
  }

  return chunks;
}

//ฟังก์ชันทดสอบการหั่น (เอาไว้รันดูผลลัพธ์บน Terminal)
if (import.meta.main) {
  const sampleLongText = `
    บริษัท TechNova ก่อตั้งขึ้นในปี 2020 โดยมีวัตถุประสงค์เพื่อพัฒนาระบบ AI สำหรับองค์กร 
    ปัจจุบันบริษัทมีพนักงานมากกว่า 500 คนทั่วโลก 
    นายสมชาย วงศ์สว่าง เป็น CEO ของ TechNova เขาได้ประกาศวิสัยทัศน์ใหม่ในปี 2026 
    ว่าจะนำองค์กรก้าวสู่การเป็นผู้นำด้าน Cognitive Architecture 
    ระบบนี้จะช่วยประมวลผลข้อมูลมหาศาลได้อย่างรวดเร็วและปลอดภัย
  `.repeat(5);

  console.log(`📄 ความยาวข้อความทั้งหมด: ${sampleLongText.length} ตัวอักษร`);
  
  const result = chunkText(sampleLongText, 200, 50);
  
  console.log(`✂️ หั่นออกมาได้ทั้งหมด: ${result.length} Chunks`);
  result.forEach(chunk => {
    console.log(`\n--- [Chunk ${chunk.sequence_order}] (ยาว ${chunk.text.length} ตัวอักษร) ---`);
    console.log(chunk.text);
  });
}