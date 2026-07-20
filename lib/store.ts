import { JobState } from '@/types'

// Simple in-memory store with TTL
class JobStore {
  private jobs = new Map<string, JobState>()
  private readonly TTL = 1000 * 60 * 60 * 2 // 2 hours

  set(id: string, state: JobState): void {
    this.jobs.set(id, state)
    // Auto-cleanup
    setTimeout(() => this.jobs.delete(id), this.TTL)
  }

  get(id: string): JobState | undefined {
    return this.jobs.get(id)
  }

  update(id: string, patch: Partial<JobState>): JobState | null {
    const existing = this.jobs.get(id)
    if (!existing) return null
    const updated: JobState = { ...existing, ...patch, updatedAt: Date.now() }
    this.jobs.set(id, updated)
    return updated
  }

  delete(id: string): void {
    this.jobs.delete(id)
  }

  all(): JobState[] {
    return Array.from(this.jobs.values())
  }
}

// Singleton - survives HMR in dev via globalThis
const globalForStore = globalThis as unknown as { jobStore: JobStore }
export const jobStore = globalForStore.jobStore ?? new JobStore()
if (process.env.NODE_ENV !== 'production') globalForStore.jobStore = jobStore
