# ClipForge – Fix Redis 500 Error

## Context
The app crashes with:
> `Internal server error: Reached the max retries per request limit (which is 20)`

This happens because the ioredis client in `lib/store.ts` uses default settings that exhaust retries when Redis is unreachable, throwing a 500 instead of failing gracefully.

---

## Pre-requisite (Do this manually before running the agent)

1. Go to [upstash.com](https://upstash.com) → create a free Redis database
2. Copy the Redis URL (format: `redis://default:<pass>@<host>:<port>`)
3. In **Vercel Dashboard → ClipForge → Settings → Environment Variables**, add:
   ```
   REDIS_URL = <your-upstash-url>
   ```
4. Redeploy the project on Vercel

---

## Agent Instructions

### Fix 1 — `lib/store.ts`

**a) Add missing options to the Redis client:**

Find:
```ts
redis = new Redis(redisUrl)
```
Replace with:
```ts
redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})
```

**b) Cache the singleton in production too:**

Find:
```ts
if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}
```
Replace with:
```ts
globalForRedis.redis = redis
```

**c) Wrap `jobStore.get` and `jobStore.set` in try/catch with in-memory fallback:**

```ts
export const jobStore = {
  async get(id: string): Promise<JobState | undefined> {
    if (redis) {
      try {
        const raw = await redis.get(`job:${id}`)
        return raw ? JSON.parse(raw) : undefined
      } catch (err) {
        console.error('[store] Redis get failed, using memory fallback:', err)
      }
    }
    return memStore.get(id)
  },

  async set(id: string, state: JobState): Promise<void> {
    if (redis) {
      try {
        await redis.set(`job:${id}`, JSON.stringify(state), 'EX', 3600)
        return
      } catch (err) {
        console.error('[store] Redis set failed, using memory fallback:', err)
      }
    }
    memStore.set(id, state)
  },
}
```

---

### Fix 2 — `lib/queue/index.ts`

Confirm `maxRetriesPerRequest: null` is already present on the BullMQ connection (added in the last commit). If not, add it:

```ts
redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
})
```

---

## After Making Changes

```bash
git add lib/store.ts lib/queue/index.ts
git commit -m "fix: Redis client options and graceful fallback on store errors"
git push
```

Vercel will auto-deploy. The 500 error should be gone.
