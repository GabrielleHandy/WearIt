import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, Modal,
  ScrollView, Alert, Dimensions, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useImagePicker } from '@/hooks/useImagePicker'
import {
  loadWardrobe, loadOutfitPhotos, saveOutfitPhoto, updateOutfitPhoto,
  deleteOutfitPhoto, incrementWorn, loadSavedOutfits,
} from '@/utils/storage'
import { ClothingItem, OutfitPhoto, OutfitPhotoTag, SavedOutfit } from '@/constants/types'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const IMG_WIDTH = SCREEN_WIDTH - Spacing.screen * 2
const GALLERY_COL = (SCREEN_WIDTH - Spacing.screen * 2 - Spacing.sm) / 2

// A photo being created or edited, before it's persisted
type DraftPhoto = {
  id?: string            // set when editing an existing OutfitPhoto
  photoUri: string
  tags: OutfitPhotoTag[]
  savedOutfitId?: string // styled outfit this look came from
}

// ─── Styled outfit picker sheet ───────────────────────────────────────────
// "This IRL look came from this designed outfit"

function OutfitPickerSheet({ visible, outfits, theme, onSelect, onClose }: {
  visible: boolean; outfits: SavedOutfit[]; theme: Theme
  onSelect: (outfit: SavedOutfit) => void; onClose: () => void
}) {
  const styles = useMemo(() => makePickerStyles(theme), [theme])
  const { bottom } = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: bottom + Spacing.base }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Which styled outfit is this?</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {outfits.map(outfit => {
            const date = new Date(outfit.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <TouchableOpacity key={outfit.id} style={styles.row} onPress={() => onSelect(outfit)} activeOpacity={0.7}>
                <View style={styles.rowEmoji}><Ionicons name="sparkles-outline" size={18} color={theme.textSecondary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{outfit.occasion || 'Saved look'}</Text>
                  <Text style={styles.rowMeta}>{(outfit.itemIds?.length ?? 0)} items · {date}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
          {outfits.length === 0 && (
            <Text style={styles.emptyText}>No styled outfits saved yet. Build or AI-suggest one on the Outfits tab first.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

// ─── Item picker sheet ────────────────────────────────────────────────────
// Opens after a tap on the photo — pick which closet item lives at that spot

function ItemPickerSheet({ visible, wardrobe, taggedIds, theme, onSelect, onClose }: {
  visible: boolean; wardrobe: ClothingItem[]; taggedIds: string[]
  theme: Theme; onSelect: (item: ClothingItem) => void; onClose: () => void
}) {
  const styles = useMemo(() => makePickerStyles(theme), [theme])
  const { bottom } = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return wardrobe
    return wardrobe.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.color?.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
  }, [query, wardrobe])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: bottom + Spacing.base }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Tag an item</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search your closet…"
          placeholderTextColor={theme.textPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {results.map(item => {
            const tagged = taggedIds.includes(item.id)
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                onPress={() => { setQuery(''); onSelect(item) }}
                activeOpacity={0.7}
              >
                {item.photoUri
                  ? <Image source={{ uri: item.photoUri }} style={styles.rowPhoto} />
                  : <View style={styles.rowEmoji}><Text style={{ fontSize: 20 }}>{item.emoji}</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta}>{item.category}{item.color ? ` · ${item.color}` : ''}</Text>
                </View>
                {tagged && <Ionicons name="pricetag" size={14} color={theme.textSecondary} />}
              </TouchableOpacity>
            )
          })}
          {results.length === 0 && (
            <Text style={styles.emptyText}>Nothing in your closet matches that.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const makePickerStyles = (theme: Theme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '75%', paddingHorizontal: Spacing.screen,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.border, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 22, color: theme.textPrimary },
  closeBtn: { padding: 4 },
  search: {
    ...Typography.styles.body, color: theme.textPrimary,
    backgroundColor: theme.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: theme.border, marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: theme.border,
  },
  rowPhoto: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: theme.surfaceTint, resizeMode: 'contain' },
  rowEmoji: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: theme.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  rowName: { ...Typography.styles.bodySmall, color: theme.textPrimary },
  rowMeta: { ...Typography.styles.caption, color: theme.textSecondary },
  emptyText: { ...Typography.styles.bodySmall, color: theme.textSecondary, textAlign: 'center', paddingVertical: Spacing.xl },
})

// ─── Main screen ────────────────────────────────────────────────────────────

export default function TagOutfitScreen() {
  const { theme } = useTheme()
  const { top } = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(theme, top), [theme, top])
  const { takePhoto, pickFromLibrary } = useImagePicker()

  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([])
  const [photos, setPhotos] = useState<OutfitPhoto[]>([])
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([])
  const [showOutfitPicker, setShowOutfitPicker] = useState(false)
  const [draft, setDraft] = useState<DraftPhoto | null>(null)
  const [imgHeight, setImgHeight] = useState(IMG_WIDTH * 1.25)
  // Where the user tapped, normalized 0–1 — picker is open while this is set
  const [pendingTap, setPendingTap] = useState<{ x: number; y: number } | null>(null)
  // Item ids already tagged when editing started — used so worn count
  // only increments for items newly tagged this session
  const [initialIds, setInitialIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Deep link from item detail: /tag-outfit?photoId=... opens that look directly
  const { photoId } = useLocalSearchParams<{ photoId?: string }>()
  const autoOpened = useRef(false)

  useFocusEffect(
    useCallback(() => {
      loadWardrobe().then(setWardrobe)
      loadOutfitPhotos().then(setPhotos)
      loadSavedOutfits().then(setSavedOutfits)
    }, [])
  )

  // Measure the real photo so the display height matches its aspect ratio.
  // The image then exactly fills its container, which is what makes
  // locationX / IMG_WIDTH a true normalized coordinate.
  useEffect(() => {
    if (!draft) return
    Image.getSize(
      draft.photoUri,
      (w, h) => setImgHeight(IMG_WIDTH * (h / w)),
      () => setImgHeight(IMG_WIDTH * 1.25),
    )
  }, [draft?.photoUri])

  const wardrobeById = useMemo(
    () => new Map(wardrobe.map(item => [item.id, item])),
    [wardrobe]
  )

  // Unique tagged items for the list under the photo (an item tagged twice shows once)
  const taggedItems = useMemo(() => {
    if (!draft) return []
    const seen = new Set<string>()
    const items: ClothingItem[] = []
    for (const t of draft.tags) {
      if (seen.has(t.itemId)) continue
      seen.add(t.itemId)
      const item = wardrobeById.get(t.itemId)
      if (item) items.push(item)
    }
    return items
  }, [draft, wardrobeById])

  // Auto-open a look when arriving via photoId — waits for both loads, runs once
  useEffect(() => {
    if (autoOpened.current || !photoId || photos.length === 0 || wardrobe.length === 0) return
    const photo = photos.find(p => p.id === photoId)
    if (photo) {
      autoOpened.current = true
      openExisting(photo)
    }
  }, [photoId, photos, wardrobe])

  const startDraft = async (source: 'camera' | 'library') => {
    const uri = source === 'camera' ? await takePhoto() : await pickFromLibrary()
    if (!uri) return
    setInitialIds([])
    setDraft({ photoUri: uri, tags: [] })
  }

  const openExisting = (photo: OutfitPhoto) => {
    // Drop tags pointing at deleted closet items — cheap render-time cleanup
    const liveTags = photo.tags.filter(t => wardrobeById.has(t.itemId))
    setInitialIds(liveTags.map(t => t.itemId))
    setDraft({ id: photo.id, photoUri: photo.photoUri, tags: liveTags, savedOutfitId: photo.savedOutfitId })
  }

  // Styled outfit this draft is linked to — undefined if unlinked or outfit was deleted
  const linkedOutfit = useMemo(
    () => savedOutfits.find(o => o.id === draft?.savedOutfitId),
    [savedOutfits, draft?.savedOutfitId]
  )

  const handleImageTap = (locationX: number, locationY: number) => {
    const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v))
    setPendingTap({ x: clamp(locationX / IMG_WIDTH), y: clamp(locationY / imgHeight) })
  }

  const handleSelectItem = (item: ClothingItem) => {
    if (!pendingTap || !draft) return
    setDraft({ ...draft, tags: [...draft.tags, { itemId: item.id, ...pendingTap }] })
    setPendingTap(null)
  }

  const removeTag = (index: number) => {
    if (!draft) return
    setDraft({ ...draft, tags: draft.tags.filter((_, i) => i !== index) })
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      if (draft.id) {
        const updated = await updateOutfitPhoto({
          id: draft.id, photoUri: draft.photoUri, tags: draft.tags,
          savedOutfitId: draft.savedOutfitId,
          createdAt: photos.find(p => p.id === draft.id)?.createdAt ?? new Date().toISOString(),
        })
        setPhotos(prev => prev.map(p => p.id === updated.id ? updated : p))
      } else {
        const saved = await saveOutfitPhoto({
          photoUri: draft.photoUri, tags: draft.tags,
          savedOutfitId: draft.savedOutfitId,
          createdAt: new Date().toISOString(),
        })
        setPhotos(prev => [saved, ...prev])
      }
      // Worn count: only items that weren't tagged when we started
      const newIds = [...new Set(draft.tags.map(t => t.itemId))].filter(id => !initialIds.includes(id))
      await incrementWorn(newIds)
      setDraft(null)
    } catch {
      Alert.alert('Could not save', 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (photo: OutfitPhoto) => {
    Alert.alert('Delete this look?', 'The photo and its tags will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteOutfitPhoto(photo.id)
          setPhotos(prev => prev.filter(p => p.id !== photo.id))
        },
      },
    ])
  }

  // ─── Draft mode: photo + tap-to-tag ──────────────────────────────────────
  if (draft) {
    return (
      <View style={styles.screen}>
        <ItemPickerSheet
          visible={!!pendingTap}
          wardrobe={wardrobe}
          taggedIds={draft.tags.map(t => t.itemId)}
          theme={theme}
          onSelect={handleSelectItem}
          onClose={() => setPendingTap(null)}
        />

        <OutfitPickerSheet
          visible={showOutfitPicker}
          outfits={savedOutfits}
          theme={theme}
          onSelect={outfit => {
            setDraft({ ...draft, savedOutfitId: outfit.id })
            setShowOutfitPicker(false)
          }}
          onClose={() => setShowOutfitPicker(false)}
        />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDraft(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tag your look</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.headerSave, saving && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.hint}>
            {draft.tags.length === 0
              ? 'Tap anywhere on the photo to tag an item from your closet'
              : 'Tap a tag to remove it · tap the photo to add another'}
          </Text>

          <View style={[styles.photoWrap, { height: imgHeight }]}>
            <Pressable onPress={e => handleImageTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
              <Image source={{ uri: draft.photoUri }} style={{ width: IMG_WIDTH, height: imgHeight, borderRadius: Radius.lg }} />
            </Pressable>

            {draft.tags.map((tag, i) => {
              const item = wardrobeById.get(tag.itemId)
              if (!item) return null
              return (
                <View
                  key={`${tag.itemId}-${i}`}
                  style={[styles.tagAnchor, { left: tag.x * IMG_WIDTH - 60, top: tag.y * imgHeight }]}
                  pointerEvents="box-none"
                >
                  <View style={styles.tagDot} />
                  <TouchableOpacity
                    style={styles.tagPill}
                    onPress={() => removeTag(i)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tagText} numberOfLines={1}>{item.name}</Text>
                    <Ionicons name="close" size={11} color={theme.textOnAccent} />
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>

          {/* Link to the styled outfit this look came from */}
          <View style={styles.taggedSection}>
            <Text style={styles.boardLabel}>STYLED OUTFIT</Text>
            {linkedOutfit ? (
              <View style={styles.linkedRow}>
                <View style={styles.linkedIcon}><Ionicons name="sparkles" size={16} color={theme.textOnAccent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taggedName} numberOfLines={1}>{linkedOutfit.occasion || 'Saved look'}</Text>
                  <Text style={styles.taggedMeta}>This is that outfit, worn IRL</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDraft({ ...draft, savedOutfitId: undefined })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.linkBtn} onPress={() => setShowOutfitPicker(true)} activeOpacity={0.7}>
                <Ionicons name="link-outline" size={15} color={theme.textSecondary} />
                <Text style={styles.linkBtnText}>Link the styled outfit this came from</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Items tagged in this look — tap through to the item page */}
          {taggedItems.length > 0 && (
            <View style={styles.taggedSection}>
              <Text style={styles.boardLabel}>TAGGED ITEMS</Text>
              {taggedItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.taggedRow}
                  onPress={() => router.push({
                    pathname: '/(tabs)/item/[id]',
                    params: { id: item.id, name: item.name, category: item.category, emoji: item.emoji, photoUri: item.photoUri ?? '' },
                  })}
                  activeOpacity={0.7}
                >
                  {item.photoUri
                    ? <Image source={{ uri: item.photoUri }} style={styles.taggedThumb} />
                    : <View style={styles.taggedEmoji}><Text style={{ fontSize: 20 }}>{item.emoji}</Text></View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taggedName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.taggedMeta}>{item.category}{item.color ? ` · ${item.color}` : ''}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </View>
    )
  }

  // ─── Gallery mode: add buttons + saved tagged looks ──────────────────────
  const rows = photos.reduce<OutfitPhoto[][]>((acc, p, i) => {
    if (i % 2 === 0) acc.push([p])
    else acc[acc.length - 1].push(p)
    return acc
  }, [])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tagged Looks</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => startDraft('camera')} activeOpacity={0.85}>
            <Ionicons name="camera-outline" size={15} color={theme.textOnAccent} />
            <Text style={styles.primaryBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => startDraft('library')} activeOpacity={0.85}>
            <Ionicons name="images-outline" size={15} color={theme.textSecondary} />
            <Text style={styles.secondaryBtnText}>Library</Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <View style={styles.boardSection}>
            <Text style={styles.boardLabel}>YOUR LOOKS</Text>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.row}>
                {row.map(photo => (
                  <TouchableOpacity key={photo.id} style={styles.galleryCard} onPress={() => openExisting(photo)} activeOpacity={0.85}>
                    <Image source={{ uri: photo.photoUri }} style={styles.galleryPhoto} />
                    <View style={styles.galleryFooter}>
                      <Text style={styles.galleryMeta}>
                        {photo.tags.length} {photo.tags.length === 1 ? 'item' : 'items'}
                      </Text>
                      <TouchableOpacity onPress={() => handleDelete(photo)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
                {row.length === 1 && <View style={{ width: GALLERY_COL }} />}
              </View>
            ))}
          </View>
        )}

        {photos.length === 0 && (
          <View style={styles.emptyBoard}>
            <Ionicons name="pricetags-outline" size={40} color={theme.border} />
            <Text style={styles.emptyText}>
              Snap a photo of an outfit and tag the pieces from your closet
            </Text>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  )
}

const makeStyles = (theme: Theme, topInset: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen, paddingTop: topInset + 8, paddingBottom: Spacing.md,
  },
  headerTitle: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 24, color: theme.textPrimary },
  headerCancel: { ...Typography.styles.bodySmall, color: theme.textSecondary },
  headerSave: { ...Typography.styles.btnLabelSm, color: theme.textPrimary },
  scrollContent: { paddingHorizontal: Spacing.screen },

  hint: { ...Typography.styles.caption, color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.md },

  // Draft photo + tags
  photoWrap: { width: IMG_WIDTH, borderRadius: Radius.lg, backgroundColor: theme.surfaceTint },
  tagAnchor: { position: 'absolute', width: 120, alignItems: 'center' },
  tagDot: {
    width: 10, height: 10, borderRadius: 5, marginTop: -5,
    backgroundColor: theme.accent, borderWidth: 2, borderColor: theme.background,
  },
  tagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
    backgroundColor: theme.accent, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4, maxWidth: 120,
    ...Shadow.card,
  },
  tagText: { fontSize: 11, fontFamily: 'JosefinSans_600SemiBold', color: theme.textOnAccent, flexShrink: 1 },

  // Tagged items list under the draft photo
  taggedSection: { marginTop: Spacing.xl, gap: Spacing.sm },
  taggedRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: theme.surface, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: theme.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  taggedThumb: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: theme.surfaceTint, resizeMode: 'contain' },
  taggedEmoji: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: theme.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  taggedName: { ...Typography.styles.bodySmall, color: theme.textPrimary },
  taggedMeta: { ...Typography.styles.caption, color: theme.textSecondary },

  // Styled outfit link
  linkedRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: theme.surface, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: theme.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  linkedIcon: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center',
  },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
    borderRadius: Radius.lg, paddingVertical: Spacing.md,
  },
  linkBtnText: { ...Typography.styles.caption, color: theme.textSecondary },

  // Gallery
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: theme.accent, borderRadius: Radius.lg, paddingVertical: Spacing.md,
  },
  primaryBtnText: { ...Typography.styles.btnLabelSm, color: theme.textOnAccent },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderColor: theme.border, borderRadius: Radius.lg, paddingVertical: Spacing.md,
  },
  secondaryBtnText: { ...Typography.styles.btnLabelSm, color: theme.textSecondary },

  boardSection: { gap: Spacing.base },
  boardLabel: { ...Typography.styles.sectionLabel, color: theme.sectionLabel },
  row: { flexDirection: 'row', gap: Spacing.sm },
  galleryCard: {
    width: GALLERY_COL, backgroundColor: theme.surface,
    borderRadius: Radius.lg, borderWidth: 0.5, borderColor: theme.border,
    overflow: 'hidden', ...Shadow.card,
  },
  galleryPhoto: { width: '100%', height: GALLERY_COL * 1.3, backgroundColor: theme.surfaceTint },
  galleryFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  galleryMeta: { ...Typography.styles.caption, color: theme.textSecondary },

  emptyBoard: { alignItems: 'center', gap: Spacing.base, paddingVertical: Spacing.xxl, opacity: 0.5 },
  emptyText: { ...Typography.styles.bodySmall, color: theme.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
})
