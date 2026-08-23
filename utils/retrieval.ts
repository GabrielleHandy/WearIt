import { ClothingItem } from '@/constants/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RetrievalContext = {
  occasion: string        // "date night", "interview", "casual"
  weather: string         // "72°F, clear sky"
  userModel?: UserModel   // null until style quiz ships (Block 2)
}

export type UserModel = {
  aesthetics: string[]
  styleAvoidances: string[]
  colorProfile: string
  fitPreference: string
}

export type ScoredItem = {
  item: ClothingItem
  score: number
  signals: string[]       // human-readable reasons for score — useful for debugging + prompt
}

type RetrievalResult = {
  retrieved: ScoredItem[]
  ignored: ScoredItem[]
  tokenEstimate: number
}

// ─── Weather parsing ─────────────────────────────────────────────────────────

function parseTemp(weather: string): number | null {
  const match = weather.match(/(-?\d+)°F/)
  return match ? parseInt(match[1], 10) : null
}

function getWeatherCondition(weather: string): string {
  const lower = weather.toLowerCase()
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) return 'rain'
  if (lower.includes('snow') || lower.includes('sleet') || lower.includes('blizzard')) return 'snow'
  if (lower.includes('wind')) return 'windy'
  return 'clear'
}

// ─── Category weather rules ──────────────────────────────────────────────────

const COLD_WEATHER_BOOST: Record<string, number> = {
  Outerwear: 20,
  Tops: 5,      // layers
}

const HOT_WEATHER_PENALTY: Record<string, number> = {
  Outerwear: -25,
}

const RAIN_BOOST: Record<string, number> = {
  Outerwear: 10,
  Shoes: 5,     // closed-toe > sandals
}

const SNOW_BOOST: Record<string, number> = {
  Outerwear: 25,
  Shoes: 10,    // boots > sneakers
  Accessories: 5, // scarves, gloves
}

const WIND_BOOST: Record<string, number> = {
  Outerwear: 15,
  Accessories: 5,
}

// ─── Occasion rules ──────────────────────────────────────────────────────────

const OCCASION_CATEGORY_BOOST: Record<string, Record<string, number>> = {
  // Dressy
  interview: { Tops: 5, Bottoms: 5, Shoes: 5, Dresses: 10 },
  'date night': { Dresses: 10, Accessories: 10, Shoes: 5 },
  date: { Dresses: 10, Accessories: 10, Shoes: 5 },
  formal: { Dresses: 15, Accessories: 10, Tops: 5, Shoes: 5 },
  wedding: { Dresses: 15, Accessories: 10, Shoes: 5 },
  church: { Dresses: 10, Tops: 5, Bottoms: 5, Shoes: 5 },
  brunch: { Dresses: 5, Accessories: 5, Tops: 5 },
  dinner: { Dresses: 10, Accessories: 5, Shoes: 5 },
  // Active
  workout: { Tops: 5, Bottoms: 5, Shoes: 10 },
  gym: { Tops: 5, Bottoms: 5, Shoes: 10 },
  hiking: { Shoes: 10, Bottoms: 5, Outerwear: 5 },
  // Casual
  casual: { Tops: 3, Bottoms: 3, Shoes: 3 },
  errand: { Tops: 3, Shoes: 3 },
  grocery: { Tops: 3, Shoes: 3 },
  // Social
  concert: { Accessories: 10, Tops: 5, Shoes: 5 },
  party: { Dresses: 10, Accessories: 10, Shoes: 5 },
  'happy hour': { Tops: 5, Accessories: 5, Shoes: 5 },
  // Outdoor
  beach: { Accessories: 5 },
  picnic: { Tops: 3, Shoes: 3 },
  travel: { Tops: 3, Bottoms: 3, Shoes: 5, Outerwear: 5 },
}

// Occasion keywords that penalize casual items by name
const FORMAL_OCCASIONS = ['interview', 'formal', 'wedding', 'gala', 'business', 'church', 'dinner']
const CASUAL_KEYWORDS = ['jogger', 'sweatpant', 'hoodie', 'flip flop', 'croc', 'slides']
const ACTIVE_OCCASIONS = ['workout', 'gym', 'hiking', 'run']

// ─── Name-level weather keywords ────────────────────────────────────────────
// These score individual items by name, not just category.
// A "Wool Coat" and "Light Linen Blazer" are both Outerwear but very
// different in 95°F heat.

