import type { TelemetryFrame } from '../types/telemetry'

function flagPresentation(message: string): { label: string; badgeClass: string } {
  const m = message.trim()
  if (!m || m === 'AllClear') {
    return { label: 'GREEN', badgeClass: 'bg-emerald-600/90 text-white ring-1 ring-emerald-400/50' }
  }
  if (/yellow/i.test(m)) {
    return { label: 'YELLOW', badgeClass: 'bg-yellow-500 text-black ring-1 ring-yellow-300/80' }
  }
  if (/red/i.test(m) && !/vsc/i.test(m)) {
    return { label: 'RED', badgeClass: 'bg-red-600 text-white ring-1 ring-red-400/60' }
  }
  if (/vsc/i.test(m)) {
    return { label: 'VSC', badgeClass: 'bg-orange-600 text-white ring-1 ring-orange-400/50' }
  }
  if (/safety/i.test(m) || /^sc$/i.test(m)) {
    return { label: 'SC', badgeClass: 'bg-amber-500 text-black ring-1 ring-amber-300/70' }
  }
  return {
    label: m.toUpperCase().slice(0, 12),
    badgeClass: 'bg-zinc-600 text-white ring-1 ring-zinc-400/50',
  }
}

function formatNum(n: number | undefined, suffix = '', decimals = 1): string | null {
  if (n === undefined || Number.isNaN(n)) return null
  return `${n.toFixed(decimals)}${suffix}`
}

interface Props {
  frame: TelemetryFrame | null
}

export default function TrackAmbientBar({ frame }: Props) {
  const ts = frame?.track_status
  const w = frame?.weather
  const flag = ts ? flagPresentation(ts.message) : { label: '—', badgeClass: 'bg-zinc-700 text-zinc-300' }

  const showRawMessage =
    ts &&
    ts.message &&
    ts.message !== 'AllClear' &&
    ts.message.trim().toLowerCase() !== flag.label.trim().toLowerCase()

  const parts: string[] = []
  const air = formatNum(w?.air_temp, '°C')
  const trk = formatNum(w?.track_temp, '°C')
  const hum = formatNum(w?.humidity, '%', 0)
  const pres = w?.pressure != null && !Number.isNaN(w.pressure) ? `${Math.round(w.pressure)} hPa` : null
  const wind =
    w?.wind_speed != null && !Number.isNaN(w.wind_speed)
      ? `${w.wind_speed.toFixed(1)} m/s${w.wind_direction != null && !Number.isNaN(w.wind_direction) ? ` @ ${Math.round(w.wind_direction)}°` : ''}`
      : null
  const rain = w?.rain_state ?? (w?.rainfall != null && w.rainfall > 0.5 ? 'Wet' : w?.rainfall != null ? 'Dry' : null)

  if (air) parts.push(`Air ${air}`)
  if (trk) parts.push(`Track ${trk}`)
  if (hum) parts.push(`Humidity ${hum}`)
  if (pres) parts.push(pres)
  if (wind) parts.push(`Wind ${wind}`)
  if (rain) parts.push(rain)

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-gray-600/60 bg-gray-900/80 px-3 py-2 text-[11px] text-gray-200 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Track</span>
        <span
          className={`inline-flex min-h-[1.5rem] items-center rounded px-2 py-0.5 text-[11px] font-bold tabular-nums ${flag.badgeClass}`}
          title={ts ? `Status ${ts.status} · ${ts.message}` : undefined}
        >
          {flag.label}
        </span>
        {showRawMessage ? (
          <span className="truncate text-[10px] text-gray-400" title={ts.message}>
            {ts.message}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 text-[10px] leading-snug text-gray-300 sm:text-right">
        <span className="font-semibold uppercase tracking-wide text-gray-500">Weather</span>
        <span className="ml-1.5 text-gray-200">
          {parts.length > 0 ? parts.join(' · ') : '—'}
        </span>
      </div>
    </div>
  )
}
