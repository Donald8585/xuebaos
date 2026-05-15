import type { Env } from "../index";

// ── AI Service ─────────────────────────────────────────────────────
// Central service for all AI API calls: DeepSeek, Replicate, Whisper

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const REPLICATE_BASE = "https://api.replicate.com/v1";
const OPENAI_BASE = "https://api.openai.com/v1";

// ══════════════════════════════════════════════════════════════════
// DeepSeek Chat (OpenAI-compatible)
// ══════════════════════════════════════════════════════════════════

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function deepseekChat(
  env: Env,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; stream?: boolean }
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000); // 50s timeout

  try {
    const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: options?.stream ?? false,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API error (${resp.status}): ${err}`);
  }

  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

// ══════════════════════════════════════════════════════════════════
// Prompt Templates
// ══════════════════════════════════════════════════════════════════

const GENERATE_PALACE_FROM_TEXT_PROMPT = `You are a master of the Method of Loci. Given raw study text, extract key concepts and build a detailed memory palace.

STEP 1: Extract 5-20 key concepts from the text. Focus on important terms, definitions, processes, and relationships.

STEP 2: For each concept, create a vivid locus in a virtual journey. Each locus must have:
- concept: the original concept name (exact term from the text)
- locusName: a specific, memorable location in the spatial sequence
- position: sequential number starting at 1
- description: rich sensory details (visual, sound, smell, tactile)
- association: how to vividly link the locus to the concept using absurd/emotional imagery

Return ONLY valid JSON. No prose, no markdown, no explanation. JSON ONLY:
{
  "palaceName": "string (creative name based on topic)",
  "description": "string (theme/setting of the palace)",
  "loci": [
    {
      "concept": "string (exact concept from text)",
      "locusName": "string (memorable location name)",
      "position": number,
      "description": "string (sensory-rich spatial description)",
      "association": "string (absurd/emotional mnemonic link)"
    }
  ]
}`;

const GENERATE_PALACE_PROMPT = `You are a master of the Method of Loci. Given a topic and list of concepts, generate a detailed memory palace.

For each concept, create a vivid location ("locus") in a virtual journey. Each locus should:
1. Have a specific, memorable name
2. Be placed in a logical spatial sequence (e.g., walking through a familiar building)
3. Include rich sensory details (visual, sound, smell, tactile)
4. Connect to the concept with strong associative imagery

Respond in JSON format:
{
  "palaceName": "string",
  "description": "string (theme/setting)",
  "loci": [
    {
      "concept": "string (the original concept)",
      "locusName": "string",
      "position": number,
      "description": "string (vivid sensory description)",
      "association": "string (how to link the locus to the concept)"
    }
  ],
  "summary": "string"
}`;

const GENERATE_STORY_PROMPT = `You are a master of mnemonic storytelling. Create an engaging, memorable narrative that encodes the given concepts using vivid imagery, emotion, and absurdity.

Guidelines:
- Make it bizarre, emotional, or funny — memorable things stick
- Weave all concepts into a single flowing narrative
- Use strong sensory and emotional hooks
- Keep it age-appropriate but creatively wild
- Chinese-friendly: include cultural references that resonate

Respond in JSON:
{
  "title": "string",
  "story": "string (the full narrative)",
  "conceptMap": [
    {"concept": "string", "narrativeHook": "string"}
  ],
  "style": "string (e.g., detective-noir, fairy-tale, sci-fi)"
}`;

const GENERATE_SYMBOLS_PROMPT = `You are a specialist in symbolic visual encoding. For each concept, generate several symbolic metaphors and visual representations that make it unforgettable.

For each concept provide:
1. A primary symbol (simple, iconic)
2. An elaborated visual metaphor (rich, detailed)
3. A sensory trigger (what you'd see/hear/feel/smell)

Respond in JSON:
{
  "symbols": [
    {
      "concept": "string",
      "primarySymbol": "string",
      "visualMetaphor": "string",
      "sensoryTrigger": "string",
      "category": "string (nature, technology, body, food, etc.)"
    }
  ]
}`;

const GRADE_RECALL_PROMPT = `You are an expert grading system for active recall. Compare the user's recall against the correct content and grade with precision.

Grade on these dimensions (0-10 each):
- Accuracy: Did they get the facts right?
- Completeness: Did they cover all key points?
- Precision: Did they use correct terminology?
- Structure: Was the recall logically organized?

Respond in JSON:
{
  "grade": number (0-100),
  "accuracy": number (0-10),
  "completeness": number (0-10),
  "precision": number (0-10),
  "structure": number (0-10),
  "missedConcepts": ["string"],
  "correctConcepts": ["string"],
  "feedback": "string (constructive)"
}`;

const FEYNMAN_GRADE_PROMPT = `You are evaluating a Feynman technique teach-back. Grade the explanation on how well a complete beginner would understand it.

Criteria:
- Simplicity (0-10): Uses plain, accessible language
- Clarity (0-10): Logical flow, no gaps
- Analogy Quality (0-10): Effective metaphors/examples
- Conceptual Depth (0-10): Shows real understanding, not just memorization
- Identified Gaps (0-10): Learner explicitly flagged what they don't know

Respond in JSON:
{
  "grade": number (0-100),
  "simplicity": number (0-10),
  "clarity": number (0-10),
  "analogyQuality": number (0-10),
  "conceptualDepth": number (0-10),
  "gapAwareness": number (0-10),
  "gapsIdentified": ["string"],
  "simplificationSuggestions": ["string"],
  "feedback": "string"
}`;

const ANALYZE_PASSAGE_PROMPT = `You are analyzing a Chinese passage for language learning. Provide comprehensive analysis including vocabulary, grammar, and comprehension.

Respond in JSON:
{
  "title": "string (if extractable, or generate one)",
  "difficultyLevel": number (1-10, HSK approximate),
  "vocabulary": [
    {"word": "string", "pinyin": "string", "definition": "string", "partOfSpeech": "string", "hskLevel": number}
  ],
  "grammarNotes": "string (key grammar patterns)",
  "translation": "string (English)",
  "analysis": "string (thematic/content analysis)",
  "comprehensionQuestions": [
    {"question": "string (Chinese)", "answer": "string"}
  ],
  "wordCount": number,
  "estimatedReadingTime": number (minutes)
}`;

const OPTIMIZE_TIMETABLE_PROMPT = `You are a study optimization expert using the graduated saturation algorithm. Given the user's timetable entries, subject priorities, and historical study data, optimize the schedule.

Principles:
- Alternate between high-cognitive-load and low-cognitive-load subjects
- Front-load difficult subjects to peak energy periods
- Leave buffer time between intense sessions
- Use interleaving for related subjects
- Respect minimum and maximum session durations

Respond in JSON:
{
  "schedule": [
    {
      "day": "string",
      "timeBlock": "string (HH:MM-HH:MM)",
      "subject": "string",
      "topic": "string",
      "mode": "string (focused/pomodoro/deep)",
      "priority": "string (high/medium/low)",
      "rationale": "string"
    }
  ],
  "notes": "string",
  "totalStudyHours": number
}`;

const CONCEPT_CHAIN_PROMPT = `You are creating a concept story chain — a narrative that links concepts causally so that remembering one triggers the next.

For the given list of concepts, create a chain where:
- Each concept causes or leads naturally to the next
- The connections are logical and memorable
- The overall story makes sense as a whole

Respond in JSON:
{
  "title": "string",
  "chain": [
    {
      "position": number,
      "concept": "string",
      "linkPhrase": "string (how it connects to the previous, if not first)"
    }
  ],
  "fullStory": "string (the complete narrative chain)"
}`;

const ANNOTATION_PASS_PROMPT = `You are a study annotation specialist. Process the given content according to the specified pass level.

Pass 1 (Preview/Skim):
- Identify main topic and 3-5 key ideas
- Note structure and difficulty
- List unfamiliar terms

Pass 2 (Deep Read):
- Detailed summary of each section
- Connect ideas, identify relationships
- Note important details and examples

Pass 3 (Synthesis):
- Create a unified summary
- Generate potential exam questions
- Connect to broader principles
- Identify what needs more study

Respond in JSON:
{
  "pass": number (1, 2, or 3),
  "summary": "string",
  "keyTerms": ["string"],
  "questions": ["string"],
  "connections": ["string"],
  "gaps": ["string"]
}`;

const GENERATE_QUESTIONS_PROMPT = `You are an expert question generator for spaced repetition learning. Generate questions from the given content.

Generation mode determines question style:
- standard: Balanced mix of question types at the given difficulty
- deep-wide: Questions that connect multiple concepts, requiring synthesis
- novelty: Unusual angles, counterintuitive cases, creative application scenarios

Respond in JSON:
{
  "questions": [
    {
      "questionType": "string (mcq|short_answer|essay|fill_blank)",
      "difficulty": "string (easy|medium|hard)",
      "questionText": "string",
      "options": ["string"] (for mcq only),
      "correctAnswer": "string",
      "explanation": "string",
      "tags": ["string"]
    }
  ]
}`;

// ══════════════════════════════════════════════════════════════════
// Feature Functions
// ══════════════════════════════════════════════════════════════════

export async function generatePalace(
  env: Env,
  topic: string,
  concepts: string[],
  count?: number
) {
  // If concepts look like raw text (>200 chars total), send as full text extraction
  const isRawText = concepts.length <= 5 && concepts.some(c => c.length > 40);
  
  // Limit total prompt to 30KB — prevents timeout on large uploads
  const MAX_PROMPT = 30000;
  const rawText = concepts.join("\n").slice(0, MAX_PROMPT);

  const prompt = isRawText
    ? `${GENERATE_PALACE_FROM_TEXT_PROMPT}

Subject/Topic: ${topic}
Source Text:
${rawText}
${count ? `\nTarget loci count: ${count}` : ""}`
    : `${GENERATE_PALACE_PROMPT}

Topic: ${topic}
Concepts: ${concepts.join(", ")}
${count ? `Number of loci requested: ${count}` : ""}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ]);

  // Strip markdown code fences if present
  let json = result.trim();
  if (json.startsWith("```")) {
    json = json.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(json);
  } catch (parseErr) {
    console.error("DeepSeek JSON parse failed", { rawResponse: result.slice(0, 500), error: String(parseErr) });
    throw new Error(`DeepSeek returned non-JSON: ${result.slice(0, 200)}`);
  }
}

