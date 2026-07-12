import { Image } from 'react-native'
import type { CropHint } from './claude'

export async function cropToClothing(uri: string, crop: CropHint): Promise<string> {
  try {
    // Dynamic import so a missing native module does not crash the app at startup.
    // Falls back to the uncropped URI until a build that includes expo-image-manipulator is deployed.
    const ImageManipulator = await import('expo-image-manipulator').catch(() => null)
    if (!ImageManipulator) return uri

    const { width, height } = await new Promise<{ width: number; height: number }>(
      (resolve, reject) =>
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
    )

    const originX = Math.round(crop.left * width)
    const originY = Math.round(crop.top * height)
    const cropW    = Math.round((crop.right - crop.left) * width)
    const cropH    = Math.round((crop.bottom - crop.top) * height)

    if (cropW < 20 || cropH < 20) return uri

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: cropW, height: cropH } }],
      { compress: 0.88, format: ImageManipulator.SaveFormat.PNG }
    )
    return result.uri
  } catch {
    return uri
  }
}
