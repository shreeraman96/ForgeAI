import { prisma } from "@/lib/db";
import { parseFile } from "@/lib/parsers";
import { chunkText } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { insertChunkWithEmbedding } from "@/lib/vectors";
import { createId } from "@paralleldrive/cuid2";

export async function processDocument(documentId: string): Promise<void> {
  try {
    // Set status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    // Fetch document record
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new Error(`Document ${documentId} not found`);

    // Download file from blob storage
    const response = await fetch(doc.fileUrl);
    if (!response.ok) throw new Error("Failed to download file from storage");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine MIME type for image parser
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      image: "image/png",
    };

    // Parse the file to extract text
    const extractedText = await parseFile(
      buffer,
      doc.fileType,
      mimeMap[doc.fileType]
    );

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text could be extracted from the document");
    }

    // Save extracted text
    await prisma.document.update({
      where: { id: documentId },
      data: { extractedText },
    });

    // Chunk the text
    const chunks = chunkText(extractedText);

    // Generate embeddings in batches of 20
    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.content);
      const embeddings = await generateEmbeddings(texts);

      // Insert chunks with embeddings
      for (let j = 0; j < batch.length; j++) {
        await insertChunkWithEmbedding({
          id: createId(),
          content: batch[j].content,
          chunkIndex: batch[j].chunkIndex,
          pageNumber: null,
          documentId: doc.id,
          embedding: embeddings[j],
        });
      }
    }

    // Set status to READY
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });

    console.log(
      `Document ${documentId} processed: ${chunks.length} chunks created`
    );
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