export async function generateStory(
  env: Env,
  topic: string,
  concepts: string[],
  style?: string
) {
  const prompt = `${GENERATE_STORY_PROMPT}

Topic: ${topic}
Concepts: ${concepts.join(", ")}
${style ? `Requested style: ${style}` : ""}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ]);
  return JSON.parse(result);
}

export async function generateSymbols(
  env: Env,
  topic: string,
  concepts: string[]
) {
  const prompt = `${GENERATE_SYMBOLS_PROMPT}

Topic: ${topic}
Concepts: ${concepts.join(", ")}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ]);
  return JSON.parse(result);
}

export async function gradeRecall(
  env: Env,
  userRecall: string,
  correctContent: string
) {
  const prompt = `${GRADE_RECALL_PROMPT}

User's Recall:
${userRecall}

Correct Content:
${correctContent}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ], { temperature: 0.3 });
  return JSON.parse(result);
}

export async function feynmanGrade(
  env: Env,
  topic: string,
  userExplanation: string
) {
  const prompt = `${FEYNMAN_GRADE_PROMPT}

Topic: ${topic}
Student's Explanation:
${userExplanation}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ], { temperature: 0.3 });
  return JSON.parse(result);
}

export async function optimizeTimetable(
  env: Env,
  entries: Array<{ day: string; startTime: string; endTime: string; subject: string; topic: string }>,
  priorities: Record<string, number>
) {
  const prompt = `${OPTIMIZE_TIMETABLE_PROMPT}

Current timetable entries:
${JSON.stringify(entries, null, 2)}

Subject priorities (higher = more important):
${JSON.stringify(priorities, null, 2)}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ]);
  return JSON.parse(result);
}

export async function generateConceptChain(
  env: Env,
  topic: string,
  concepts: string[]
) {
  const prompt = `${CONCEPT_CHAIN_PROMPT}

Topic: ${topic}
Concepts (in order): ${concepts.join(" → ")}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ]);
  return JSON.parse(result);
}

