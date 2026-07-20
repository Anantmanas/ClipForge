import path from 'path'
import fs from 'fs'
import { JobOptions, JobState } from '@/types'
import { jobStore } from './store'
import { downloadVideo } from './video/downloader'
import { transcribeVideo } from './video/transcriber'
import { findViralClips, generateCaptions } from './ai/analyzer'
import { renderClip } from './video/processor'

function tempDir(): string {
  const d = process.env.TEMP_DIR ?? path.join(process.cwd(), 'tmp')
  fs.mkdirSync(d, { recursive: true })
  return d
}

function outputDir(): string {
  const d = process.env.OUTPUT_DIR ?? path.join(process.cwd(), 'public', 'outputs')
  fs.mkdirSync(d, { recursive: true })
  return d
}

async function progress(jobId: string, status: JobState['status'], pct: number, msg: string) {
  await jobStore.update(jobId, { status, progress: pct, message: msg })
  console.log(`[${jobId}] [${status}] ${pct}% — ${msg}`)
}

export async function runPipeline(jobId: string, options: JobOptions): Promise<void> {
  const tmp = path.join(tempDir(), jobId)
  fs.mkdirSync(tmp, { recursive: true })

  try {
    // 1. Download
    await progress(jobId, 'downloading', 5, 'Downloading video…')
    const downloaded = await downloadVideo(options.url, tmp, jobId)
    await jobStore.update(jobId, {
      videoTitle: downloaded.title,
      videoDuration: downloaded.duration,
    })

    // 2. Transcribe
    await progress(jobId, 'transcribing', 25, 'Transcribing audio…')
    const segments = await transcribeVideo(downloaded.filePath, tmp)
    if (segments.length === 0) {
      throw new Error('Transcription returned no segments. The video may have no speech.')
    }

    // 3. AI Analysis
    await progress(jobId, 'analyzing', 45, 'AI is scoring clips…')
    const candidates = await findViralClips(segments, options.clipDuration, downloaded.title)
    if (candidates.length === 0) {
      throw new Error('AI could not identify any viral clip candidates.')
    }
    await jobStore.update(jobId, { candidates })

    // 4. Render requested number of clips (options.numClips)
    const numToRender = Math.min(options.numClips ?? 1, candidates.length)

    for (let i = 0; i < numToRender; i++) {
      const clip = candidates[i]
      await progress(jobId, 'rendering', 60 + Math.round((i / numToRender) * 35), `Rendering clip ${i + 1} of ${numToRender}…`)

      const captions = options.addCaptions
        ? await generateCaptions(segments, clip.startTime, clip.endTime)
        : []

      const clipOutFile = `${jobId}_clip${i + 1}_${options.aspectRatio.replace(':', 'x')}_${options.quality}.mp4`
      const clipOutputPath = path.join(outputDir(), clipOutFile)

      await renderClip({
        inputPath: downloaded.filePath,
        outputPath: clipOutputPath,
        startTime: clip.startTime,
        endTime: clip.endTime,
        aspectRatio: options.aspectRatio,
        quality: options.quality,
        captions: options.addCaptions ? captions : undefined,
      })

      clip.outputPath = clipOutputPath
      clip.outputUrl = `/outputs/${clipOutFile}`
    }

    const best = candidates[0]
    await progress(jobId, 'done', 100, 'Clips ready!')
    await jobStore.update(jobId, {
      selectedClip: best,
      candidates, // Save updated candidates with outputUrls
      outputPath: best.outputPath,
      outputUrl: best.outputUrl,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[${jobId}] Pipeline error:`, message)
    await jobStore.update(jobId, {
      status: 'error',
      progress: 0,
      message: 'An error occurred',
      error: message,
    })
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      // Non-fatal
    }
  }
}
