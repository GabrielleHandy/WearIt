import { useState, useCallback, useMemo } from 'react'
import {
  View, FlatList, Text, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator,
  Image, Dimensions,
} from 'react-native'
import { WishlistItem } from '@/constants/types'
import { addWishlistItem, loadWishlist, deleteWishlistItem } from '@/utils/storage'
import { tagClothingItem } from '@/utils/claude'
import { useFocusEffect, router } from 'expo-router'
import { useImagePicker } from '@/hooks/useImagePicker'
import { getPendingSharedUri, setPendingSharedUri } from '@/utils/shareIntent'
import * as FileSystem from 'expo-file-system'
import { type Theme, Spacing, Radius, Typography } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

const { width } = Dimensions.get('window')
const CARD_SIZE = (width - 48) / 2   // 2 columns, 16px outer padding + 16px gap

export default function ShoppingScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tagging, setTagging] = useState(false)
  const { takePhoto, pickFromLibrary } = useImagePicker()

  useFocusEffect(
    useCallback(() => {
      // Handle incoming share intent (image shared from another app)
      const sharedUri = getPendingSharedUri()
      if (sharedUri) {
        setPendingSharedUri(null)
        processUri(sharedUri)
      }

      loadWishlist().then(saved => {
        setItems(saved)
        setLoading(false)
      })
    }, [])
  )

  const saveImagePermanently = async (uri: string): Promise<string> => {
    const filename = `wishlist_${Date.now()}_${uri.split('/').pop()!}`
    const destPath = FileSystem.Paths.document.uri + filename
    const sourceFile = new FileSystem.File(uri)
    const destFile = new FileSystem.File(destPath)
    sourceFile.copy(destFile)
    return destPath
  }

  const processUri = async (uri: string) => {
    setTagging(true)
    try {
      const permanentUri = await saveImagePermanently(uri)
      const tag = await tagClothingItem(permanentUri)
      const newItem = await addWishlistItem({
        name: tag.name,
        category: tag.category,
        color: tag.color,
        photoUri: permanentUri,
        addedAt: new Date().toISOString(),
      })
      setItems(prev => [newItem, ...prev])
    } catch {
      Alert.alert('Something went wrong', 'Could not tag this item. Try again.')
    } finally {
      setTagging(false)
    }
  }

  const captureAndTag = async (getUri: () => Promise<string | null>) => {
    const uri = await getUri()
    if (!uri) return
    await processUri(uri)
  }

  const handleAdd = () => {
    Alert.alert('Add to Wishlist', 'Add a photo of something you want', [
      { text: '📷 Take Photo', onPress: () => captureAndTag(takePhoto) },
      { text: '🖼️ Choose from Library', onPress: () => captureAndTag(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleLongPress = (item: WishlistItem) => {
    Alert.alert(item.name, 'Remove from wishlist?', [
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteWishlistItem(item.id)
          setItems(prev => prev.filter(i => i.id !== item.id))
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading wishlist ✨</Text>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={handleAdd}
        disabled={tagging}
      >
        {tagging ? (
          <View style={styles.row}>
            <ActivityIndicator color={theme.textOnAccent} size="small" />
            <Text style={styles.addBtnText}>Tagging item...</Text>
          </View>
        ) : (
          <Text style={styles.addBtnText}>+ Add to Wishlist</Text>
        )}
      </TouchableOpacity>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛍️</Text>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyBody}>
            Screenshot something you love, or snap a photo in-store.{'\n'}
            WearIt will tag it and save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/wishlist/${item.id}`)}
              onLongPress={() => handleLongPress(item)}
              activeOpacity={0.85}
            >
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: item.photoUri }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.color ? `${item.color} · ` : ''}{item.category}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  center: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'serif',
    fontSize: 18,
    color: theme.textSecondary,
  },
  addBtn: {
    margin: Spacing.base,
    backgroundColor: theme.accent,
    padding: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  addBtnText: {
    color: theme.textOnAccent,
    fontWeight: '600',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...Typography.styles.body,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  grid: {
    padding: Spacing.base,
    gap: Spacing.base,
  },
  card: {
    width: CARD_SIZE,
    backgroundColor: theme.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  photoContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  cardInfo: {
    padding: 10,
    gap: 2,
  },
  cardName: {
    ...Typography.styles.bodySmall,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  cardMeta: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
  },
})
