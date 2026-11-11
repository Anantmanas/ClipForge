import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { AspectRatio, Quality } from '@/types'

const execFileAsync = promisify(execFile)

function getFFmpegBin(): string {
  return process.env.FFMPEG_PATH ?? 'ffmpeg'
}

interface VideoMetadata {
  width: number
  height: number
  duration: number
}

export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  const ffprobeBin = process.env.FFPROBE_PATH ?? 'ffprobe'
  const { stdout } = await execFileAsync(ffprobeBin, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ])
  const data = JSON.parse(stdout)
  const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video')
  return {
    width: videoStream?.width ?? 1920,
    height: videoStream?.height ?? 1080,
    duration: parseFloat(data.format?.duration ?? '0'),
  }
}

function buildCropFilter(
  srcWidth: number,
  srcHeight: number,
  aspectRatio: AspectRatio
): string {
  const [targetW, targetH] = aspectRatio.split(':').map(Number)
  const targetAspect = targetW / targetH
  const srcAspect = srcWidth / srcHeight

  let cropW: number
  let cropH: number

  if (srcAspect > targetAspect) {
    // Source is wider — crop sides
    cropH = srcHeight
    cropW = Math.round(srcHeight * targetAspect)
  } else {
    // Source is taller — crop top/bottom
    cropW = srcWidth
    cropH = Math.round(srcWidth / targetAspect)
  }

  const x = Math.round((srcWidth - cropW) / 2)
  const y = Math.round((srcHeight - cropH) / 2)

  return `crop=${cropW}:${cropH}:${x}:${y}`
}

function buildScaleFilter(quality: Quality, aspectRatio: AspectRatio): string {
  const [w, h] = aspectRatio.split(':').map(Number)
  // Pick the long edge based on aspect orientation: portrait uses height as long edge, landscape uses width.
  const longEdge = quality === '1080p' ? 1920 : 1280
  const targetAspect = w / h
  let width: number
  let height: number
  if (targetAspect >= 1) {
    // Landscape or square: long edge is width
    width = longEdge
    height = Math.round(longEdge / targetAspect)
  } else {
    // Portrait: long edge is height
    height = longEdge
    width = Math.round(longEdge * targetAspect)
  }
  // Ensure dimensions are divisible by 2 (H.264 requirement)
  const safeW = width % 2 === 0 ? width : width + 1
  const safeH = height % 2 === 0 ? height : height + 1
  return `scale=${safeW}:${safeH}`
}

interface Caption {
  start: number
  end: number
  text: string
}

function buildCaptionFilter(captions: Caption[], videoHeight: number): string {
  // Build drawtext filters for each caption segment
  const filters = captions.map((cap) => {
    const escapedText = cap.text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
    const y = Math.round(videoHeight * 0.8)
    return (
      `drawtext=text='${escapedText}':` +
      `fontsize=42:fontcolor=white:` +
      `borderw=3:bordercolor=black@0.8:` +
      `x=(w-text_w)/2:y=${y}:` +
      `enable='between(t,${cap.start},${cap.end})'`
    )
  })
  return filters.join(',')
}

export async function renderClip(params: {
  inputPath: string
  outputPath: string
  startTime: number
  endTime: number
  aspectRatio: AspectRatio
  quality: Quality
  captions?: Caption[]
}): Promise<void> {
  const { inputPath, outputPath, startTime, endTime, aspectRatio, quality, captions } = params
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const meta = await getVideoMetadata(inputPath)
  const cropFilter = buildCropFilter(meta.width, meta.height, aspectRatio)
  const scaleFilter = buildScaleFilter(quality, aspectRatio)

  const filterParts = [cropFilter, scaleFilter]

  if (captions && captions.length > 0) {
    // Adjust caption times relative to clip start
    const relativeCaptions = captions
      .filter(c => c.start >= startTime && c.end <= endTime)
      .map(c => ({
        start: c.start - startTime,
        end: c.end - startTime,
        text: c.text,
      }))

    if (relativeCaptions.length > 0) {
      const [targetW, targetH] = aspectRatio.split(':').map(Number)
      const longEdge = quality === '1080p' ? 1920 : 1280
      const targetAspect = targetW / targetH
      const outputHeight = targetAspect >= 1 ? Math.round(longEdge / targetAspect) : longEdge
      const outputWidth = targetAspect >= 1 ? longEdge : Math.round(longEdge * targetAspect)
      filterParts.push(buildCaptionFilter(relativeCaptions, outputHeight))
      void outputWidth // used implicitly
    }
  }

  const vf = filterParts.join(',')
  const duration = endTime - startTime

  const ffmpeg = getFFmpegBin()
  await execFileAsync(ffmpeg, [
    '-ss', String(startTime),
    '-i', inputPath,
    '-t', String(duration),
    '-vf', vf,
    '-c:v', 'libx264',
    '-preset', quality === '1080p' ? 'medium' : 'fast',
    '-crf', quality === '1080p' ? '18' : '20',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ])
}

export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp: number
): Promise<void> {
  const ffmpeg = getFFmpegBin()
  await execFileAsync(ffmpeg, [
    '-ss', String(timestamp),
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2',
    '-y',
    outputPath,
  ])
}
