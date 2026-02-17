import { prisma } from "@/lib/db";

export async function storeChunkWithEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE "DocumentChunk"
    SET embedding = ${vectorStr}::vector
    WHERE id = ${chunkId}
  `;
}

export async function insertChunkWithEmbedding(params: {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  documentId: string;
  embedding: number[];
}): Promise<void> {
  const vectorStr = `[${params.embedding.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO "DocumentChunk" (id, content, "chunkIndex", "pageNumber", "documentId", embedding, "createdAt")
    VALUES (
      ${params.id},
      ${params.content},
      ${params.chunkIndex},
      ${params.pageNumber},
      ${params.documentId},
      ${vectorStr}::vector,
      NOW()
    )
  `;
}

export interface SearchResult {
  chunkId: string;
  content: string;
  score: number;
  documentName: string;
  documentId: string;
  chunkIndex: number;
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  organizationId: string,
  topK: number = 5,
  similarityThreshold: number = 0.3
): Promise<SearchResult[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  const threshold = similarityThreshold;

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      dc.id as "chunkId",
      dc.content,
      dc."chunkIndex",
      d."fileName" as "documentName",
      d.id as "documentId",
      1 - (dc.embedding <=> ${vectorStr}::vector) as score
    FROM "DocumentChunk" dc
    JOIN "Document" d ON dc."documentId" = d.id
    WHERE d."organizationId" = ${organizationId}
      AND d.status = 'READY'
      AND 1 - (dc.embedding <=> ${vectorStr}::vector) > ${threshold}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `;

  return results;
}
