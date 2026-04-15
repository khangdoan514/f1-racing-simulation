import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DriverTelemetry, SessionInfo, TelemetryFrame } from '../types/telemetry'
import TyreIcon from './TyreIcon'

const TEAM_LOGO_SLUG: Record<string, string> = {
  'oracle red bull racing': 'redbull',
  'red bull racing': 'redbull',
  'mercedes': 'mercedes',
  'ferrari': 'ferrari',
  'mclaren': 'mclaren',
  'aston martin': 'astonmartin',
  'alpine': 'alpine',
  'williams': 'williams',
  'haas f1 team': 'haas',
  'moneygram haas f1 team': 'haas',
  'rb': 'rb',
  'visa cash app rb': 'rb',
  'racing bulls': 'rb',
  'sauber': 'sauber',
  'stake f1 team kick sauber': 'sauber',
  'kick sauber': 'sauber',
  'audi': 'audi',
}

function teamLogoSlug(team: string): string | null {
  const k = team.trim().toLowerCase()
  return TEAM_LOGO_SLUG[k] ?? null
}

interface LeaderboardProps {
  frameData: TelemetryFrame | null
  sessionInfo?: SessionInfo | null
}

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

function sortDrivers(frame: TelemetryFrame): [string, DriverTelemetry][] {
  return Object.entries(frame.drivers).sort((a, b) => {
    const posA = a[1].position ?? Number.MAX_SAFE_INTEGER
    const posB = b[1].position ?? Number.MAX_SAFE_INTEGER
    if (posA !== posB) return posA - posB
    return a[0].localeCompare(b[0])
  })
}

function intervalLabel(sorted: [string, DriverTelemetry][], index: number): string {
  if (index === 0) return 'LEADER'
  const ahead = sorted[index - 1][1]
  const me = sorted[index][1]
  const lapA = ahead.lap ?? 0
  const lapM = me.lap ?? 0
  if (lapA !== lapM) {
    const d = lapA - lapM
    if (d >= 1) return d === 1 ? '+1 LAP' : `+${d} LAPS`
    return '—'
  }

  // Use backend gap first
  const da = ahead.dist ?? 0
  const dm = me.dist ?? 0
  let gapM =
    ahead.gap_to_leader_m != null && me.gap_to_leader_m != null
      ? Math.max(0, me.gap_to_leader_m - ahead.gap_to_leader_m)
      : Math.abs(da - dm)
  
  // Duplicate gap and use distance
  if (gapM < 0.5) {
    gapM = Math.abs(da - dm)
  }
  
  const ms = Math.max((me.speed ?? 0) / 3.6, 25)
  const sec = gapM / ms
  if (sec > 0 && sec < 0.0005) return '+0.001s'
  if (sec < 600) return `+${sec.toFixed(3)}s`
  return `+${(sec / 60).toFixed(1)}m`
}

function teamInitials(team: string): string {
  const w = team
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase()
  if (w.length === 1 && w[0].length >= 2) return w[0].slice(0, 2).toUpperCase()
  return team.slice(0, 2).toUpperCase() || '—'
}

function textOnHexBackground(hex: string): string {
  const m = hex.replace('#', '')
  if (m.length < 6) return '#f8fafc'
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#f8fafc'
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  return y > 165 ? '#0f172a' : '#f8fafc'
}

