import { AiModelEndpoints, ClothingItem, GapAnalysisResult, SavedOutfit, WearItSuggestion, WishlistItem } from "@/constants/types"
import { incrementUsage, isUnderCap, loadModelConfig, loadSavedOutfits, saveTrainingExample } from "./storage"
import { askModelAdapter } from "./modelAdapter"
import * as FileSystem from 'expo-file-system/legacy'
import { type Theme } from "@/constants/theme"

// Lambda endpoint (outfit suggestions routed through API Gateway → Lambda → Secrets Manager)
const API_GATEWAY_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || ''

// Proxy URL + shared secret (production) — keys stay in the Worker, never in the bundle
const PROXY_URL = process.env.EXPO_PUBLIC_PROXY_URL
const PROXY_KEY = process.env.EXPO_PUBLIC_PROXY_KEY
// Direct key kept for local dev fallback (when PROXY_URL is not set)
const AI_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY

const REQUIRED_CATEGORIES = ['Tops', 'Bottoms', 'Shoes']

const model: keyof typeof AiModelEndpoints = 'Anthropic'

/**
 * Returns the correct endpoint + headers for Anthropic API calls.
 * Production: routes through Cloudflare Worker proxy (API key server-side).
 * Local dev: falls back to direct Anthropic call with EXPO_PUBLIC_ANTHROPIC_KEY.
 */
function anthropicRequest(): { url: string; headers: Record<string, string> } {
  if (PROXY_URL) {
    return {
      url: PROXY_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-wearit-key': PROXY_KEY ?? '',
      },
    }
  }
  return {
    url: AiModelEndpoints[model],
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  }
}

export async function askWearIt(items: ClothingItem[], context?: string): Promise<WearItSuggestion> {
  const hasRequiredCategories = REQUIRED_CATEGORIES.every(cat =>
    items.some(item => item.category === cat)
  )

  if (!hasRequiredCategories) {
    return {
      suggestion: "Add more variety to your wardrobe for outfit suggestions!",
      reason: "You need at least one Top, Bottom, and pair of Shoes for a complete outfit."
    }
  }

  // Load saved outfits to pass as context — helps Claude avoid repeating suggestions
  const savedOutfits = await loadSavedOutfits()

  // Tier 1: User's own configured model (OpenRouter, Groq, etc.) — their key, their cost
  const userConfig = await loadModelConfig()
  if (userConfig?.url && userConfig?.model) {
    const adapterResult = await askModelAdapter(items, context)
    if (adapterResult) return adapterResult
  }

  // Tier 2: Bundled Claude key (free, capped at 20/month) — for users with no config
  const underCap = await isUnderCap()
  if (underCap) {
    try {
      const result = await getOutfitSuggestion(items, context, savedOutfits)
      // Only increment after a real suggestion — don't burn credits on error responses
      if (result.suggestion && !result.suggestion.includes('Could not')) {
        await incrementUsage()
      }
      return result
    } catch (error) {
      console.warn('Claude failed, falling through to degradation', error)
    }
  }

  // Tier 3: Graceful degradation
  return {
    suggestion: userConfig?.url
      ? "Couldn't reach your configured model right now."
      : "You've used your 20 free AI suggestions for this month.",
    reason: userConfig?.url
      ? "Check your API key and endpoint in Settings, then try again."
      : "Add your own API key in Settings (OpenRouter, Groq, etc.) for unlimited suggestions.",
    isFallback: true
  }
}

