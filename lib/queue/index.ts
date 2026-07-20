import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { runPipeline } from '../pipeline'

const redisUrl = process.env.REDIS_URL

const globalForQueue = globalThis as unknown as {
  queueConnection?: Redis
  videoQueue?: Queue
  videoWorker?: Worker
}

export function getRedisConnection(): Redis | undefined {
  if (!redisUrl) return undefined
  if (!globalForQueue.queueConnection) {
    globalForQueue.queueConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
    })
  }
  return globalForQueue.queueConnection
}

export function getVideoQueue(): Queue | undefined {
  const connection = getRedisConnection()
  if (!connection) return undefined
  if (!globalForQueue.videoQueue) {
    globalForQueue.videoQueue = new Queue('video-jobs', { connection })
  }
  return globalForQueue.videoQueue
}

export function initWorker(): Worker | undefined {
  const connection = getRedisConnection()
  if (!connection) return undefined
  if (!globalForQueue.videoWorker) {
    globalForQueue.videoWorker = new Worker(
      'video-jobs',
      async (job) => {
        const { id, options } = job.data
        console.log(`[Worker] Processing job ${id}...`)
        try {
          await runPipeline(id, options)
        } catch (error) {
          console.error(`[Worker] Job ${id} failed with error:`, error)
          throw error
        }
      },
      { connection, concurrency: 1 }
    )
    console.log('[Worker] BullMQ worker initialized.')
  }
  return globalForQueue.videoWorker
}
