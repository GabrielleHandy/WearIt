import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, ScrollView, Alert, Dimensions,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import OutfitCanvas from '@/components/OutfitCanvas'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import { loadWardrobe, loadSavedOutfits, saveOutfit, updateSavedOutfit, deleteSavedOutfit, loadOutfitPhotos } from '@/utils/storage'
import { askWearIt } from '@/utils/claude'
import { getWeather } from '@/utils/weather'
import { WearItSuggestion, SavedOutfit, ClothingItem, CanvasItemLayout, OutfitPhoto } from '@/constants/types'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAI } from '@/contexts/AIContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.screen * 2 - Spacing.sm) / 2

const CATEGORY_EMOJI: Record<string, string> = {
  Tops: '👕', Bottoms: '👖', Shoes: '👟',
  Dresses: '👗', Outerwear: '🧥', Accessories: '👜', Other: '🎽',
}


// ─── Outfit preview sheet ─────────────────────────────────────────────────

const PREVIEW_COL = (SCREEN_WIDTH - Spacing.screen * 2 - Spacing.base * 3) / 3

function OutfitPreviewSheet({ outfit, wardrobe, irlPhotos, theme, onClose, onEdit }: {
  outfit: SavedOutfit | null; wardrobe: ClothingItem[]; irlPhotos: OutfitPhoto[]; theme: Theme
  onClose: () => void; onEdit: () => void
}) {
  const previewStyles = useMemo(() => makePreviewStyles(theme), [theme])
  const { bottom } = useSafeAreaInsets()

  const items = useMemo(() =>
    (outfit?.itemIds ?? [])
      .map(id => wardrobe.find(w => w.id === id))
      .filter((item): item is ClothingItem => Boolean(item)),
    [outfit?.itemIds, wardrobe]
  )

  return (
    <Modal visible={!!outfit} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={previewStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[previewStyles.sheet, { paddingBottom: bottom + Spacing.xl }]}>
        <View style={previewStyles.handle} />

        {/* Header */}
        <View style={previewStyles.header}>
          <Text style={previewStyles.title} numberOfLines={1}>
            {outfit?.occasion || 'Saved Look'}
          </Text>
          <TouchableOpacity onPress={onClose} style={previewStyles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={previewStyles.scrollContent}>
          {/* Item grid */}
          {items.length > 0 && (
            <View style={previewStyles.grid}>
              {items.map(item => (
                <View key={item.id} style={previewStyles.gridCell}>
                  {item.photoUri
                    ? <Image source={{ uri: item.photoUri }} style={previewStyles.gridPhoto} resizeMode="contain" />
                    : <View style={previewStyles.gridEmoji}><Text style={{ fontSize: 32 }}>{item.emoji}</Text></View>
                  }
                  <Text style={previewStyles.gridName} numberOfLines={2}>{item.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Suggestion */}
          {outfit?.suggestion ? (
            <Text style={previewStyles.suggestion}>
              {outfit.suggestion.replace(/\*\*(.*?)\*\*/g, '$1')}
            </Text>
          ) : null}
          {outfit?.weather ? <Text style={previewStyles.meta}>🌤 {outfit.weather}</Text> : null}

          {/* IRL photos linked to this styled outfit */}
          {irlPhotos.length > 0 && (
            <View style={{ gap: Spacing.sm }}>
              <Text style={previewStyles.irlLabel}>WORN IRL</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
                {irlPhotos.map(photo => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => {
                      onClose()
                      router.push({ pathname: '/tag-outfit', params: { photoId: photo.id } })
                    }}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: photo.photoUri }} style={previewStyles.irlThumb} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Edit button */}
          <TouchableOpacity style={previewStyles.editBtn} onPress={onEdit}>
            <Ionicons name="construct-outline" size={15} color={theme.textOnAccent} />
            <Text style={previewStyles.editBtnText}>Edit Look</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const makePreviewStyles = (theme: Theme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.border, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 22, color: theme.textPrimary, flex: 1 },
  closeBtn: { padding: 4 },
  scrollContent: { padding: Spacing.screen, gap: Spacing.base },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  gridCell: { width: PREVIEW_COL, alignItems: 'center', gap: 6 },
  gridPhoto: {
    width: PREVIEW_COL, height: PREVIEW_COL * 1.25,
    borderRadius: Radius.md, backgroundColor: theme.surfaceTint,
  },
  gridEmoji: {
    width: PREVIEW_COL, height: PREVIEW_COL * 1.25,
    borderRadius: Radius.md, backgroundColor: theme.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
  },
  gridName: { ...Typography.styles.caption, color: theme.textSecondary, textAlign: 'center', lineHeight: 14 },
  suggestion: {
    fontFamily: 'CormorantGaramond_400Regular', fontSize: 15,
    color: theme.textPrimary, lineHeight: 24,
  },
  meta: { ...Typography.styles.caption, color: theme.textSecondary },
  irlLabel: { ...Typography.styles.sectionLabel, color: theme.sectionLabel },
  irlThumb: { width: 80, height: 104, borderRadius: Radius.md, backgroundColor: theme.surfaceTint },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: theme.accent, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  editBtnText: { ...Typography.styles.btnLabelSm, color: theme.textOnAccent },
})

// ─── Saved outfit card ─────────────────────────────────────────────────────

function OutfitCard({ outfit, theme, wardrobe, onPress }: {
  outfit: SavedOutfit; theme: Theme; wardrobe: ClothingItem[]; onPress: () => void
}) {
  const styles = useMemo(() => makeCardStyles(theme), [theme])
  const items = useMemo(() =>
    (outfit.itemIds ?? [])
      .map(id => wardrobe.find(w => w.id === id))
      .filter((item): item is ClothingItem => Boolean(item)),
    [outfit.itemIds, wardrobe]
  )
  const extraCount = Math.max(0, items.length - 3)
  const date = new Date(outfit.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const preview = outfit.suggestion.split('.').slice(0, 2).join('.').replace(/\*\*(.*?)\*\*/g, '$1').trim()

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {items.length > 0 && (
        <View style={styles.thumbRow}>
          {items.slice(0, 3).map((item, idx) => (
            <View key={item.id} style={[styles.thumb, idx > 0 && styles.thumbOverlap, { zIndex: 10 - idx }]}>
              {item.photoUri
                ? <Image source={{ uri: item.photoUri }} style={styles.thumbImg} />
                : <View style={styles.thumbEmoji}><Text style={styles.thumbEmojiText}>{item.emoji}</Text></View>
              }
            </View>
          ))}
          {extraCount > 0 && (
            <View style={[styles.thumb, styles.thumbOverlap, styles.thumbExtra, { zIndex: 1 }]}>
              <Text style={styles.thumbExtraText}>+{extraCount}</Text>
            </View>
          )}
        </View>
      )}
      {outfit.occasion ? (
        <View style={styles.occasionPill}>
          <Text style={styles.occasionText} numberOfLines={1}>{outfit.occasion}</Text>
        </View>
      ) : null}
      <Text style={styles.preview} numberOfLines={3}>{preview}</Text>
      <View style={styles.footer}>
        {outfit.weather ? <Text style={styles.meta} numberOfLines={1}>🌤 {outfit.weather.split('·')[0].trim()}</Text> : null}
        <View style={styles.footerRow}>
          <Text style={styles.date}>{date}</Text>
          <Ionicons name="chevron-forward" size={10} color={theme.textSecondary} style={{ opacity: 0.5 }} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const makeCardStyles = (theme: Theme) => StyleSheet.create({
  card: {
    width: CARD_WIDTH, backgroundColor: theme.surface,
    borderRadius: Radius.lg, padding: Spacing.md,
    gap: Spacing.sm, borderWidth: 0.5, borderColor: theme.border,
    shadowColor: '#1A1218',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  // Item thumbnail strip
  thumbRow: { flexDirection: 'row', marginBottom: 2 },
  thumb: {
    width: 46, height: 46, borderRadius: 999,
    borderWidth: 2, borderColor: theme.surface,
    backgroundColor: theme.textSecondary + '38',
  },
  thumbOverlap: { marginLeft: -12 },
  thumbImg: { width: '100%', height: '100%', borderRadius: 999, resizeMode: 'contain' },
  thumbEmoji: {
    width: '100%', height: '100%', borderRadius: 999,
    backgroundColor: theme.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbEmojiText: { fontSize: 18 },
  thumbExtra: {
    backgroundColor: theme.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 999,
  },
  thumbExtraText: { fontSize: 11, fontFamily: 'JosefinSans_600SemiBold', color: theme.textSecondary },
  occasionPill: {
    backgroundColor: theme.accent, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  occasionText: { fontSize: 11, fontFamily: 'JosefinSans_600SemiBold', color: theme.textOnAccent, textTransform: 'uppercase', letterSpacing: 0.5 },
  preview: { fontFamily: 'CormorantGaramond_400Regular', fontSize: 13, color: theme.textPrimary, lineHeight: 19 },
  footer: { gap: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontSize: 10, fontFamily: 'JosefinSans_400Regular', color: theme.textSecondary },
  date: { fontSize: 10, fontFamily: 'JosefinSans_400Regular', color: theme.textSecondary },
})

// ─── Main screen ────────────────────────────────────────────────────────────

export default function OutfitsScreen() {
  const { theme } = useTheme()
  const { aiEnabled } = useAI()
  const { top } = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(theme, top), [theme, top])

  const [suggestion, setSuggestion] = useState<WearItSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [occasion, setOccasion] = useState('')
  const [weather, setWeather] = useState('')
  const [savedLooks, setSavedLooks] = useState<SavedOutfit[]>([])
  const [saving, setSaving] = useState(false)
  const [isFallback, setIsFallback] = useState(false)
  const [outfitItems, setOutfitItems] = useState<ClothingItem[]>([])
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([])
  const [outfitPhotos, setOutfitPhotos] = useState<OutfitPhoto[]>([])

  // Preview sheet
  const [previewOutfit, setPreviewOutfit] = useState<SavedOutfit | null>(null)

  // Deep links from item detail: addItemId opens the canvas, previewOutfitId opens a saved look
  const { addItemId, previewOutfitId } = useLocalSearchParams<{ addItemId?: string; previewOutfitId?: string }>()

  // Canvas builder
  const [showCanvas, setShowCanvas] = useState(false)
  const [canvasInitialIds, setCanvasInitialIds] = useState<string[]>([])
  const [canvasInitialName, setCanvasInitialName] = useState('')
  const [canvasOutfitId, setCanvasOutfitId] = useState<string | undefined>(undefined)
  const [canvasInitialLayout, setCanvasInitialLayout] = useState<CanvasItemLayout[] | undefined>(undefined)

  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
        const [place] = await Location.reverseGeocodeAsync(loc.coords)
        const city = place.city || place.subregion || place.region || ''
        if (city) {
          const w = await getWeather(city)
          if (w) setWeather(`${w} · ${city}`)
        }
      } catch {}
    })()
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadOutfitPhotos().then(setOutfitPhotos)
      loadSavedOutfits().then(outfits => {
        setSavedLooks(outfits)
        if (previewOutfitId) {
          const found = outfits.find(o => o.id === previewOutfitId)
          if (found) setPreviewOutfit(found)
        }
      })
      loadWardrobe().then(w => {
        setWardrobe(w)
        if (addItemId) {
          setCanvasInitialIds([addItemId])
          setCanvasInitialName('')
          setCanvasOutfitId(undefined)
          setCanvasInitialLayout(undefined)
          setShowCanvas(true)
        }
      })
    }, [addItemId, previewOutfitId])
  )

  const handleAsk = async () => {
    setLoading(true)
    setSuggestion(null)
    setOutfitItems([])
    setIsFallback(false)
    try {
      if (wardrobe.length === 0) {
        setSuggestion({ suggestion: 'Add some clothes to your wardrobe first!', reason: '' })
        setIsFallback(true)
        return
      }
      const context = [occasion, weather ? `Weather: ${weather}` : ''].filter(Boolean).join('. ')
      const result = await askWearIt(wardrobe, context)
      setSuggestion(result)
      setIsFallback(result.isFallback ?? false)
      if (result.itemIndices && result.itemIndices.length > 0) {
        setOutfitItems(
          result.itemIndices
            .map(i => wardrobe[i])
            .filter((item): item is ClothingItem => Boolean(item))
        )
      }
    } catch {
      setSuggestion({ suggestion: 'Something went wrong. Try again.', reason: '' })
      setIsFallback(true)
    } finally {
      setLoading(false)
    }
  }


  const handleSaveCanvasOutfit = async (itemIds: string[], outfitName: string, layout: CanvasItemLayout[]) => {
    const selectedItems = wardrobe.filter(i => itemIds.includes(i.id))
    const nameList = selectedItems.map(i => i.name).join(', ')

    if (canvasOutfitId) {
      // Update existing — preserve original AI suggestion/reason text
      const existing = savedLooks.find(o => o.id === canvasOutfitId)
      const updated = await updateSavedOutfit({
        id: canvasOutfitId,
        suggestion: existing?.suggestion ?? `${outfitName}: ${nameList}.`,
        reason: existing?.reason ?? 'Manually built outfit.',
        occasion: outfitName,
        weather: existing?.weather ?? weather,
        savedAt: new Date().toISOString(),
        itemIds,
        canvasLayout: layout,
      })
      setSavedLooks(prev => prev.map(o => o.id === canvasOutfitId ? updated : o))
    } else {
      const saved = await saveOutfit({
        suggestion: `${outfitName}: ${nameList}.`,
        reason: 'Manually built outfit.',
        occasion: occasion.trim() || outfitName,
        weather,
        savedAt: new Date().toISOString(),
        itemIds,
        canvasLayout: layout,
      })
      setSavedLooks(prev => [saved, ...prev])
    }

    setShowCanvas(false)
    setCanvasInitialIds([])
    setCanvasInitialName('')
    setCanvasOutfitId(undefined)
    setCanvasInitialLayout(undefined)
  }

  const handleDeleteFromCanvas = async (id: string) => {
    await deleteSavedOutfit(id)
    setSavedLooks(prev => prev.filter(o => o.id !== id))
    setShowCanvas(false)
    setCanvasInitialIds([])
    setCanvasInitialName('')
    setCanvasOutfitId(undefined)
    setCanvasInitialLayout(undefined)
  }

  const handleSaveLook = async () => {
    if (!suggestion) return
    setSaving(true)
    try {
      const saved = await saveOutfit({
        suggestion: suggestion.suggestion,
        reason: suggestion.reason,
        occasion: occasion.trim(),
        weather,
        savedAt: new Date().toISOString(),
        itemIds: outfitItems.map(i => i.id),
      })
      setSavedLooks(prev => [saved, ...prev])
      setSuggestion(null)
      setOutfitItems([])
      setOccasion('')
    } catch {
      Alert.alert('Could not save', 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

const rows = savedLooks.reduce<SavedOutfit[][]>((acc, item, i) => {
    if (i % 2 === 0) acc.push([item])
    else acc[acc.length - 1].push(item)
    return acc
  }, [])

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Preview sheet — view look before editing */}
      <OutfitPreviewSheet
        outfit={previewOutfit}
        wardrobe={wardrobe}
        irlPhotos={outfitPhotos.filter(p => p.savedOutfitId === previewOutfit?.id)}
        theme={theme}
        onClose={() => setPreviewOutfit(null)}
        onEdit={() => {
          if (!previewOutfit) return
          setCanvasInitialIds(previewOutfit.itemIds ?? [])
          setCanvasInitialName(previewOutfit.occasion || 'My Look')
          setCanvasOutfitId(previewOutfit.id)
          setCanvasInitialLayout(previewOutfit.canvasLayout)
          setPreviewOutfit(null)
          setShowCanvas(true)
        }}
      />

      {/* Canvas — build new or view/edit saved look */}
      <OutfitCanvas
        visible={showCanvas}
        wardrobe={wardrobe}
        onClose={() => {
          setShowCanvas(false)
          setCanvasInitialIds([])
          setCanvasInitialName('')
          setCanvasOutfitId(undefined)
          setCanvasInitialLayout(undefined)
        }}
        onSave={handleSaveCanvasOutfit}
        onDelete={handleDeleteFromCanvas}
        theme={theme}
        initialItemIds={canvasInitialIds}
        initialName={canvasInitialName}
        existingOutfitId={canvasOutfitId}
        initialLayout={canvasInitialLayout}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Outfits</Text>
          {weather ? (
            <View style={styles.weatherChip}>
              <Ionicons name="partly-sunny-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.weatherText}>{weather}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Occasion input ───────────────────────────────── */}
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="What's the occasion? (optional)"
            placeholderTextColor={theme.textPlaceholder}
            value={occasion}
            onChangeText={setOccasion}
            returnKeyType="done"
          />

          {/* Action buttons */}
          <View style={styles.actionRow}>
            {aiEnabled && (
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleAsk}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={theme.textOnAccent} size="small" />
                  : <><Ionicons name="sparkles-outline" size={15} color={theme.textOnAccent} /><Text style={styles.primaryBtnText}>AI Suggest</Text></>
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.border }]}
              onPress={() => setShowCanvas(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="construct-outline" size={15} color={theme.textSecondary} />
              <Text style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>Build</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.border }]}
              onPress={() => router.push('/tag-outfit')}
              activeOpacity={0.85}
            >
              <Ionicons name="pricetags-outline" size={15} color={theme.textSecondary} />
              <Text style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>Tag</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Suggestion card ───────────────────────────── */}
        {suggestion && (
          <View style={styles.suggestionCard}>
            <View style={styles.suggestionInner}>
              {outfitItems.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemRow}>
                  {outfitItems.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemCard}
                      onPress={() => router.push({ pathname: '/(tabs)/item/[id]', params: { id: item.id, name: item.name, category: item.category, emoji: item.emoji, photoUri: item.photoUri ?? '' } })}
                      activeOpacity={0.8}
                    >
                      {item.photoUri
                        ? <View style={styles.itemPhotoWrap}><View style={styles.itemPlate} /><Image source={{ uri: item.photoUri }} style={styles.itemPhoto} /></View>
                        : <View style={[styles.itemEmoji, { backgroundColor: theme.surfaceTint }]}><Text style={styles.itemEmojiText}>{item.emoji}</Text></View>
                      }
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.suggestionText}>{suggestion.suggestion.replace(/\*\*(.*?)\*\*/g, '$1')}</Text>
              {suggestion.reason ? <Text style={styles.reasonText}>{suggestion.reason.replace(/\*\*(.*?)\*\*/g, '$1')}</Text> : null}
              {!isFallback && (
                <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSaveLook} disabled={saving} activeOpacity={0.85}>
                  {saving
                    ? <ActivityIndicator color={theme.textOnAccent} size="small" />
                    : <><Ionicons name="heart-outline" size={16} color={theme.textOnAccent} /><Text style={styles.saveBtnText}>Save this look</Text></>
                  }
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.dismissBtn} onPress={() => setSuggestion(null)}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Saved looks board ────────────────────────── */}
        {savedLooks.length > 0 && (
          <View style={styles.boardSection}>
            <Text style={styles.boardLabel}>SAVED LOOKS</Text>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.row}>
                {row.map(outfit => (
                  <OutfitCard
                    key={outfit.id}
                    outfit={outfit}
                    theme={theme}
                    wardrobe={wardrobe}
                    onPress={() => setPreviewOutfit(outfit)}
                  />
                ))}
                {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
              </View>
            ))}
          </View>
        )}

        {savedLooks.length === 0 && !suggestion && !loading && (
          <View style={styles.emptyBoard}>
            <Ionicons name="albums-outline" size={40} color={theme.border} />
            <Text style={styles.emptyText}>Your saved looks will appear here</Text>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (theme: Theme, topInset: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  scrollContent: { paddingHorizontal: Spacing.screen, paddingTop: topInset + 8 },
  header: { marginBottom: Spacing.xl, gap: Spacing.sm },
  title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, color: theme.textPrimary },
  weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: theme.surface, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: theme.border },
  weatherText: { ...Typography.styles.caption, color: theme.textSecondary },

  formCard: { backgroundColor: theme.surface, borderRadius: Radius.xl, padding: Spacing.base, gap: Spacing.md, borderWidth: 1, borderColor: theme.border, marginBottom: Spacing.base, ...Shadow.card },
  input: { ...Typography.styles.body, color: theme.textPrimary, backgroundColor: theme.background, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: theme.border },

  // Three action buttons
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  primaryBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.accent, borderRadius: Radius.lg, paddingVertical: Spacing.md },
  primaryBtnText: { ...Typography.styles.btnLabelSm, color: theme.textOnAccent },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderRadius: Radius.lg, paddingVertical: Spacing.md },
  secondaryBtnText: { ...Typography.styles.btnLabelSm },
  btnDisabled: { opacity: 0.6 },

  itemRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  itemCard: {
    width: 80, alignItems: 'center', gap: 6,
    backgroundColor: theme.surface, borderRadius: Radius.lg, padding: 4,
    shadowColor: '#1A1218', shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  itemPhotoWrap: { width: 72, height: 92, borderRadius: Radius.md },
  itemPlate: {
    position: 'absolute', top: 8, left: 6, right: 6, bottom: 8,
    borderRadius: 999, backgroundColor: theme.textSecondary, opacity: 0.22,
  },
  itemPhoto: { width: 72, height: 92, borderRadius: Radius.md, resizeMode: 'contain' },
  itemEmoji: { width: 72, height: 92, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceTint },
  itemEmojiText: { fontSize: 36 },
  itemName: { ...Typography.styles.caption, color: theme.textSecondary, textAlign: 'center', lineHeight: 14 },

  suggestionCard: {
    borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.xl,
    borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.surface,
    shadowColor: '#1A1218', shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  suggestionInner: { padding: Spacing.xl, gap: Spacing.md },
  suggestionText: { fontFamily: 'CormorantGaramond_400Regular', fontSize: 16, color: theme.textPrimary, lineHeight: 26 },
  reasonText: { ...Typography.styles.italic, color: theme.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: theme.accent, borderRadius: Radius.lg, paddingVertical: 12, marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...Typography.styles.btnLabelSm, color: theme.textOnAccent },
  dismissBtn: { alignItems: 'center', paddingVertical: 4 },
  dismissText: { ...Typography.styles.caption, color: theme.textSecondary },

  boardSection: { gap: Spacing.base },
  boardLabel: { ...Typography.styles.sectionLabel, color: theme.sectionLabel },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch' },
  emptyBoard: { alignItems: 'center', justifyContent: 'center', gap: Spacing.base, paddingTop: Spacing.xxl, paddingBottom: Spacing.xxl, opacity: 0.5 },
  emptyText: { ...Typography.styles.bodySmall, color: theme.textSecondary, textAlign: 'center' },
})