export async function getOutfitSuggestion(items: ClothingItem[], context?: string, savedOutfits?: SavedOutfit[]): Promise<WearItSuggestion> {
  const errorAnswer: WearItSuggestion= { suggestion: 'Could not generate a suggestion right now.', reason: "" }

  const wardrobeList = items
    .map((item, i) => {
      let line = `${i}. ${item.name} (${item.category})`
      if (item.color) line += ` — color: ${item.color}`
      if (item.worn) line += ` — worn: ${item.worn}x`
      return line
    })
    .join('\n')
  

  // Inject up to 5 most recent saved looks so Claude avoids repeating them
  const savedLooksBlock = savedOutfits && savedOutfits.length > 0
    ? `\n\nThe user has already saved these outfits — avoid repeating the same combinations:\n` +
      savedOutfits.slice(0, 5).map(o => {
        const date = new Date(o.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return `- [${date}${o.occasion ? `, ${o.occasion}` : ''}]: ${o.suggestion.split('.')[0]}.`
      }).join('\n')
    : ''

  // ─── Route through Lambda when API Gateway URL is configured ───
  if (API_GATEWAY_URL) {
    try {
      const wardrobeSlice = wardrobeList + savedLooksBlock
      const response = await fetch(API_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wardrobeSlice, context: context || 'casual everyday' }),
      })
      const data = await response.json()

      if (!response.ok) {
        console.error('Lambda error:', data)
        return {
          suggestion: data.suggestion || errorAnswer.suggestion,
          reason: data.reason || `Server error (${response.status})`,
          isFallback: true,
        }
      }

      const result: WearItSuggestion = {
        suggestion: data.suggestion || '',
        reason: data.reason || '',
        itemIndices: Array.isArray(data.items) ? data.items.filter((i: unknown): i is number => typeof i === 'number') : undefined,
      }

      if (result.suggestion && !result.suggestion.includes('Could not')) {
        await saveTrainingExample({
          wardrobeList,
          context: context || 'casual everyday',
          suggestion: result.suggestion,
          reason: result.reason,
          timestamp: new Date().toISOString(),
        })
      }
      return result
    } catch (error) {
      console.error('Lambda request failed:', error)
      // Fall through to direct/proxy call below
    }
  }

  // ─── Fallback: direct Anthropic / proxy call ───
  if (!PROXY_URL && !AI_KEY) {
    errorAnswer.reason = `Missing Anthropic key.`
    return errorAnswer
  }

  const { url, headers } = anthropicRequest()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        system: `You are WearIt, an expert personal fashion stylist and wardrobe curator.
You assemble sophisticated, highly wearable outfits exclusively from pieces in the user's wardrobe list.

STYLING DIRECTIVES:
1. FORMULA: Assemble a complete look containing:
   - 1 Top + 1 Bottom (or 1 Dress), plus 1 pair of Footwear (Shoes).
   - Optional: Layer with Outerwear or add Accessories when appropriate for the weather or occasion.
2. COLOR & PROPORTION HARMONY:
   - Balance statement pieces with neutral foundations (e.g. cream, black, navy, stone, grey, olive).
   - Contrast textures (e.g., silk + knit, linen + denim, leather + wool).
   - Never combine clashing patterns or conflicting garments of the same category (e.g. 2 pants).
3. WEATHER & OCCASION ADAPTATION:
   - If temperature, weather, or occasion is provided, prioritize comfort, appropriate layering, and formality.
4. ACTIONABLE STYLING IN "suggestion":
   - Explicitly name each chosen piece.
   - Describe how to wear and style the look (e.g., tuck style, rolling sleeves, layering order).
5. STYLING RATIONALE IN "reason":
   - 2-3 sentences explaining the visual balance, texture/color harmony, and why it suits the occasion.
6. FORMAT REQUIREMENT:
   - Return ONLY valid JSON:
   {
     "suggestion": string,
     "reason": string,
     "items": [0-based index numbers of the items you selected from the numbered list]
   }
   - "items" must contain only 0-based integer indices corresponding to the numbered list.
   - Never suggest items not in the wardrobe list.`,
        messages: [{
          role: 'user',
          content: `Here is my wardrobe:\n${wardrobeList}${savedLooksBlock}${context ? `\n\nOccasion & Context: ${context}` : ''}\n\nSuggest one styled complete outfit for today based on these pieces.`
        }]
      })
    })
    const data = await response.json()
    const result = parseResponse(data)
  if (result.suggestion && !result.suggestion.includes('Could not')) {
  await saveTrainingExample({
    wardrobeList,
    context: context || 'casual everyday',
    suggestion: result.suggestion,
    reason: result.reason,
    timestamp: new Date().toISOString()
  })
}
  return result
  } catch (error) {
    console.error("Unkown Claude Error:", error)
    errorAnswer.reason = 'Claude Error'
    errorAnswer.isFallback = true
    return errorAnswer
  }
}

// Normalized crop box (0–1 fractions of image dimensions)
export type CropHint = { top: number; left: number; bottom: number; right: number }