const WARM_KEYWORDS = ['wool', 'fleece', 'puffer', 'parka', 'sherpa', 'flannel', 'cashmere', 'knit', 'sweater', 'thermal', 'corduroy', 'velvet']
const COOL_KEYWORDS = ['linen', 'cotton', 'tank', 'sleeveless', 'sandal', 'shorts', 'crop', 'mesh', 'satin', 'silk']
const WATERPROOF_KEYWORDS = ['rain', 'waterproof', 'gore-tex', 'rubber', 'boot']

// ─── Core scoring ────────────────────────────────────────────────────────────

export function scoreItem(item: ClothingItem, ctx: RetrievalContext): ScoredItem {
  let score = 50  // baseline
  const signals: string[] = []
  const nameLower = item.name.toLowerCase()

  // 1. Weather scoring
  const temp = parseTemp(ctx.weather)
  if (temp !== null) {
    // Name-level: warm fabrics boosted in cold, penalized in heat (and vice versa)
    if (temp < 50) {
      if (WARM_KEYWORDS.some(kw => nameLower.includes(kw))) {
        score += 10
        signals.push('warm fabric boost for cold weather (+10)')
      }
      if (COOL_KEYWORDS.some(kw => nameLower.includes(kw))) {
        score -= 10
        signals.push('cool fabric penalty for cold weather (-10)')
      }
    }
    if (temp > 80) {
      if (COOL_KEYWORDS.some(kw => nameLower.includes(kw))) {
        score += 10
        signals.push('cool fabric boost for hot weather (+10)')
      }
      if (WARM_KEYWORDS.some(kw => nameLower.includes(kw))) {
        score -= 15
        signals.push('warm fabric penalty for hot weather (-15)')
      }
    }

    // Category-level (existing logic)
    if (temp < 50) {
      const boost = COLD_WEATHER_BOOST[item.category] ?? 0
      if (boost) {
        score += boost
        signals.push(`cold weather boost (+${boost})`)
      }
    }
    if (temp > 80) {
      const penalty = HOT_WEATHER_PENALTY[item.category] ?? 0
      if (penalty) {
        score += penalty  // penalty is negative
        signals.push(`hot weather penalty (${penalty})`)
      }
    }
  }

  const condition = getWeatherCondition(ctx.weather)
  if (condition === 'rain') {
    const boost = RAIN_BOOST[item.category] ?? 0
    if (boost) {
      score += boost
      signals.push(`rain boost (+${boost})`)
    }
    if (WATERPROOF_KEYWORDS.some(kw => nameLower.includes(kw))) {
      score += 10
      signals.push('waterproof item boost for rain (+10)')
    }
  }
  if (condition === 'snow') {
    const boost = SNOW_BOOST[item.category] ?? 0
    if (boost) {
      score += boost
      signals.push(`snow boost (+${boost})`)
    }
  }
  if (condition === 'windy') {
    const boost = WIND_BOOST[item.category] ?? 0
    if (boost) {
      score += boost
      signals.push(`wind boost (+${boost})`)
    }
  }

  // 2. Occasion scoring
  const occasionLower = ctx.occasion.toLowerCase()
  for (const [occ, boosts] of Object.entries(OCCASION_CATEGORY_BOOST)) {
    if (occasionLower.includes(occ)) {
      const boost = boosts[item.category] ?? 0
      if (boost) {
        score += boost
        signals.push(`${occ} occasion boost (+${boost})`)
      }
    }
  }

  // Penalize casual items for formal occasions
  const isFormal = FORMAL_OCCASIONS.some(f => occasionLower.includes(f))
  if (isFormal) {
    if (CASUAL_KEYWORDS.some(kw => nameLower.includes(kw))) {
      score -= 30
      signals.push('casual item penalized for formal occasion (-30)')
    }
  }

  // Penalize dressy items for active occasions
  const isActive = ACTIVE_OCCASIONS.some(a => occasionLower.includes(a))
  if (isActive) {
    if (item.category === 'Dresses' || item.category === 'Accessories') {
      score -= 15
      signals.push('dressy item penalized for active occasion (-15)')
    }
  }

  // 3. Worn frequency — favorites get a bump
  if (item.worn && item.worn > 0) {
    const wornBoost = Math.min(item.worn * 2, 15)  // cap at +15
    score += wornBoost
    signals.push(`favorite boost (+${wornBoost}, worn ${item.worn}x)`)
  }

  // 4. User model scoring (when style quiz ships)
  if (ctx.userModel) {
    // Color match
    if (item.color && ctx.userModel.colorProfile) {
      const profileLower = ctx.userModel.colorProfile.toLowerCase()
      const colorLower = item.color.toLowerCase()
      if (profileLower.includes(colorLower) || colorLower.includes('black') || colorLower.includes('white')) {
        score += 5
        signals.push('color profile match (+5)')
      }
    }

    // Style avoidance penalty
    if (ctx.userModel.styleAvoidances.length > 0) {
      for (const avoid of ctx.userModel.styleAvoidances) {
        if (nameLower.includes(avoid.toLowerCase())) {
          score -= 20
          signals.push(`style avoidance: "${avoid}" (-20)`)
        }
      }
    }
  }

  return { item, score: Math.max(0, Math.min(100, score)), signals }
}

