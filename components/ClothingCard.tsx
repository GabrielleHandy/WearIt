import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { Colors, Typography, Radius, Shadow } from '@/constants/theme'

export default function ClothingCard({
  id,
  name = 'Unnamed Item',
  category = 'Uncategorized',
  emoji = '🧥',
  photoUri,
  addedAt,
}: {
  id: string
  name?: string
  category?: string
  emoji?: string
  photoUri?: string
  addedAt?: string
}) {
  const [selected, setSelected] = useState(false)
  const scheme: keyof typeof Colors = useColorScheme() === 'dark' ? 'dark' : 'light'
  const C = Colors[scheme]

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.card,
        { backgroundColor: C.backgroundCard, borderColor: C.border },
        selected && { borderColor: C.accent, backgroundColor: C.backgroundAccent },
        Shadow.card,
      ]}
      onPress={() => router.push({
        pathname: '/(tabs)/item/[id]',
        params: { id, name, category, emoji, photoUri }
      })}
      onLongPress={() => setSelected(!selected)}
    >
      <View style={styles.imageContainer}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: C.backgroundSubtle }]}>
            <Text style={styles.placeholderEmoji}>{emoji}</Text>
          </View>
        )}
        {selected && (
          <View style={[styles.selectedBadge, { backgroundColor: C.accent }]}>
            <Text style={styles.selectedCheck}>✓</Text>
          </View>
        )}
      </View>

      <View style={[styles.info, { borderTopColor: C.border }]}>
        <Text
          style={[styles.name, { color: C.textPrimary, fontFamily: Typography.bodyMedium }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[styles.category, { color: C.textAccent, fontFamily: Typography.label }]}
          numberOfLines={1}
        >
          {category.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 4,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
    opacity: 0.4,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  info: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    gap: 3,
  },
  name: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  category: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
})
