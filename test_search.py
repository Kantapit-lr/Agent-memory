import requests
from embed_manager import get_embedding_model
import json

base_url = "https://urging-overboard-generic.ngrok-free.dev"
headers = {"ngrok-skip-browser-warning": "true"}

user_question = "What is Bamboo Diplomacy?"
print(f"คำถาม: '{user_question}'")

print("กำลังแปลงคำถามเป็น Vector...")
embed_model = get_embedding_model()
question_vector = embed_model.embed_query(user_question)

search_payload = {
    "query_embedding": question_vector, 
    "limit": 2 
}

print(f"กำลังส่ง Vector ไปค้นหาใน Database ของเพื่อน...")
try:
    response = requests.post(f"{base_url}/search", json=search_payload, headers=headers)
    response.raise_for_status()
    
    results = response.json()
    print("\n🎉 ค้นหาสำเร็จ! ผลลัพธ์ที่เพื่อนส่งกลับมาคือ:")
    print(json.dumps(results, indent=2, ensure_ascii=False))
    
except requests.exceptions.HTTPError as e:
    print(f"❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: {e}")

    print(f"🔍 คำใบ้จาก Backend: {e.response.text}") 
except Exception as e:
    print(f"❌ เกิดข้อผิดพลาดอื่นๆ: {e}")