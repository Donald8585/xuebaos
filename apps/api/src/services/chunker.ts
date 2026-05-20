/**
 * Semantic text chunker for loci generation pipeline.
 * Splits text into LLM-friendly chunks with overlap for context continuity.
 *
 * Strategy:
 *  1. Split on section headings (Markdown H1-H6 or ALLCAPS lines)
 *  2. Within sections, split on paragraph boundaries
 *  3. Group paragraphs into target token windows (1500-3000 tokens)
 *  4. Maintain ~150 char overlap between chunks
 */

export interface ChunkResult {
  chunkId: string;
  sequenceIndex: number;
  text: string;
  tokenCount: number;
  sectionTitle?: string;
}

const TARGET_CHUNK_TOKENS = 2000;
const MIN_CHUNK_TOKENS = 400;
const MAX_CHUNK_TOKENS = 3000;
const OVERLAP_CHARS = 150;

/** Simple token estimator: ~4 chars per token for English/混合文本 */
export function estimateTokens(text: string): number {
  // CJK characters ≈ 1.5 tokens, Latin ≈ 0.25 tokens
  // Averaging to ~4 chars per token is close enough for chunk sizing
  return Math.ceil(text.length / 4);
}

/** Detect section headings: # H1-H6, or ALLCAPS short lines, or === --- underline styles */
function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Markdown heading
  if (/^#{1,6}\s/.test(trimmed)) return true;
  // ALLCAPS short line (likely a heading)
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 100
      && /[A-Z]/.test(trimmed) && !/^\d+$/.test(trimmed)) return true;
  // Underline style
  if (/^=+$/.test(trimmed) || /^-+$/.test(trimmed)) return true;
  return false;
}

interface Section {
  title?: string;
  paragraphs: string[];
}

/** Split text into sections by heading boundaries */
function splitIntoSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentSection: Section = { paragraphs: [] };
  let currentParagraph = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip underline-only lines (belong to previous heading)
    if (/^(=+|-+)$/.test(trimmed) && i > 0 && isHeading(lines[i - 1])) {
      continue;
    }

    // Heading detected — start new section
    if (isHeading(line)) {
      // Flush current paragraph
      if (currentParagraph.trim()) {
        currentSection.paragraphs.push(currentParagraph.trim());
        currentParagraph = "";
      }
      // Save previous section if it has content
      if (currentSection.paragraphs.length > 0) {
        sections.push(currentSection);
      }
      const title = trimmed.replace(/^#{1,6}\s*/, "").slice(0, 200);
      currentSection = { title, paragraphs: [] };
      continue;
    }

    // Blank line → paragraph boundary
    if (!trimmed) {
      if (currentParagraph.trim()) {
        currentSection.paragraphs.push(currentParagraph.trim());
        currentParagraph = "";
      }
      continue;
    }

    // Accumulate paragraph
    currentParagraph += (currentParagraph ? " " : "") + line;
  }

  // Flush final paragraph + section
  if (currentParagraph.trim()) {
    currentSection.paragraphs.push(currentParagraph.trim());
  }
  if (currentSection.paragraphs.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Chunk text into LLM-friendly segments.
 * Returns array of chunks with IDs, sequence indices, and metadata.
 */
export function chunkText(plaintext: string, jobId: string): ChunkResult[] {
  const sections = splitIntoSections(plaintext);
  const chunks: ChunkResult[] = [];
  let seqIndex = 0;

  for (const section of sections) {
    const sectionChunks = chunkSection(section, jobId, seqIndex);
    chunks.push(...sectionChunks);
    seqIndex += sectionChunks.length;
  }

  // If no chunks produced (empty text or only headings), create one empty-ish chunk
  if (chunks.length === 0 && plaintext.trim().length > 0) {
    chunks.push({
      chunkId: `${jobId}-c${seqIndex}`,
      sequenceIndex: seqIndex,
      text: plaintext.trim().slice(0, MAX_CHUNK_TOKENS * 4),
      tokenCount: estimateTokens(plaintext.trim()),
    });
  }

  return chunks;
}

/** Chunk paragraphs within a section, respecting token targets */
function chunkSection(section: Section, jobId: string, startIndex: number): ChunkResult[] {
  const results: ChunkResult[] = [];
  let buffer = "";
  let bufferTokens = 0;

  for (const para of section.paragraphs) {
    const paraTokens = estimateTokens(para);

    // Single paragraph exceeds max → split by sentences
    if (paraTokens > MAX_CHUNK_TOKENS) {
      // Flush buffer first
      if (buffer.trim()) {
        results.push(makeChunk(jobId, startIndex + results.length, buffer, section.title));
        buffer = "";
        bufferTokens = 0;
      }
      // Split mega-paragraph into sentence-sized sub-chunks
      for (const subChunk of splitLongParagraph(para, jobId, startIndex + results.length, section.title)) {
        results.push(subChunk);
      }
      continue;
    }

    // Adding this paragraph would exceed target → flush buffer
    if (bufferTokens > 0 && bufferTokens + paraTokens > TARGET_CHUNK_TOKENS * 1.2) {
      results.push(makeChunk(jobId, startIndex + results.length, buffer, section.title));
      buffer = "";
      bufferTokens = 0;
    }

    // Add paragraph to buffer with overlap from previous
    if (bufferTokens > 0 && paraTokens < MIN_CHUNK_TOKENS) {
      // Small paragraph after existing buffer — just append
      buffer += "\n\n" + para;
      bufferTokens += paraTokens;
    } else if (bufferTokens === 0) {
      buffer = para;
      bufferTokens = paraTokens;
    } else {
      buffer += "\n\n" + para;
      bufferTokens += paraTokens;
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    results.push(makeChunk(jobId, startIndex + results.length, buffer, section.title));
  }

  return results;
}

/** Split a very long paragraph by sentence boundaries */
function splitLongParagraph(
  text: string,
  jobId: string,
  startIndex: number,
  sectionTitle?: string
): ChunkResult[] {
  const results: ChunkResult[] = [];
  // Split on sentence boundaries: .!? followed by space/capital or end
  const sentences = text.match(/[^.!?\n]+[.!?]+(\s|$)/g) || [text];

  let buffer = "";
  let bufferTokens = 0;

  for (const sent of sentences) {
    const sentTokens = estimateTokens(sent);

    if (bufferTokens + sentTokens > MAX_CHUNK_TOKENS && buffer.trim()) {
      results.push(makeChunk(jobId, startIndex + results.length, buffer, sectionTitle));
      // Overlap: carry last ~OVERLAP_CHARS of previous chunk into next
      const overlap = buffer.slice(-OVERLAP_CHARS);
      buffer = overlap + " " + sent;
      bufferTokens = estimateTokens(buffer);
    } else {
      buffer += (buffer ? " " : "") + sent;
      bufferTokens += sentTokens;
    }
  }

  if (buffer.trim()) {
    results.push(makeChunk(jobId, startIndex + results.length, buffer, sectionTitle));
  }

  return results;
}

function makeChunk(jobId: string, seqIndex: number, text: string, sectionTitle?: string): ChunkResult {
  return {
    chunkId: `${jobId}-c${seqIndex}`,
    sequenceIndex: seqIndex,
    text: text.trim(),
    tokenCount: estimateTokens(text.trim()),
    sectionTitle,
  };
}
