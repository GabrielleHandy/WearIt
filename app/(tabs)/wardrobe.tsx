import { useState, useCallback, useMemo } from 'react'
import {
  View, ScrollView, Text, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator, Image,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ClothingItem, ClothingCategoryOptions } from '@/constants/types'
import { addItem, loadWardrobe, deleteItems } from '../../utils/storage'
import { tagClothingItem } from '@/utils/claude'
import { removeBackground } from '@/utils/removeBackground'
import { cropToClothing } from '@/utils/cropImage'
import { useFocusEffect, router } from 'expo-router'
import { useImagePicker } from '@/hooks/useImagePicker'
import * as FileSystem from 'expo-file-system'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAI } from '@/contexts/AIContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Dresses', 'Outerwear', 'Accessories', 'Other']

const CATEGORY_EMOJI: Record<string, string> = {
  Tops: '👕', Bottoms: '👖', Shoes: '👟',
  Dresses: '👗', Outerwear: '🧥', Accessories: '👜', Other: '🎽',
}

// Ionicons fallback per category — no emojis in the card UI
const CATEGORY_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  Tops:        'shirt-outline',
  Bottoms:     'body-outline',
  Shoes:       'walk-outline',
  Dresses:     'ribbon-outline',
  Outerwear:   'layers-outline',
  Accessories: 'bag-handle-outline',
  Other:       'sparkles-outline',
}

// ─── Color name → hex ──────────────────────────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  black: '#1a1a1a', white: '#f5f5f5', grey: '#9e9e9e', gray: '#9e9e9e',
  red: '#e53935', pink: '#e91e8c', orange: '#f57c00', yellow: '#fdd835',
  green: '#43a047', teal: '#00897b', blue: '#1e88e5', navy: '#1a237e',
  purple: '#8e24aa', brown: '#6d4c41', beige: '#d7ccc8', cream: '#fff8e1',
  tan: '#c8a97e', khaki: '#bdb76b', olive: '#808000', burgundy: '#800020',
  coral: '#ff6b6b', lavender: '#b39ddb', gold: '#ffd700', silver: '#c0c0c0',
}

function colorToHex(colorName: string): string {
  const lower = colorName.toLowerCase()
  for (const [key, hex] of Object.entries(COLOR_HEX)) {
    if (lower.includes(key)) return hex
  }
  return '#aaaaaa'
}

// ─── Manual Tag Modal ─────────────────────────────────────────────────────
// Used when AI is off. Shows photo + form fields.

