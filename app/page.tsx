'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { JobState, ClipCandidate, AspectRatio, Quality } from '@/types'
import { isValidYouTubeUrl, formatDuration } from '@/lib/utils'
// ─── Icons ────────────────────────────────────────────────────────────────────
function IconYT() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', width: '80px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: value >= 7 ? 'var(--accent)' : value >= 5 ? 'var(--warning)' : 'var(--text-3)',
          borderRadius: '2px',
          transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: value >= 7 ? 'var(--accent)' : 'var(--text-2)', width: '24px', textAlign: 'right' }}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Progress indicator ───────────────────────────────────────────────────────
const STEPS: Array<{ key: string; label: string }> = [
  { key: 'downloading', label: 'Download' },
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'analyzing', label: 'AI Score' },
  { key: 'captioning', label: 'Captions' },
  { key: 'rendering', label: 'Render' },
  { key: 'done', label: 'Done' },
]

function PipelineProgress({ job }: { job: JobState }) {
  const stepKeys = STEPS.map(s => s.key)
  const currentIdx = stepKeys.indexOf(job.status)

  return (
    <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--border)' }}>
      {/* Step indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '20px' }}>
        {STEPS.map((step, i) => {
          const done = i < currentIdx || job.status === 'done'
          const active = i === currentIdx && job.status !== 'done'
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: `1.5px solid ${done ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: done ? 'var(--accent)' : active ? 'var(--accent-glow)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}>
                  {done ? (
                    <span style={{ color: '#000' }}><IconCheck /></span>
                  ) : (
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: active ? 'var(--accent)' : 'var(--border-2)',
                      display: 'block',
                      animation: active ? 'blink 1.2s ease-in-out infinite' : 'none',
                    }} />
                  )}
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: done || active ? 'var(--accent)' : 'var(--text-3)',
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: '1px', margin: '0 6px', marginBottom: '22px',
                  background: done ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.3s ease',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--border)', borderRadius: '2px', height: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${job.progress}%`,
          background: 'var(--accent)',
          transition: 'width 0.5s ease',
          boxShadow: '0 0 12px var(--accent)',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>
          {job.message}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)' }}>
          {job.progress}%
        </span>
      </div>
    </div>
  )
}

// ─── Clip Card ────────────────────────────────────────────────────────────────
function ClipCard({ clip, rank }: { clip: ClipCandidate; rank: number }) {
  return (
    <div style={{
      background: 'var(--bg-3)', border: '1px solid var(--border)',
      borderRadius: '4px', padding: '18px',
      animation: 'fade-up 0.4s ease both',
      animationDelay: `${rank * 0.08}s`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#000',
              background: rank === 0 ? 'var(--accent)' : 'var(--text-3)',
              padding: '2px 7px', borderRadius: '2px', letterSpacing: '0.06em',
            }}>
              #{rank + 1} {rank === 0 ? '★ BEST' : ''}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
              {formatDuration(clip.startTime)} → {formatDuration(clip.endTime)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)' }}>
              {clip.duration.toFixed(1)}s
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.5 }}>
            &ldquo;{clip.reason}&rdquo;
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
            {(clip.score.total * 10).toFixed(0)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            /100
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <ScoreBar label="Hook" value={clip.score.hook} />
        <ScoreBar label="Emotion" value={clip.score.emotion} />
        <ScoreBar label="Curiosity" value={clip.score.curiosity} />
        <ScoreBar label="Retention" value={clip.score.retention} />
        <ScoreBar label="Humor" value={clip.score.humor} />
        <ScoreBar label="Payoff" value={clip.score.storyPayoff} />
      </div>

      {/* Transcript preview */}
      <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-2)', borderRadius: '3px', borderLeft: '2px solid var(--border-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
          {clip.transcript}
        </p>
        {clip.outputUrl && (
          <a
            href={clip.outputUrl}
            download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: '3px', fontFamily: 'var(--font-mono)',
              fontSize: '11.5px', fontWeight: 700, textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <IconDownload /> Download
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}
    >
      <div style={{
        width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0,
        background: checked ? 'var(--accent)' : 'var(--border-2)',
        position: 'relative', transition: 'background 0.2s ease', marginTop: '2px',
      }}>
        <div style={{
          position: 'absolute', top: '3px',
          left: checked ? '19px' : '3px',
          width: '14px', height: '14px', borderRadius: '50%',
          background: checked ? '#000' : 'var(--text-3)',
          transition: 'left 0.2s ease, background 0.2s ease',
        }} />
      </div>
      <div>
        <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '1px' }}>{description}</div>}
      </div>
    </button>
  )
}

