import { ClothingItem, ModelConfig, OutfitPhoto, SavedOutfit, WishlistItem } from '@/constants/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'


//MONTHLY CAP LOGIC
const USAGE_KEY = 'wearit_claude_usage'
const MONTHLY_CAP = 50 // TODO: revert to 20 after testing Lambda
export async function getUsageCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(USAGE_KEY)
  if (!raw) return 0
  const parsed = JSON.parse(raw)

  // Reset if it's a new month or new year
  const now = new Date()
  if (parsed.month !== now.getMonth() || parsed.year !== now.getFullYear()) {
    await AsyncStorage.removeItem(USAGE_KEY)
    return 0
  }

  return parsed.count
}

export async function incrementUsage(): Promise<void> {
  const count = await getUsageCount()
  const now = new Date()
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify({
    count: count + 1,
    month: now.getMonth(),
    year: now.getFullYear(),
  }))
}

export async function isUnderCap(): Promise<boolean> {
  const count = await getUsageCount()
  return count < MONTHLY_CAP
}

//WARDROBE LOGIC CRUD
const WARDROBE_KEY = 'wearit_wardrobe'

export async function loadWardrobe(): Promise<ClothingItem[]> {
  const raw = await AsyncStorage.getItem(WARDROBE_KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

export async function saveWardrobe(items: ClothingItem[]) {
  await AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(items))
}

export async function addItem(item: Omit<ClothingItem, 'id'>) {
  const current = await loadWardrobe()
  const newItem = { ...item, id: Crypto.randomUUID() }
  await saveWardrobe([...current, newItem])
  return newItem
}

export async function deleteItem(id: string) {
  const current = await loadWardrobe()
  await saveWardrobe(current.filter(item => item.id !== id))
}

export async function deleteItems(ids: string[]) {
  const set = new Set(ids)
  const current = await loadWardrobe()
  await saveWardrobe(current.filter(item => !set.has(item.id)))
}

export async function updateItem(updated: ClothingItem) {
  const current = await loadWardrobe()
  await saveWardrobe(current.map(item =>
    item.id === updated.id ? updated : item
  ))
}

// WISHLIST CRUD
const WISHLIST_KEY = 'wearit_wishlist'

export async function loadWishlist(): Promise<WishlistItem[]> {
  const raw = await AsyncStorage.getItem(WISHLIST_KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

export async function saveWishlist(items: WishlistItem[]) {
  await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(items))
}

export async function addWishlistItem(item: Omit<WishlistItem, 'id'>): Promise<WishlistItem> {
  const current = await loadWishlist()
  const newItem = { ...item, id: Crypto.randomUUID() }
  await saveWishlist([...current, newItem])
  return newItem
}

export async function deleteWishlistItem(id: string) {
  const current = await loadWishlist()
  await saveWishlist(current.filter(item => item.id !== id))
}

export async function getWishlistItem(id: string): Promise<WishlistItem | null> {
  const items = await loadWishlist()
  return items.find(item => item.id === id) ?? null
}

// WARDROBE SEARCH
export async function searchWardrobe(query: string): Promise<ClothingItem[]> {
  const items = await loadWardrobe()
  const q = query.toLowerCase()
  return items.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.color?.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q)
  )
}

//TRAINING EXAMPLES

const TRAINING_KEY = 'wearit_training_examples'

export type TrainingExample = {
  wardrobeList: string
  context: string
  suggestion: string
  reason: string
  timestamp: string
}

export async function saveTrainingExample(example: TrainingExample): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRAINING_KEY)
    const existing: TrainingExample[] = raw ? JSON.parse(raw) : []
    // Keep last 20 examples — enough for few-shot, not too heavy
    const updated = [...existing, example].slice(-20)
    await AsyncStorage.setItem(TRAINING_KEY, JSON.stringify(updated))
  } catch(e) {
    console.error('Failed to save training example:', e)
  }
}

export async function getTrainingExamples(): Promise<TrainingExample[]> {
  try {
    const raw = await AsyncStorage.getItem(TRAINING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// SAVED OUTFITS
const OUTFITS_KEY = 'wearit_saved_outfits'

export async function loadSavedOutfits(): Promise<SavedOutfit[]> {
  const raw = await AsyncStorage.getItem(OUTFITS_KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

export async function saveOutfit(outfit: Omit<SavedOutfit, 'id'>): Promise<SavedOutfit> {
  const current = await loadSavedOutfits()
  const newOutfit = { ...outfit, id: Crypto.randomUUID() }
  // Newest first
  await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify([newOutfit, ...current]))
  return newOutfit
}

export async function updateSavedOutfit(outfit: SavedOutfit): Promise<SavedOutfit> {
  const current = await loadSavedOutfits()
  await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(current.map(o => o.id === outfit.id ? outfit : o)))
  return outfit
}

export async function deleteSavedOutfit(id: string): Promise<void> {
  const current = await loadSavedOutfits()
  await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(current.filter(o => o.id !== id)))
}

// Bulk overwrite — used by restore-from-backup, where we're replacing the whole list at once
export async function saveSavedOutfits(outfits: SavedOutfit[]): Promise<void> {
  await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(outfits))
}

// MODEL CONFIG
const MODEL_CONFIG_KEY = 'wearit_model_config'

export async function saveModelConfig(config: ModelConfig): Promise<void> {
  await AsyncStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config))
}

export async function loadModelConfig(): Promise<ModelConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(MODEL_CONFIG_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function clearModelConfig(): Promise<void> {
  await AsyncStorage.removeItem(MODEL_CONFIG_KEY)
}

// OUTFIT PHOTOS (tagged looks)
const OUTFIT_PHOTOS_KEY = 'wearit_outfit_photos'

export async function loadOutfitPhotos(): Promise<OutfitPhoto[]> {
  const raw = await AsyncStorage.getItem(OUTFIT_PHOTOS_KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

export async function saveOutfitPhoto(photo: Omit<OutfitPhoto, 'id'>): Promise<OutfitPhoto> {
  const current = await loadOutfitPhotos()
  const newPhoto = { ...photo, id: Crypto.randomUUID() }
  // Newest first
  await AsyncStorage.setItem(OUTFIT_PHOTOS_KEY, JSON.stringify([newPhoto, ...current]))
  return newPhoto
}

export async function updateOutfitPhoto(photo: OutfitPhoto): Promise<OutfitPhoto> {
  const current = await loadOutfitPhotos()
  await AsyncStorage.setItem(OUTFIT_PHOTOS_KEY, JSON.stringify(current.map(p => p.id === photo.id ? photo : p)))
  return photo
}

export async function deleteOutfitPhoto(id: string): Promise<void> {
  const current = await loadOutfitPhotos()
  await AsyncStorage.setItem(OUTFIT_PHOTOS_KEY, JSON.stringify(current.filter(p => p.id !== id)))
}

// Bump worn count for items tagged in an outfit photo — feeds the
// enriched wardrobe data sent to Claude (Block 3)
export async function incrementWorn(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return
  const set = new Set(itemIds)
  const current = await loadWardrobe()
  await saveWardrobe(current.map(item =>
    set.has(item.id) ? { ...item, worn: (item.worn ?? 0) + 1 } : item
  ))
}

// AI ENABLED FLAG
const AI_ENABLED_KEY = 'wearit_ai_enabled'

export async function loadAIEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(AI_ENABLED_KEY)
    if (raw === null) return true  // default: AI on
    return JSON.parse(raw)
  } catch { return true }
}

export async function saveAIEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AI_ENABLED_KEY, JSON.stringify(enabled))
}
