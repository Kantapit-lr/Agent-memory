from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
from psycopg2 import pool
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv
import os
import psycopg2.extras

load_dotenv()

# เชื่อมต่อ PostgreSQL
# conn = psycopg2.connect(
#     host="localhost",
#     port=5432,
#     database=os.getenv("DB_NAME"),
#     user=os.getenv("DB_USER"),
#     password=os.getenv("DB_PASSWORD")
# )
# register_vector(conn)

connection_pool = pool.ThreadedConnectionPool(
    1, 10,
    host="localhost",
    port=5432,
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD")
)
app = FastAPI()


# ฟังก์ชันตัวช่วยดึง Connection และ Register Vector ให้พร้อมใช้
def get_db_connection():
    conn = connection_pool.getconn()
    # ลงทะเบียน vector type ไว้เสมอ เพื่อให้ใช้งานได้ทั้งตอน Insert และ Select
    register_vector(conn)
    return conn


# Model รับข้อมูลจากเพื่อน
class DocumentInput(BaseModel):
    content: str
    metadata: dict = {}

class EmbeddingInput(BaseModel):
    document_id: int
    chunk_text: str
    embedding: list[float]

class SearchInput(BaseModel):
    query_embedding: list[float]
    limit: int = 5

# API บันทึก document
@app.post("/documents")
def add_document(doc: DocumentInput):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO documents (content, metadata) VALUES (%s, %s) RETURNING id",
                (doc.content, psycopg2.extras.Json(doc.metadata))
            )
            conn.commit()
            return {"id": cur.fetchone()[0]}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:    
        connection_pool.putconn(conn)

# API บันทึก embedding
@app.post("/embeddings")
def add_embedding(data: EmbeddingInput):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO embeddings (document_id, chunk_text, embedding) VALUES (%s, %s, %s)",
                (data.document_id, data.chunk_text, data.embedding)
            )
            conn.commit()
            return {"status": "ok"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:    
        connection_pool.putconn(conn)

# API ค้นหา vector
@app.post("/search")
def search(data: SearchInput):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT chunk_text FROM embeddings ORDER BY embedding <=> %s::vector LIMIT %s",
                (data.query_embedding, data.limit)
            )
            results = cur.fetchall()
            return {"results": [r[0] for r in results]}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:    
        connection_pool.putconn(conn)