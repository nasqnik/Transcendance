import client from './client'
import { type TaskCategory } from '../constants/categories'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GamificationStat {
  category: TaskCategory
  /** Levels completed in this category */
  level: number
  /** XP within current level (0 – 99) */
  xp_percent: number
}

export interface GamificationProfile {
  /** Kid's overall main level */
  main_level: number
  /** XP within current main level (0 – 199) */
  overall_xp: number
  /** Coins earned */
  coins: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getGamificationStats(): Promise<GamificationStat[]> {
  const res = await client.get('/gamification/stats/')
  return res.data
}

export async function getGamificationProfile(): Promise<GamificationProfile> {
  const res = await client.get('/gamification/profile/')
  return res.data
}