export async function tagClothingItem(photoUri: string): Promise<{
  name: string
  category: ClothingItem['category']
  color: string
  tags?: string[]
  crop?: CropHint
}> {
  const fallback = { name: 'New Item', category: 'Tops' as ClothingItem['category'], color: '', tags: [] }

  if (!PROXY_URL && !AI_KEY) return fallback

  const { url, headers } = anthropicRequest()

  try {
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: 'base64',
    })

    const ext = photoUri.split('.').pop()?.toLowerCase()
    const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg'

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 250,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `You are an expert fashion cataloging AI. Identify the clothing item in this image.
Return ONLY valid JSON (no markdown, no extra text):
{
  "name": string,
  "category": "Tops"|"Bottoms"|"Shoes"|"Dresses"|"Outerwear"|"Accessories"|"Other",
  "color": string,
  "tags": [string, string, string],
  "crop": {"top": number, "left": number, "bottom": number, "right": number}
}

INSPECTION RULES:
- "name": Descriptive, editorial title including material/texture + cut + garment type (e.g. "Relaxed Linen Button-Down", "High-Rise Straight Denim", "Chunky Ribbed Knit Sweater", "Leather Penny Loafers"). Avoid vague names like "Shirt" or "Pants".
- "category": Must be one of: Tops, Bottoms, Shoes, Dresses, Outerwear, Accessories, Other.
- "color": Primary color name (e.g. "White", "Navy", "Charcoal", "Burgundy", "Beige", "Olive", "Black", "Tan").
- "tags": 3 to 5 lowercase style/season/utility tags (e.g. ["casual", "linen", "breathable", "summer", "work"]).
- "crop": Tight normalized bounding box (0.0–1.0 fractions of width/height) around ONLY the clothing item. Exclude body parts, background clutter, and empty margins. Add 3-5% margin around garment edges.
- If multiple garments or a person appears, identify and crop the single primary central clothing item.`,
            },
          ],
        }],
      }),
    })

    const data = await response.json()
    const text = data?.content?.[0]?.text
    if (!text) return fallback

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    const crop: CropHint | undefined = parsed.crop &&
      typeof parsed.crop.top === 'number' &&
      typeof parsed.crop.left === 'number' &&
      typeof parsed.crop.bottom === 'number' &&
      typeof parsed.crop.right === 'number'
        ? {
            top:    Math.max(0, parsed.crop.top - 0.03),
            left:   Math.max(0, parsed.crop.left - 0.03),
            bottom: Math.min(1, parsed.crop.bottom + 0.03),
            right:  Math.min(1, parsed.crop.right + 0.03),
          }
        : undefined

    return {
      name: parsed.name || fallback.name,
      category: parsed.category || fallback.category,
      color: parsed.color || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: unknown) => String(t).toLowerCase()) : [],
      crop,
    }
  } catch (e) {
    console.warn('Auto-tag failed, using defaults:', e)
    return fallback
  }
}

export async function analyzeGap(
  wishlistItem: WishlistItem,
  wardrobe: ClothingItem[]
): Promise<GapAnalysisResult> {
  const fallback: GapAnalysisResult = {
    matches: [],
    missing: [],
    summary: 'Could not analyze your wardrobe right now. Try again in a moment.',
  }

  if (!PROXY_URL && !AI_KEY) return fallback

  const { url: gapUrl, headers: gapHeaders } = anthropicRequest()

  const wardrobeList = wardrobe
    .map(item => `- ${item.name} (${item.category}${item.color ? `, ${item.color}` : ''})`)
    .join('\n')

  try {
    const response = await fetch(gapUrl, {
      method: 'POST',
      headers: gapHeaders,
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        system: `You are a personal wardrobe stylist and shopping consultant. Given a wishlist item and a user's current wardrobe, provide an honest, discerning purchase assessment.
Determine:
1. Which existing wardrobe pieces pair with this wishlist item to create complete looks (Pairings).
2. What complementary pieces they would still need to complete full outfits (Missing).
3. A clear 2-3 sentence summary on whether this item expands their style versatility or fills a genuine wardrobe gap.
Return ONLY valid JSON — no markdown, no extra text.`,
        messages: [{
          role: 'user',
          content: `Wishlist item: ${wishlistItem.name} (${wishlistItem.color || 'Neutral'} ${wishlistItem.category})

My current wardrobe:
${wardrobeList || 'No items yet'}

Return JSON in this exact format:
{
  "matchNames": ["exact item names from the wardrobe list that pair well with this wishlist item to make outfits"],
  "missing": ["short descriptions of specific pieces they'd need to style with this — e.g. 'Tailored white trousers', 'Leather ankle boots'"],
  "summary": "2-3 sentences: what in their closet pairs with it, whether it fills a missing gap, and styling advice."
}

Only include item names in matchNames that appear exactly in the wardrobe list above.`,
        }],
      }),
    })

    const data = await response.json()
    const text = data?.content?.[0]?.text
    if (!text) return fallback

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Map matchNames back to actual ClothingItem objects
    const matchNames: string[] = parsed.matchNames ?? []
    const matches = wardrobe.filter(item =>
      matchNames.some(name => name.toLowerCase() === item.name.toLowerCase())
    )

    return {
      matches,
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      summary: parsed.summary ?? fallback.summary,
    }
  } catch (e) {
    console.warn('Gap analysis failed:', e)
    return fallback
  }
}

