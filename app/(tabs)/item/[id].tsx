import { ClothingItem, ClothingCategoryOptions, OutfitPhoto, SavedOutfit } from '@/constants/types'
import { deleteItem, loadWardrobe, updateItem, loadOutfitPhotos, loadSavedOutfits } from '@/utils/storage'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, TextInput, Alert, ScrollView, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useImagePicker } from '@/hooks/useImagePicker'
import * as FileSystem from 'expo-file-system'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const PHOTO_HEIGHT = Math.round(SCREEN_HEIGHT * 0.60)

// ─── Category pill ─────────────────────────────────────────────────────────

function CategoryPill({ option, selected, theme, onPress }: {
  option: string; selected: boolean; theme: Theme; onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[pillStyles.pill, { borderColor: theme.accent }, selected && { backgroundColor: theme.accent }]}
    >
      <Text style={[pillStyles.text, { color: theme.accent }, selected && { color: theme.textOnAccent }]}>
        {option}
      </Text>
    </TouchableOpacity>
  )
}

const pillStyles = StyleSheet.create({
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5 },
  text: { fontSize: 12, fontWeight: '500', fontFamily: 'JosefinSans_600SemiBold' },
})

// ─── Action button ──────────────────────────────────────────────────────────

function ActionBtn({ icon, label, onPress, danger = false, theme }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; theme: Theme
}) {
  return (
    <TouchableOpacity style={actionStyles.btn} onPress={onPress} activeOpacity={0.7}>
      <View style={[actionStyles.iconWrap, { backgroundColor: danger ? theme.accentDanger + '15' : theme.surfaceTint }]}>
        <Ionicons name={icon} size={20} color={danger ? theme.accentDanger : theme.accent} />
      </View>
      <Text style={[actionStyles.label, { color: danger ? theme.accentDanger : theme.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const actionStyles = StyleSheet.create({
  btn: { alignItems: 'center', gap: 6, flex: 1 },
  iconWrap: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'JosefinSans_400Regular', textAlign: 'center' },
})

// ─── Main screen ────────────────────────────────────────────────────────────

export default function ItemDetail() {
  const { theme } = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  const { takePhoto, pickFromLibrary } = useImagePicker()

  const { id, name, category, emoji, photoUri } = useLocalSearchParams()

  const [editMode, setEditMode] = useState(false)
  const [selectedName, setSelectedName] = useState(name as string)
  const [selectedCategory, setSelectedCategory] = useState(category as string)
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedPhotoUri, setSelectedPhotoUri] = useState(photoUri as string | undefined)
  const [selectedBackPhotoUri, setSelectedBackPhotoUri] = useState<string | undefined>(undefined)
  const [showBack, setShowBack] = useState(false)   // front/back toggle
  const [changesMade, setChangesMade] = useState(false)

  // Full item ref for preserving untouched fields on save
  const [fullItem, setFullItem] = useState<ClothingItem | null>(null)
  const [originalPhotoUri, setOriginalPhotoUri] = useState<string | undefined>(undefined)

  // Everywhere this item appears — tagged photo looks + saved styled outfits
  const [taggedLooks, setTaggedLooks] = useState<OutfitPhoto[]>([])
  const [styledOutfits, setStyledOutfits] = useState<SavedOutfit[]>([])

  useFocusEffect(
    useCallback(() => {
      loadWardrobe().then(items => {
        const item = items.find(i => i.id === id)
        if (!item) return
        setFullItem(item)
        setSelectedName(item.name)
        setSelectedCategory(item.category)
        setSelectedColor(item.color ?? '')
        setSelectedPhotoUri(item.photoUri)
        setSelectedBackPhotoUri(item.backPhotoUri)
        setOriginalPhotoUri(item.originalPhotoUri)
        // If this item was saved without a name (needsTagging), auto-open edit mode
        if (item.needsTagging) setEditMode(true)
      })
      loadOutfitPhotos().then(all =>
        setTaggedLooks(all.filter(p => p.tags.some(t => t.itemId === id)))
      )
      loadSavedOutfits().then(all =>
        setStyledOutfits(all.filter(o => o.itemIds?.includes(id as string)))
      )
    }, [id])
  )

  const markChanged = () => setChangesMade(true)

  const saveImagePermanently = async (uri: string): Promise<string> => {
    const filename = `back_${Date.now()}_${uri.split('/').pop()!}`
    const destPath = FileSystem.Paths.document.uri + filename
    const sourceFile = new FileSystem.File(uri)
    const destFile = new FileSystem.File(destPath)
    await sourceFile.copy(destFile)
    return destPath
  }

  const handleChangePhoto = (isBack: boolean) => {
    Alert.alert(isBack ? 'Back Photo' : 'Front Photo', 'Choose source', [
      {
        text: '📷 Camera',
        onPress: async () => {
          const uri = await takePhoto()
          if (!uri) return
          const perm = await saveImagePermanently(uri)
          if (isBack) { setSelectedBackPhotoUri(perm); setShowBack(true) }
          else setSelectedPhotoUri(perm)
          markChanged()
        },
      },
      {
        text: '🖼️ Library',
        onPress: async () => {
          const uri = await pickFromLibrary()
          if (!uri) return
          const perm = await saveImagePermanently(uri)
          if (isBack) { setSelectedBackPhotoUri(perm); setShowBack(true) }
          else setSelectedPhotoUri(perm)
          markChanged()
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleSave = async () => {
    if (!fullItem) return
    await updateItem({
      ...fullItem,
      name: selectedName,
      category: selectedCategory as ClothingItem['category'],
      color: selectedColor || undefined,
      photoUri: selectedPhotoUri,
      backPhotoUri: selectedBackPhotoUri,
      needsTagging: false,
    })
    setEditMode(false)
    setChangesMade(false)
  }

  const handleDelete = () => {
    Alert.alert('Remove from wardrobe', `Remove "${selectedName}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteItem(id as string)
          router.back()
        },
      },
    ])
  }

  const handleAddToOutfit = () => router.push({ pathname: '/(tabs)/outfits', params: { addItemId: id as string } })

  const handleRevertCrop = () => {
    if (!fullItem || !originalPhotoUri) return
    Alert.alert('Revert crop', 'Show the original uncropped photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revert',
        onPress: async () => {
          await updateItem({ ...fullItem, photoUri: originalPhotoUri, originalPhotoUri: undefined })
          setSelectedPhotoUri(originalPhotoUri)
          setOriginalPhotoUri(undefined)
          setFullItem(prev => prev ? { ...prev, photoUri: originalPhotoUri, originalPhotoUri: undefined } : prev)
        },
      },
    ])
  }

  const activePhotoUri = showBack ? selectedBackPhotoUri : selectedPhotoUri
  const hasBackPhoto = !!selectedBackPhotoUri

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>

      {/* ── Full-bleed photo ──────────────────────────────── */}
      <View style={styles.photoContainer}>
        {activePhotoUri ? (
          <Image source={{ uri: activePhotoUri }} style={styles.photo} resizeMode="contain" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.placeholderEmoji}>{showBack ? '🔄' : emoji}</Text>
            {editMode && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={() => handleChangePhoto(showBack)}
              >
                <Ionicons name="camera-outline" size={18} color={theme.textOnAccent} />
                <Text style={[styles.addPhotoBtnText, { color: theme.textOnAccent }]}>
                  {showBack ? 'Add Back Photo' : 'Add Photo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.photoScrim} />

        {/* Back button */}
        <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Change photo button (edit mode only) */}
        {editMode && activePhotoUri && (
          <TouchableOpacity style={[styles.bgRemoveBtn, { top: insets.top + 8 }]} onPress={() => handleChangePhoto(showBack)} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Front / Back toggle — shown when back photo exists, or in edit mode */}
        {(hasBackPhoto || editMode) && (
          <View style={[styles.photoTabs, { bottom: Spacing.md }]}>
            <TouchableOpacity
              style={[styles.photoTab, !showBack && styles.photoTabActive, { backgroundColor: !showBack ? theme.accent : 'rgba(0,0,0,0.4)' }]}
              onPress={() => setShowBack(false)}
            >
              <Text style={[styles.photoTabText, { color: theme.textOnAccent }]}>Front</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoTab, showBack && styles.photoTabActive, { backgroundColor: showBack ? theme.accent : 'rgba(0,0,0,0.4)' }]}
              onPress={() => {
                if (editMode && !hasBackPhoto) {
                  handleChangePhoto(true)
                } else {
                  setShowBack(true)
                }
              }}
            >
              <Text style={[styles.photoTabText, { color: theme.textOnAccent }]}>
                {editMode && !hasBackPhoto ? '+ Back' : 'Back'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Info panel ───────────────────────────────────── */}
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        {editMode ? (
          <TextInput
            style={[styles.nameInput, { color: theme.textPrimary, borderBottomColor: theme.accent }]}
            value={selectedName}
            onChangeText={v => { setSelectedName(v); markChanged() }}
            placeholder="Item name"
            placeholderTextColor={theme.textPlaceholder}
            autoFocus={!fullItem?.needsTagging}
          />
        ) : (
          <Text style={styles.name}>{selectedName}</Text>
        )}

        {/* Category + color row */}
        {editMode ? (
          <>
            <TextInput
              style={[styles.colorInput, { color: theme.textPrimary, backgroundColor: theme.surface, borderColor: theme.border }]}
              value={selectedColor}
              onChangeText={v => { setSelectedColor(v); markChanged() }}
              placeholder="Color (e.g. Navy Blue)"
              placeholderTextColor={theme.textPlaceholder}
              autoCapitalize="words"
            />
            <View style={styles.categoryGrid}>
              {ClothingCategoryOptions.map(option => (
                <CategoryPill
                  key={option}
                  option={option}
                  selected={selectedCategory === option}
                  theme={theme}
                  onPress={() => { setSelectedCategory(option); markChanged() }}
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.category}>
            {selectedCategory}{selectedColor ? ` · ${selectedColor}` : ''}
          </Text>
        )}

        {/* Save button */}
        {editMode && changesMade && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Ionicons name="checkmark" size={16} color={theme.textOnAccent} />
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {/* Action row */}
        <View style={styles.actions}>
          <ActionBtn
            icon={editMode ? 'close-outline' : 'pencil-outline'}
            label={editMode ? 'Cancel' : 'Edit'}
            onPress={() => { setEditMode(!editMode); setChangesMade(false) }}
            theme={theme}
          />
          <ActionBtn
            icon="layers-outline"
            label="Add to Outfit"
            onPress={handleAddToOutfit}
            theme={theme}
          />
          {originalPhotoUri && (
            <ActionBtn
              icon="crop-outline"
              label="Full Photo"
              onPress={handleRevertCrop}
              theme={theme}
            />
          )}
          <ActionBtn
            icon="trash-outline"
            label="Delete"
            onPress={handleDelete}
            danger
            theme={theme}
          />
        </View>

        {/* ── Where this item appears ─────────────────────── */}
        {(taggedLooks.length > 0 || styledOutfits.length > 0) && <View style={styles.divider} />}

        {taggedLooks.length > 0 && (
          <View style={styles.linkSection}>
            <Text style={styles.linkLabel}>IN TAGGED LOOKS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkRow}>
              {taggedLooks.map(look => (
                <TouchableOpacity
                  key={look.id}
                  onPress={() => router.push({ pathname: '/tag-outfit', params: { photoId: look.id } })}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: look.photoUri }} style={styles.lookThumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {styledOutfits.length > 0 && (
          <View style={styles.linkSection}>
            <Text style={styles.linkLabel}>IN STYLED OUTFITS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkRow}>
              {styledOutfits.map(outfit => (
                <TouchableOpacity
                  key={outfit.id}
                  style={styles.outfitChip}
                  onPress={() => router.push({ pathname: '/(tabs)/outfits', params: { previewOutfitId: outfit.id } })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sparkles-outline" size={13} color={theme.textSecondary} />
                  <Text style={styles.outfitChipText} numberOfLines={1}>
                    {outfit.occasion || 'Saved look'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },

  photoContainer: { width: '100%', height: PHOTO_HEIGHT, backgroundColor: theme.surfaceTint },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceTint,
    gap: Spacing.base,
  },
  placeholderEmoji: { fontSize: 96 },
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.accent, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.lg,
  },
  addPhotoBtnText: { ...Typography.styles.btnLabelSm },
  photoScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.25)' },
  backBtn: {
    position: 'absolute', left: Spacing.base,
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  bgRemoveBtn: {
    position: 'absolute', right: Spacing.base,
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  photoTabs: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  photoTab: {
    paddingHorizontal: Spacing.xl, paddingVertical: 6,
    borderRadius: Radius.full, opacity: 0.9,
  },
  photoTabActive: {},
  photoTabText: { fontSize: 12, fontWeight: '600', fontFamily: 'JosefinSans_600SemiBold' },

  panel: {
    flex: 1, backgroundColor: theme.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  panelContent: { padding: Spacing.screen, paddingTop: Spacing.xl },
  name: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 26, color: theme.textPrimary, marginBottom: 6 },
  nameInput: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 24, borderBottomWidth: 2, paddingVertical: 6, marginBottom: 12 },
  category: { ...Typography.styles.bodySmall, color: theme.textSecondary, marginBottom: Spacing.xl, textTransform: 'capitalize' },
  colorInput: {
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 14, marginBottom: Spacing.base,
    fontFamily: 'JosefinSans_400Regular',
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.base },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: theme.accent, alignSelf: 'flex-start',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Radius.lg, marginTop: Spacing.md, marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  saveBtnText: { ...Typography.styles.btnLabelSm, color: theme.textOnAccent },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: Spacing.xl },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },

  // "Where this item appears" sections
  linkSection: { gap: Spacing.md, marginBottom: Spacing.xl },
  linkLabel: { ...Typography.styles.sectionLabel, color: theme.sectionLabel },
  linkRow: { gap: Spacing.sm },
  lookThumb: { width: 72, height: 92, borderRadius: Radius.md, backgroundColor: theme.surfaceTint },
  outfitChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: theme.border, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8, maxWidth: 180,
  },
  outfitChipText: { ...Typography.styles.caption, color: theme.textSecondary, flexShrink: 1 },
})
