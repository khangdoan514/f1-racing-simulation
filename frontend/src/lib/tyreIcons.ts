import softUrl from '../assets/tyres/soft.png'
import mediumUrl from '../assets/tyres/medium.png'
import hardUrl from '../assets/tyres/hard.png'
import intermediateUrl from '../assets/tyres/intermediate.png'
import wetUrl from '../assets/tyres/wet.png'

const BY_INDEX: Record<number, string> = {
  0: softUrl,
  1: mediumUrl,
  2: hardUrl,
  3: intermediateUrl,
  4: wetUrl,
}

const EXACT: Record<string, number> = {
  SOFT: 0,
  MEDIUM: 1,
  HARD: 2,
  INTERMEDIATE: 3,
  WET: 4,
  HYPERSOFT: 0,
  SUPERSOFT: 0,
  ULTRASOFT: 0,
  'SUPER SOFT': 0,
  SUPER_SOFT: 0,
}

function indexFromPirelliCCompound(u: string): number | null {
  const m = u.match(/\bC(\d)\b/)
  if (!m) return null
  
  const n = parseInt(m[1], 10)
  if (n < 1 || n > 5) return null
  if (n <= 2) return 2
  if (n === 3) return 1
  
  return 0
}

export function tyreCompoundIndex(compound?: string): number | null {
  if (compound === undefined || compound === null) return null
  
  const raw = String(compound).trim()
  if (!raw) return null
  
  const lower = raw.toLowerCase()
  if (lower === 'nan' || lower === 'unknown' || lower === 'none') return null

  const u = raw.toUpperCase()
  if (EXACT[u] !== undefined) return EXACT[u]

  const fromC = indexFromPirelliCCompound(u)
  if (fromC !== null) return fromC

  // FastF1
  if (u.includes('WET')) return 4
  if (u.includes('INTER') || lower.includes('intermediate')) return 3
  if (u.includes('HARD')) return 2
  if (u.includes('MEDIUM')) return 1
  if (u.includes('SOFT')) return 0
  
  return null
}

const LETTERS = ['S', 'M', 'H', 'I', 'W'] as const

export function tyreIconSrc(compound?: string, tyreIndex?: number | null): string | null {
  if (tyreIndex !== undefined && tyreIndex !== null && tyreIndex >= 0 && tyreIndex <= 4) {
    return BY_INDEX[tyreIndex] ?? null
  }
  
  const idx = tyreCompoundIndex(compound)
  if (idx === null) return null
  
  return BY_INDEX[idx] ?? null
}

export function compoundLetter(compound?: string, tyreIndex?: number | null): string {
  if (tyreIndex !== undefined && tyreIndex !== null && tyreIndex >= 0 && tyreIndex <= 4) {
    return LETTERS[tyreIndex]
  }

  if (!compound) return '—'
  const u = compound.toUpperCase()
  if (u.includes('HARD')) return 'H'
  if (u.includes('MEDIUM')) return 'M'
  if (u.includes('INTER')) return 'I'
  if (u.includes('WET')) return 'W'
  if (u.includes('SOFT')) return 'S'
  
  const c = indexFromPirelliCCompound(u)
  if (c === 2) return 'H'
  if (c === 1) return 'M'
  if (c === 0) return 'S'
  
  return compound.slice(0, 1).toUpperCase()
}
