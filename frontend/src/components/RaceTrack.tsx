import { useEffect, useRef, useState } from 'react'
import type { TelemetryFrame, SessionInfo } from '../types/telemetry'

const SECTOR_FILL_COLORS: readonly [string, string, string] = ['#9b3a45', '#cebf96', '#6892a0']

function formatSectorSeconds(seconds: number | null | undefined): string {
  if (seconds == null || typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return '—'
  }

  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds - m * 60
    return `${m}:${s.toFixed(3).padStart(6, '0')}`
  }
  
  return `${seconds.toFixed(3)}s`
}

interface RaceTrackProps {
  frameData: TelemetryFrame | null
  sessionInfo: SessionInfo | null
  trackBoundaries?: {
    inner: { x: number[]; y: number[] }
    outer: { x: number[]; y: number[] }
    center?: { x: number[]; y: number[] }
    corridorWidthM?: number
    sectorSplits?: number[]
    drsZones?: Array<{ start: number; end: number }>
    finishLine?: { x: number[]; y: number[] }
  }
}

type SectorHoverLayout = {
  canvasW: number
  canvasH: number
  worldCenterX: number
  worldCenterY: number
  screenCenterX: number
  screenCenterY: number
  scale: number
  rotateLeft90: boolean
  centerPts: { x: number; y: number }[]
  cutA: number
  cutB: number
  maxHoverDistSq: number
}

// Midpoint of inner and outer
function buildCenterline(
  inner: { x: number[]; y: number[] },
  outer: { x: number[]; y: number[] }
): { x: number; y: number }[] {
  const n = Math.min(inner.x.length, inner.y.length, outer.x.length, outer.y.length)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    pts.push({
      x: (inner.x[i] + outer.x[i]) / 2,
      y: (inner.y[i] + outer.y[i]) / 2,
    })
  }

  return pts
}

// Circular Laplacian smooth
function smoothClosedRing(
  xs: number[],
  ys: number[],
  count: number,
  passes = 2
): { x: number[]; y: number[] } {
  const n = Math.min(count, xs.length, ys.length)
  if (n < 3) return { x: xs.slice(0, n), y: ys.slice(0, n) }
  let x = xs.slice(0, n)
  let y = ys.slice(0, n)
  for (let p = 0; p < passes; p++) {
    const nx = new Array(n)
    const ny = new Array(n)
    for (let i = 0; i < n; i++) {
      const im = (i - 1 + n) % n
      const ip = (i + 1) % n
      nx[i] = 0.25 * x[im] + 0.5 * x[i] + 0.25 * x[ip]
      ny[i] = 0.25 * y[im] + 0.5 * y[i] + 0.25 * y[ip]
    }

    x = nx
    y = ny
  }

  return { x, y }
}

// Pull boundary toward center
function blendBoundaryTowardCenter(
  boundary: { x: number[]; y: number[] },
  center: { x: number[]; y: number[] },
  factor: number
): { x: number[]; y: number[] } {
  const n = Math.min(boundary.x.length, boundary.y.length, center.x.length, center.y.length)
  const outX: number[] = []
  const outY: number[] = []
  const k = Math.max(0, Math.min(1, factor))
  for (let i = 0; i < n; i++) {
    outX.push(boundary.x[i] * (1 - k) + center.x[i] * k)
    outY.push(boundary.y[i] * (1 - k) + center.y[i] * k)
  }

  return { x: outX, y: outY }
}