export async function analyzePassage(
  env: Env,
  passageText: string,
  language: string = "chinese"
) {
  const prompt = `${ANALYZE_PASSAGE_PROMPT}

Passage:
${passageText}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ]);
  return JSON.parse(result);
}

export async function processAnnotation(
  env: Env,
  content: string,
  pass: number,
  previousContent?: string
) {
  const prompt = `${ANNOTATION_PASS_PROMPT}

Content to annotate (${pass === 1 ? "first" : pass === 2 ? "second" : "third"} pass):
${content}
${previousContent ? `\nPrevious pass content:\n${previousContent}` : ""}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ], { temperature: 0.5 });
  return JSON.parse(result);
}

export async function generateQuestions(
  env: Env,
  subject: string,
  topic: string,
  content: string,
  mode: "standard" | "deep-wide" | "novelty" = "standard",
  difficulty: string = "medium",
  count: number = 10
) {
  const prompt = `${GENERATE_QUESTIONS_PROMPT}

Subject: ${subject}
Topic: ${topic}
Source Content: ${content}
Mode: ${mode}
Target Difficulty: ${difficulty}
Number of Questions: ${count}`;

  const result = await deepseekChat(env, [
    { role: "user", content: prompt },
  ]);
  return JSON.parse(result);
}

// ══════════════════════════════════════════════════════════════════
// Replicate Flux Image Generation
// ══════════════════════════════════════════════════════════════════

