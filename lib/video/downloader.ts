import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

export interface DownloadResult {
  filePath: string
  title: string
  duration: number
  width: number
  height: number
}

async function findYtDlp(): Promise<string> {
  const candidates = ['yt-dlp', 'yt_dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp']
  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ['--version'])
      return bin
    } catch {
      // try next
    }
  }
  throw new Error(
    'yt-dlp not found. Please install it: https://github.com/yt-dlp/yt-dlp#installation'
  )
}

export async function getVideoInfo(url: string): Promise<{ title: string; duration: number }> {
  const ytdlp = await findYtDlp()
  const { stdout } = await execFileAsync(ytdlp, [
    '--dump-json',
    '--no-playlist',
    '--extractor-args', 'youtube:player_client=android,web',
    url,
  ])
  const info = JSON.parse(stdout)
  return {
    title: info.title ?? 'Unknown',
    duration: info.duration ?? 0,
  }
}

export async function downloadVideo(
  url: string,
  outputDir: string,
  jobId: string
): Promise<DownloadResult> {
  fs.mkdirSync(outputDir, { recursive: true })
  const outputTemplate = path.join(outputDir, `${jobId}.%(ext)s`)
  const ytdlp = await findYtDlp()

  // Get metadata first
  const { stdout: jsonOut } = await execFileAsync(ytdlp, [
    '--dump-json',
    '--no-playlist',
    '--extractor-args', 'youtube:player_client=android,web',
    url,
  ])
  const info = JSON.parse(jsonOut)

  // Download best quality mp4 up to 1080p
  await execFileAsync(ytdlp, [
    '-f',
    'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '--merge-output-format',
    'mp4',
    '-o',
    outputTemplate,
    '--no-playlist',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=android,web',
    url,
  ])

  // Find the downloaded file
  const files = fs.readdirSync(outputDir).filter(f => f.startsWith(jobId) && f.endsWith('.mp4'))
  if (files.length === 0) {
    throw new Error('Download completed but no mp4 file found')
  }

  return {
    filePath: path.join(outputDir, files[0]),
    title: info.title ?? 'Unknown',
    duration: info.duration ?? 0,
    width: info.width ?? 1920,
    height: info.height ?? 1080,
  }
}
