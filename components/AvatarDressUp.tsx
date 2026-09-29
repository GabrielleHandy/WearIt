import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, Alert, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { ClothingItem } from '@/constants/types'
import { type Theme, Spacing, Radius } from '@/constants/theme'
import { Outfit, slotForCategory, toggleWorn, wornItems } from '@/utils/avatarSlots'
import AvatarScene from '@/components/AvatarScene'

const CATEGORY_EMOJI: Record<string, string> = {
  Tops: '👕', Bottoms: '👖', Shoes: '👟',
  Dresses: '👗', Outerwear: '🧥', Accessories: '👜', Other: '🎽',
}

/**
 * Full-screen 3D dress-up: the user's wardrobe becomes a tray of items they
 * can put on a rotatable mannequin. Drag the avatar to spin it.
 */
export default function AvatarDressUp({
  visible, wardrobe, theme, initialItemIds, onClose, onSave,
}: {
  visible: boolean
  wardrobe: ClothingItem[]
  theme: Theme
  initialItemIds?: string[]
  onClose: () => void
  onSave: (itemIds: string[], name: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [outfit, setOutfit] = useState<Outfit>({})
  const [name, setName] = useState('')
  const rotationRef = useRef(0)

  // Only categories that map onto the body can be worn
  const wearable = useMemo(() => wardrobe.filter(i => slotForCategory(i.category)), [wardrobe])
  const worn = wornItems(outfit)

  useEffect(() => {
    if (!visible) return
    rotationRef.current = 0
    setName('')
    let next: Outfit = {}
    for (const id of initialItemIds ?? []) {
      const item = wardrobe.find(w => w.id === id)
      if (item) next = toggleWorn(next, item)
    }
    setOutfit(next)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const spin = useMemo(
    () => Gesture.Pan().runOnJS(true).onChange(e => { rotationRef.current += e.changeX * 0.012 }),
    [],
  )

  const handleSave = () => {
    if (worn.length === 0) {
      Alert.alert('Nothing worn yet', 'Tap an item below to put it on the avatar.')
      return
    }
    onSave(worn.map(i => i.id), name.trim() || 'My Look')
  }

  const s = makeStyles(theme)

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[s.screen, { paddingTop: insets.top }]}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={[s.headerBtn, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={s.title}>Dress Up</Text>
            <View style={s.headerRight}>
              <TouchableOpacity onPress={() => setOutfit({})} hitSlop={8}>
                <Text style={[s.headerBtn, { color: theme.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} hitSlop={8}>
                <Text style={[s.headerBtn, { color: theme.accent, fontWeight: '600' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.nameRow}>
            <TextInput
              style={s.nameInput}
              placeholder="Name this look (optional)"
              placeholderTextColor={theme.textPlaceholder}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />
          </View>

          <GestureDetector gesture={spin}>
            <View style={s.stage}>
              {visible && <AvatarScene outfit={outfit} rotationRef={rotationRef} />}
              <Text style={s.hint} pointerEvents="none">Drag to rotate</Text>
            </View>
          </GestureDetector>

          <View style={[s.tray, { paddingBottom: insets.bottom }]}>
            {wearable.length === 0 ? (
              <Text style={s.empty}>Add tops, bottoms, dresses or shoes to your wardrobe to dress the avatar.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.trayScroll}>
                {wearable.map(item => {
                  const slot = slotForCategory(item.category)!
                  const on = outfit[slot]?.id === item.id
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setOutfit(o => toggleWorn(o, item))}
                      activeOpacity={0.7}
                      style={[s.trayItem, on && s.trayItemOn]}
                    >
                      {item.photoUri
                        ? <Image source={{ uri: item.photoUri }} style={s.trayImg} resizeMode="contain" />
                        : <Text style={s.trayEmoji}>{item.emoji ?? CATEGORY_EMOJI[item.category]}</Text>}
                      {on && (
                        <View style={s.check}>
                          <Ionicons name="checkmark" size={11} color={theme.textOnAccent} />
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 17, color: theme.textPrimary },
  headerBtn: { fontFamily: 'JosefinSans_400Regular', fontSize: 15, paddingVertical: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  nameRow: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  nameInput: { fontFamily: 'JosefinSans_400Regular', fontSize: 15, color: theme.textPrimary },
  stage: { flex: 1, backgroundColor: theme.surfaceTint },
  hint: {
    position: 'absolute', bottom: Spacing.sm, alignSelf: 'center',
    fontFamily: 'JosefinSans_400Regular', fontSize: 12, color: theme.textSecondary,
  },
  tray: { minHeight: 120, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  trayScroll: { padding: Spacing.sm, gap: Spacing.sm, alignItems: 'center' },
  trayItem: {
    width: 80, height: 90, borderRadius: Radius.md, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceTint,
    borderWidth: 2, borderColor: 'transparent',
  },
  trayItemOn: { borderColor: theme.accent },
  trayImg: { width: '100%', height: '100%' },
  trayEmoji: { fontSize: 32 },
  check: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center',
  },
  empty: {
    padding: Spacing.base, textAlign: 'center',
    fontFamily: 'JosefinSans_400Regular', fontSize: 13, color: theme.textSecondary,
  },
})
