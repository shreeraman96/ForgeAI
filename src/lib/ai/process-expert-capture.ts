import { prisma } from "@/lib/db";
import { uploadVideoToGemini, analyzeExpertVideo } from "./gemini";
import { synthesizeExpertCapture } from "./expert-capture-synthesis";
import { generateExpertCaptureChunks } from "./expert-capture-text";
import { generateEmbeddings } from "./embeddings";
import { insertChunkWithEmbedding } from "@/lib/vectors";
import { createId } from "@paralleldrive/cuid2";

/**
 * Full Expert Capture processing pipeline.
 *
 * Mirrors the structure of process-document.ts: same PENDING → PROCESSING → READY
 * state machine, same batch embedding loop, same try/catch → FAILED pattern.
 *
 * Pipeline:
 *   1. Set status PROCESSING
 *   2. Obtain video buffer (from caller if provided, else download from Vercel Blob)
 *   3. Upload to Gemini Files API → fileUri
 *   4. Analyze with Gemini 2.0 Flash (visual + audio) → raw JSON
 *   5. Synthesize with Claude Sonnet 4.5 → ExpertKnowledgeDocument
 *   6. Save expertCaptureData + extractedText to Document record
 *   7. Generate semantic pre-chunks (one per procedure step, Q&A pair, etc.)
 *   8. Embed + insert in batches of 20
 *   9. Set status READY
 *
 * @param videoBuffer - Optional: pass the already-buffered video from the upload route
 *   to skip a redundant Blob re-download. Falls back to fetching doc.fileUrl when absent
 *   (e.g. when called from a background job / QStash webhook).
 *
 * NOTE: This runs as a fire-and-forget background task. On Vercel serverless,
 * background work after HTTP response is killed. Run locally or on a VPS for MVP.
 * Production fix: use Upstash QStash to call a dedicated processing webhook.
 */
export async function processExpertCapture(
  documentId: string,
  videoBuffer?: Buffer
): Promise<void> {
  try {
    // 1. Mark as PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    // 2. Fetch document record
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new Error(`Document ${documentId} not found`);
    if (doc.docType !== "EXPERT_CAPTURE") {
      throw new Error(`Document ${documentId} is not an EXPERT_CAPTURE`);
    }

    // 3. Obtain video buffer
    let buffer: Buffer;
    if (videoBuffer) {
      // Use the buffer passed directly from the upload route (avoids blob re-download)
      console.log(`[ExpertCapture] Using pre-buffered video for ${documentId}`);
      buffer = videoBuffer;
    } else {
      // Fallback: download from Vercel Blob (needed when called from a background job)
      console.log(`[ExpertCapture] Downloading video for ${documentId} from ${doc.fileUrl}`);
      const response = await fetch(doc.fileUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download video from Blob storage: ${response.status} ${response.statusText} (${doc.fileUrl})`
        );
      }
      buffer = Buffer.from(await response.arrayBuffer());
    }

    // 4. Upload to Gemini Files API
    console.log(`[ExpertCapture] Uploading to Gemini Files API...`);
    const mimeType = doc.mimeType || "video/mp4";
    const fileUri = await uploadVideoToGemini(buffer, mimeType, doc.fileName);
    console.log(`[ExpertCapture] Gemini file ready: ${fileUri}`);

    // 5. Analyze with Gemini 2.0 Flash
    console.log(`[ExpertCapture] Analyzing video with Gemini 2.0 Flash...`);
    const geminiAnalysisJson = await analyzeExpertVideo(
      fileUri,
      mimeType,
      doc.title || doc.fileName,
      doc.description || undefined
    );

    // 6. Synthesize with Claude Sonnet 4.5
    console.log(`[ExpertCapture] Synthesizing knowledge document with Claude Sonnet 4.5...`);
    const expertDocument = await synthesizeExpertCapture(geminiAnalysisJson, {
      title: doc.title || doc.fileName,
      description: doc.description || undefined,
      uploadedAt: doc.createdAt.toISOString(),
    });

    // 7. Save structured document and transcript to DB
    await prisma.document.update({
      where: { id: documentId },
      data: {
        expertCaptureData: expertDocument as object,
        extractedText: expertDocument.fullTranscript,
      },
    });

    // 8. Generate semantic pre-chunks
    console.log(`[ExpertCapture] Generating semantic chunks...`);
    const textChunks = generateExpertCaptureChunks(expertDocument);

    // 9. Embed and store in batches of 20
    const BATCH_SIZE = 20;
    for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
      const batch = textChunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.content);
      const embeddings = await generateEmbeddings(texts);

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

    // 10. Mark as READY
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });

    const procedureCount = textChunks.filter(
      (c) => c.chunkType === "procedure"
    ).length;
    const qaCount = textChunks.filter((c) => c.chunkType === "qa").length;
    console.log(
      `[ExpertCapture] Document ${documentId} processed: ${textChunks.length} chunks ` +
        `(${procedureCount} procedures, ${qaCount} Q&A pairs)`
    );
  } catch (error) {
    console.error(`[ExpertCapture] Error processing ${documentId}:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown error during expert capture processing",
      },
    });
  }
}
