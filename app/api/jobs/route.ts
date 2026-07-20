import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { jobStore } from '@/lib/store'
import { runPipeline } from '@/lib/pipeline'
import { isValidYouTubeUrl } from '@/lib/utils'
import { JobState } from '@/types'

const CreateJobSchema = z.object({
  url: z.string().url(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
  quality: z.enum(['720p', '1080p']).default('720p'),
  clipDuration: z.number().min(20).max(45).default(30),
  addCaptions: z.boolean().default(true),
  addBroll: z.boolean().default(false),
  numClips: z.number().min(1).max(2).default(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateJobSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const options = parsed.data

    if (!isValidYouTubeUrl(options.url)) {
      return NextResponse.json(
        { success: false, error: 'Invalid YouTube URL' },
        { status: 400 }
      )
    }

    const id = uuidv4()
    const now = Date.now()

    const state: JobState = {
      id,
      status: 'queued',
      progress: 0,
      message: 'Job queued…',
      options,
      createdAt: now,
      updatedAt: now,
    }

    jobStore.set(id, state)

    // Run pipeline asynchronously (inline worker mode)
    // In production with Redis, this would dispatch to a BullMQ queue
    setImmediate(() => runPipeline(id, options))

    return NextResponse.json({ success: true, data: state }, { status: 201 })
  } catch (err) {
    console.error('POST /api/jobs error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
