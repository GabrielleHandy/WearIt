import * as ImagePicker from 'expo-image-picker'

export function useImagePicker() {
  const takePhoto = async (): Promise<string | null> => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync()
    if (!granted) return null

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.8,
    })

    if (result.canceled) return null
    return result.assets[0].uri
  }

  const pickFromLibrary = async (): Promise<string | null> => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) return null

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.8,
    })

    if (result.canceled) return null
    return result.assets[0].uri
  }

  // Multi-select — returns an array of URIs (no crop, crop is disabled for multi)
  const pickMultipleFromLibrary = async (): Promise<string[]> => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) return []

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
      orderedSelection: true,
    })

    if (result.canceled) return []
    return result.assets.map(a => a.uri)
  }

  return { takePhoto, pickFromLibrary, pickMultipleFromLibrary }
}
