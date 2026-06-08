from data_loader import load_data_from_website, load_data_from_pdf
from text_chunker import get_text_chunks
from embed_manager import get_embedding_model
from graph_extractor import extract_graph_data
import time
import requests

def run_data_pipeline(raw_text: str):
    print("🚀 เริ่มต้นกระบวนการ Data Pipeline (Vector + Graph)...\n")
    
    print("[1/4] กำลังหั่นข้อความ...")
    chunks = get_text_chunks(raw_text, chunk_size=500, chunk_overlap=50) 
    print(f"      ✅ หั่นเสร็จแล้ว ได้ทั้งหมด {len(chunks)} ชิ้น\n")
    
    print("[2/4] กำลังเชื่อมต่อสมอง AI (Embedding Model)...")
    embed_model = get_embedding_model()
    print("      ✅ เชื่อมต่อสำเร็จ\n")
    
    print("[3/4] กำลังประมวลผล (แปลง Vector และสกัด Graph) ทีละชิ้น...")
    prepared_data = [] 
    
    for i, chunk in enumerate(chunks):
        print(f"      ⏳ กำลังจัดการชิ้นที่ {i+1}/{len(chunks)}...")

        vector = embed_model.embed_query(chunk)
        graph_data = extract_graph_data(chunk)
        
        data_package = {
            "chunk_id": i + 1,
            "text": chunk,
            "embedding": vector,
            "graph_nodes": graph_data.get("nodes", []),
            "graph_edges": graph_data.get("edges", [])
        }
        prepared_data.append(data_package)
        print(f"      📦 แพ็กชิ้นที่ {i+1} เสร็จเรียบร้อย!\n")
        time.sleep(3)
        
    print(f"🎉 กระบวนการ Data Pipeline เสร็จสมบูรณ์! ได้ข้อมูลพร้อมส่งทั้งหมด {len(prepared_data)} กล่อง")
    return prepared_data

def send_to_backend(prepared_data: list, source_name: str):
    print("\n🚀 [API] เริ่มต้นการส่งข้อมูลไปให้เพื่อน (Backend)...")
    
    base_url = "https://urging-overboard-generic.ngrok-free.dev"
    
    headers = {"ngrok-skip-browser-warning": "true"}
    
    all_nodes = []
    all_edges = []
    for item in prepared_data:
        all_nodes.extend(item.get("graph_nodes", []))
        all_edges.extend(item.get("graph_edges", []))
        
    doc_payload = {
        "content": f"ข้อมูลอิมพอร์ตจาก: {source_name}",
        "metadata": {
            "source": source_name,
            "total_chunks": len(prepared_data),
            "graph_nodes": all_nodes,
            "graph_edges": all_edges
        }
    }
    
    print(f"   ➤ 1. กำลังสร้างเอกสารใหม่ที่ /documents ...")
    try:
        doc_response = requests.post(f"{base_url}/documents", json=doc_payload, headers=headers)
        doc_response.raise_for_status() 
        
        doc_data = doc_response.json()
        document_id = doc_data.get("document_id") or doc_data.get("id")
        
        if not document_id:
            print("   ❌ Error: เพื่อนไม่ได้ส่ง ID กลับมาให้ หรือชื่อ Key ไม่ตรง!")
            print(f"      ข้อมูลที่เพื่อนตอบกลับ: {doc_data}")
            return
            
        print(f"   ✅ สำเร็จ! ได้ Document ID มาแล้วคือ: {document_id}")
        
    except requests.exceptions.HTTPError as e:
        print(f"   ❌ เกิดข้อผิดพลาดตอนยิง /documents : {e}")

        if e.response is not None:
             print(f"   🔍 คำใบ้จาก Backend: {e.response.text}")
        return
    except Exception as e:
        print(f"   ❌ เกิดข้อผิดพลาดอื่นๆ : {e}")
        return

    print(f"\n   ➤ 2. กำลังทยอยส่ง Vector ทั้ง {len(prepared_data)} ชิ้น ไปที่ /embeddings ...")
    success_count = 0
    
    for chunk in prepared_data:
        embed_payload = {
            "document_id": document_id,
            "chunk_text": chunk["text"],
            "embedding": chunk["embedding"]
        }
        try:
            embed_response = requests.post(f"{base_url}/embeddings", json=embed_payload, headers=headers)
            embed_response.raise_for_status()
            success_count += 1
            print(f"      ✅ ส่งชิ้นที่ {chunk['chunk_id']} สำเร็จ!")
        except Exception as e:
            print(f"      ❌ ส่งชิ้นที่ {chunk['chunk_id']} ล้มเหลว: {e}")
            
    print(f"\n🎉 ส่งข้อมูลขึ้น Database สำเร็จทั้งหมด {success_count}/{len(prepared_data)} ชิ้น!")

# --- ส่วนทดสอบการทำงาน ---
if __name__ == "__main__":
    target_url = "https://en.wikipedia.org/wiki/Bamboo_diplomacy"
    print(f"🌐 กำลังโหลดข้อมูลจาก: {target_url}")
    scraped_text = load_data_from_website(target_url)
    
    # target_pdf = "lumira_profile.pdf"
    # print(f"📄 กำลังโหลดข้อมูลจากไฟล์: {target_pdf}")
    # scraped_text = load_data_from_pdf(target_pdf)
    
    final_data_to_send = run_data_pipeline(scraped_text)

    send_to_backend(final_data_to_send, target_url)