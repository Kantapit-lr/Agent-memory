from langchain_text_splitters import RecursiveCharacterTextSplitter

def get_text_chunks(raw_text: str, chunk_size: int = 500, chunk_overlap: int = 50):
    """
    ฟังก์ชันสำหรับหั่นข้อความยาวๆ ให้เป็นชิ้นย่อยๆ (Chunks)
    
    Args:
        raw_text (str): ข้อความต้นฉบับ
        chunk_size (int): ความยาวสูงสุดของตัวอักษรในแต่ละก้อน
        chunk_overlap (int): จำนวนตัวอักษรที่ยอมให้แต่ละก้อนเกยทับกัน
        
    Returns:
        list: รายการของข้อความที่ถูกหั่นแล้ว
    """

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""] 
    )
    chunks = text_splitter.split_text(raw_text)
    
    return chunks

# --- ส่วนทดสอบการทำงาน ---
if __name__ == "__main__":
    sample_text = """
    ระบบ Agent Memory คือการทำให้ AI มีความจำระยะยาว โดยการใช้เทคโนโลยี RAG (Retrieval-Augmented Generation)
    ข้อมูลที่ AI ควรรู้จะถูกนำมาหั่นเป็นชิ้นเล็กๆ เรียกว่า Chunk จากนั้นจะถูกนำไปแปลงเป็นตัวเลข Vector 
    และจัดเก็บลงในฐานข้อมูล Vector Database อย่างเช่น PostgreSQL 
    เมื่อผู้ใช้ถามคำถาม ระบบจะไปค้นหา Chunk ที่เกี่ยวข้องที่สุดมาให้ AI อ่านเพื่อตอบคำถาม
    """
    
    result_chunks = get_text_chunks(sample_text, chunk_size=100, chunk_overlap=20)
    
    print(f"✅ หั่นข้อความได้ทั้งหมด {len(result_chunks)} ชิ้น\n")
    for i, chunk in enumerate(result_chunks):
        print(f"--- ชิ้นที่ {i+1} ---")
        print(chunk)
        print("-" * 15)