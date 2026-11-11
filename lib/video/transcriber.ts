import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import OpenAI from 'openai'
import { TranscriptSegment } from '@/types'

const execFileAsync = promisify(execFile)

async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  const ffmpegBin = process.env.FFMPEG_PATH ?? 'ffmpeg'
  await execFileAsync(ffmpegBin, [
    '-i', videoPath,
    '-vn',
    '-ar', '16000',
    '-ac', '1',
    '-f', 'wav',
    '-y',
    audioPath,
  ])
}

async function transcribeWithOpenAI(audioPath: string): Promise<TranscriptSegment[]> {
  let apiKey: string | undefined
  let baseURL = 'https://api.openai.com/v1'
  let model = process.env.AI_AUDIO_MODEL ?? 'whisper-1'

  // Prefer Groq for Whisper audio transcription (free, fast, and avoids sending Gemini keys to api.openai.com)
  if (process.env.GROQ_API_KEY) {
    apiKey = process.env.GROQ_API_KEY
    baseURL = 'https://api.groq.com/openai/v1'
    model = process.env.AI_AUDIO_MODEL ?? 'whisper-large-v3'
  } else if (process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY
    baseURL = 'https://api.openai.com/v1'
    model = process.env.AI_AUDIO_MODEL ?? 'whisper-1'
  } else {
    throw new Error('No compatible audio API key found. Set GROQ_API_KEY or OPENAI_API_KEY in .env (OpenRouter does not support audio transcription)')
  }

  const client = new OpenAI({ apiKey, baseURL })

  const audioStream = fs.createReadStream(audioPath)
  let response: any
  try {
    response = await client.audio.transcriptions.create({
      model,
      file: audioStream,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    })
  } catch (err) {
    throw new Error(`Audio transcription failed (${model}): ${err instanceof Error ? err.message : String(err)}`)
  }

  // verbose_json returns segments
  const typed = response as unknown as {
    segments?: Array<{ start: number; end: number; text: string }>
  }
  return (typed.segments ?? []).map(s => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }))
}

async function tryLocalWhisper(audioPath: string): Promise<TranscriptSegment[] | null> {
  const candidates = ['whisper', 'whisper.cpp', '/usr/local/bin/whisper']
  for (const bin of candidates) {
    try {
      const outDir = path.dirname(audioPath)
      await execFileAsync(bin, [
        audioPath,
        '--output_format', 'json',
        '--output_dir', outDir,
        '--model', 'base',
        '--language', 'en',
      ])
      const jsonFile = audioPath.replace(/\.[^.]+$/, '.json')
      if (fs.existsSync(jsonFile)) {
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
        return (data.segments ?? []).map((s: { start: number; end: number; text: string }) => ({
          start: s.start,
          end: s.end,
          text: s.text.trim(),
        }))
      }
    } catch {
      // try next
    }
  }
  return null
}

export async function transcribeVideo(
  videoPath: string,
  tempDir: string
): Promise<TranscriptSegment[]> {
  fs.mkdirSync(tempDir, { recursive: true })
  const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`)

  try {
    await extractAudio(videoPath, audioPath)

    // Try local whisper first (free)
    const localResult = await tryLocalWhisper(audioPath)
    if (localResult && localResult.length > 0) return localResult

    // Fall back to OpenAI Whisper API
    return await transcribeWithOpenAI(audioPath)
  } finally {
    // Cleanup audio file
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
  }
}
