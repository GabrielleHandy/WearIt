import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Image, Dimensions, TextInput, Alert,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { ClothingItem, CanvasItemLayout } from '@/constants/types'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const ITEM_W = 110
const ITEM_H = 145
const TRAY_HEIGHT = 120
const HEADER_HEIGHT = 52
const CANVAS_H = SCREEN_H - TRAY_HEIGHT - HEADER_HEIGHT - (Platform.OS === 'ios' ? 100 : 60)

const CATEGORY_EMOJI: Record<string, string> = {
  Tops: '👕', Bottoms: '👖', Shoes: '👟',
  Dresses: '👗', Outerwear: '🧥', Accessories: '👜', Other: '🎽',
}

// Stagger offsets from center for pre-populated items
const STAGGER_OFFSETS = [
  { x: -50, y: -70 },
  { x: 50, y: -80 },
  { x: -90, y: 10 },
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: -50, y: 80 },
  { x: 50, y: 80 },
  { x: 0, y: -60 },
]

// ─── Type ─────────────────────────────────────────────────────────────────────

type CanvasEntry = {
  id: string          // unique instance (same item can be added multiple times)
  clothingId: string
  photoUri?: string
  emoji: string
  name: string
  zIndex: number
  initialX?: number
  initialY?: number
  initialScale?: number
  initialRotation?: number
}

// ─── Individual draggable canvas item ─────────────────────────────────────────