export async function generateImage(
  env: Env,
  prompt: string,
  options?: { width?: number; height?: number; numOutputs?: number }
): Promise<string[]> {
  const resp = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      version: "black-forest-labs/flux-schnell",
      input: {
        prompt,
        width: options?.width ?? 1024,
        height: options?.height ?? 768,
        num_outputs: options?.numOutputs ?? 1,
        num_inference_steps: 4,
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Replicate API error (${resp.status}): ${err}`);
  }

  const prediction = (await resp.json()) as { id: string; status: string };

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 30;
  while (attempts < maxAttempts) {
    const pollResp = await fetch(
      `${REPLICATE_BASE}/predictions/${prediction.id}`,
      {
        headers: {
          Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
        },
      }
    );

    if (!pollResp.ok) throw new Error(`Failed to poll Replicate prediction`);

    const result = (await pollResp.json()) as {
      status: string;
      output?: string[];
      error?: string;
    };

    if (result.status === "succeeded") {
      return result.output ?? [];
    }
    if (result.status === "failed") {
      throw new Error(`Replicate generation failed: ${result.error}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  throw new Error("Replicate generation timed out");
}

// ══════════════════════════════════════════════════════════════════
// Whisper Transcription
// ══════════════════════════════════════════════════════════════════

export async function transcribe(
  env: Env,
  audioBuffer: ArrayBuffer,
  filename: string = "audio.webm"
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], {
    type: filename.endsWith(".mp3")
      ? "audio/mpeg"
      : filename.endsWith(".wav")
        ? "audio/wav"
        : "audio/webm",
  });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("language", "zh"); // Default Chinese, can be overridden

  const resp = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Whisper API error (${resp.status}): ${err}`);
  }

  const data = (await resp.json()) as { text: string };
  return data.text;
}

// ══════════════════════════════════════════════════════════════════
//  XueBaOS Principles — Core Study OS Knowledge Base
// ══════════════════════════════════════════════════════════════════

export const XUEBA_SYSTEM_PROMPT = `You are XUEBA (學霸) — the Study God AI coach inside XueBaOS, the operating system for elite learners.

Your mission: transform any student into a 學霸 (top-scoring scholar) using evidence-based learning science.

## YOUR IDENTITY
- Name: 學霸 (Xueba)
- Role: AI study coach, memory architect, learning optimizer
- Tone: Direct, motivating, precise, slightly intense — like a elite academic coach
- Languages: Respond in the same language the user uses (English, 繁體中文, 简体中文)
- NEVER hallucinate. If unsure, say so and suggest a learning experiment.

## CORE METHODOLOGIES — THE 學霸 TOOLKIT

### 1. Method of Loci (記憶宮殿 / Memory Palace)
Ancient technique proven by modern neuroscience. Convert abstract concepts into vivid, spatially-anchored images placed along a familiar journey.
- Each locus = one concept, with multi-sensory encoding (visual + sound + smell + emotion)
- Best for: lists, sequences, vocabulary, anatomy, historical timelines
- Key principle: BIZARRE + EMOTIONAL = unforgettable
- Spacing: review palace after 1h → 1d → 3d → 7d → 14d → 30d

### 2. Mnemonic Storytelling
Weave concepts into a single flowing narrative. The brain remembers stories 22× better than isolated facts.
- Use absurdity, humor, personal relevance
- Chain concepts causally (this happens → THEREFORE that happens)
- Each story element triggers the next via associative priming

### 3. Symbolic Visual Encoding (符號編碼)
Convert every abstract concept into a concrete symbol your brain can grasp instantly.
- Primary symbol: simple, iconic, instantly recognizable
- Visual metaphor: rich, detailed scene that embodies the concept
- Sensory trigger: specific feeling/sound/image tied to the concept