// Closest point on polyline
function closestPointOnPolyline(
  px: number,
  py: number,
  points: { x: number; y: number }[],
  closed: boolean
): { x: number; y: number } {
  if (points.length === 0) return { x: px, y: py }
  if (points.length === 1) return { ...points[0] }
  const considerSegment = (ax: number, ay: number, bx: number, by: number) => {
    const abx = bx - ax
    const aby = by - ay
    const apx = px - ax
    const apy = py - ay
    const ab2 = abx * abx + aby * aby
    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0
    t = Math.max(0, Math.min(1, t))
    const qx = ax + t * abx
    const qy = ay + t * aby
    const d = (px - qx) ** 2 + (py - qy) ** 2
    if (d < bestD) {
      bestD = d
      bestX = qx
      bestY = qy
    }
  }

  let bestX = points[0].x
  let bestY = points[0].y
  let bestD = (px - bestX) ** 2 + (py - bestY) ** 2

  for (let i = 0; i < points.length - 1; i++) {
    considerSegment(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)
  }

  if (closed && points.length >= 3) {
    const last = points[points.length - 1]
    const first = points[0]
    considerSegment(last.x, last.y, first.x, first.y)
  }

  return { x: bestX, y: bestY }
}

// Closest point on closed polyline
function closestArcFracOnRing(
  wx: number,
  wy: number,
  pts: { x: number; y: number }[]
): { frac: number; distSq: number } {
  const n = pts.length
  if (n < 2) return { frac: 0, distSq: Infinity }
  const segLens: number[] = []
  let total = 0
  for (let i = 0; i < n; i++) {
    const ax = pts[i].x
    const ay = pts[i].y
    const bx = pts[(i + 1) % n].x
    const by = pts[(i + 1) % n].y
    const d = Math.hypot(bx - ax, by - ay)
    segLens.push(d)
    total += d
  }

  if (total <= 0) return { frac: 0, distSq: Infinity }
  let bestDist = Infinity
  let bestS = 0
  let cum = 0
  for (let i = 0; i < n; i++) {
    const ax = pts[i].x
    const ay = pts[i].y
    const bx = pts[(i + 1) % n].x
    const by = pts[(i + 1) % n].y
    const abx = bx - ax
    const aby = by - ay
    const apx = wx - ax
    const apy = wy - ay
    const ab2 = abx * abx + aby * aby
    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0
    t = Math.max(0, Math.min(1, t))
    const qx = ax + t * abx
    const qy = ay + t * aby
    const dq = (wx - qx) ** 2 + (wy - qy) ** 2
    if (dq < bestDist) {
      bestDist = dq
      bestS = cum + t * segLens[i]
    }

    cum += segLens[i]
  }

  const frac = ((bestS % total) + total) % total / total
  return { frac, distSq: bestDist }
}

