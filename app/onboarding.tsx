import { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Image, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'

// TODO: Replace with user auth flow (Phase 4 — accounts + social)
// When login ships: onboarding ends on screen 3 with "Create Account" + "Log In" buttons
// instead of "Get Started", and we gate wardrobe loading on auth state.

export const ONBOARDING_KEY = 'wearit_has_seen_onboarding'

const { width: W, height: H } = Dimensions.get('window')

// ─── Illustration helpers ────────────────────────────────────────────────────
const il = StyleSheet.create({
  ring: { width: W, height: 300, position: 'relative' },
  bubble: {
    position: 'absolute', width: 56, height: 56,
    borderRadius: 28, backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  centerBubble: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FEF6F2', borderWidth: 2, borderColor: '#C97B5A',
    alignItems: 'center', justifyContent: 'center',
    left: W / 2 - 36, top: 170 - 36,
  },
  outfitPreview: { width: W, height: 300, alignItems: 'center', justifyContent: 'center', gap: 20 },
  outfitCard: {
    width: 160, height: 160, borderRadius: 24,
    backgroundColor: '#FEF6F2', borderWidth: 1.5, borderColor: '#C97B5A',
    alignItems: 'center', justifyContent: 'center',
  },
  outfitRow: { flexDirection: 'row', gap: 16 },
  outfitItem: {
    width: 72, height: 72, borderRadius: 16,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  canvas: { width: W, height: 300, position: 'relative' },
  canvasItem: {
    position: 'absolute', borderRadius: 16,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
})

const SLIDES = [
  {
    key: '1',
    illustration: (
      <View style={il.ring}>
        {['👗', '👟', '🧥', '👖', '👜', '👕', '🥿', '🧣'].map((emoji, i) => {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
          const r = 110
          return (
            <View
              key={i}
              style={[il.bubble, {
                left: W / 2 - 28 + Math.cos(angle) * r,
                top: 170 - 28 + Math.sin(angle) * r,
              }]}
            >
              <Text style={{ fontSize: 26 }}>{emoji}</Text>
            </View>
          )
        })}
        <View style={il.centerBubble}>
          <Ionicons name="shirt-outline" size={32} color="#C97B5A" />
        </View>
      </View>
    ),
    title: 'Everything\nYou Own',
    subtitle: 'Snap or upload your pieces. Name, category, color — tagged and sorted. Your wardrobe, always at hand.',
  },
  {
    key: '2',
    illustration: (
      <View style={il.outfitPreview}>
        <View style={il.outfitCard}>
          <Text style={{ fontSize: 52 }}>✨</Text>
        </View>
        <View style={il.outfitRow}>
          {['👕', '👖', '👟'].map((e, i) => (
            <View key={i} style={il.outfitItem}>
              <Text style={{ fontSize: 32 }}>{e}</Text>
            </View>
          ))}
        </View>
      </View>
    ),
    title: 'Your Outfit,\nin Seconds',
    subtitle: 'Say the occasion. WearIt builds the look from your wardrobe — not the internet.',
  },
  {
    key: '3',
    illustration: (
      <View style={il.canvas}>
        {[
          { emoji: '🧥', top: 40,  left: W * 0.15, rotate: '-8deg', size: 90 },
          { emoji: '👖', top: 110, left: W * 0.42, rotate: '5deg',  size: 80 },
          { emoji: '👟', top: 200, left: W * 0.22, rotate: '-4deg', size: 72 },
        ].map((item, i) => (
          <View key={i} style={[il.canvasItem, {
            top: item.top, left: item.left,
            width: item.size, height: item.size,
            transform: [{ rotate: item.rotate }],
          }]}>
            <Text style={{ fontSize: item.size * 0.55 }}>{item.emoji}</Text>
          </View>
        ))}
      </View>
    ),
    title: 'Build It\nYour Way',
    subtitle: 'Drag, layer, rotate. Arrange pieces exactly how you\'d wear them — then save what works.',
  },
]

async function markSeen() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1')
}

export default function Onboarding() {
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollX = useRef(new Animated.Value(0)).current

  const finish = async () => {
    await markSeen()
    router.replace('/(tabs)/home')
  }

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true })
    } else {
      finish()
    }
  }

  const isLast = activeIndex === SLIDES.length - 1

  return (
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="dark" />

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={s.skipBtn} onPress={finish} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={e => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / W))
        }}
        renderItem={({ item }) => (
          <View style={s.slide}>
            <View style={s.illustrationWrap}>
              {item.illustration}
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => {
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * W, i * W, (i + 1) * W],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          })
          const width = scrollX.interpolate({
            inputRange: [(i - 1) * W, i * W, (i + 1) * W],
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          })
          return (
            <Animated.View key={i} style={[s.dot, { opacity, width }]} />
          )
        })}
      </View>

      {/* CTA */}
      <TouchableOpacity style={s.cta} onPress={next} activeOpacity={0.85}>
        <Text style={s.ctaText}>{isLast ? 'Get Started' : 'Next'}</Text>
      </TouchableOpacity>
    </View>
  )
}



// ─── Main styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF7F2', alignItems: 'center' },
  skipBtn: { alignSelf: 'flex-end', paddingHorizontal: 24, paddingVertical: 12 },
  skipText: { fontSize: 14, fontFamily: 'JosefinSans_400Regular', color: '#8C5E4A' },
  slide: { width: W, alignItems: 'center', paddingHorizontal: 32 },
  illustrationWrap: { width: W, height: 300, marginBottom: 32 },
  title: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 38, lineHeight: 44,
    color: '#2C1F1A', textAlign: 'center', marginBottom: 16,
  },
  subtitle: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 14, lineHeight: 22,
    color: '#8C5E4A', textAlign: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, marginVertical: 24, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#C97B5A' },
  cta: {
    width: W - 64, backgroundColor: '#2C1F1A',
    borderRadius: 999, paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { fontFamily: 'JosefinSans_600SemiBold', fontSize: 15, color: '#FAF7F2', letterSpacing: 1 },
})
