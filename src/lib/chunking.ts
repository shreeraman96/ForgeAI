interface ChunkResult {
  content: string;
  chunkIndex: number;
}

const DEFAULT_CHUNK_SIZE = 3200; // ~800 tokens (4 chars per token approx)
const DEFAULT_OVERLAP = 800; // ~200 tokens

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): ChunkResult[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  // Clean the text
  const cleaned = text.replace(/\n{3,}/g, "\n\n").trim();

  if (cleaned.length <= chunkSize) {
    return [{ content: cleaned, chunkIndex: 0 }];
  }

  const chunks: ChunkResult[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    // Try to break at a sentence boundary
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf(". ", end);
      const lastNewline = cleaned.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      // Only use the break point if it's within a reasonable range
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ content: chunk, chunkIndex });
      chunkIndex++;
    }

    // Move start forward, accounting for overlap
    start = end - overlap;
    if (start <= chunks[chunks.length - 1]?.content.length
      ? start
      : start) {
      // Avoid infinite loop
      if (start >= cleaned.length) break;
      if (end === cleaned.length) break;
    }
  }

  return chunks;
}
