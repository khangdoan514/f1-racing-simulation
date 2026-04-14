import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SessionSelectionPage from './features/selection/SessionSelectionPage'
import ReplayPage from './features/replay/ReplayPage'
import QualifyingPage from './features/qualifying/QualifyingPage'
import { buildReplayWebSocket, controlPlayback, getCurrentFrame, getQualifyingSummary, loadSession as apiLoadSession, seekFrame, setPlaybackSpeed as apiSetPlaybackSpeed } from './lib/api'
import type { QualifyingSummary, SessionInfo, TelemetryFrame, TrackBoundaries } from './types/telemetry'

function App() {
  const [mode, setMode] = useState<'selection' | 'race' | 'qualifying'>('selection')
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [currentFrame, setCurrentFrame] = useState<TelemetryFrame | null>(null)
  const [totalFrames, setTotalFrames] = useState(0)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [trackBoundaries, setTrackBoundaries] = useState<TrackBoundaries | undefined>(undefined)
  const [qualifyingSummary, setQualifyingSummary] = useState<QualifyingSummary | null>(null)

  const animationFrameRef = useRef<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const fetchCurrentFrame = useCallback(async () => {
    try {
      const data = await getCurrentFrame()
      if (data.frame) {
        setCurrentFrame(data.frame)
        setFrameIndex(data.frame_index)
        setTotalFrames(data.total_frames)
        setIsPlaying(data.is_playing)
        setPlaybackSpeed(data.playback_speed)
      }
    } catch (error) {
      console.error('Failed to fetch frame:', error)
    }
  }, [])

  useEffect(() => {
    if (!sessionLoaded || mode !== 'race') return
    const ws = buildReplayWebSocket()
    wsRef.current = ws
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'frame') {
          setCurrentFrame(data.frame)
          setFrameIndex(data.frame_index)
          setTotalFrames(data.total_frames)
          setIsPlaying(data.is_playing)
          setPlaybackSpeed(data.playback_speed)
        }
      } catch {
        
      }
    }

    const loop = async () => {
      await fetchCurrentFrame()
      animationFrameRef.current = requestAnimationFrame(loop)
    }
    animationFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      ws.close()
    }
  }, [fetchCurrentFrame, mode, sessionLoaded])

  const loadSession = async (year: number, round: number, sessionType: string = 'R') => {
    try {
      const data = await apiLoadSession(year, round, sessionType)
      if (data.status === 'loaded') {
        setSessionInfo(data.session_info)
        setTotalFrames(data.total_frames)
        setTrackBoundaries({
          inner: data.track_boundaries?.inner ?? { x: [], y: [] },
          outer: data.track_boundaries?.outer ?? { x: [], y: [] },
          center: data.track_boundaries?.center ?? { x: [], y: [] },
          corridorWidthM: data.track_boundaries?.corridor_width_m ?? 220,
          sectorSplits: data.track_boundaries?.sector_splits ?? [],
          drsZones: data.track_boundaries?.drs_zones ?? [],
          finishLine: data.track_boundaries?.finish_line
            ? data.track_boundaries.finish_line
            : { x: [], y: [] },
        })
        setSessionLoaded(true)
        if (data.mode === 'qualifying') {
          setMode('qualifying')
          const summary = await getQualifyingSummary()
          setQualifyingSummary(summary)
        } else {
          setMode('race')
          await fetchCurrentFrame()
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  const handlePlay = async () => {
    await controlPlayback('play')
  }

  const handlePause = async () => {
    await controlPlayback('pause')
  }

  const handleRestart = async () => {
    await controlPlayback('restart')
    await fetchCurrentFrame()
  }

  const handleSpeedChange = async (speed: number) => {
    await apiSetPlaybackSpeed(speed)
    setPlaybackSpeed(speed)
  }

  const handleSeek = async (frame: number) => {
    await seekFrame(frame)
    await fetchCurrentFrame()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <main className="mx-auto max-w-[min(100%,96rem)] px-3 py-6 sm:px-4 sm:py-8">
        {!sessionLoaded ? (
          <SessionSelectionPage onLoadSession={loadSession} />
        ) : mode === 'qualifying' ? (
          <QualifyingPage summary={qualifyingSummary} />
        ) : (
          <ReplayPage
            currentFrame={currentFrame}
            sessionInfo={sessionInfo}
            trackBoundaries={trackBoundaries}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            frameIndex={frameIndex}
            totalFrames={totalFrames}
            onPlay={handlePlay}
            onPause={handlePause}
            onRestart={handleRestart}
            onSpeedChange={handleSpeedChange}
            onSeek={handleSeek}
          />
        )}
      </main>
    </div>
  )
}

export default App