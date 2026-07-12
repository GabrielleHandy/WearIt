import { ClothingItem, WearItSuggestion } from '@/constants/types'

// ─── Color families ────────────────────────────────────────────────────────
// Items with neutral colors mix with everything. Colorful items are limited to
// 1 per outfit to avoid clashing when we can't do real color theory.

const NEUTRALS = [
  'black', 'white', 'grey', 'gray', 'beige', 'cream', 'tan', 'navy',
  'camel', 'khaki', 'ivory', 'off-white', 'charcoal', 'stone',
]

function isNeutral(color?: string): boolean {
  if (!color) return true  // no color info — treat as safe
  const lower = color.toLowerCase()
  return NEUTRALS.some(n => lower.includes(n))
}

// ─── Pick one item from a category, preferring items that pair with a color ──

function pickFromCategory(
  pool: ClothingItem[],
  preferNeutralIfColorful: boolean
): ClothingItem | null {
  if (pool.length === 0) return null
  if (!preferNeutralIfColorful) {
    return pool[Math.floor(Math.random() * pool.length)]
  }
  // Prefer neutrals when we already have a colorful item
  const neutrals = pool.filter(i => isNeutral(i.color))
  const source = neutrals.length > 0 ? neutrals : pool
  return source[Math.floor(Math.random() * source.length)]
}

// ─── Context hints ─────────────────────────────────────────────────────────

const WARM_HINTS = ['warm', 'summer', 'hot', 'sunny', 'beach', 'tropical']
const COLD_HINTS = ['cold', 'winter', 'coat', 'chilly', 'rainy', 'snow', 'freezing']
const FORMAL_HINTS = ['interview', 'formal', 'work', 'office', 'meeting', 'wedding', 'dinner']
const CASUAL_HINTS = ['casual', 'chill', 'relax', 'weekend', 'errand', 'grocery', 'brunch']

function contextIncludes(context: string | undefined, hints: string[]): boolean {
  if (!context) return false
  const lower = context.toLowerCase()
  return hints.some(h => lower.includes(h))
}

// ─── Main export ──────────────────────────────────────────────────────────

export function randomizeOutfit(
  items: ClothingItem[],
  context?: string
): WearItSuggestion {
  const byCategory = (cat: ClothingItem['category']) =>
    items.filter(i => i.category === cat)

  const tops = byCategory('Tops')
  const bottoms = byCategory('Bottoms')
  const shoes = byCategory('Shoes')
  const dresses = byCategory('Dresses')
  const outerwear = byCategory('Outerwear')
  const accessories = byCategory('Accessories')

  // Need at least shoes + (tops+bottoms OR a dress)
  const canMakeOutfit =
    shoes.length > 0 && (dresses.length > 0 || (tops.length > 0 && bottoms.length > 0))

  if (!canMakeOutfit) {
    return {
      suggestion: "Add more variety to your wardrobe to get outfit suggestions.",
      reason: "You need at least one Top, Bottom, and pair of Shoes — or a Dress and Shoes.",
      itemNames: [],
    }
  }

  const isCold = contextIncludes(context, COLD_HINTS)
  const isFormal = contextIncludes(context, FORMAL_HINTS)
  const isCasual = contextIncludes(context, CASUAL_HINTS)

  const selected: ClothingItem[] = []
  let hasColorful = false

  // ── Core: dress or top + bottom ──────────────────────
  const useDress = dresses.length > 0 && (tops.length === 0 || Math.random() < 0.3)

  if (useDress) {
    const dress = pickFromCategory(dresses, false)!
    selected.push(dress)
    if (!isNeutral(dress.color)) hasColorful = true
  } else {
    // Tops first
    const top = pickFromCategory(tops, false)
    if (top) {
      selected.push(top)
      if (!isNeutral(top.color)) hasColorful = true
    }

    // Bottom — prefer neutral if top is colorful
    const bottom = pickFromCategory(bottoms, hasColorful)
    if (bottom) {
      selected.push(bottom)
      if (!isNeutral(bottom.color)) hasColorful = true
    }
  }

  // ── Shoes ────────────────────────────────────────────
  const shoe = pickFromCategory(shoes, hasColorful)
  if (shoe) {
    selected.push(shoe)
    if (!isNeutral(shoe.color)) hasColorful = true
  }

  // ── Outerwear — add if cold context or randomly (30%) ──
  if (outerwear.length > 0 && (isCold || Math.random() < 0.3)) {
    const coat = pickFromCategory(outerwear, hasColorful)
    if (coat) selected.push(coat)
  }

  // ── Accessories — add if formal context or randomly (40%) ──
  if (accessories.length > 0 && (isFormal || Math.random() < 0.4)) {
    const acc = pickFromCategory(accessories, false)
    if (acc) selected.push(acc)
  }

  // ── Build suggestion text ────────────────────────────
  const names = selected.map(i => i.name)

  let suggestion: string
  if (names.length === 0) {
    return { suggestion: "Couldn't build an outfit. Try adding more items.", reason: '' }
  } else if (useDress) {
    const rest = names.slice(1)
    suggestion = rest.length > 0
      ? `Wear your ${names[0]} with ${rest.join(' and ')}.`
      : `Style your ${names[0]} for today.`
  } else if (names.length === 3) {
    suggestion = `Pair your ${names[0]} with ${names[1]} and ${names[2]}.`
  } else {
    const [first, second, ...rest] = names
    suggestion = `Pair your ${first} with ${second}${rest.length > 0 ? ` and finish with ${rest.join(', ')}` : ''}.`
  }

  const occasionLabel = isFormal
    ? 'a put-together look for your occasion'
    : isCasual
    ? 'a relaxed everyday look'
    : isCold
    ? 'a layered look for cooler weather'
    : 'a balanced look from your wardrobe'

  const reason = `A randomized outfit — ${occasionLabel}. Tap "Save this look" to keep it.`

  return { suggestion, reason, itemNames: names }
}