function ManualTagModal({
  visible,
  photoUri,
  batchInfo,
  theme,
  onSave,
  onCancel,
}: {
  visible: boolean
  photoUri: string | null
  batchInfo?: { current: number; total: number }
  theme: Theme
  onSave: (fields: { name: string; category: ClothingItem['category']; color: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ClothingItem['category']>('Tops')
  const [color, setColor] = useState('')

  const handleSave = () => {
    onSave({ name: name.trim() || 'New Item', category, color: color.trim() })
    setName('')
    setColor('')
    setCategory('Tops')
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={modalStyles.content}>

          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={[modalStyles.title, { color: theme.textPrimary }]}>
              {batchInfo ? `Label Item ${batchInfo.current} of ${batchInfo.total}` : 'Label This Item'}
            </Text>
            {!batchInfo && (
              <TouchableOpacity onPress={onCancel} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Photo preview */}
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={modalStyles.photo} resizeMode="cover" />
          ) : (
            <View style={[modalStyles.photoPlaceholder, { backgroundColor: theme.surfaceTint }]}>
              <Text style={{ fontSize: 48 }}>{CATEGORY_EMOJI[category]}</Text>
            </View>
          )}

          {/* Name */}
          <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Name</Text>
          <TextInput
            style={[modalStyles.input, { color: theme.textPrimary, backgroundColor: theme.surface, borderColor: theme.border }]}
            placeholder="e.g. White Linen Shirt"
            placeholderTextColor={theme.textPlaceholder}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Color */}
          <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Color</Text>
          <TextInput
            style={[modalStyles.input, { color: theme.textPrimary, backgroundColor: theme.surface, borderColor: theme.border }]}
            placeholder="e.g. Navy Blue"
            placeholderTextColor={theme.textPlaceholder}
            value={color}
            onChangeText={setColor}
            autoCapitalize="words"
            returnKeyType="done"
          />

          {/* Category */}
          <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Category</Text>
          <View style={modalStyles.pills}>
            {ClothingCategoryOptions.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[
                  modalStyles.pill,
                  { borderColor: theme.accent },
                  category === opt && { backgroundColor: theme.accent },
                ]}
                onPress={() => setCategory(opt as ClothingItem['category'])}
              >
                <Text style={[
                  modalStyles.pillText,
                  { color: theme.accent },
                  category === opt && { color: theme.textOnAccent },
                ]}>
                  {CATEGORY_EMOJI[opt]} {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[modalStyles.saveBtn, { backgroundColor: theme.accent }]}
            onPress={handleSave}
          >
            <Text style={[modalStyles.saveBtnText, { color: theme.textOnAccent }]}>
              {batchInfo && batchInfo.current < batchInfo.total ? 'Save & Next →' : 'Save Item'}
            </Text>
          </TouchableOpacity>

          {batchInfo && (
            <TouchableOpacity style={modalStyles.skipBtn} onPress={onCancel}>
              <Text style={[modalStyles.skipText, { color: theme.textSecondary }]}>Cancel remaining</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  content: {
    padding: Spacing.screen,
    paddingTop: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.styles.screenTitle,
  },
  photo: {
    width: '100%',
    height: 240,
    borderRadius: Radius.xl,
    marginBottom: Spacing.xl,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.styles.sectionLabel,
    marginBottom: Spacing.sm,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.styles.body,
    marginBottom: Spacing.xl,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'JosefinSans_600SemiBold',
  },
  saveBtn: {
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveBtnText: {
    ...Typography.styles.btnLabel,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipText: {
    ...Typography.styles.caption,
  },
})

// ─── Grid card (2-col vertical grid with overflow photo design) ────────────

// ─── Horizontal browse card (default category view) ───────────────────────

const BROWSE_CARD_WIDTH = 130

function BrowseCard({ item, theme, selected, selectMode, onToggle }: {
  item: ClothingItem; theme: Theme; selected?: boolean; selectMode?: boolean; onToggle?: () => void
}) {
  const s = useMemo(() => makeBrowseCardStyles(theme), [theme])
  return (
    <TouchableOpacity
      style={s.wrapper}
      onPress={selectMode ? onToggle : () => router.push({ pathname: '/(tabs)/item/[id]', params: { id: item.id, name: item.name, category: item.category, emoji: item.emoji, photoUri: item.photoUri ?? '' } })}
      activeOpacity={0.88}
    >
      {/* Photo container — constrains plate + shadow + photo */}
      <View style={s.photoContainer}>
        <View style={s.photoPlate} />
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={s.shadowImage} tintColor="black" />
        ) : null}
        <View style={[s.photoWrap, selected && s.photoWrapSelected]}>
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={[s.photo, selected && s.photoSelected]} />
          ) : (
            <View style={s.emojiBg}>
              <Ionicons name={CATEGORY_ICON[item.category] ?? 'shirt-outline'} size={36} color={theme.textPlaceholder} />
            </View>
          )}
        </View>
        {item.needsTagging && !selectMode && (
          <View style={s.editBadge}>
            <Text style={s.editText}>Edit</Text>
          </View>
        )}
        {selectMode && (
          <View style={[s.selectBadge, selected && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
            {selected && <Ionicons name="checkmark" size={11} color="#fff" />}
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const makeBrowseCardStyles = (theme: Theme) => StyleSheet.create({
  wrapper: {
    width: BROWSE_CARD_WIDTH,
  },
  // Contains both shadow + photo so shadow is bounded to photo area
  photoContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  // Circle plate behind photo — clothes overhang the edges, looks lifted
  photoPlate: {
    position: 'absolute',
    top: 14,
    left: 10,
    right: 10,
    bottom: 14,
    borderRadius: 999,
    backgroundColor: theme.textSecondary,
    opacity: 0.22,
  },
  // Tinted copy — sits between plate and photo, adds depth below clothing shape
  shadowImage: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: -5,
    borderRadius: Radius.xl,
    opacity: 0.08,
    resizeMode: 'cover',
  },
  // Fills photoContainer, clips image + adds edge definition for light-colored items
  photoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  emojiBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceTint,
  },
  editBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,200,0,0.92)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  editText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#1a1a1a',
    fontFamily: 'JosefinSans_600SemiBold',
  },
  photoWrapSelected: {
    opacity: 0.6,
  },
  photoSelected: {},
  selectBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// ─── Grid card (filtered/search results — 2-col vertical grid) ────────────

function GridCard({ item, theme, selected, selectMode, onToggle }: {
  item: ClothingItem; theme: Theme; selected?: boolean; selectMode?: boolean; onToggle?: () => void
}) {
  const gridStyles = useMemo(() => makeGridCardStyles(theme), [theme])
  return (
    <TouchableOpacity
      style={gridStyles.wrapper}
      onPress={selectMode ? onToggle : () => router.push({ pathname: '/(tabs)/item/[id]', params: { id: item.id, name: item.name, category: item.category, emoji: item.emoji, photoUri: item.photoUri ?? '' } })}
      activeOpacity={0.88}
    >
      <View style={gridStyles.photoContainer}>
        <View style={gridStyles.photoPlate} />
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={gridStyles.shadowImage} tintColor="black" />
        ) : null}
        <View style={[gridStyles.photoWrap, selected && gridStyles.photoWrapSelected]}>
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={gridStyles.photo} />
          ) : (
            <View style={gridStyles.emojiBg}>
              <Ionicons name={CATEGORY_ICON[item.category] ?? 'shirt-outline'} size={40} color={theme.textPlaceholder} />
            </View>
          )}
        </View>
        {item.needsTagging && !selectMode && (
          <View style={gridStyles.editBadge}>
            <Text style={gridStyles.editText}>Edit</Text>
          </View>
        )}
        {selectMode && (
          <View style={[gridStyles.selectBadge, selected && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
            {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const makeGridCardStyles = (theme: Theme) => StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  photoPlate: {
    position: 'absolute',
    top: 14,
    left: 10,
    right: 10,
    bottom: 14,
    borderRadius: 999,
    backgroundColor: theme.textSecondary,
    opacity: 0.22,
  },
  shadowImage: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: -5,
    borderRadius: Radius.xl,
    opacity: 0.08,
    resizeMode: 'cover',
  },
  photoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  emojiBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceTint,
  },
  editBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,200,0,0.92)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  editText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#1a1a1a',
    fontFamily: 'JosefinSans_600SemiBold',
  },
  photoWrapSelected: {
    opacity: 0.55,
  },
  selectBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyWardrobe({ onAdd }: { onAdd: () => void }) {
  const { theme } = useTheme()
  const emptyStyles = useMemo(() => makeEmptyStyles(theme), [theme])
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>🪞</Text>
      <Text style={emptyStyles.title}>Your closet is waiting</Text>
      <Text style={emptyStyles.subtitle}>Add your first piece and let WearIt learn your style</Text>
      <TouchableOpacity style={emptyStyles.btn} onPress={onAdd}>
        <Text style={emptyStyles.btnText}>+ Add First Item</Text>
      </TouchableOpacity>
    </View>
  )
}

const makeEmptyStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xxl,
  },
  icon: { fontSize: 56, marginBottom: Spacing.base },
  title: { ...Typography.styles.screenTitle, color: theme.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { ...Typography.styles.bodySmall, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  btn: { backgroundColor: theme.accent, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.lg },
  btnText: { ...Typography.styles.btnLabel, color: theme.textOnAccent },
})

// ─── Main screen ───────────────────────────────────────────────────────────

export default function WardrobeScreen() {
  const { theme } = useTheme()
  const { aiEnabled } = useAI()
  const { top } = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(theme, top), [theme, top])
  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tagging, setTagging] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [query, setQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterColors, setFilterColors] = useState<string[]>([])
  const [showColorPicker, setShowColorPicker] = useState(false)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showMenu, setShowMenu] = useState(false)

  // Manual tagging modal state
  const [manualQueue, setManualQueue] = useState<string[]>([])   // permanent URIs queued
  const [manualIndex, setManualIndex] = useState(0)
  const [showManualModal, setShowManualModal] = useState(false)

  const { takePhoto, pickFromLibrary, pickMultipleFromLibrary } = useImagePicker()

  const availableColors = useMemo(() => {
    const seen = new Set<string>()
    items.forEach(i => { if (i.color) seen.add(i.color) })
    return Array.from(seen).sort()
  }, [items])

  // Items that still need manual labeling
  const needsTaggingCount = useMemo(() => items.filter(i => i.needsTagging).length, [items])

  const saveImagePermanently = async (uri: string): Promise<string> => {
    const filename = uri.split('/').pop()!
    const destPath = FileSystem.Paths.document.uri + filename
    const sourceFile = new FileSystem.File(uri)
    const destFile = new FileSystem.File(destPath)
    await sourceFile.copy(destFile)
    return destPath
  }

  // ── Manual save from modal ─────────────────────────────────────────────
  const handleManualSave = async (fields: { name: string; category: ClothingItem['category']; color: string }) => {
    const uri = manualQueue[manualIndex]
    const newItem = await addItem({
      name: fields.name,
      category: fields.category,
      emoji: CATEGORY_EMOJI[fields.category] ?? '👗',
      color: fields.color,
      photoUri: uri,
      addedAt: new Date().getTime().toString(),
      needsTagging: false,
    })
    setItems(prev => [...prev, newItem])

    const next = manualIndex + 1
    if (next < manualQueue.length) {
      setManualIndex(next)
    } else {
      setManualQueue([])
      setManualIndex(0)
      setShowManualModal(false)
    }
  }

  const handleManualCancel = () => {
    setManualQueue([])
    setManualIndex(0)
    setShowManualModal(false)
  }

  // ── Tag + save a single photo (AI path) ───────────────────────────────
  const tagAndSaveAI = async (permanentUri: string) => {
    // Strip background first — removeBackground falls back on any failure
    const cleanUri = await removeBackground(permanentUri)
    const tag = await tagClothingItem(cleanUri)
    // Crop to the clothing bounding box Claude returned (if present)
    const finalUri = tag.crop ? await cropToClothing(cleanUri, tag.crop) : cleanUri
    const newItem = await addItem({
      name: tag.name,
      category: tag.category,
      emoji: CATEGORY_EMOJI[tag.category] ?? '👗',
      color: tag.color,
      tags: tag.tags,
      photoUri: finalUri,
      originalPhotoUri: tag.crop ? cleanUri : undefined,  // keep original so crop can be redone
      addedAt: new Date().getTime().toString(),
      needsTagging: false,
    })
    setItems(prev => [...prev, newItem])
    return newItem
  }

  const processBatchAI = async (uris: string[]) => {
    for (let i = 0; i < uris.length; i++) {
      setBatchProgress({ current: i + 1, total: uris.length })
      try {
        await tagAndSaveAI(uris[i])
      } catch {
        // Skip failed items
      }
    }
    setBatchProgress(null)
  }

  // ── Add item handler ────────────────────────────────────────────────────
  const [showPhotoTips, setShowPhotoTips] = useState(false)

  const handleAddItem = async () => {
    Alert.alert('Add to Wardrobe', 'Tip: Lay the item flat on a clean surface and shoot from above with good lighting. Avoid busy backgrounds.', [
      {
        text: '📷 Take Photo',
        onPress: async () => {
          const uri = await takePhoto()
          if (!uri) return
          const permanentUri = await saveImagePermanently(uri)
          if (!aiEnabled) {
            const cleanUri = await removeBackground(permanentUri)
            setManualQueue([cleanUri])
            setManualIndex(0)
            setShowManualModal(true)
            return
          }
          setTagging(true)
          await tagAndSaveAI(permanentUri)
          setTagging(false)
        },
      },
      {
        text: '🖼️ Choose one',
        onPress: async () => {
          const uri = await pickFromLibrary()
          if (!uri) return
          const permanentUri = await saveImagePermanently(uri)
          if (!aiEnabled) {
            const cleanUri = await removeBackground(permanentUri)
            setManualQueue([cleanUri])
            setManualIndex(0)
            setShowManualModal(true)
            return
          }
          setTagging(true)
          await tagAndSaveAI(permanentUri)
          setTagging(false)
        },
      },
      {
        text: '📚 Select multiple',
        onPress: async () => {
          const uris = await pickMultipleFromLibrary()
          if (uris.length === 0) return
          const permanentUris = await Promise.all(uris.map(saveImagePermanently))
          if (!aiEnabled) {
            const cleanUris = await Promise.all(permanentUris.map(removeBackground))
            setManualQueue(cleanUris)
            setManualIndex(0)
            setShowManualModal(true)
            return
          }
          await processBatchAI(permanentUris)
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  useFocusEffect(
    useCallback(() => {
      loadWardrobe().then(saved => {
        setItems(saved)
        setLoading(false)
      })
    }, [])
  )

  const toggleColorFilter = (color: string) => {
    setFilterColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])
  }

  const toggleCategoryFilter = (category: string) => {
    setFilterCategory(prev => prev === category ? null : category)
  }

  const clearAllFilters = () => {
    setQuery('')
    setFilterCategory(null)
    setFilterColors([])
    setShowColorPicker(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(items.map(i => i.id)))

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    Alert.alert(
      `Remove ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}?`,
      "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await deleteItems([...selectedIds])
            setItems(prev => prev.filter(i => !selectedIds.has(i.id)))
            exitSelectMode()
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  const q = query.toLowerCase().trim()
  const tokens = q.split(/\s+/).filter(Boolean)
  const isFiltered = q.length > 0 || filterCategory !== null || filterColors.length > 0

  const filteredItems = isFiltered
    ? items.filter(item => {
        if (tokens.length > 0) {
          const ok = tokens.every(token =>
            item.name.toLowerCase().includes(token) ||
            item.category.toLowerCase().includes(token) ||
            (item.color?.toLowerCase().includes(token) ?? false)
          )
          if (!ok) return false
        }
        if (filterCategory && item.category !== filterCategory) return false
        if (filterColors.length > 0 && !filterColors.includes(item.color ?? '')) return false
        return true
      })
    : []

  const filteredRows = filteredItems.reduce<ClothingItem[][]>((acc, item, i) => {
    if (i % 2 === 0) acc.push([item])
    else acc[acc.length - 1].push(item)
    return acc
  }, [])

  const categoriesWithItems = CATEGORIES
    .map(cat => ({ category: cat, items: items.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  const hasActiveChips = filterCategory !== null || filterColors.length > 0

  return (
    <View style={styles.screen}>
      {showMenu && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setShowMenu(false)}
          activeOpacity={0}
        />
      )}

      {/* Manual tagging modal */}
      <ManualTagModal
        visible={showManualModal}
        photoUri={manualQueue[manualIndex] ?? null}
        batchInfo={manualQueue.length > 1 ? { current: manualIndex + 1, total: manualQueue.length } : undefined}
        theme={theme}
        onSave={handleManualSave}
        onCancel={handleManualCancel}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Wardrobe</Text>
          <Text style={styles.subtitle}>{items.length} {items.length === 1 ? 'piece' : 'pieces'}</Text>
        </View>
        {selectMode ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={exitSelectMode}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowMenu(prev => !prev)}
              disabled={tagging || !!batchProgress}
              hitSlop={8}
            >
              {tagging ? (
                <ActivityIndicator color={theme.textOnAccent} size='small' />
              ) : (
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.textOnAccent} />
              )}
            </TouchableOpacity>
            {showMenu && (
              <View style={[styles.menuDropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setShowMenu(false); handleAddItem() }}
                >
                  <Ionicons name="add" size={16} color={theme.textPrimary} />
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Add item</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.border }]}
                  onPress={() => { setShowMenu(false); setShowPhotoTips(true) }}
                >
                  <Ionicons name="camera-outline" size={16} color={theme.textPrimary} />
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Photo tips</Text>
                </TouchableOpacity>
                {items.length > 0 && (
                  <TouchableOpacity
                    style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.border }]}
                    onPress={() => { setShowMenu(false); setSelectMode(true) }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={theme.textPrimary} />
                    <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Select items</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Select mode bar */}
      {selectMode && (
        <View style={[styles.selectBar, { backgroundColor: theme.surfaceTint, borderColor: theme.border }]}>
          <Text style={[styles.selectBarText, { color: theme.textSecondary }]}>
            {selectedIds.size} selected
          </Text>
          <TouchableOpacity onPress={selectedIds.size === items.length ? exitSelectMode : selectAll}>
            <Text style={[styles.selectBarLink, { color: theme.accent }]}>
              {selectedIds.size === items.length ? 'Deselect all' : 'Select all'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Needs-labeling banner */}
      {needsTaggingCount > 0 && (
        <TouchableOpacity
          style={[styles.needsTagBanner, { backgroundColor: theme.surfaceTint, borderColor: theme.border }]}
          onPress={() => {
            const pending = items.filter(i => i.needsTagging)
            if (pending[0]) {
              router.push({
                pathname: '/(tabs)/item/[id]',
                params: { id: pending[0].id, name: pending[0].name, category: pending[0].category, emoji: pending[0].emoji, photoUri: pending[0].photoUri ?? '' },
              })
            }
          }}
        >
          <Ionicons name="alert-circle-outline" size={16} color={theme.accent} />
          <Text style={[styles.needsTagText, { color: theme.textPrimary }]}>
            {needsTaggingCount} item{needsTaggingCount !== 1 ? 's' : ''} need labeling
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Search bar + filter icon */}
      {items.length > 0 && (
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, color, or category…"
            placeholderTextColor={theme.textPlaceholder}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          {availableColors.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowColorPicker(prev => !prev)}
              hitSlop={8}
              style={[styles.funnelBtn, showColorPicker && styles.funnelBtnActive]}
            >
              <Ionicons name="filter" size={16} color={showColorPicker || filterColors.length > 0 ? theme.accent : theme.textSecondary} />
              {filterColors.length > 0 && (
                <View style={[styles.funnelBadge, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.funnelBadgeText, { color: theme.textOnAccent }]}>{filterColors.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Color picker dropdown */}
      {showColorPicker && availableColors.length > 0 && (
        <View style={[styles.colorPicker, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.colorPickerLabel, { color: theme.textSecondary }]}>Filter by color</Text>
          <View style={styles.colorDots}>
            {availableColors.map(color => {
              const active = filterColors.includes(color)
              return (
                <TouchableOpacity key={color} style={styles.colorOption} onPress={() => toggleColorFilter(color)} activeOpacity={0.7}>
                  <View style={[styles.colorDot, { backgroundColor: colorToHex(color) }, active && styles.colorDotActive]}>
                    {active && <Ionicons name="checkmark" size={10} color="#fff" />}
                  </View>
                  <Text style={[styles.colorDotLabel, { color: active ? theme.accent : theme.textSecondary }]} numberOfLines={1}>{color}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}

      {/* Active filter chips */}
      {hasActiveChips && (
        <View style={styles.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {filterCategory && (
              <TouchableOpacity style={[styles.chip, { backgroundColor: theme.accent }]} onPress={() => setFilterCategory(null)} activeOpacity={0.7}>
                <Text style={[styles.chipText, { color: theme.textOnAccent }]}>{filterCategory}</Text>
                <Ionicons name="close" size={12} color={theme.textOnAccent} style={styles.chipX} />
              </TouchableOpacity>
            )}
            {filterColors.map(color => (
              <TouchableOpacity key={color} style={[styles.chip, { backgroundColor: theme.accent }]} onPress={() => toggleColorFilter(color)} activeOpacity={0.7}>
                <View style={[styles.chipColorDot, { backgroundColor: colorToHex(color) }]} />
                <Text style={[styles.chipText, { color: theme.textOnAccent }]}>{color}</Text>
                <Ionicons name="close" size={12} color={theme.textOnAccent} style={styles.chipX} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.chip, styles.chipClear, { borderColor: theme.border }]} onPress={clearAllFilters} activeOpacity={0.7}>
              <Text style={[styles.chipText, { color: theme.textSecondary }]}>Clear all</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Tagging / batch progress banner */}
      {(tagging || batchProgress) && (
        <View style={[styles.taggingBanner, { backgroundColor: theme.surfaceTint, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.accent} size='small' />
          <Text style={[styles.taggingText, { color: theme.textSecondary }]}>
            {batchProgress ? `Tagging ${batchProgress.current} of ${batchProgress.total}…` : 'Auto-tagging your item…'}
          </Text>
          {batchProgress && (
            <View style={[styles.batchBar, { backgroundColor: theme.border }]}>
              <View style={[styles.batchBarFill, { backgroundColor: theme.accent, width: `${(batchProgress.current / batchProgress.total) * 100}%` as any }]} />
            </View>
          )}
        </View>
      )}

      {/* Content */}
      {items.length === 0 ? (
        <EmptyWardrobe onAdd={handleAddItem} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {isFiltered ? (
            filteredItems.length === 0 ? (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={32} color={theme.border} />
                <Text style={styles.noResultsText}>No items match your filters</Text>
                <TouchableOpacity onPress={clearAllFilters}>
                  <Text style={[styles.clearFiltersLink, { color: theme.accent }]}>Clear filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.gridSection}>
                <Text style={styles.sectionLabel}>{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</Text>
                {filteredRows.map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.gridRow}>
                    {row.map(item => (
                      <GridCard
                        key={item.id}
                        item={item}
                        theme={theme}
                        selected={selectedIds.has(item.id)}
                        selectMode={selectMode}
                        onToggle={() => toggleSelect(item.id)}
                      />
                    ))}
                    {row.length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            )
          ) : (
            categoriesWithItems.map(({ category, items: catItems }) => (
              <View key={category} style={styles.section}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleCategoryFilter(category)} activeOpacity={0.6}>
                  <Text style={[styles.sectionLabel, filterCategory === category && { color: theme.accent }]}>
                    {category.toUpperCase()}
                  </Text>
                  <View style={styles.sectionHeaderRight}>
                    <Text style={styles.sectionCount}>{catItems.length}</Text>
                    <Ionicons name="chevron-forward" size={12} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                  </View>
                </TouchableOpacity>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.browseScroll}
                >
                  {catItems.map(item => (
                    <BrowseCard
                      key={item.id}
                      item={item}
                      theme={theme}
                      selected={selectedIds.has(item.id)}
                      selectMode={selectMode}
                      onToggle={() => toggleSelect(item.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            ))
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
      {/* Bulk delete bar */}
      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.deleteBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity style={[styles.deleteBarBtn, { backgroundColor: theme.accentDanger }]} onPress={handleBulkDelete}>
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.deleteBarBtnText}>
              Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photo Tips Modal */}
      <Modal visible={showPhotoTips} animationType="fade" transparent>
        <View style={styles.tipsOverlay}>
          <View style={[styles.tipsCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.tipsTitle, { color: theme.textPrimary }]}>Photo Tips</Text>
            <Text style={[styles.tipsTxt, { color: theme.textSecondary }]}>
              Get the best results from AI tagging and background removal:
            </Text>
            {[
              ['Flat lay', 'Lay the item flat on a clean, solid-color surface'],
              ['Shoot from above', 'Hold the camera directly overhead for a straight-on angle'],
              ['Good lighting', 'Natural daylight works best -- avoid harsh shadows'],
              ['One item at a time', 'Keep each photo to a single garment or accessory'],
              ['Avoid clutter', 'Clear the background of other objects, patterns, or text'],
              ['Full item visible', 'Make sure the entire piece fits in the frame with a little margin'],
            ].map(([title, desc], i) => (
              <View key={i} style={styles.tipRow}>
                <Ionicons name="checkmark-circle" size={16} color={theme.accent} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.tipBold, { color: theme.textPrimary }]}>{title}</Text>
                  <Text style={[styles.tipDesc, { color: theme.textSecondary }]}>{desc}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.tipsClose, { backgroundColor: theme.accent }]} onPress={() => setShowPhotoTips(false)}>
              <Text style={[styles.tipsCloseText, { color: theme.textOnAccent }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const makeStyles = (theme: Theme, topInset: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen, paddingTop: topInset + 8, paddingBottom: Spacing.base,
    backgroundColor: theme.background,
  },
  title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, color: theme.textPrimary },
  subtitle: { ...Typography.styles.caption, color: theme.textSecondary, marginTop: 2 },
  addBtn: {
    backgroundColor: theme.accent, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, minWidth: 64, alignItems: 'center',
  },
  addBtnText: { ...Typography.styles.btnLabelSm, color: theme.textOnAccent },
  needsTagBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.screen, marginBottom: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1,
  },
  needsTagText: { ...Typography.styles.bodySmall, flex: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.screen, marginBottom: Spacing.sm,
    backgroundColor: theme.surface, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: theme.border, paddingHorizontal: Spacing.md, height: 42, gap: Spacing.sm,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: { flex: 1, ...Typography.styles.bodySmall, color: theme.textPrimary, paddingVertical: 0 },
  funnelBtn: { padding: 4, position: 'relative' },
  funnelBtnActive: { opacity: 1 },
  funnelBadge: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  funnelBadgeText: { fontSize: 8, fontWeight: '700' },
  colorPicker: {
    marginHorizontal: Spacing.screen, marginBottom: Spacing.sm,
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm,
  },
  colorPickerLabel: { ...Typography.styles.caption, fontFamily: Typography.bodyMedium, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  colorDots: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorOption: { alignItems: 'center', gap: 4, width: 44 },
  colorDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotActive: { borderColor: theme.accent },
  colorDotLabel: { fontSize: 9, textAlign: 'center', lineHeight: 11 },
  taggingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.screen, marginBottom: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1,
  },
  taggingText: { ...Typography.styles.bodySmall, flex: 1 },
  batchBar: { height: 3, borderRadius: 2, overflow: 'hidden', flex: 1, minWidth: 60 },
  batchBarFill: { height: '100%', borderRadius: 2 },
  noResults: { alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xxl, gap: Spacing.base, opacity: 0.6 },
  noResultsText: { ...Typography.styles.bodySmall, color: theme.textSecondary, textAlign: 'center' },
  clearFiltersLink: { ...Typography.styles.bodySmall, fontWeight: '600' },
  gridSection: { paddingHorizontal: Spacing.screen, gap: Spacing.base },
  gridRow: { flexDirection: 'row', gap: Spacing.base },
  scrollContent: { paddingTop: Spacing.sm },
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen, marginBottom: Spacing.sm,
  },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionLabel: { ...Typography.styles.sectionLabel, color: theme.sectionLabel },
  sectionCount: { ...Typography.styles.caption, color: theme.textSecondary },
  cardRow: { paddingHorizontal: Spacing.screen },
  cancelBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  cancelBtnText: {
    ...Typography.styles.body,
    color: theme.accent,
  },
  menuDropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 160,
    borderRadius: Radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  menuItemText: {
    ...Typography.styles.body,
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  selectBarText: {
    ...Typography.styles.bodySmall,
  },
  selectBarLink: {
    ...Typography.styles.bodySmall,
    fontFamily: Typography.bodyMedium,
  },
  deleteBar: {
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
  },
  deleteBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
  },
  deleteBarBtnText: {
    ...Typography.styles.btnLabelSm,
    color: '#fff',
  },

  // Photo Tips Modal
  tipsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screen,
  },
  tipsCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  tipsTitle: {
    ...Typography.styles.h2,
    marginBottom: Spacing.sm,
  },
  tipsTxt: {
    ...Typography.styles.bodySmall,
    marginBottom: Spacing.base,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  tipBold: {
    ...Typography.styles.bodySmall,
    fontFamily: Typography.bodyMedium,
  },
  tipDesc: {
    ...Typography.styles.bodySmall,
    marginTop: 2,
  },
  tipsClose: {
    marginTop: Spacing.base,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tipsCloseText: {
    ...Typography.styles.btnLabelSm,
  },
})
