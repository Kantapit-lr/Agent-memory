import os
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

# โหลด API Key
load_dotenv()

def extract_graph_data(text_chunk: str):
    """
    ฟังก์ชันสำหรับให้ AI อ่านข้อความแล้วสกัด Nodes และ Edges ออกมาในรูปแบบ JSON
    """
    print(f"กำลังให้ AI วิเคราะห์ความสัมพันธ์... (ความยาวข้อความ: {len(text_chunk)} ตัวอักษร)")
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.5-flash", 
        temperature=0,
        max_retries=2,
        timeout=30
    )
    
    prompt_template = """
    คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์ข้อมูลและสร้าง Knowledge Graph 
    จงอ่านข้อความต่อไปนี้และสกัด "รายชื่อสิ่งของ/บุคคล (Nodes)" และ "ความสัมพันธ์ (Edges)" ออกมา
    
    ข้อความ:
    "{text}"
    
    ข้อกำหนด:
    1. Nodes ควรมี id (ชื่อ) และ type (ประเภท เช่น Person, Organization, Concept)
    2. Edges ควรมี source (จุดเริ่มต้น), target (จุดหมาย), และ relation (ความสัมพันธ์)
    3. ตอบกลับมาเป็นโครงสร้าง JSON เท่านั้น ห้ามมีข้อความอื่นปน
    
    ตัวอย่าง JSON ที่ต้องการ:
    {{
        "nodes": [
            {{"id": "สมชาย", "type": "Person"}},
            {{"id": "บริษัท A", "type": "Organization"}}
        ],
        "edges": [
            {{"source": "สมชาย", "target": "บริษัท A", "relation": "ทำงานที่"}}
        ]
    }}
    """
    
    prompt = PromptTemplate.from_template(prompt_template)
    
    chain = prompt | llm | StrOutputParser() 
    
    try:
        result = chain.invoke({"text": text_chunk})
        
        clean_result = result.strip() # ไม่ต้องมี .content แล้ว

        if clean_result.startswith("```json"):
            clean_result = clean_result[7:-3].strip()
        elif clean_result.startswith("```"):
            clean_result = clean_result[3:-3].strip()
        graph_data = json.loads(clean_result)
        return graph_data
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการสกัด Graph: {e}")
        return {"nodes": [], "edges": []}

# --- ส่วนทดสอบการทำงาน ---
if __name__ == "__main__":
    test_text = """
    Bamboo diplomacy is a political concept. 
    Thailand used Bamboo diplomacy to survive during World War II.
    """
    
    print("--- ทดสอบการสกัด Graph ---")
    result_data = extract_graph_data(test_text)
    
    print("\n✅ ผลลัพธ์ที่ได้จาก AI:")
    print(json.dumps(result_data, indent=2, ensure_ascii=False))