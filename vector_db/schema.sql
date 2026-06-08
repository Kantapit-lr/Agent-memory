-- เปิดใช้ pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- เก็บเอกสารต้นฉบับ
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- เก็บ vector ของแต่ละ chunk
CREATE TABLE embeddings (
    id SERIAL PRIMARY KEY,
    document_id INT REFERENCES documents(id),
    chunk_text TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW()
);

-- เก็บ entity สำหรับ GraphRAG
CREATE TABLE entities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    metadata JSONB
);

-- เก็บความสัมพันธ์ระหว่าง entity
CREATE TABLE relationships (
    id SERIAL PRIMARY KEY,
    source_id INT REFERENCES entities(id),
    target_id INT REFERENCES entities(id),
    relation_type TEXT NOT NULL,
    metadata JSONB
);