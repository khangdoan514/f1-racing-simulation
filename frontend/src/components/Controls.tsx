import { Play, Pause, RotateCcw, Rewind, FastForward } from 'lucide-react'

interface ControlsProps {
  isPlaying: boolean
  playbackSpeed: number
  currentFrame: number
  totalFrames: number
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  onSpeedChange: (speed: number) => void
  onSeek: (frame: number) => void
}

export default function Controls({
  isPlaying,
  playbackSpeed,
  currentFrame,
  totalFrames,
  onPlay,
  onPause,
  onRestart,
  onSpeedChange,
  onSeek,
}: ControlsProps) {
  const speeds = [0.25, 0.5, 1, 2, 4, 8]

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const frame = Math.floor(percentage * totalFrames)
    onSeek(frame)
  }

  const progress = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6">
      {/* Progress Bar */}
      <div className="mb-4">
        <div
          className="h-2 bg-gray-700 rounded-full cursor-pointer hover:bg-gray-600 transition-colors"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-400 font-mono">
          <span>Frame: {currentFrame}</span>
          <span>Total: {totalFrames}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Restart */}
        <button
          onClick={onRestart}
          className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
          title="Restart"
        >
          <RotateCcw size={20} />
        </button>

        {/* Rewind */}
        <button
          onClick={() => onSeek(Math.max(0, currentFrame - 100))}
          className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
          title="Rewind 100 frames"
        >
          <Rewind size={20} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-lg"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </button>

        {/* Fast Forward */}
        <button
          onClick={() => onSeek(Math.min(totalFrames - 1, currentFrame + 100))}
          className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
          title="Fast forward 100 frames"
        >
          <FastForward size={20} />
        </button>

        {/* Speed Control */}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm text-gray-400">Speed:</span>
          <div className="flex gap-1">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-3 py-1 rounded text-sm font-mono transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}