function TeamMark({ team, color }: { team: string; color: string }) {
  const slug = teamLogoSlug(team)
  const [imgFailed, setImgFailed] = useState(false)
  const fg = textOnHexBackground(color)

  if (slug && !imgFailed) {
    return (
      <img
        src={`/team-logos/${slug}.png`}
        alt=""
        title={team}
        className="h-7 w-7 shrink-0 rounded bg-zinc-900 object-contain p-0.5 ring-1 ring-black/40"
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[9px] font-black leading-none shadow-inner ring-1 ring-black/30"
      style={{ backgroundColor: color, color: fg }}
      title={team}
    >
      {teamInitials(team)}
    </div>
  )
}

function getGearColor(gear: number) {
  if (gear === 0) return 'text-red-400'
  if (gear >= 7) return 'text-green-400'
  return 'text-yellow-400'
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatRaceResultTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

function DriverTelemetryTiles({ data }: { data: DriverTelemetry }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-1 text-[10px] sm:grid-cols-3">
        <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">Speed</span>
          <span className="font-mono text-[10px] text-white">{Math.round(data.speed)} km/h</span>
        </div>
        <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">Gear</span>
          <span className={`font-mono text-[10px] font-bold ${getGearColor(data.gear)}`}>
            {data.gear === 0 ? 'N' : data.gear}
          </span>
        </div>
        <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">Throttle</span>
          <span className="font-mono text-[10px] text-green-400">{Math.round(data.throttle)}%</span>
        </div>
        <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">Brake</span>
          <span className="font-mono text-[10px] text-red-400">{Math.round(data.brake)}%</span>
        </div>
        <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">DRS</span>
          <span className="font-mono text-[10px]">
            {data.drs > 0 ? (
              <span className="text-purple-400">Open</span>
            ) : (
              <span className="text-gray-500">Closed</span>
            )}
          </span>
        </div>
        <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">Tyre</span>
          <div className="mt-0.5 flex items-center gap-1">
            <TyreIcon compound={data.compound} tyre={data.tyre} size="sm" />
            <span className="min-w-0 flex-1 break-words font-mono text-[10px] text-white">
              {data.compound || '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-900 ring-1 ring-black/30">
        <div className="bg-green-500 transition-[width]" style={{ width: `${data.throttle}%` }} />
        <div className="bg-red-500 transition-[width]" style={{ width: `${data.brake}%` }} />
      </div>
    </>
  )
}

export default function Leaderboard({ frameData, sessionInfo }: LeaderboardProps) {
  const ANIM_MS = 1000
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const prevTopByCodeRef = useRef<Map<string, number>>(new Map())
  const animCleanupRef = useRef<number | null>(null)
  const queuedRowsRef = useRef<[string, DriverTelemetry][] | null>(null)
  const queuedOrderSigRef = useRef<string>('')
  const isAnimatingRef = useRef(false)
  const lastFrameStampRef = useRef<number | null>(null)
  const rows = useMemo(() => (frameData ? sortDrivers(frameData) : []), [frameData])
  const [displayRows, setDisplayRows] = useState<[string, DriverTelemetry][]>(rows)
  const incomingOrderSig = useMemo(() => rows.map(([code, data]) => `${code}:${data.position ?? ''}`).join('|'), [rows])
  const displayOrderSig = useMemo(
    () => displayRows.map(([code, data]) => `${code}:${data.position ?? ''}`).join('|'),
    [displayRows]
  )

  const rowsToRender = displayRows
  const leaderLap = rowsToRender[0]?.[1]?.lap ?? 1
  const showFastestLapUi = leaderLap >= 2 // Fastest lap from lap two
  const fl = frameData?.fastest_lap ?? sessionInfo?.fastest_lap
  const intervalByCode = new Map<string, string>()
  rowsToRender.forEach(([code], index) => {
    intervalByCode.set(code, intervalLabel(rowsToRender, index))
  })

  const leaderData = rowsToRender[0]?.[1]
  const leaderFinished = Boolean(leaderData?.finished)
  const leaderFinishTime =
    leaderFinished && typeof leaderData?.finish_time_seconds === 'number'
      ? leaderData.finish_time_seconds
      : null

  const resultGapByCode = new Map<string, string>()
  if (leaderFinishTime != null) {
    rowsToRender.forEach(([code, data], index) => {
      if (index === 0) {
        resultGapByCode.set(code, formatRaceResultTime(leaderFinishTime))
        return
      }

      if (typeof data.finish_time_seconds === 'number') {
        const delta = Math.max(0, data.finish_time_seconds - leaderFinishTime)
        resultGapByCode.set(code, `+${delta.toFixed(3)}s`)
      } else if (data.out) {
        resultGapByCode.set(code, '-')
      } else {
        resultGapByCode.set(code, intervalByCode.get(code) ?? '—')
      }
    })
  }

  useEffect(() => {
    if (!frameData) {
      prevTopByCodeRef.current = new Map()
      queuedRowsRef.current = null
      queuedOrderSigRef.current = ''
      isAnimatingRef.current = false
      lastFrameStampRef.current = null
      setDisplayRows([])
      if (animCleanupRef.current != null) {
        window.clearTimeout(animCleanupRef.current)
        animCleanupRef.current = null
      }

      return
    }

    const frameStamp = frameData.time ?? frameData.t ?? null
    const frameDidAdvance = frameStamp != null && frameStamp !== lastFrameStampRef.current
    lastFrameStampRef.current = frameStamp
    if (!frameDidAdvance) {
      queuedRowsRef.current = null
      queuedOrderSigRef.current = ''
      return
    }

    if (!displayRows.length) {
      setDisplayRows(rows)
      return
    }

    if (incomingOrderSig === displayOrderSig) {
      setDisplayRows(rows)
      return
    }

    if (isAnimatingRef.current) {
      queuedRowsRef.current = rows
      queuedOrderSigRef.current = incomingOrderSig
      return
    }

    setDisplayRows(rows)
  }, [frameData, rows, incomingOrderSig, displayOrderSig, displayRows.length])

  useLayoutEffect(() => {
    if (!rowsToRender.length) return
    if (animCleanupRef.current != null) {
      window.clearTimeout(animCleanupRef.current)
      animCleanupRef.current = null
    }

    rowsToRender.forEach(([code]) => {
      const el = rowRefs.current.get(code)
      if (!el) return
      el.style.transition = ''
      el.style.transform = ''
    })

    const prevTop = prevTopByCodeRef.current
    const nextTop = new Map<string, number>()
    const moving: Array<{ el: HTMLDivElement; dy: number }> = []
    rowsToRender.forEach(([code]) => {
      const el = rowRefs.current.get(code)
      if (!el) return
      const top = el.getBoundingClientRect().top
      nextTop.set(code, top)
      const before = prevTop.get(code)
      if (before == null) return
      const dy = before - top
      if (Math.abs(dy) < 0.5) return
      moving.push({ el, dy })
    })

    if (moving.length) {
      isAnimatingRef.current = true
      moving.forEach(({ el, dy }) => {
        el.style.transition = 'none'
        el.style.transform = `translateY(${dy}px)`
      })

      void document.body.offsetHeight
      moving.forEach(({ el }) => {
        el.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
        el.style.transform = 'translateY(0)'
      })

      animCleanupRef.current = window.setTimeout(() => {
        rowsToRender.forEach(([code]) => {
          const el = rowRefs.current.get(code)
          if (!el) return
          el.style.transition = ''
          el.style.transform = ''
        })

        isAnimatingRef.current = false
        const next = queuedRowsRef.current
        const nextSig = queuedOrderSigRef.current
        queuedRowsRef.current = null
        queuedOrderSigRef.current = ''
        if (next && nextSig && nextSig !== displayOrderSig) setDisplayRows(next)
        animCleanupRef.current = null
      }, ANIM_MS + 60)
    }

    prevTopByCodeRef.current = nextTop
  }, [displayOrderSig])

  useEffect(() => {
    return () => {
      if (animCleanupRef.current != null) {
        window.clearTimeout(animCleanupRef.current)
        animCleanupRef.current = null
      }
    }
  }, [])

  if (!frameData) {
    return (
      <div className="w-full min-w-0 rounded-lg bg-gray-800/90 p-3 shadow-xl ring-1 ring-gray-700/80">
        <h2 className="mb-2 text-sm font-bold text-red-500">Leaderboard</h2>
        <p className="text-xs text-gray-400">No data available</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full min-w-0 rounded-lg bg-gray-800/90 p-2.5 shadow-xl ring-1 ring-gray-700/80 sm:p-3">
      <h2 className="mb-1.5 pb-1.5 text-sm font-bold tracking-tight text-red-500">
        Leaderboard
      </h2>

      <div className="flex flex-col gap-0.5 overflow-visible text-[12px]">
        {rowsToRender.map(([code, data]) => {
          const expanded = expandedCode === code
          const interval =
            leaderFinishTime != null
              ? (resultGapByCode.get(code) ?? intervalByCode.get(code) ?? '—')
              : (intervalByCode.get(code) ?? '—')

          const isLeader = data.position === 1
          const abbrev = data.abbrev ?? code
          const hasFastestLap = Boolean(showFastestLapUi && fl?.abbrev && abbrev === fl.abbrev)
          const fastestLapRowLabel =
            hasFastestLap && fl && typeof fl.time_seconds === 'number'
              ? fl.lap
                ? `Fastest Lap - ${formatLapTime(fl.time_seconds)} - L${fl.lap}`
                : `Fastest Lap - ${formatLapTime(fl.time_seconds)}`
              : null

          const toggle = () => setExpandedCode((c) => (c === code ? null : code))
          return (
            <div
              key={code}
              ref={(el) => {
                rowRefs.current.set(code, el)
              }}
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              aria-label={`${abbrev}, position ${data.position ?? '?'}. Press to ${expanded ? 'collapse' : 'expand'} session detail.`}
              className={`cursor-pointer rounded text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500/60 ${
                expanded
                  ? 'border border-red-500/50 bg-gray-700/95 ring-1 ring-red-500/20'
                  : hasFastestLap
                    ? 'border border-purple-500/40 bg-purple-950/15 hover:border-purple-400/50' : ''
              }`}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggle()
                }
              }}
            >
              <div className="flex min-h-0 flex-wrap items-center gap-x-1 gap-y-0.5 px-1.5 py-1">
                <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums leading-none text-gray-200">
                  {data.position ?? '—'}
                </span>

                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <TeamMark team={data.team ?? 'Team'} color={data.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-0">
                      <span className="text-xs font-bold tracking-wide text-white">{abbrev}</span>
                      {fastestLapRowLabel ? (
                        <span
                          className="max-w-[min(100%,12rem)] truncate rounded bg-purple-900/80 px-1 py-px font-mono text-[10px] font-semibold tabular-nums leading-tight text-purple-100 sm:max-w-[18rem]"
                          title={fastestLapRowLabel}
                        >
                          {fastestLapRowLabel}
                        </span>
                      ) : null}
                      {data.finished ? (
                        <span className="rounded bg-emerald-950/80 px-1 py-px text-[8px] font-semibold uppercase text-emerald-300 ring-1 ring-emerald-700/50">
                          FINISH
                        </span>
                      ) : data.out ? (
                        <span className="rounded bg-zinc-800/90 px-1 py-px text-[8px] font-semibold uppercase text-zinc-300 ring-1 ring-zinc-600/60">
                          OUT
                        </span>
                      ) : data.pitting ? (
                        <span className="rounded bg-red-950/80 px-1 py-px text-[8px] font-semibold uppercase text-red-300">
                          Pit
                        </span>
                      ) : null}
                    </div>
                    {data.team ? (
                      <p className="truncate text-[9px] leading-tight text-gray-500">{data.team}</p>
                    ) : null}
                  </div>
                </div>

                <div
                  className={`ml-auto min-w-[2.85rem] shrink-0 text-right font-mono text-[10px] font-semibold tabular-nums leading-tight ${
                    isLeader ? 'text-amber-400' : 'text-gray-200'
                  }`}
                >
                  {interval === 'LEADER' ? 'LEADER' : interval}
                </div>

                <TyreIcon compound={data.compound} tyre={data.tyre} size="sm" />

                <span
                  className={`inline-block shrink-0 text-[9px] text-gray-400 transition-transform duration-200 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                >
                  ▾
                </span>
              </div>

              {expanded && (
                <div className="border-t border-gray-600/70 px-2 pb-2.5 pt-2 sm:px-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Session detail
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
                      <span className="block text-[9px] uppercase tracking-wide text-gray-500">Lap</span>
                      <span className="font-mono text-[10px] text-white">{data.lap ?? '—'}</span>
                    </div>
                    <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50">
                      <span className="block text-[9px] uppercase tracking-wide text-gray-500">Pit stops so far</span>
                      <span className="font-mono text-[10px] text-white">{data.pit_stops ?? 0}</span>
                    </div>
                    <div className="rounded bg-gray-800/90 px-2 py-1.5 ring-1 ring-gray-600/50 sm:col-span-1">
                      <span className="block text-[9px] uppercase tracking-wide text-gray-500">Race distance</span>
                      <span className="font-mono text-[10px] text-white">
                        {data.dist != null ? `${(data.dist / 1000).toFixed(3)} km` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <DriverTelemetryTiles data={data} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(frameData.time ?? frameData.t) !== undefined && (
        <div className="mt-2 border-t border-gray-700 pt-2">
          <div className="text-[11px] text-gray-400">
            Race time{' '}
            <span className="font-mono text-gray-200">{formatTime(frameData.time ?? frameData.t ?? 0)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