### 4. FSRS (Free Spaced Repetition Scheduler)
The state-of-the-art spaced repetition algorithm. Adapts to YOUR memory patterns.
- 4 states: New → Learning → Review → Relearning
- Tracks: stability, difficulty, retrievability per item
- Schedule adapts based on your actual recall performance
- Optimal intervals: computed from your personal forgetting curve

### 5. Active Recall + Free Recall
Passive re-reading is a TRAP. Testing yourself is where real learning happens.
- Free Recall: After studying, close everything and write EVERYTHING you remember
- Cued Recall: Use prompts/questions to trigger targeted retrieval
- The Blank Page Method: stare at a blank page and reconstruct the entire topic from memory

### 6. Feynman Technique
If you can't explain it simply, you don't understand it.
- Step 1: Pick a concept
- Step 2: Explain it to a 12-year-old (plain language, no jargon)
- Step 3: Identify gaps where you struggled
- Step 4: Go back, learn, simplify further
- Goal: One-sentence explanation that captures the essence

### 7. 3-Pass Annotation System (三遍註解法)
Don't just read — PROCESS at increasing depth.
- Pass 1 (Skim): Main topic, structure, 3-5 key ideas, unfamiliar terms
- Pass 2 (Deep Read): Section summaries, relationships, details, examples
- Pass 3 (Synthesis): Unified summary, exam questions, connections to other subjects, identify gaps

### 8. Concept Story Chains (概念鏈)
Link concepts causally so remembering one triggers the next automatically.
- A → causes → B → reveals → C → challenges → D
- Each link must be logical and memorable
- Creates a single "pull" path through an entire topic

### 9. Graduated Saturation Scheduling
Optimize your study timetable like an OS scheduler.
- Front-load difficult subjects to peak energy periods
- Alternate high-cognitive-load with low-cognitive-load subjects
- Use interleaving: mix related subjects, don't block them
- Pomodoro: 25min focus → 5min break → repeat
- Deep work blocks: 90min uninterrupted for complex topics

### 10. Deep-Wide Questioning (深廣提問法)
Generate questions that force synthesis, not just recall.
- Standard: Balanced mix of MCQs, short answer, essay
- Deep-Wide: Questions connecting multiple concepts → synthesis
- Novelty: Unusual angles, counterintuitive cases, creative applications

### 11. Interleaving + Variability
Don't block-study one subject for hours. Mix them.
- Math → History → Math → Science → Math
- Forces your brain to discriminate between problem types
- Improves transfer to novel situations by 40%+

### 12. The 學霸 MINDSET
- Growth mindset: intelligence is built, not born
- Deliberate practice: target your weakest areas, not your comfort zone
- Metacognition: constantly ask "Do I actually understand this?"
- Sleep = consolidation: review before bed, your brain processes overnight
- Exercise boosts BDNF: 20min cardio before studying = better encoding

## HOW TO RESPOND
1. Diagnose what the user needs (motivation? technique? organization? understanding?)
2. Prescribe the specific 學霸 method(s) that fit
3. Give a concrete, actionable step they can do RIGHT NOW
4. Be encouraging but demand excellence — 學霸s don't settle for mediocre
5. When relevant, suggest which XueBaOS tool to use (Palace builder, Story generator, Q-Bank, Recall Arena, etc.)

You are the study partner every top student wishes they had. Now go make some 學霸s.`;

// ══════════════════════════════════════════════════════════════════
// XueBaOS Chat — Conversational AI with Principles Knowledge
// ══════════════════════════════════════════════════════════════════

export async function xuebaChat(
  env: Env,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const systemMessages: ChatMessage[] = [
    { role: "system", content: XUEBA_SYSTEM_PROMPT },
  ];

  return deepseekChat(env, [...systemMessages, ...messages], {
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 4096,
  });
}

// ══════════════════════════════════════════════════════════════════
// Streaming Chat — Server-Sent Events via ReadableStream
// ══════════════════════════════════════════════════════════════════

export async function xuebaChatStream(
  env: Env,
  messages: ChatMessage[]
): Promise<ReadableStream> {
  const allMessages = [
    { role: "system", content: XUEBA_SYSTEM_PROMPT },
    ...messages,
  ];

  const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek stream error (${resp.status}): ${err}`);
  }

  // Transform DeepSeek SSE stream into clean text tokens
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch {
                // Skip invalid JSON chunks
              }
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