export async function generateTheme(aesthetic: string): Promise<Theme | null> {
  if (!PROXY_URL && !AI_KEY) return null

  const { url: themeUrl, headers: themeHeaders } = anthropicRequest()

  const themeContract = `
  background     — main screen background
  surface        — card / input background
  surfaceTint    — selected / hover state surface
  textPrimary    — headings, body text
  textSecondary  — labels, captions, muted text
  textPlaceholder — input placeholder text
  textOnAccent   — text on accent-colored backgrounds (must be highly readable)
  accent         — primary CTA, active tab, selection ring
  accentMuted    — secondary / outline states
  accentDanger   — destructive actions, errors
  border         — card and input borders
  borderSubtle   — dividers, very light separators
  tabActive      — active tab icon/text color
  tabInactive    — inactive tab icon/text color
  tabBar         — tab bar background
  tabBarBorder   — tab bar top border
  sectionLabel   — ALL CAPS section header labels`

  try {
    const response = await fetch(themeUrl, {
      method: 'POST',
      headers: themeHeaders,
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        system: `You are an expert digital product designer creating a high-contrast, accessible mobile app theme. Given an aesthetic description, generate a complete, harmonious color palette. Use hex colors only. Return ONLY a valid JSON object — no markdown, no explanation, no extra text.`,
        messages: [{
          role: 'user',
          content: `Create a WearIt app theme for the aesthetic: "${aesthetic}"

Return a JSON object with exactly these keys:
${themeContract}

Design & Accessibility Rules:
- Hex colors only (e.g. "#1A1412", "#FAF7F2")
- background and surface: surface must have visible contrast from background (e.g. 5-10% lighter in dark palettes, subtle contrast/borders in light palettes).
- accent: the signature aesthetic color (vibrant, rich, or iconic to the aesthetic).
- CONTRAST GUARD: textOnAccent must have strong contrast against accent:
  - If accent is light/pastel, textOnAccent MUST be dark ("#1A1412").
  - If accent is dark/saturated, textOnAccent MUST be light ("#FAF7F2").
- textPrimary must have at least 4.5:1 contrast against background and surface.
- tabBar should match or complement background.
- sectionLabel should match accent.
- Make it cohesive, beautiful, and unmistakably "${aesthetic}"`
        }]
      })
    })

    const data = await response.json()
    const text = data?.content?.[0]?.text
    if (!text) return null

    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Validate all required keys are present
    const required: (keyof Theme)[] = [
      'background', 'surface', 'surfaceTint', 'textPrimary', 'textSecondary',
      'textPlaceholder', 'textOnAccent', 'accent', 'accentMuted', 'accentDanger',
      'border', 'borderSubtle', 'tabActive', 'tabInactive', 'tabBar', 'tabBarBorder',
      'sectionLabel'
    ]
    const isValid = required.every(k => typeof parsed[k] === 'string')
    if (!isValid) return null

    return parsed as Theme
  } catch (e) {
    console.warn('Theme generation failed:', e)
    return null
  }
}

function parseResponse(data: any, bonsai?: boolean) {
  const errorAnswer = { suggestion: 'Could not generate a suggestion right now.', reason: "" }
  const parsedAnswer = (answer: any): WearItSuggestion => {
    if (!answer) return errorAnswer

    // Strip think tags
    const stripped = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

    try {
      // Fix newlines inside JSON strings before parsing
      const sanitized = stripped
        .replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"')  // flatten newlines in values
        .replace(/[\u0000-\u001F]/g, ' ')                   // remove control chars
        .replace(/,\s*}/g, '}')                             // trailing commas
        .replace(/}\s*$/, '}')
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')                              // ensure closing brace

      const parsed = JSON.parse(sanitized)
      return {
        suggestion: (parsed?.suggestion || '').replace(/\*\*/g, '').trim(),
        reason: (parsed?.reason || `Suggestion made by ${bonsai ? 'Bonsai' : 'Claude'}`).replace(/\*\*/g, '').trim(),
        itemIndices: Array.isArray(parsed?.items) ? parsed.items.filter((i: unknown): i is number => typeof i === 'number') : undefined,
      }
    } catch {
      // JSON failed — just use the raw text as suggestion
      return {
        suggestion: stripped.replace(/[{}"]/g, '').replace(/suggestion:|reason:/gi, '').trim(),
        reason: ''
      }
    }
  }
  if (data?.error) {
    console.error("Claude Error:", data.error)
    errorAnswer.reason = data.error.message
    return errorAnswer
  }
  if (bonsai) {
    let bonsaiAnswer = data?.choices?.[0]?.message?.content || null
    const answer = bonsaiAnswer?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null
    return parsedAnswer(answer)
  }
  errorAnswer.reason = !!data?.content?.[0]?.text ? data?.stop_details?.explanation || '' : ''

  return errorAnswer?.reason ? errorAnswer : parsedAnswer(data?.content?.[0]?.text)
}
