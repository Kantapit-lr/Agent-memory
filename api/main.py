from fastapi import FastAPI
from pydantic import BaseModel
import psycopg2
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv
import os
import psycopg2.extras

load_dotenv()

# เชื่อมต่อ PostgreSQL
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD")
)
register_vector(conn)

app = FastAPI()

# Model รับข้อมูลจากเพื่อน
class DocumentInput(BaseModel):
    content: str
    metadata: dict = {}

class EmbeddingInput(BaseModel):
    document_id: int
    chunk_text: str
    embedding: list[float]

# API บันทึก document
@app.post("/documents")
def add_document(doc: DocumentInput):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (content, metadata) VALUES (%s, %s) RETURNING id",
            (doc.content, psycopg2.extras.Json(doc.metadata))
        )
        conn.commit()
        return {"id": cur.fetchone()[0]}

# API บันทึก embedding
@app.post("/embeddings")
def add_embedding(data: EmbeddingInput):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO embeddings (document_id, chunk_text, embedding) VALUES (%s, %s, %s)",
            (data.document_id, data.chunk_text, data.embedding)
        )
        conn.commit()
        return {"status": "ok"}

# API ค้นหา vector
@app.post("/search")
def search(query_embedding: list[float], limit: int = 5):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT chunk_text FROM embeddings ORDER BY embedding <=> %s LIMIT %s",
            (query_embedding, limit)
        )
        results = cur.fetchall()
        return {"results": [r[0] for r in results]}