// ─── Segment buttons ──────────────────────────────────────────────────────────
function SegmentGroup<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '1px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '8px 6px',
              background: value === opt.value ? 'var(--accent)' : 'var(--bg-3)',
              color: value === opt.value ? '#000' : 'var(--text-2)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: value === opt.value ? 700 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [job, setJob] = useState<JobState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Options
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16')
  const [quality, setQuality] = useState<Quality>('720p')
  const [clipDuration, setClipDuration] = useState(30)
  const [addCaptions, setAddCaptions] = useState(true)
  const [addBroll, setAddBroll] = useState(false)
  const [numClips, setNumClips] = useState(1)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback((jobId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.success) {
          setJob(data.data)
          if (data.data.status === 'done' || data.data.status === 'error') {
            stopPolling()
          }
        }
      } catch {
        // network error — keep polling
      }
    }, 1500)
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const handleSubmit = useCallback(async () => {
    setUrlError('')
    if (!url.trim()) {
      setUrlError('Paste a YouTube URL to get started')
      return
    }
    if (!isValidYouTubeUrl(url.trim())) {
      setUrlError('That doesn\'t look like a valid YouTube URL')
      return
    }
    setIsSubmitting(true)
    setJob(null)

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          aspectRatio,
          quality,
          clipDuration,
          addCaptions,
          addBroll,
          numClips,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setUrlError(data.error ?? 'Failed to start job')
        return
      }
      setJob(data.data)
      startPolling(data.data.id)
    } catch {
      setUrlError('Network error — is the server running?')
    } finally {
      setIsSubmitting(false)
    }
  }, [url, aspectRatio, quality, clipDuration, addCaptions, addBroll, numClips, startPolling])

  const handleReset = () => {
    stopPolling()
    setJob(null)
    setUrl('')
    setUrlError('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const isActive = job && job.status !== 'done' && job.status !== 'error'
  const isDone = job?.status === 'done'
  const isError = job?.status === 'error'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '18px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '3px',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: '#000' }}>CF</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
              CLIPFORGE
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Viral Clip Engine
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {['yt-dlp', 'whisper', 'ffmpeg', 'gpt-4o'].map(tag => (
            <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {tag}
            </span>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '900px', width: '100%', margin: '0 auto', padding: '0 24px' }}>
        {/* ── Hero ── */}
        {!job && (
          <div style={{ padding: '64px 0 40px', animation: 'fade-up 0.5s ease both' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              ◆ ONE URL → ONE VIRAL CLIP
            </div>
            <h1 style={{ fontSize: '42px', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '12px' }}>
              Find the <em style={{ fontStyle: 'normal', color: 'var(--accent)', fontWeight: 600 }}>exact moment</em>
              <br />that makes people share.
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: '15px', maxWidth: '480px', lineHeight: 1.6 }}>
              AI scores every second of your video for hook, emotion, curiosity, and retention.
              Auto-crops, captions, and exports in under 2 minutes.
            </p>
          </div>
        )}

        {/* ── URL Input ── */}
        {!job && (
          <div style={{ marginBottom: '40px', animation: 'fade-up 0.5s ease 0.1s both' }}>
            <div style={{
              border: `1px solid ${urlError ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: '4px',
              background: 'var(--bg-2)',
              display: 'flex',
              alignItems: 'center',
              transition: 'border-color 0.2s ease',
              overflow: 'hidden',
            }}
              onFocus={() => { }}
            >
              <div style={{ padding: '0 16px', color: 'var(--text-3)', flexShrink: 0 }}>
                <IconYT />
              </div>
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setUrlError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="https://www.youtube.com/watch?v=..."
                autoFocus
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', color: 'var(--text)',
                  fontFamily: 'var(--font-mono)', fontSize: '13px',
                  padding: '16px 0',
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  padding: '12px 24px', margin: '6px',
                  background: 'var(--accent)', color: '#000',
                  border: 'none', borderRadius: '3px',
                  fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  opacity: isSubmitting ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {isSubmitting ? 'Starting…' : <><span>Analyze</span><IconArrow /></>}
              </button>
            </div>
            {urlError && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--danger)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconX /> {urlError}
              </div>
            )}
          </div>
        )}

        {/* ── Settings ── */}
        {!job && (
          <div style={{
            border: '1px solid var(--border)', borderRadius: '4px',
            padding: '24px', marginBottom: '40px',
            background: 'var(--bg-2)',
            animation: 'fade-up 0.5s ease 0.2s both',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: '20px' }}>
              ── Configuration
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.5fr', gap: '20px', marginBottom: '24px' }}>
              <SegmentGroup
                label="Aspect Ratio"
                value={aspectRatio}
                onChange={setAspectRatio}
                options={[
                  { value: '9:16', label: '9:16' },
                  { value: '1:1', label: '1:1' },
                  { value: '16:9', label: '16:9' },
                ]}
              />
              <SegmentGroup
                label="Quality"
                value={quality}
                onChange={setQuality}
                options={[
                  { value: '720p', label: '720p' },
                  { value: '1080p', label: '1080p' },
                ]}
              />
              <SegmentGroup
                label="Variants"
                value={numClips === 1 ? '1' : '2'}
                onChange={v => setNumClips(Number(v))}
                options={[
                  { value: '1', label: '1 Clip' },
                  { value: '2', label: '2 Clips' },
                ]}
              />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '8px' }}>
                  Clip Length — <span style={{ color: 'var(--accent)' }}>{clipDuration}s</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>20s</span>
                  <input
                    type="range" min={20} max={45} value={clipDuration}
                    onChange={e => setClipDuration(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>45s</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '32px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <Toggle
                checked={addCaptions}
                onChange={setAddCaptions}
                label="Auto Captions"
                description="Burn subtitles into the video"
              />
              <Toggle
                checked={addBroll}
                onChange={setAddBroll}
                label="AI B-Roll"
                description="Insert context cutaways (beta)"
              />
            </div>
          </div>
        )}

        {/* ── Pipeline Progress ── */}
        {job && isActive && (
          <div style={{
            border: '1px solid var(--border)', borderRadius: '4px',
            background: 'var(--bg-2)', marginTop: '32px',
            animation: 'fade-up 0.4s ease both',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                ◆ PROCESSING
              </div>
              {job.videoTitle && (
                <div style={{ fontSize: '14px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.videoTitle}
                </div>
              )}
            </div>
            <PipelineProgress job={job} />
          </div>
        )}

        {/* ── Error State ── */}
        {job && isError && (
          <div style={{
            border: '1px solid var(--danger)', borderRadius: '4px',
            padding: '24px 32px', marginTop: '32px',
            background: 'rgba(255,68,68,0.06)',
            animation: 'fade-up 0.4s ease both',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              ✕ Pipeline Failed
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
              {job.error}
            </p>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px', background: 'transparent',
                border: '1px solid var(--danger)', borderRadius: '3px',
                color: 'var(--danger)', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Done State ── */}
        {job && isDone && (
          <div style={{ marginTop: '32px', animation: 'fade-up 0.4s ease both' }}>
            {/* Download banner */}
            <div style={{
              border: '1px solid var(--accent)', borderRadius: '4px',
              padding: '24px 32px', marginBottom: '24px',
              background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '16px',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  ✓ {job.options.numClips && job.options.numClips > 1 ? 'CLIPS READY' : 'CLIP READY'}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                  {job.videoTitle}
                  {job.selectedClip && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)', marginLeft: '10px' }}>
                      {formatDuration(job.selectedClip.startTime)} → {formatDuration(job.selectedClip.endTime)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {job.outputUrl && (
                  <a
                    href={job.outputUrl}
                    download
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '12px 24px',
                      background: 'var(--accent)', color: '#000',
                      border: 'none', borderRadius: '3px',
                      fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
                      textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
                      cursor: 'pointer',
                    }}
                  >
                    <IconDownload /> {job.options.numClips && job.options.numClips > 1 ? 'Download Clip #1' : 'Download MP4'}
                  </a>
                )}
                {job.candidates && job.candidates[1]?.outputUrl && (
                  <a
                    href={job.candidates[1].outputUrl}
                    download
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '12px 24px',
                      background: 'var(--accent)', color: '#000',
                      border: 'none', borderRadius: '3px',
                      fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
                      textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
                      cursor: 'pointer',
                    }}
                  >
                    <IconDownload /> Download Clip #2
                  </a>
                )}
                <button
                  onClick={handleReset}
                  style={{
                    padding: '12px 20px',
                    background: 'transparent',
                    border: '1px solid var(--border-2)',
                    borderRadius: '3px', color: 'var(--text-2)',
                    fontFamily: 'var(--font-mono)', fontSize: '12px',
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}
                >
                  New Clip
                </button>
              </div>
            </div>

            {/* Clip candidates */}
            {job.candidates && job.candidates.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  ── AI Scored Candidates ({job.candidates.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {job.candidates.map((clip, i) => (
                    <ClipCard key={i} clip={clip} rank={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer tagline ── */}
        {!job && (
          <div style={{ padding: '24px 0 48px', borderTop: '1px solid var(--border)', marginTop: 'auto', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {[
              ['01', 'Paste URL'],
              ['02', 'AI scores every second'],
              ['03', 'Auto-crop + captions'],
              ['04', 'Download MP4'],
            ].map(([num, label]) => (
              <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)' }}>{num}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