function CanvasItem({
  entry,
  onRemove,
  onBringToFront,
  onLayoutUpdate,
  theme,
}: {
  entry: CanvasEntry
  onRemove: (id: string) => void
  onBringToFront: (id: string) => void
  onLayoutUpdate: (id: string, clothingId: string, x: number, y: number, scale: number, rotation: number) => void
  theme: Theme
}) {
  const defaultX = SCREEN_W / 2 - ITEM_W / 2
  const defaultY = CANVAS_H / 2 - ITEM_H / 2

  const tx = useSharedValue(entry.initialX ?? defaultX)
  const ty = useSharedValue(entry.initialY ?? defaultY)
  const ctxX = useSharedValue(0)
  const ctxY = useSharedValue(0)

  const scale = useSharedValue(entry.initialScale ?? 1)
  const savedScale = useSharedValue(entry.initialScale ?? 1)

  const rotation = useSharedValue(entry.initialRotation ?? 0)
  const savedRotation = useSharedValue(entry.initialRotation ?? 0)

  const pan = Gesture.Pan()
    .onStart(() => {
      ctxX.value = tx.value
      ctxY.value = ty.value
      runOnJS(onBringToFront)(entry.id)
    })
    .onUpdate(e => {
      tx.value = ctxX.value + e.translationX
      ty.value = ctxY.value + e.translationY
    })
    .onEnd(() => {
      runOnJS(onLayoutUpdate)(entry.id, entry.clothingId, tx.value, ty.value, scale.value, rotation.value)
    })

  const pinch = Gesture.Pinch()
    .onStart(() => { runOnJS(onBringToFront)(entry.id) })
    .onUpdate(e => { scale.value = Math.max(0.3, Math.min(3, savedScale.value * e.scale)) })
    .onEnd(() => {
      savedScale.value = scale.value
      runOnJS(onLayoutUpdate)(entry.id, entry.clothingId, tx.value, ty.value, scale.value, rotation.value)
    })

  const rot = Gesture.Rotation()
    .onStart(() => { runOnJS(onBringToFront)(entry.id) })
    .onUpdate(e => { rotation.value = savedRotation.value + e.rotation })
    .onEnd(() => {
      savedRotation.value = rotation.value
      runOnJS(onLayoutUpdate)(entry.id, entry.clothingId, tx.value, ty.value, scale.value, rotation.value)
    })

  const composed = Gesture.Simultaneous(pan, Gesture.Simultaneous(pinch, rot))

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }))

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.canvasItem, animStyle, { zIndex: entry.zIndex }]}>
        {entry.photoUri ? (
          <Image
            source={{ uri: entry.photoUri }}
            style={styles.canvasPhoto}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.canvasEmojiBg, { backgroundColor: theme.surfaceTint }]}>
            <Text style={styles.canvasEmoji}>{entry.emoji}</Text>
          </View>
        )}
        {/* Delete badge */}
        <TouchableOpacity
          style={[styles.deleteBadge, { backgroundColor: theme.accentDanger }]}
          onPress={() => runOnJS(onRemove)(entry.id)}
          hitSlop={8}
        >
          <Ionicons name="close" size={10} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OutfitCanvas({
  visible,
  wardrobe,
  onClose,
  onSave,
  onDelete,
  theme,
  initialItemIds,
  initialName,
  existingOutfitId,
  initialLayout,
}: {
  visible: boolean
  wardrobe: ClothingItem[]
  onClose: () => void
  onSave: (itemIds: string[], outfitName: string, layout: CanvasItemLayout[]) => void
  onDelete?: (id: string) => void
  theme: Theme
  initialItemIds?: string[]
  initialName?: string
  existingOutfitId?: string
  initialLayout?: CanvasItemLayout[]
}) {
  const insets = useSafeAreaInsets()
  const styles2 = useMemo(() => makeStyles(theme, insets.top), [theme, insets.top])

  const [canvasItems, setCanvasItems] = useState<CanvasEntry[]>([])
  const [zCounter, setZCounter] = useState(1)
  const [outfitName, setOutfitName] = useState('')

  // Tracks current x/y/scale/rotation for every canvas item — updated on each gesture end
  const layoutRef = useRef<Map<string, CanvasItemLayout>>(new Map())

  const handleLayoutUpdate = useCallback((
    id: string, clothingId: string,
    x: number, y: number, scale: number, rotation: number
  ) => {
    layoutRef.current.set(id, { clothingId, x, y, scale, rotation })
  }, [])

  // Seed canvas whenever the modal opens
  useEffect(() => {
    if (!visible) return

    layoutRef.current.clear()

    if (initialItemIds && initialItemIds.length > 0) {
      const centerX = SCREEN_W / 2 - ITEM_W / 2
      const centerY = CANVAS_H / 2 - ITEM_H / 2
      const items = wardrobe.filter(w => initialItemIds.includes(w.id))
      const seeded: CanvasEntry[] = items.map((item, i) => {
        const offset = STAGGER_OFFSETS[i % STAGGER_OFFSETS.length]
        const saved = initialLayout?.find(l => l.clothingId === item.id)
        const entryId = `${item.id}-seed-${i}`
        const x = saved?.x ?? (centerX + offset.x)
        const y = saved?.y ?? (centerY + offset.y)
        const scale = saved?.scale ?? 1
        const rotation = saved?.rotation ?? 0
        layoutRef.current.set(entryId, { clothingId: item.id, x, y, scale, rotation })
        return {
          id: entryId,
          clothingId: item.id,
          photoUri: item.photoUri,
          emoji: item.emoji ?? (CATEGORY_EMOJI[item.category] || '🎽'),
          name: item.name,
          zIndex: i + 1,
          initialX: x,
          initialY: y,
          initialScale: scale,
          initialRotation: rotation,
        }
      })
      setCanvasItems(seeded)
      setZCounter(items.length + 1)
      setOutfitName(initialName ?? '')
    } else {
      setCanvasItems([])
      setOutfitName(initialName ?? '')
      setZCounter(1)
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const filledCategories = ['Tops', 'Bottoms', 'Shoes', 'Dresses', 'Outerwear', 'Accessories', 'Other']
    .map(cat => ({ cat, items: wardrobe.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  const addItem = useCallback((item: ClothingItem) => {
    setZCounter(z => {
      const newZ = z + 1
      setCanvasItems(prev => [
        ...prev,
        {
          id: `${item.id}-${Date.now()}`,
          clothingId: item.id,
          photoUri: item.photoUri,
          emoji: item.emoji ?? (CATEGORY_EMOJI[item.category] || '🎽'),
          name: item.name,
          zIndex: newZ,
        },
      ])
      return newZ
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setCanvasItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const bringToFront = useCallback((id: string) => {
    setZCounter(z => {
      const newZ = z + 1
      setCanvasItems(prev =>
        prev.map(i => i.id === id ? { ...i, zIndex: newZ } : i)
      )
      return newZ
    })
  }, [])

  const handleSave = () => {
    if (canvasItems.length === 0) {
      Alert.alert('Nothing on the canvas', 'Add at least one item from your wardrobe.')
      return
    }
    const uniqueIds = [...new Set(canvasItems.map(i => i.clothingId))]
    const layout = canvasItems.map(item =>
      layoutRef.current.get(item.id) ?? { clothingId: item.clothingId, x: 0, y: 0, scale: 1, rotation: 0 }
    )
    onSave(uniqueIds, outfitName.trim() || 'My Look', layout)
    setCanvasItems([])
    setOutfitName('')
    setZCounter(1)
  }

  const handleClose = () => {
    setCanvasItems([])
    setOutfitName('')
    setZCounter(1)
    onClose()
  }

  const handleDelete = () => {
    if (!existingOutfitId || !onDelete) return
    Alert.alert(
      'Remove this look?',
      outfitName ? `"${outfitName}" — this can't be undone.` : "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => {
            onDelete(existingOutfitId)
            handleClose()
          },
        },
      ]
    )
  }

  const isViewing = !!existingOutfitId

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles2.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>

          {/* ── Header ───────────────────────────────────────────── */}
          <View style={[styles2.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Text style={[styles2.headerBtn, { color: theme.textSecondary }]}>
                {isViewing ? 'Done' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles2.headerTitle, { color: theme.textPrimary }]}>
              {isViewing ? 'Your Look' : 'Build a Look'}
            </Text>
            <View style={styles2.headerRight}>
              {isViewing && onDelete && (
                <TouchableOpacity onPress={handleDelete} hitSlop={8} style={styles2.trashBtn}>
                  <Ionicons name="trash-outline" size={17} color={theme.accentDanger} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSave} hitSlop={8}>
                <Text style={[styles2.headerBtn, { color: theme.accent, fontFamily: 'JosefinSans_600SemiBold', fontWeight: '600' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Outfit name input ─────────────────────────────────── */}
          <View style={[styles2.nameRow, { borderBottomColor: theme.border }]}>
            <TextInput
              style={[styles2.nameInput, { color: theme.textPrimary }]}
              placeholder="Name this look (optional)"
              placeholderTextColor={theme.textPlaceholder}
              value={outfitName}
              onChangeText={setOutfitName}
              returnKeyType="done"
            />
          </View>

          {/* ── Canvas ───────────────────────────────────────────── */}
          <View style={[styles2.canvas, { backgroundColor: theme.surfaceTint, borderBottomColor: theme.border }]}>
            {canvasItems.length === 0 && (
              <View style={styles2.canvasEmpty} pointerEvents="none">
                <Ionicons name="shirt-outline" size={32} color={theme.border} />
                <Text style={[styles2.canvasEmptyText, { color: theme.textSecondary }]}>
                  Tap items below to add them
                </Text>
              </View>
            )}
            {canvasItems.map(entry => (
              <CanvasItem
                key={entry.id}
                entry={entry}
                onRemove={removeItem}
                onBringToFront={bringToFront}
                onLayoutUpdate={handleLayoutUpdate}
                theme={theme}
              />
            ))}
          </View>

          {/* ── Wardrobe tray ─────────────────────────────────────── */}
          <View style={[styles2.tray, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles2.trayScroll}
            >
              {wardrobe.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => addItem(item)}
                  style={[styles2.trayItem, { backgroundColor: theme.surfaceTint }]}
                  activeOpacity={0.7}
                >
                  {item.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={styles2.trayImg} resizeMode="cover" />
                  ) : (
                    <Text style={styles2.trayEmoji}>
                      {item.emoji ?? (CATEGORY_EMOJI[item.category] ?? '🎽')}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  canvasItem: {
    position: 'absolute',
    width: ITEM_W,
    height: ITEM_H,
  },
  canvasPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
  },
  canvasEmojiBg: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasEmoji: { fontSize: 40 },
  deleteBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

const makeStyles = (theme: Theme, topInset: number) => StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 17,
  },
  headerBtn: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 15,
    paddingVertical: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  trashBtn: { padding: 4 },
  nameRow: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  nameInput: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 15,
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    borderBottomWidth: 1,
  },
  canvasEmpty: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  canvasEmptyText: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 13,
  },
  tray: {
    height: TRAY_HEIGHT,
    borderTopWidth: 1,
  },
  trayScroll: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  trayItem: {
    width: 80,
    height: 90,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayImg: { width: '100%', height: '100%' },
  trayEmoji: { fontSize: 32 },
})
