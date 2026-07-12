import * as FileSystem from 'expo-file-system/legacy'

const REMOVEBG_KEY = process.env.EXPO_PUBLIC_REMOVEBG_KEY
const REMOVEBG_URL = 'https://api.remove.bg/v1.0/removebg'

/**
 * Strips the background from a clothing photo using the remove.bg API.
 *
 * Returns a `file://` URI to a new transparent PNG on success. On ANY failure
 * (missing key, network error, quota exhausted, malformed response) it returns
 * the ORIGINAL `uri` untouched — background removal must never block a user
 * from adding an item to their wardrobe.
 *
 * Architecture note: every network/vendor detail of background removal lives
 * behind this one function. Call sites only ever do `uri = await removeBackground(uri)`.
 * Swapping remove.bg for an on-device model later means rewriting only this file.
 */
export async function removeBackground(uri: string): Promise<string> {
  // No key configured → silently pass the original photo through.
  if (!REMOVEBG_KEY) return uri

  try {
    // 1. Read the local image as base64. React Native's fetch handles base64
    //    strings far more reliably than binary Blob/FormData uploads, so we
    //    send and receive base64 on both ends.
    const inputB64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    })

    // 2. Ask remove.bg to reply with JSON (the Accept header) so the cutout
    //    comes back as base64 (`data.result_b64`) instead of a raw binary
    //    stream we'd otherwise have to decode by hand.
    const res = await fetch(REMOVEBG_URL, {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVEBG_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        image_file_b64: inputB64,
        size: 'auto', // free keys cap at preview resolution (~0.25MP) — fine for cards
        format: 'png', // PNG preserves the transparent background
        type: 'product', // tuned for objects/clothing, not people
      }),
    })

    if (!res.ok) {
      console.warn(`remove.bg failed (${res.status}) — keeping original photo`)
      return uri
    }

    const json = await res.json()
    const resultB64: string | undefined = json?.data?.result_b64
    if (!resultB64) return uri

    // 3. Persist the cutout in the document directory and hand back its URI.
    const dest = `${FileSystem.documentDirectory}cutout_${Date.now()}.png`
    await FileSystem.writeAsStringAsync(dest, resultB64, {
      encoding: 'base64',
    })
    return dest
  } catch (e) {
    console.warn('remove.bg error — keeping original photo:', e)
    return uri
  }
}
