import OpenAI from 'openai'
import { ClipCandidate, ClipScore, TranscriptSegment } from '@/types'

function getClient(): OpenAI {
  let apiKey = process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY
  let baseURL = process.env.AI_BASE_URL

  if (baseURL?.includes('openrouter')) {
    apiKey = process.env.OPENROUTER_API_KEY ?? apiKey
  } else if (baseURL?.includes('groq')) {
    apiKey = process.env.GROQ_API_KEY ?? apiKey
  } else if (baseURL?.includes('googleapis')) {
    apiKey = process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY ?? apiKey
  }

  if (!apiKey) {
    if (process.env.GEMINI_API_KEY) {
      apiKey = process.env.GEMINI_API_KEY
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/'
    } else if (process.env.OPENROUTER_API_KEY) {
      apiKey = process.env.OPENROUTER_API_KEY
      baseURL = 'https://openrouter.ai/api/v1'
    } else if (process.env.GROQ_API_KEY) {
      apiKey = process.env.GROQ_API_KEY
      baseURL = 'https://api.groq.com/openai/v1'
    }
  }

  if (!apiKey) throw new Error('No AI API key found. Set GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in .env')
  return new OpenAI({
    apiKey,
    baseURL: baseURL ?? 'https://api.openai.com/v1',
  })
}

function getModel(): string {
  return process.env.AI_MODEL ?? 'gpt-4o-mini'
}

interface AnalysisResult {
  clips: Array<{
    startIndex: number
    endIndex: number
    scores: {
      hook: number
      emotion: number
      curiosity: number
      retention: number
      humor: number
      storyPayoff: number
    }
    reason: string
  }>
}

function buildTranscriptWithTimestamps(segments: TranscriptSegment[]): string {
  return segments
    .map((s, i) => `[${i}] ${formatTime(s.start)}-${formatTime(s.end)}: ${s.text}`)
    .join('\n')
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function calcTotal(scores: ClipScore): number {
  const weights = {
    hook: 0.3,
    emotion: 0.2,
    curiosity: 0.2,
    retention: 0.15,
    humor: 0.1,
    storyPayoff: 0.05,
  }
  return (
    scores.hook * weights.hook +
    scores.emotion * weights.emotion +
    scores.curiosity * weights.curiosity +
    scores.retention * weights.retention +
    scores.humor * weights.humor +
    scores.storyPayoff * weights.storyPayoff
  )
}

function adjustClipRange(
  segments: TranscriptSegment[],
  startIndex: number,
  endIndex: number,
  targetDuration: number
): { startIndex: number; endIndex: number } {
  let start = startIndex
  let end = endIndex

  const getDuration = (s: number, e: number) => segments[e].end - segments[s].start

  // Case 1: Too short -> expand symmetrically
  while (getDuration(start, end) < targetDuration) {
    const canExpandLeft = start > 0
    const canExpandRight = end < segments.length - 1

    if (!canExpandLeft && !canExpandRight) {
      break
    }

    if (canExpandLeft && canExpandRight) {
      start--
      if (getDuration(start, end) >= targetDuration) break
      end++
    } else if (canExpandLeft) {
      start--
    } else {
      end++
    }
  }

  // Case 2: Too long -> shrink symmetrically
  while (getDuration(start, end) > targetDuration + 2 && start < end) {
    const durationWithStartShrunk = segments[end].end - segments[start + 1].start
    const durationWithEndShrunk = segments[end - 1].end - segments[start].start

    if (Math.abs(durationWithStartShrunk - targetDuration) < Math.abs(durationWithEndShrunk - targetDuration)) {
      start++
    } else {
      end--
    }
  }

  return { startIndex: start, endIndex: end }
}

export async function findViralClips(
  segments: TranscriptSegment[],
  targetDuration: number,
  videoTitle: string
): Promise<ClipCandidate[]> {
  if (segments.length === 0) return []

  const client = getClient()
  const transcript = buildTranscriptWithTimestamps(segments)
  const totalDuration = segments[segments.length - 1].end

  const systemPrompt = `You are a viral content expert specializing in short-form video clips for TikTok, Instagram Reels, and YouTube Shorts.

Your job: analyze a video transcript and identify the BEST ${targetDuration}-second clips that will go viral.

Scoring criteria (0-10 each):
- hook: Does it grab attention in the first 2 seconds?
- emotion: Does it trigger strong emotion (joy, surprise, anger, awe)?
- curiosity: Does it make you want to watch more / share?
- retention: Will viewers watch until the end?
- humor: Is it genuinely funny?
- storyPayoff: Does it have a satisfying arc or reveal?

Return ONLY valid JSON (no markdown, no explanation):
{
  "clips": [
    {
      "startIndex": <segment index number>,
      "endIndex": <segment index number>,
      "scores": { "hook": 0-10, "emotion": 0-10, "curiosity": 0-10, "retention": 0-10, "humor": 0-10, "storyPayoff": 0-10 },
      "reason": "<one sentence why this clip will go viral>"
    }
  ]
}

Find 3-5 candidates. Each clip should be approximately ${targetDuration} seconds long.
Prefer clips that are complete thoughts with a clear beginning, middle, and end.`

  const userPrompt = `Video: "${videoTitle}"
Total duration: ${Math.round(totalDuration)}s
Target clip length: ~${targetDuration}s

Transcript (segment index, timestamp, text):
${transcript}

Find the best viral clip moments.`

  let raw = ''
  try {
    const response = await client.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })
    raw = response.choices[0].message.content ?? ''
  } catch (err) {
    throw new Error(`AI analysis failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Parse JSON, stripping any markdown fences and any leading/trailing prose.
  // Models sometimes wrap output in ```json ... ```, sometimes in ``` ... ```,
  // and occasionally add a sentence before/after the JSON.
  let cleaned = raw
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')   // drop everything up to & including first fence
    .replace(/```[\s\S]*$/g, '')                  // drop closing fence & anything after
    .trim()
  // If the model returned prose + JSON, try to extract the first {...} block
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1)
    }
  }

  let parsed: AnalysisResult
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(
      `Failed to parse AI response as JSON (${err instanceof Error ? err.message : String(err)}). ` +
      `Raw response (first 500 chars): ${raw.slice(0, 500)}`
    )
  }

  const candidates: ClipCandidate[] = []

  for (const clip of parsed.clips ?? []) {
    let { startIndex, endIndex } = clip
    if (startIndex === undefined || endIndex === undefined) continue

    const adjusted = adjustClipRange(segments, startIndex, endIndex, targetDuration)
    startIndex = adjusted.startIndex
    endIndex = adjusted.endIndex

    const startSeg = segments[startIndex]
    const endSeg = segments[endIndex]
    if (!startSeg || !endSeg) continue

    const score: ClipScore = {
      ...clip.scores,
      total: 0,
    }
    score.total = calcTotal(score)

    const transcriptText = segments
      .slice(startIndex, endIndex + 1)
      .map(s => s.text)
      .join(' ')

    candidates.push({
      startTime: startSeg.start,
      endTime: endSeg.end,
      duration: endSeg.end - startSeg.start,
      transcript: transcriptText,
      score,
      reason: clip.reason,
    })
  }

  // Sort by total score descending
  return candidates.sort((a, b) => b.score.total - a.score.total)
}

// Generate caption segments from transcript segments for a clip window
export async function generateCaptions(
  segments: TranscriptSegment[],
  startTime: number,
  endTime: number
): Promise<Array<{ start: number; end: number; text: string }>> {
  return segments
    .filter(s => s.start >= startTime && s.end <= endTime)
    .map(s => ({ start: s.start, end: s.end, text: s.text }))
}
