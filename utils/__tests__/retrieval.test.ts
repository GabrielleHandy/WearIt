/**
 * Unit tests for retrieval.ts
 *
 * Run with: npx jest utils/__tests__/retrieval.test.ts
 * (requires jest + ts-jest: npm install -D jest ts-jest @types/jest)
 *
 * These are pure function tests — no async, no storage, no network.
 */

import { scoreItem, retrieveRelevantItems, formatItemForPrompt } from '../retrieval'
import type { RetrievalContext, ScoredItem } from '../retrieval'
import type { ClothingItem } from '../../constants/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: '1',
    name: 'Black T-Shirt',
    category: 'Tops',
    emoji: '👕',
    addedAt: '2025-01-01',
    ...overrides,
  }
}

function ctx(overrides: Partial<RetrievalContext> = {}): RetrievalContext {
  return {
    occasion: 'casual everyday',
    weather: '72°F, clear sky',
    ...overrides,
  }
}

// ─── scoreItem ──────────────────────────────────────────────────────────────

describe('scoreItem', () => {
  test('baseline score is 50 with no special context', () => {
    const result = scoreItem(makeItem(), ctx())
    expect(result.score).toBe(50)
    expect(result.signals).toEqual([])
  })

  // Weather — category level
  test('outerwear boosted in cold weather', () => {
    const result = scoreItem(
      makeItem({ category: 'Outerwear', name: 'Denim Jacket' }),
      ctx({ weather: '35°F, cloudy' })
    )
    expect(result.score).toBeGreaterThan(50)
    expect(result.signals).toContain(expect.stringContaining('cold weather'))
  })

  test('outerwear penalized in hot weather', () => {
    const result = scoreItem(
      makeItem({ category: 'Outerwear', name: 'Denim Jacket' }),
      ctx({ weather: '95°F, sunny' })
    )
    expect(result.score).toBeLessThan(50)
  })

  // Weather — name level
  test('wool item boosted in cold weather', () => {
    const result = scoreItem(
      makeItem({ name: 'Wool Peacoat', category: 'Outerwear' }),
      ctx({ weather: '30°F, snow' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('warm fabric boost')
  })

  test('wool item penalized in hot weather', () => {
    const result = scoreItem(
      makeItem({ name: 'Wool Sweater', category: 'Tops' }),
      ctx({ weather: '95°F, sunny' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('warm fabric penalty')
  })

  test('linen item boosted in hot weather', () => {
    const result = scoreItem(
      makeItem({ name: 'Linen Button-Down', category: 'Tops' }),
      ctx({ weather: '90°F, clear' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('cool fabric boost')
  })

  test('waterproof item boosted in rain', () => {
    const result = scoreItem(
      makeItem({ name: 'Rain Jacket', category: 'Outerwear' }),
      ctx({ weather: '55°F, rain' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('waterproof')
  })

  // Snow + wind
  test('outerwear boosted in snow', () => {
    const result = scoreItem(
      makeItem({ category: 'Outerwear', name: 'Puffer Coat' }),
      ctx({ weather: '20°F, snow' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('snow boost')
  })

  test('outerwear boosted in wind', () => {
    const result = scoreItem(
      makeItem({ category: 'Outerwear', name: 'Windbreaker' }),
      ctx({ weather: '55°F, windy' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('wind boost')
  })

  // Occasion
  test('dresses boosted for date night', () => {
    const result = scoreItem(
      makeItem({ category: 'Dresses', name: 'Black Midi Dress' }),
      ctx({ occasion: 'date night' })
    )
    expect(result.score).toBeGreaterThan(50)
  })

  test('casual items penalized for interview', () => {
    const result = scoreItem(
      makeItem({ name: 'Grey Hoodie', category: 'Tops' }),
      ctx({ occasion: 'interview' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('casual item penalized')
    expect(result.score).toBeLessThan(50)
  })

  test('dresses penalized for gym', () => {
    const result = scoreItem(
      makeItem({ category: 'Dresses', name: 'Floral Dress' }),
      ctx({ occasion: 'gym' })
    )
    const signals = result.signals.join(', ')
    expect(signals).toContain('dressy item penalized for active')
  })

  // Worn frequency
  test('frequently worn items get a boost', () => {
    const result = scoreItem(
      makeItem({ worn: 8 }),
      ctx()
    )
    expect(result.score).toBeGreaterThan(50)
    expect(result.signals).toContain(expect.stringContaining('favorite'))
  })

  test('worn boost caps at 15', () => {
    const result = scoreItem(
      makeItem({ worn: 100 }),
      ctx()
    )
    // baseline 50 + cap 15 = 65
    expect(result.score).toBe(65)
  })

  // Score clamping
  test('score does not exceed 100', () => {
    const result = scoreItem(
      makeItem({ category: 'Outerwear', name: 'Wool Puffer Coat', worn: 10 }),
      ctx({ weather: '10°F, snow', occasion: 'hiking' })
    )
    expect(result.score).toBeLessThanOrEqual(100)
  })

  test('score does not go below 0', () => {
    const result = scoreItem(
      makeItem({ name: 'Flip Flop Sandals', category: 'Shoes' }),
      ctx({ weather: '95°F, sunny', occasion: 'formal wedding gala' })
    )
    expect(result.score).toBeGreaterThanOrEqual(0)
  })
})

// ─── retrieveRelevantItems ──────────────────────────────────────────────────

describe('retrieveRelevantItems', () => {
  const makeWardrobe = (count: number): ClothingItem[] => {
    const categories: ClothingItem['category'][] = ['Tops', 'Bottoms', 'Shoes', 'Dresses', 'Outerwear', 'Accessories']
    return Array.from({ length: count }, (_, i) => makeItem({
      id: String(i),
      name: `Item ${i}`,
      category: categories[i % categories.length],
    }))
  }

  test('returns at most 15 items', () => {
    const items = makeWardrobe(50)
    const result = retrieveRelevantItems(items, ctx())
    expect(result.retrieved.length).toBeLessThanOrEqual(15)
  })

  test('returns all items if wardrobe has fewer than 15', () => {
    const items = makeWardrobe(8)
    const result = retrieveRelevantItems(items, ctx())
    expect(result.retrieved.length).toBe(8)
  })

  test('guarantees at least one Top, Bottom, Shoes if available', () => {
    // Create a wardrobe where all high-scored items are Dresses
    const items: ClothingItem[] = [
      ...Array.from({ length: 20 }, (_, i) => makeItem({
        id: `dress-${i}`,
        name: `Fancy Dress ${i}`,
        category: 'Dresses',
        worn: 10, // high worn count to inflate score
      })),
      makeItem({ id: 'top-1', name: 'Plain Tee', category: 'Tops' }),
      makeItem({ id: 'bot-1', name: 'Jeans', category: 'Bottoms' }),
      makeItem({ id: 'shoe-1', name: 'Sneakers', category: 'Shoes' }),
    ]

    const result = retrieveRelevantItems(items, ctx({ occasion: 'formal' }))
    const categories = result.retrieved.map(s => s.item.category)

    expect(categories).toContain('Tops')
    expect(categories).toContain('Bottoms')
    expect(categories).toContain('Shoes')
  })

  test('retrieved + ignored = total items', () => {
    const items = makeWardrobe(30)
    const result = retrieveRelevantItems(items, ctx())
    expect(result.retrieved.length + result.ignored.length).toBe(30)
  })

  test('retrieved items are sorted by score descending', () => {
    const items = makeWardrobe(30)
    const result = retrieveRelevantItems(items, ctx())
    for (let i = 1; i < result.retrieved.length; i++) {
      // Allow equal scores (stable sort not guaranteed)
      expect(result.retrieved[i - 1].score).toBeGreaterThanOrEqual(result.retrieved[i].score)
    }
  })

  test('includes token estimate', () => {
    const items = makeWardrobe(20)
    const result = retrieveRelevantItems(items, ctx())
    expect(result.tokenEstimate).toBeGreaterThan(0)
  })
})

// ─── formatItemForPrompt ────────────────────────────────────────────────────

describe('formatItemForPrompt', () => {
  test('includes name, category, color, and worn count', () => {
    const scored: ScoredItem = {
      item: makeItem({ name: 'White Linen Shirt', color: 'white', worn: 5 }),
      score: 60,
      signals: [],
    }
    const line = formatItemForPrompt(scored)
    expect(line).toBe('- White Linen Shirt (Tops), white, worn 5x')
  })

  test('omits color and worn when missing', () => {
    const scored: ScoredItem = {
      item: makeItem({ name: 'Black Tee' }),
      score: 50,
      signals: [],
    }
    const line = formatItemForPrompt(scored)
    expect(line).toBe('- Black Tee (Tops)')
  })
})
