import { NextRequest, NextResponse } from 'next/server'
import { jobStore } from '@/lib/store'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const job = await jobStore.get(id)

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: job })
  } catch (err) {
    console.error('GET /api/jobs/[id] error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: `Internal server error: ${errMsg}` },
      { status: 500 }
    )
  }
}
