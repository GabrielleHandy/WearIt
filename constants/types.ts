export type ClothingItem = {
  id: string
  name: string
  category: 'Tops' | 'Bottoms' | 'Shoes' | 'Dresses' | 'Outerwear' | 'Accessories' | 'Other'
  emoji: string
  photoUri?: string        // front photo (cropped)
  originalPhotoUri?: string // bg-removed, uncropped — kept so crop can be redone
  backPhotoUri?: string    // back / detail photo
  color?: string           // primary color
  tags?: string[]          // user-defined tags for smart matching (e.g. "casual", "work", "summer")
  worn?: number            // track how often you wear it
  addedAt: string          // ISO date string
  needsTagging?: boolean   // true for no-AI items saved without a name/category yet
}
export type WearItSuggestion = {
  suggestion: string
  reason: string
  itemIndices?: number[]  // 0-based indices into the wardrobe array used in the prompt
  items?: number[]        // alias for itemIndices
  itemNames?: string[]    // legacy / randomizer compatibility
  isFallback?: boolean
}

export type WishlistItem = {
  id: string
  name: string
  category: ClothingItem['category']
  color: string
  photoUri: string       // always required — the visual is the point
  sourceNote?: string    // optional: "from Zara", "seen on TikTok", etc.
  addedAt: string
}

export type CanvasItemLayout = {
  clothingId: string   // wardrobe item id
  x: number            // translateX on canvas
  y: number            // translateY on canvas
  scale: number        // pinch scale
  rotation: number     // rotation in radians
}

export type SavedOutfit = {
  id: string
  suggestion: string       // the full AI-generated outfit text
  reason: string           // Claude's reasoning
  occasion: string         // what the user typed ("date night", "interview", etc.)
  weather: string          // weather context at time of generation
  savedAt: string          // ISO date string
  itemIds?: string[]       // wardrobe item IDs in this outfit
  canvasLayout?: CanvasItemLayout[]  // persisted canvas positions/transforms
}

export type OutfitPhotoTag = {
  itemId: string   // wardrobe item id this tag points to
  x: number        // 0–1, fraction of image width (normalized so tags survive any screen size)
  y: number        // 0–1, fraction of image height
}

export type OutfitPhoto = {
  id: string
  photoUri: string          // full outfit photo (camera or library)
  createdAt: string         // ISO date string
  tags: OutfitPhotoTag[]    // Facebook-style item tags placed on the photo
  savedOutfitId?: string    // optional link to the styled outfit this look came from
}

export type GapAnalysisResult = {
  matches: ClothingItem[]       // items you already own that are similar
  missing: string[]             // categories/pieces you'd need to complete the look
  summary: string               // Claude's plain-english read
}

export const ClothingCategoryOptions = [
  'Tops',
  'Bottoms',
  'Shoes',
  'Dresses',
  'Outerwear',
  'Accessories',
  'Other',]

export const AiModelEndpoints = {
  'Anthropic': 'https://api.anthropic.com/v1/messages'
}

export type ModelConfig = {
  url: string
  model: string
  apiKey?: string
  label?: string
}