export default function RaceTrack({ frameData, trackBoundaries }: RaceTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectorLayoutRef = useRef<SectorHoverLayout | null>(null)
  const [sectorHover, setSectorHover] = useState<{
    sector: 1 | 2 | 3
    clientX: number
    clientY: number
  } | null>(null)

  useEffect(() => {
    if (!frameData || !canvasRef.current) {
      sectorLayoutRef.current = null
      setSectorHover(null)
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      sectorLayoutRef.current = null
      return
    }

    sectorLayoutRef.current = null
    ctx.imageSmoothingEnabled = true
    if ('imageSmoothingQuality' in ctx) {
      ;(ctx as CanvasRenderingContext2D & { imageSmoothingQuality: string }).imageSmoothingQuality = 'high'
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Compute bounds
    let minX: number, maxX: number, minY: number, maxY: number
    let useTrackBounds = false
    
    const corridorHalfM = (trackBoundaries?.corridorWidthM ?? 220) / 2

    if (trackBoundaries?.center?.x && trackBoundaries.center.x.length > 1) {
      const cx = trackBoundaries.center.x
      const cy = trackBoundaries.center.y
      minX = Math.min(...cx) - corridorHalfM
      maxX = Math.max(...cx) + corridorHalfM
      minY = Math.min(...cy) - corridorHalfM
      maxY = Math.max(...cy) + corridorHalfM
      useTrackBounds = true
    } else if (trackBoundaries && trackBoundaries.inner.x.length > 0 && trackBoundaries.outer.x.length > 0) {
      const { inner, outer } = trackBoundaries
      const allX = [...inner.x, ...outer.x]
      const allY = [...inner.y, ...outer.y]
      minX = Math.min(...allX)
      maxX = Math.max(...allX)
      minY = Math.min(...allY)
      maxY = Math.max(...allY)
      useTrackBounds = true
    } else {
      const drivers = Object.entries(frameData.drivers)
      if (drivers.length === 0) return
      const allX = drivers.map(([_, d]) => d.x)
      const allY = drivers.map(([_, d]) => d.y)
      minX = Math.min(...allX)
      maxX = Math.max(...allX)
      minY = Math.min(...allY)
      maxY = Math.max(...allY)
    }

    // Add padding and center track
    const paddingRatio = 0.08
    const worldWidth = Math.max(1, maxX - minX)
    const worldHeight = Math.max(1, maxY - minY)
    const rotateLeft90 = true
    const usableWidth = canvas.width * (1 - 2 * paddingRatio)
    const usableHeight = canvas.height * (1 - 2 * paddingRatio)

    // Rotation swaps width and height
    const rotatedWorldWidth = rotateLeft90 ? worldHeight : worldWidth
    const rotatedWorldHeight = rotateLeft90 ? worldWidth : worldHeight
    const scaleX = usableWidth / rotatedWorldWidth
    const scaleY = usableHeight / rotatedWorldHeight
    const scale = Math.min(scaleX, scaleY)

    // Flip Y for track orientation
    const worldCenterX = (minX + maxX) / 2
    const worldCenterY = (minY + maxY) / 2
    const screenCenterX = canvas.width / 2
    const screenCenterY = canvas.height / 2

    const transform = (x: number, y: number) => {
      // Normalize around center
      const nx = x - worldCenterX
      const ny = y - worldCenterY

      // Rotate left 90
      const rx = rotateLeft90 ? -ny : nx
      const ry = rotateLeft90 ? nx : ny

      // Convert to screen
      return {
        x: screenCenterX + rx * scale,
        y: canvas.height - (screenCenterY + ry * scale)
      }
    }

    // Centerline for snapping
    let centerlineWorld: { x: number; y: number }[] | null = null
    if (useTrackBounds && trackBoundaries) {
      if (trackBoundaries.center?.x && trackBoundaries.center.x.length > 1) {
        const c = trackBoundaries.center
        const nc = Math.min(c.x.length, c.y.length)
        centerlineWorld = []
        for (let i = 0; i < nc; i++) centerlineWorld.push({ x: c.x[i], y: c.y[i] })
      } else {
        centerlineWorld = buildCenterline(trackBoundaries.inner, trackBoundaries.outer)
      }
    }

    // Draw track
    if (useTrackBounds && trackBoundaries) {
      const drsPath =
        trackBoundaries.center?.x && trackBoundaries.center.x.length > 1
          ? trackBoundaries.center
          : trackBoundaries.outer
      const drsN = Math.min(drsPath.x.length, drsPath.y.length)
      const strokeClosedPolyline = (xs: number[], ys: number[], count: number, color = '#000000', width = 2) => {
        if (count < 2) return
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.miterLimit = 1.4
        const buildPath = () => {
          const pts: { x: number; y: number }[] = []
          for (let i = 0; i < count; i++) {
            pts.push(transform(xs[i], ys[i]))
          }

          ctx.beginPath()
          if (pts.length < 3) {
            ctx.moveTo(pts[0].x, pts[0].y)
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
            ctx.closePath()
            return
          }

          const mid0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
          ctx.moveTo(mid0.x, mid0.y)
          for (let i = 1; i <= pts.length; i++) {
            const p1 = pts[i % pts.length]
            const p2 = pts[(i + 1) % pts.length]
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
            ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y)
          }

          ctx.closePath()
        }

        ctx.save()
        buildPath()
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.stroke()
        ctx.restore()
      }

      if (trackBoundaries.center?.x && trackBoundaries.center.x.length > 1) {
        const cx = trackBoundaries.center.x
        const cy = trackBoundaries.center.y
        const nc = Math.min(cx.length, cy.length)
        const sectorColors = SECTOR_FILL_COLORS
        const splitFracs = (trackBoundaries.sectorSplits ?? []).filter((f) => f > 0 && f < 1).sort((a, b) => a - b)
        const cutA = splitFracs[0] ?? 1 / 3
        const cutB = splitFracs[1] ?? 2 / 3
        const iA = Math.max(1, Math.min(nc - 2, Math.round(cutA * (nc - 1))))
        const iB = Math.max(iA + 1, Math.min(nc - 1, Math.round(cutB * (nc - 1))))
        const inner = trackBoundaries.inner
        const outer = trackBoundaries.outer
        const n = Math.min(inner.x.length, inner.y.length, outer.x.length, outer.y.length, cx.length, cy.length)
        if (n >= 2) {
          const centerPath = { x: cx.slice(0, n), y: cy.slice(0, n) }
          // Move visible boundaries inward
          const boundaryInset = 0.1
          const innerDraw = blendBoundaryTowardCenter(
            { x: inner.x.slice(0, n), y: inner.y.slice(0, n) },
            centerPath,
            boundaryInset
          )

          const outerDraw = blendBoundaryTowardCenter(
            { x: outer.x.slice(0, n), y: outer.y.slice(0, n) },
            centerPath,
            boundaryInset
          )

          const innerSmooth = smoothClosedRing(innerDraw.x, innerDraw.y, n, 2)
          const outerSmooth = smoothClosedRing(outerDraw.x, outerDraw.y, n, 2)
          const walk = (start: number, end: number, cb: (idx: number) => void) => {
            if (end >= start) {
              for (let i = start; i <= end; i++) cb(i)
              return
            }

            for (let i = start; i < n; i++) cb(i)
            for (let i = 0; i <= end; i++) cb(i)
          }

          const fillSectorBand = (start: number, end: number, color: string) => {
            ctx.save()
            ctx.beginPath()
            let first = true
            walk(start, end, (i) => {
              const p = transform(outerSmooth.x[i], outerSmooth.y[i])
              if (first) {
                ctx.moveTo(p.x, p.y)
                first = false
              } else {
                ctx.lineTo(p.x, p.y)
              }
            })

            const innerIdx: number[] = []
            walk(start, end, (i) => innerIdx.push(i))
            for (let k = innerIdx.length - 1; k >= 0; k--) {
              const i = innerIdx[k]
              const p = transform(innerSmooth.x[i], innerSmooth.y[i])
              ctx.lineTo(p.x, p.y)
            }

            ctx.closePath()
            ctx.fillStyle = color
            ctx.fill()
            ctx.restore()
          }

          fillSectorBand(0, iA, sectorColors[0])
          fillSectorBand(iA, iB, sectorColors[1])
          fillSectorBand(iB, 0, sectorColors[2])
          strokeClosedPolyline(outerSmooth.x, outerSmooth.y, n, '#ffffff', 2)
          strokeClosedPolyline(innerSmooth.x, innerSmooth.y, n, '#ffffff', 2)
          const centerPtsSector: { x: number; y: number }[] = []
          for (let i = 0; i < n; i++) centerPtsSector.push({ x: cx[i], y: cy[i] })
          sectorLayoutRef.current = {
            canvasW: canvas.width,
            canvasH: canvas.height,
            worldCenterX,
            worldCenterY,
            screenCenterX,
            screenCenterY,
            scale,
            rotateLeft90,
            centerPts: centerPtsSector,
            cutA,
            cutB,
            maxHoverDistSq: (1.2 * corridorHalfM) ** 2,
          }
        }
      } else {
        const inner = trackBoundaries.inner
        const outer = trackBoundaries.outer
        const n = Math.min(inner.x.length, inner.y.length, outer.x.length, outer.y.length)
        if (n >= 2) {
          const outerS = smoothClosedRing(outer.x, outer.y, n, 2)
          const innerS = smoothClosedRing(inner.x, inner.y, n, 2)
          if (outer.x.length > 1) strokeClosedPolyline(outerS.x, outerS.y, n, '#ffffff', 2)
          if (inner.x.length > 1) strokeClosedPolyline(innerS.x, innerS.y, n, '#ffffff', 2)
        }
      }

      if (trackBoundaries.drsZones && trackBoundaries.drsZones.length > 0 && drsN > 1) {
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 3.5
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        for (const zone of trackBoundaries.drsZones) {
          const startIdx = Math.max(0, Math.min(zone.start, drsN - 1))
          const endIdx = Math.max(startIdx + 1, Math.min(zone.end, drsN - 1))
          ctx.beginPath()
          const start = transform(drsPath.x[startIdx], drsPath.y[startIdx])
          ctx.moveTo(start.x, start.y)
          for (let i = startIdx + 1; i <= endIdx; i++) {
            const point = transform(drsPath.x[i], drsPath.y[i])
            ctx.lineTo(point.x, point.y)
          }

          ctx.stroke()
        }
      }

      // Start finish line
      const fl = trackBoundaries.finishLine
      const flx = fl?.x
      const fly = fl?.y
      if (flx && fly && flx.length >= 2 && fly.length >= 2) {
        const nFl = Math.min(flx.length, fly.length)
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.miterLimit = 1.4
        const buildFinishPath = () => {
          ctx.beginPath()
          const p0 = transform(flx[0], fly[0])
          ctx.moveTo(p0.x, p0.y)
          for (let i = 1; i < nFl; i++) {
            const p = transform(flx[i], fly[i])
            ctx.lineTo(p.x, p.y)
          }
        }

        ctx.save()
        buildFinishPath()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
    }

    // Draw drivers
    const drivers = Object.entries(frameData.drivers)
    drivers.forEach(([driver, data]) => {
      // Snap car to centerline
      const worldPos =
        centerlineWorld && centerlineWorld.length > 1
          ? closestPointOnPolyline(data.x, data.y, centerlineWorld, true)
          : { x: data.x, y: data.y }
      const pos = transform(worldPos.x, worldPos.y)
      
      // Draw car body
      ctx.fillStyle = data.color
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Draw driver code
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      const label = data.abbrev ?? driver
      ctx.fillText(label, pos.x, pos.y - 12)
      
      if (data.finished) {
        ctx.font = 'bold 9px monospace'
        ctx.fillStyle = '#6ee7b7'
        ctx.fillText('FINISH', pos.x, pos.y + 14)
      } else if (data.out) {
        ctx.font = 'bold 9px monospace'
        ctx.fillStyle = '#a1a1aa'
        ctx.fillText('OUT', pos.x, pos.y + 14)
      } else if (data.pitting) {
        ctx.font = 'bold 9px monospace'
        ctx.fillStyle = '#f87171'
        ctx.fillText('Pitting', pos.x, pos.y + 14)
      }
    })
  }, [frameData, trackBoundaries])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onSectorMove = (ev: MouseEvent) => {
      const L = sectorLayoutRef.current
      if (!L) {
        setSectorHover(null)
        return
      }

      const rect = canvas.getBoundingClientRect()
      const sx = ((ev.clientX - rect.left) / rect.width) * L.canvasW
      const sy = ((ev.clientY - rect.top) / rect.height) * L.canvasH
      const ry = (L.canvasH - sy - L.screenCenterY) / L.scale
      const rx = (sx - L.screenCenterX) / L.scale
      const nx = L.rotateLeft90 ? ry : rx
      const ny = L.rotateLeft90 ? -rx : ry
      const wx = nx + L.worldCenterX
      const wy = ny + L.worldCenterY
      const { frac, distSq } = closestArcFracOnRing(wx, wy, L.centerPts)
      if (distSq > L.maxHoverDistSq) {
        setSectorHover(null)
        return
      }

      const sector = (frac < L.cutA ? 1 : frac < L.cutB ? 2 : 3) as 1 | 2 | 3
      setSectorHover({ sector, clientX: ev.clientX, clientY: ev.clientY })
    }
    const onSectorLeave = () => setSectorHover(null)
    canvas.addEventListener('mousemove', onSectorMove)
    canvas.addEventListener('mouseleave', onSectorLeave)
    return () => {
      canvas.removeEventListener('mousemove', onSectorMove)
      canvas.removeEventListener('mouseleave', onSectorLeave)
    }
  }, [])

  const sectorHoverFill = sectorHover != null ? SECTOR_FILL_COLORS[sectorHover.sector - 1] : ''
  const sectorFastestRaw =
    sectorHover && frameData?.sector_fastest
      ? frameData.sector_fastest[String(sectorHover.sector) as '1' | '2' | '3']
      : undefined
  const sectorFastestEntry =
    sectorFastestRaw &&
    typeof sectorFastestRaw.time_seconds === 'number' &&
    Number.isFinite(sectorFastestRaw.time_seconds) &&
    sectorFastestRaw.abbrev
      ? sectorFastestRaw
      : undefined

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={1200}
        height={780}
        className="h-auto w-full max-w-full rounded-lg border border-gray-500 bg-white shadow-lg"
      />
      {sectorHover && (
        <div
          className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform motion-safe:transition-[transform] motion-safe:duration-100 motion-safe:ease-out"
          style={{
            transform: `translate3d(${sectorHover.clientX + 18}px, ${sectorHover.clientY + 18}px, 0)`,
          }}
        >
          <div
            key={sectorHover.sector}
            className="race-sector-tooltip relative flex min-w-[8.5rem] overflow-hidden rounded-xl border border-white/12 bg-zinc-950/92 text-left backdrop-blur-md"
            style={{
              boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 28px ${sectorHoverFill}40`,
            }}
          >
            <div className="w-1 shrink-0" style={{ backgroundColor: sectorHoverFill }} aria-hidden />
            <div className="relative flex flex-1 flex-col px-3 py-2.5 pr-3">
              <div
                className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.14] blur-2xl"
                style={{ backgroundColor: sectorHoverFill }}
                aria-hidden
              />
              <p
                className="relative m-0 font-black uppercase leading-none tracking-[0.12em] tabular-nums"
                style={{
                  color: sectorHoverFill,
                  fontSize: '0.95rem',
                  textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 18px rgba(0,0,0,0.45)',
                }}
              >
                Sector {sectorHover.sector}
              </p>
              {sectorFastestEntry ? (
                <p className="relative m-0 mt-2 text-[11px] leading-snug text-zinc-300">
                  <span className="text-zinc-500">Fastest so far · </span>
                  <span className="font-semibold text-white">{sectorFastestEntry.abbrev}</span>
                  <span className="ml-1.5 font-mono tabular-nums text-zinc-200">
                    {formatSectorSeconds(sectorFastestEntry.time_seconds)}
                  </span>
                </p>
              ) : (
                <p className="relative m-0 mt-2 text-[11px] text-zinc-500">
                  {frameData?.sector_fastest == null
                    ? 'Reload session for sector bests'
                    : 'No sector time yet'}
                </p>
              )}
              <div
                className="relative mt-2 h-0.5 w-full overflow-hidden rounded-full bg-zinc-800/90"
                aria-hidden
              >
                <div
                  className="race-sector-tooltip-bar h-full w-full"
                  style={{
                    background: `linear-gradient(90deg, ${sectorHoverFill}, transparent)`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {!frameData && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <p className="text-gray-300">Waiting for telemetry data...</p>
        </div>
      )}
    </div>
  )
}