import type { QualifyingSummary } from '../types/telemetry'

const API_BASE = '/api'

export async function loadSession(year: number, round_number: number, session_type: string, refresh = false) {
  const response = await fetch(`${API_BASE}/load-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year, round_number, session_type, refresh }),
  })
  return response.json()
}

export async function getCurrentFrame() {
  const response = await fetch(`${API_BASE}/current-frame`)
  return response.json()
}

export async function controlPlayback(action: 'play' | 'pause' | 'restart') {
  const response = await fetch(`${API_BASE}/control/${action}`, { method: 'POST' })
  return response.json()
}

export async function seekFrame(frame: number) {
  const response = await fetch(`${API_BASE}/control/seek?frame=${frame}`, { method: 'POST' })
  return response.json()
}

export async function setPlaybackSpeed(speed: number) {
  const response = await fetch(`${API_BASE}/control/speed?speed=${speed}`, { method: 'POST' })
  return response.json()
}

export async function getQualifyingSummary(): Promise<QualifyingSummary> {
  const response = await fetch(`${API_BASE}/qualifying/summary`)
  return response.json()
}

export async function getDriverInsight(driver: string) {
  const response = await fetch(`${API_BASE}/insights/driver?driver=${driver}`)
  return response.json()
}

export function buildReplayWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${protocol}://${window.location.host}/ws/replay`)
}
