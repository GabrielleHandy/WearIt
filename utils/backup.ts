// Cloud backup/restore for the wardrobe, wishlist, and saved outfits.
// No login — backups are keyed by a random deviceId generated once per install
// and persisted in AsyncStorage. To restore on a new phone, the user re-enters
// that same deviceId (shown in Settings).
//
// Photos are never sent through the Lambda/API Gateway body — they're uploaded
// and downloaded directly against S3 via short-lived presigned URLs the Lambda
// hands back, since base64-inlining many photos would blow past payload limits.

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import * as FileSystem from 'expo-file-system/legacy'
import { ClothingItem, SavedOutfit, WishlistItem } from '@/constants/types'
import {
  loadSavedOutfits,
  loadWardrobe,
  loadWishlist,
  saveSavedOutfits,
  saveWardrobe,
  saveWishlist,
} from './storage'

const BACKUP_URL = process.env.EXPO_PUBLIC_BACKUP_API_URL || ''
const DEVICE_ID_KEY = 'wearit_device_id'

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = Crypto.randomUUID()
    await AsyncStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export async function setDeviceId(id: string): Promise<void> {
  await AsyncStorage.setItem(DEVICE_ID_KEY, id.trim())
}

type BackupResult = { ok: true } | { ok: false; error: string }

type PhotoUpload = { key: string; localUri: string }

function photoKey(deviceId: string, itemId: string, slot: 'front' | 'original' | 'back') {
  return `${deviceId}/${itemId}-${slot}.jpg`
}

function wishlistPhotoKey(deviceId: string, itemId: string) {
  return `${deviceId}/wishlist-${itemId}.jpg`
}

function collectPhotos(deviceId: string, wardrobe: ClothingItem[], wishlist: WishlistItem[]): PhotoUpload[] {
  const uploads: PhotoUpload[] = []
  for (const item of wardrobe) {
    if (item.photoUri) uploads.push({ key: photoKey(deviceId, item.id, 'front'), localUri: item.photoUri })
    if (item.originalPhotoUri) uploads.push({ key: photoKey(deviceId, item.id, 'original'), localUri: item.originalPhotoUri })
    if (item.backPhotoUri) uploads.push({ key: photoKey(deviceId, item.id, 'back'), localUri: item.backPhotoUri })
  }
  for (const item of wishlist) {
    if (item.photoUri) uploads.push({ key: wishlistPhotoKey(deviceId, item.id), localUri: item.photoUri })
  }
  return uploads
}

export async function backupWardrobe(
  onProgress?: (done: number, total: number) => void
): Promise<BackupResult> {
  if (!BACKUP_URL) return { ok: false, error: 'Backup is not configured yet.' }

  try {
    const deviceId = await getDeviceId()
    const [wardrobe, wishlist, savedOutfits] = await Promise.all([
      loadWardrobe(),
      loadWishlist(),
      loadSavedOutfits(),
    ])
    const photos = collectPhotos(deviceId, wardrobe, wishlist)

    const res = await fetch(BACKUP_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        wardrobe,
        wishlist,
        savedOutfits,
        photoKeys: photos.map(p => p.key),
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('Backup save failed:', res.status, text)
      return { ok: false, error: `Server error (${res.status})` }
    }

    const { uploadUrls } = (await res.json()) as { uploadUrls: Record<string, string> }

    let done = 0
    for (const photo of photos) {
      const url = uploadUrls[photo.key]
      if (url) {
        await FileSystem.uploadAsync(url, photo.localUri, {
          httpMethod: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
        })
      }
      done += 1
      onProgress?.(done, photos.length)
    }

    return { ok: true }
  } catch (e) {
    console.error('Backup failed:', e)
    return { ok: false, error: 'Could not reach the backup server.' }
  }
}

export async function restoreWardrobe(
  deviceIdOverride?: string,
  onProgress?: (done: number, total: number) => void
): Promise<BackupResult> {
  if (!BACKUP_URL) return { ok: false, error: 'Backup is not configured yet.' }

  try {
    const deviceId = deviceIdOverride?.trim() || (await getDeviceId())
    const res = await fetch(`${BACKUP_URL}?deviceId=${encodeURIComponent(deviceId)}`)

    if (!res.ok) {
      if (res.status === 404) return { ok: false, error: 'No backup found for that device ID.' }
      const text = await res.text().catch(() => '')
      console.error('Restore fetch failed:', res.status, text)
      return { ok: false, error: `Server error (${res.status})` }
    }

    const data = (await res.json()) as {
      wardrobe: ClothingItem[]
      wishlist: WishlistItem[]
      savedOutfits: SavedOutfit[]
      photos: Record<string, string>
    }

    const photoEntries = Object.entries(data.photos || {})
    const downloaded: Record<string, string> = {}
    let done = 0
    for (const [key, url] of photoEntries) {
      const filename = key.split('/').pop()
      const dest = `${FileSystem.cacheDirectory}${filename}`
      const result = await FileSystem.downloadAsync(url, dest)
      downloaded[key] = result.uri
      done += 1
      onProgress?.(done, photoEntries.length)
    }

    const wardrobe = (data.wardrobe || []).map(item => ({
      ...item,
      photoUri: downloaded[photoKey(deviceId, item.id, 'front')] ?? item.photoUri,
      originalPhotoUri: downloaded[photoKey(deviceId, item.id, 'original')] ?? item.originalPhotoUri,
      backPhotoUri: downloaded[photoKey(deviceId, item.id, 'back')] ?? item.backPhotoUri,
    }))

    const wishlist = (data.wishlist || []).map(item => ({
      ...item,
      photoUri: downloaded[wishlistPhotoKey(deviceId, item.id)] ?? item.photoUri,
    }))

    // If we restored under a different deviceId than the one already on this install,
    // adopt it — future backups should overwrite the same cloud record, not fork a new one.
    if (deviceIdOverride) await setDeviceId(deviceId)

    await saveWardrobe(wardrobe)
    await saveWishlist(wishlist)
    await saveSavedOutfits(data.savedOutfits || [])

    return { ok: true }
  } catch (e) {
    console.error('Restore failed:', e)
    return { ok: false, error: 'Could not reach the backup server.' }
  }
}
