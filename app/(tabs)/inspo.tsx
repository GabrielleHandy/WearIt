import { useState, useCallback, useMemo } from 'react'
import {
  View, FlatList, Text, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator,
  Image, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { WishlistItem } from '@/constants/types'
import { addWishlistItem, loadWishlist, deleteWishlistItem } from '@/utils/storage'
import { tagClothingItem } from '@/utils/claude'
import { useFocusEffect, router } from 'expo-router'
import { useImagePicker } from '@/hooks/useImagePicker'
import { getPendingSharedUri, setPendingSharedUri } from '@/utils/shareIntent'
import * as FileSystem from 'expo-file-system'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')
const CARD_SIZE = (width - Spacing.screen * 2 - Spacing.base) / 2

export default function InspoScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const insets = useSafeAreaInsets()

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
    Alert.alert('Add to Inspo', 'Screenshot something you love or snap it in-store', [
      { text: '📷 Take Photo', onPress: () => captureAndTag(takePhoto) },
      { text: '🖼️ Choose from Library', onPress: () => captureAndTag(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleLongPress = (item: WishlistItem) => {
    Alert.alert(item.name, 'Remove from Inspo?', [
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
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inspo</Text>
          <Text style={styles.subtitle}>
            {items.length > 0
              ? 'Tap to check your closet · Hold to remove'
              : 'Save pieces you love — WearIt checks what you already own'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, tagging && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={tagging}
          activeOpacity={0.85}
        >
          {tagging ? (
            <ActivityIndicator color={theme.textOnAccent} size="small" />
          ) : (
            <Ionicons name="add" size={20} color={theme.textOnAccent} />
          )}
        </TouchableOpacity>
      </View>

      {/* Tagging indicator */}
      {tagging && (
        <View style={styles.taggingBanner}>
          <ActivityIndicator color={theme.accent} size="small" />
          <Text style={styles.taggingText}>Auto-tagging your item...</Text>
        </View>
      )}

      {/* ── Grid ───────────────────────────────────────── */}
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="compass-outline" size={48} color={theme.border} />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>
            Screenshot something you love on TikTok, in-store, or anywhere.{'\n'}
            WearIt tags it and tells you how close you already are.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={handleAdd}>
            <Text style={styles.emptyBtnText}>+ Add First Piece</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: Spacing.base }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/wishlist/${item.id}`)}
              onLongPress={() => handleLongPress(item)}
              activeOpacity={0.85}
              delayLongPress={400}
            >
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: item.photoUri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.color ? `${item.color} · ` : ''}{item.category}
                </Text>
                {/* Tap hint */}
                <View style={styles.analyzeHint}>
                  <Ionicons name="search-outline" size={10} color={theme.accent} />
                  <Text style={styles.analyzeHintText}>Check closet gap</Text>
                </View>
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

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 30,
    color: theme.textPrimary,
  },
  subtitle: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    marginTop: 4,
    maxWidth: 240,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  addBtnDisabled: { opacity: 0.6 },

  // ── Tagging banner ───────────────────────────────────────
  taggingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.screen,
    marginBottom: Spacing.sm,
    backgroundColor: theme.surfaceTint,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  taggingText: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
  },

  // ── Grid ────────────────────────────────────────────────
  grid: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.base,
  },
  card: {
    width: CARD_SIZE,
    backgroundColor: theme.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    ...Shadow.card,
  },
  photoContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: theme.surfaceTint,
  },
  photo: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  cardInfo: {
    padding: Spacing.sm,
    gap: 3,
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
  analyzeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  analyzeHintText: {
    fontSize: 10,
    fontFamily: 'JosefinSans_400Regular',
    color: theme.accent,
  },

  // ── Empty state ──────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.base,
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
  emptyBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
  emptyBtnText: {
    ...Typography.styles.btnLabelSm,
    color: theme.textOnAccent,
  },
})
