# ClipForge — Viral Clip Engine

**Paste a YouTube URL. Get a viral short-form clip in under 2 minutes.**

AI scores every second of your video for hook, emotion, curiosity, and retention — then auto-crops, captions, and exports the best moment as an MP4.

---

## How It Works

```
URL → Download (yt-dlp) → Transcribe (Whisper) → AI Score (GPT-4o) → Crop + Caption (FFmpeg) → MP4
```

1. **Download** — yt-dlp grabs the video at up to 1080p
2. **Transcribe** — Whisper converts speech to timestamped segments
3. **AI Score** — GPT-4o evaluates every segment on 6 viral dimensions
4. **Crop** — FFmpeg reframes to 9:16 / 1:1 / 16:9 with smart centre-crop
5. **Caption** — Subtitles burned in at the transcript segment level
6. **Export** — H.264 MP4 at 720p or 1080p, ready to post

---

## Quick Start

### Prerequisites

| Tool | Install |
|------|---------|
| Node.js 20+ | https://nodejs.org |
| ffmpeg | brew install ffmpeg / apt install ffmpeg |
| yt-dlp | pip install yt-dlp |
| AI API key | OpenAI or OpenRouter |

### Local

```bash
npm install
cp .env.example .env
# Edit .env — add OPENAI_API_KEY
npm run dev
```

### Docker

```bash
cp .env.example .env
# Edit .env — add OPENAI_API_KEY
docker compose up
```

---

## Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...

# Optional
OPENROUTER_API_KEY=...
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
OUTPUT_DIR=./public/outputs
TEMP_DIR=./tmp
REDIS_URL=redis://localhost:6379
```

---

## AI Scoring Dimensions

| Dimension | Weight |
|-----------|--------|
| Hook      | 30%    |
| Emotion   | 20%    |
| Curiosity | 20%    |
| Retention | 15%    |
| Humor     | 10%    |
| Payoff    | 5%     |

---

## Architecture

```
app/api/jobs/           POST create job, GET poll status
lib/pipeline.ts         Main orchestrator
lib/ai/analyzer.ts      GPT-4o clip scoring
lib/video/downloader.ts yt-dlp wrapper
lib/video/transcriber.ts Whisper wrapper
lib/video/processor.ts  FFmpeg crop/caption/render
```
