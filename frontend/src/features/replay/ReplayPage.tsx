import Controls from '../../components/Controls'
import Leaderboard from '../../components/Leaderboard'
import RaceTrack from '../../components/RaceTrack'
import TrackAmbientBar from '../../components/TrackAmbientBar'
import type { SessionInfo, TelemetryFrame, TrackBoundaries } from '../../types/telemetry'

interface Props {
  currentFrame: TelemetryFrame | null
  sessionInfo: SessionInfo | null
  trackBoundaries?: TrackBoundaries
  isPlaying: boolean
  playbackSpeed: number
  frameIndex: number
  totalFrames: number
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  onSpeedChange: (speed: number) => void
  onSeek: (frame: number) => void
}

export default function ReplayPage(props: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <div className="min-w-0 lg:col-span-8">
        <TrackAmbientBar frame={props.currentFrame} />
        <div className="rounded-lg bg-gray-800 p-3 shadow-xl sm:p-4">
          <RaceTrack
            frameData={props.currentFrame}
            sessionInfo={props.sessionInfo}
            trackBoundaries={props.trackBoundaries}
          />
        </div>
        <div className="mt-6">
          <Controls
            isPlaying={props.isPlaying}
            playbackSpeed={props.playbackSpeed}
            currentFrame={props.frameIndex}
            totalFrames={props.totalFrames}
            onPlay={props.onPlay}
            onPause={props.onPause}
            onRestart={props.onRestart}
            onSpeedChange={props.onSpeedChange}
            onSeek={props.onSeek}
          />
        </div>
      </div>
      <div className="min-w-0 lg:col-span-4">
        <Leaderboard frameData={props.currentFrame} sessionInfo={props.sessionInfo} />
      </div>
    </div>
  )
}
