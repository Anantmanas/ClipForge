import { NextRequest, NextResponse } from 'next/server'
import { jobStore } from '@/lib/store'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = await jobStore.get(id)

  if (!job) {
    return NextResponse.json(
      { success: false, error: 'Job not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, data: job })
}
