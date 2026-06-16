import bs4
from dotenv import load_dotenv
load_dotenv()
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader
import re

def load_data_from_pdf(file_path: str):
    """
    ฟังก์ชันสำหรับอ่านข้อมูลจากไฟล์ PDF
    """
    print(f"กำลังอ่านไฟล์ PDF จาก: {file_path}")
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    
    raw_text = "\n".join([doc.page_content for doc in documents])
    return raw_text

def load_data_from_website(url: str):
    """
    ฟังก์ชันสำหรับดูดข้อมูลตัวอักษรจากหน้าเว็บไซต์ (แบบกรองขยะออกแล้ว)
    """
    print(f"กำลังดูดข้อมูลจากเว็บไซต์: {url}")
    
    custom_strainer = bs4.SoupStrainer(["p", "h1", "h2", "h3"])
    
    loader = WebBaseLoader(
        url,
        bs_kwargs={"parse_only": custom_strainer}
    )
    documents = loader.load()
    
    raw_text = "\n".join([doc.page_content for doc in documents])
    clean_text = re.sub(r'\n\s*\n', '\n\n', raw_text)
    
    return clean_text.strip()

# --- ส่วนทดสอบการทำงาน ---
if __name__ == "__main__":
    print("--- ทดสอบระบบดูดข้อมูล ---")
    
    # 🔴ทดสอบ Website
    sample_url = "https://en.wikipedia.org/wiki/Bamboo_diplomacy"
    web_text = load_data_from_website(sample_url)
    print(f"ดูดข้อความจากเว็บสำเร็จ! ความยาว: {len(web_text)} ตัวอักษร")
    print(f"ตัวอย่างข้อความ:\n {web_text[:300]}...\n")

    # 🔵ทดสอบ PDF
    # sample_pdf = "lumira_profile.pdf" 
    # pdf_text = load_data_from_pdf(sample_pdf)
    
    # print(f"\nดูดข้อความจาก PDF สำเร็จ! ความยาว: {len(pdf_text)} ตัวอักษร")
    # print(f"ตัวอย่างข้อความ:\n{pdf_text[:300]}...")