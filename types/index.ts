export type AspectRatio = '9:16' | '1:1' | '16:9'
export type Quality = '720p' | '1080p'
export type JobStatus = 'queued' | 'downloading' | 'transcribing' | 'analyzing' | 'clipping' | 'captioning' | 'rendering' | 'done' | 'error'

export interface ClipScore {
  hook: number       // 0-10
  emotion: number    // 0-10
  curiosity: number  // 0-10
  retention: number  // 0-10
  humor: number      // 0-10
  storyPayoff: number // 0-10
  total: number      // weighted average
}

export interface ClipCandidate {
  startTime: number   // seconds
  endTime: number     // seconds
  duration: number    // seconds
  transcript: string
  score: ClipScore
  reason: string
  outputUrl?: string
  outputPath?: string
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

export interface JobOptions {
  url: string
  aspectRatio: AspectRatio
  quality: Quality
  clipDuration: number   // target seconds (20-45)
  addCaptions: boolean
  addBroll: boolean
  numClips: number
}

export interface JobState {
  id: string
  status: JobStatus
  progress: number       // 0-100
  message: string
  options: JobOptions
  videoTitle?: string
  videoDuration?: number
  candidates?: ClipCandidate[]
  selectedClip?: ClipCandidate
  outputPath?: string
  outputUrl?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
