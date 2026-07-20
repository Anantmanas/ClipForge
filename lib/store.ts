import { JobState } from '@/types'
import Redis from 'ioredis'

// Singleton for Redis connection to prevent creating new connections on HMR reloads
const redisUrl = process.env.REDIS_URL
const globalForRedis = globalThis as unknown as { redis?: Redis }
let redis: Redis | undefined = globalForRedis.redis

if (!redis && redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  redis.on('error', (err) => {
    console.error('[ioredis] Store client connection error:', err)
  })
  // Cache the Redis singleton globally in all environments
  globalForRedis.redis = redis
}

// Simple store supporting Redis with in-memory fallback
class JobStore {
  private jobs = new Map<string, JobState>()
  private readonly TTL = 1000 * 60 * 60 * 2 // 2 hours

  private get redis(): Redis | undefined {
    return redis
  }

  async set(id: string, state: JobState): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(`job:${id}`, Math.ceil(this.TTL / 1000), JSON.stringify(state))
      } catch (err) {
        console.error('[store] Redis set failed, using memory fallback:', err)
        this.jobs.set(id, state)
        // Auto-cleanup
        setTimeout(() => this.jobs.delete(id), this.TTL)
      }
    } else {
      this.jobs.set(id, state)
      // Auto-cleanup
      setTimeout(() => this.jobs.delete(id), this.TTL)
    }
  }

  async get(id: string): Promise<JobState | undefined> {
    if (this.redis) {
      try {
        const data = await this.redis.get(`job:${id}`)
        return data ? JSON.parse(data) : undefined
      } catch (err) {
        console.error('[store] Redis get failed, using memory fallback:', err)
        return this.jobs.get(id)
      }
    } else {
      return this.jobs.get(id)
    }
  }

  async update(id: string, patch: Partial<JobState>): Promise<JobState | null> {
    const existing = await this.get(id)
    if (!existing) return null
    const updated: JobState = { ...existing, ...patch, updatedAt: Date.now() }
    await this.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`job:${id}`)
    } else {
      this.jobs.delete(id)
    }
  }

  async all(): Promise<JobState[]> {
    if (this.redis) {
      const keys = await this.redis.keys('job:*')
      if (keys.length === 0) return []
      const list = await this.redis.mget(...keys)
      return list.map(item => (item ? JSON.parse(item) : null)).filter(Boolean) as JobState[]
    } else {
      return Array.from(this.jobs.values())
    }
  }
}

// Singleton - survives HMR in dev via globalThis
const globalForStore = globalThis as unknown as { jobStore: JobStore }
export const jobStore = globalForStore.jobStore ?? new JobStore()
if (process.env.NODE_ENV !== 'production') globalForStore.jobStore = jobStore

