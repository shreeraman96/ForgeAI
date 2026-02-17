-- Run this after prisma migrate dev to set up pgvector
-- This creates the vector similarity search index for document chunks

CREATE EXTENSION IF NOT EXISTS vector;

-- Create IVFFlat index for cosine similarity search
-- This dramatically speeds up nearest-neighbor queries
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_idx"
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
