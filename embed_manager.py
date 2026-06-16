from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings

load_dotenv()

def get_embedding_model():
    """
    ฟังก์ชันสำหรับเรียกใช้งานโมเดลแปลงข้อความเป็น Vector (Embedding)
    โดยใช้โมเดลฟรีของ Google Gemini
    """
    
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        output_dimensionality=768
    )
    return embeddings

# --- ส่วนทดสอบการทำงาน ---
if __name__ == "__main__":
    embed_model = get_embedding_model()
    
    test_text = "ทดสอบการแปลงข้อมูลระบบความจำ Agent เป็นตัวเลข Vector"
    
    vector_result = embed_model.embed_query(test_text)
    
    print("✅ การเชื่อมต่อกับ Google Gemini API สำเร็จ!")
    print(f"ความยาวของ Vector ที่ได้คือ: {len(vector_result)} มิติ")
    print(f"ตัวอย่างหน้าตาตัวเลข 5 ตัวแรก: {vector_result[:5]}")