// ─── Retrieval ───────────────────────────────────────────────────────────────

const TOP_K = 15

export function retrieveRelevantItems(
  items: ClothingItem[],
  ctx: RetrievalContext
): RetrievalResult {
  const scored = items.map(item => scoreItem(item, ctx))

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score)

  // Ensure category coverage — at least 1 Top, 1 Bottom, 1 Shoes if available
  const REQUIRED = ['Tops', 'Bottoms', 'Shoes'] as const
  const topK = scored.slice(0, TOP_K)
  const rest = scored.slice(TOP_K)

  for (const cat of REQUIRED) {
    const alreadyHas = topK.some(s => s.item.category === cat)
    if (!alreadyHas) {
      const fromRest = rest.find(s => s.item.category === cat)
      if (fromRest) {
        // Swap: remove lowest-scored non-required item, add this one
        const swapIdx = [...topK].reverse().findIndex(
          s => !REQUIRED.includes(s.item.category as typeof REQUIRED[number])
        )
        if (swapIdx >= 0) {
          const realIdx = topK.length - 1 - swapIdx
          topK.splice(realIdx, 1, fromRest)
          fromRest.signals.push(`promoted for ${cat} coverage`)
        }
      }
    }
  }

  const retrieved = topK
  const ignored = scored.filter(s => !retrieved.includes(s))

  return {
    retrieved,
    ignored,
    tokenEstimate: estimateTokens(retrieved),
  }
}

// ─── Token estimation ────────────────────────────────────────────────────────

function estimateTokens(items: ScoredItem[]): number {
  // Rough estimate: each item line ≈ 20-30 tokens with rich metadata
  return items.reduce((sum, s) => {
    const line = formatItemForPrompt(s)
    // ~4 chars per token is a rough heuristic
    return sum + Math.ceil(line.length / 4)
  }, 0)
}

// ─── Prompt formatting ──────────────────────────────────────────────────────

export function formatItemForPrompt(scored: ScoredItem): string {
  const { item } = scored
  let line = `- ${item.name} (${item.category})`
  if (item.color) line += `, ${item.color}`
  if (item.worn && item.worn > 0) line += `, worn ${item.worn}x`
  return line
}

export function formatRetrievedForPrompt(result: RetrievalResult): string {
  return result.retrieved
    .map((scored, index) => {
      const line = formatItemForPrompt(scored)
      return `${index}. ${line.startsWith('- ') ? line.slice(2) : line}`
    })
    .join('\n')
}

// ─── Debug logging ───────────────────────────────────────────────────────────

export function logRetrieval(result: RetrievalResult): void {
  if (__DEV__) {
    console.log('── RAG Retrieval ──')
    console.log(`Retrieved ${result.retrieved.length} items (~${result.tokenEstimate} tokens):`)
    result.retrieved.forEach(s =>
      console.log(`  [${s.score}] ${s.item.name} — ${s.signals.join(', ') || 'baseline'}`)
    )
    if (result.ignored.length > 0) {
      console.log(`Ignored ${result.ignored.length} items:`)
      result.ignored.slice(0, 5).forEach(s =>
        console.log(`  [${s.score}] ${s.item.name}`)
      )
      if (result.ignored.length > 5) {
        console.log(`  ... and ${result.ignored.length - 5} more`)
      }
    }
  }
}
