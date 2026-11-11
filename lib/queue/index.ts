import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { runPipeline } from '../pipeline'

const redisUrl = process.env.REDIS_URL

const globalForQueue = globalThis as unknown as {
  queueConnection?: Redis
  workerConnection?: Redis
  videoQueue?: Queue
  videoWorker?: Worker
}

function createRedisConnection(label: string): Redis {
  const conn = new Redis(redisUrl!, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    keepAlive: 30000,
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
      return targetErrors.some((e) => err.message.includes(e))
    },
  })
  conn.on('error', (err: any) => {
    // Upstash closes idle TCP sockets; ioredis reconnects automatically
    if (err?.code === 'ECONNRESET') return
    console.error(`[ioredis] ${label} Redis connection error:`, err)
  })
  return conn
}

export function getRedisConnection(): Redis | undefined {
  if (!redisUrl) return undefined
  if (!globalForQueue.queueConnection) {
    globalForQueue.queueConnection = createRedisConnection('Queue')
  }
  return globalForQueue.queueConnection
}

function getWorkerConnection(): Redis | undefined {
  if (!redisUrl) return undefined
  if (!globalForQueue.workerConnection) {
    globalForQueue.workerConnection = createRedisConnection('Worker')
  }
  return globalForQueue.workerConnection
}

export function getVideoQueue(): Queue | undefined {
  const connection = getRedisConnection()
  if (!connection) return undefined
  if (!globalForQueue.videoQueue) {
    const q = new Queue('video-jobs', { connection })
    q.on('error', (err) => {
      console.error('[BullMQ] Queue error:', err)
    })
    globalForQueue.videoQueue = q
  }
  return globalForQueue.videoQueue
}

export function initWorker(): Worker | undefined {
  const connection = getWorkerConnection()
  if (!connection) return undefined
  if (!globalForQueue.videoWorker) {
    const w = new Worker(
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
    w.on('error', (err) => {
      console.error('[BullMQ] Worker error:', err)
    })
    console.log('[Worker] BullMQ worker initialized.')
    globalForQueue.videoWorker = w
  }
  return globalForQueue.videoWorker
}
