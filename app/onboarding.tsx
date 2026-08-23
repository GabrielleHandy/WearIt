import { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'

export const ONBOARDING_KEY = 'wearit_has_seen_onboarding'

const { width: W } = Dimensions.get('window')

async function markSeen() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1')
}

export default function Onboarding() {
  const insets = useSafeAreaInsets()
  const listRef = useRef<Animated.FlatList>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollX = useRef(new Animated.Value(0)).current

  const finish = async () => {
    await markSeen()
    router.replace('/(tabs)/home')
  }

  const next = () => {
    if (activeIndex < 2) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true })
    } else {
      finish()
    }
  }

  const isLast = activeIndex === 2

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="dark" />

      {/* Top Header: Skip */}
      <View style={s.topBar}>
        <View style={{ width: 40 }} />
        <TouchableOpacity
          style={s.skipBtn}
          onPress={finish}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel */}
      <Animated.FlatList
        ref={listRef}
        data={[0, 1, 2]}
        keyExtractor={item => item.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onMomentumScrollEnd={e => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / W))
        }}
        renderItem={({ item }) => {
          if (item === 0) {
            // Slide 1: Digitize Wardrobe
            return (
              <View style={s.slide}>
                <View style={s.visualCard}>
                  <View style={s.hangerBubble}>
                    <Ionicons name="shirt-outline" size={48} color="#C97B5A" />
                  </View>
                  <View style={s.tagRow}>
                    <View style={s.tagBadge}>
                      <Ionicons name="sparkles" size={12} color="#C97B5A" />
                      <Text style={s.tagBadgeText}>Auto-Cropped</Text>
                    </View>
                    <View style={s.tagBadge}>
                      <Text style={s.tagBadgeText}>Tops · Linen</Text>
                    </View>
                    <View style={s.tagBadge}>
                      <Text style={s.tagBadgeText}>Cream</Text>
                    </View>
                  </View>
                </View>

                <View style={s.textContainer}>
                  <Text style={s.title}>Everything You Own,{'\n'}Curated</Text>
                  <Text style={s.subtitle}>
                    Snap photos of your clothes. AI extracts garments, removes backgrounds,
                    and tags category, name, and color automatically.
                  </Text>
                </View>
              </View>
            )
          }

          if (item === 1) {
            // Slide 2: AI Outfits
            return (
              <View style={s.slide}>
                <View style={s.visualCard}>
                  <View style={s.outfitPreviewHeader}>
                    <View style={s.occasionPill}>
                      <Ionicons name="sparkles" size={11} color="#FAF7F2" />
                      <Text style={s.occasionPillText}>Coffee Date</Text>
                    </View>
                    <Text style={s.weatherText}>72°F · Sunny</Text>
                  </View>

                  <View style={s.outfitGarmentsRow}>
                    <View style={s.garmentChip}>
                      <Ionicons name="shirt-outline" size={20} color="#2C1F1A" />
                      <Text style={s.garmentChipLabel}>Shirt</Text>
                    </View>
                    <View style={s.garmentChip}>
                      <Ionicons name="body-outline" size={20} color="#2C1F1A" />
                      <Text style={s.garmentChipLabel}>Denim</Text>
                    </View>
                    <View style={s.garmentChip}>
                      <Ionicons name="walk-outline" size={20} color="#2C1F1A" />
                      <Text style={s.garmentChipLabel}>Loafers</Text>
                    </View>
                  </View>

                  <Text style={s.outfitQuote}>
                    "Relaxed neutral layering tailored to mild afternoon weather."
                  </Text>
                </View>

                <View style={s.textContainer}>
                  <Text style={s.title}>Personalized AI{'\n'}Outfit Suggestions</Text>
                  <Text style={s.subtitle}>
                    Tell WearIt your occasion. It styles complete looks exclusively from your real wardrobe,
                    adapted to today's local weather.
                  </Text>
                </View>
              </View>
            )
          }

          // Slide 3: Cloud & Peace of mind
          return (
            <View style={s.slide}>
              <View style={s.visualCard}>
                <View style={s.shieldCircle}>
                  <Ionicons name="shield-checkmark-outline" size={44} color="#C97B5A" />
                </View>

                <View style={s.cloudPillsRow}>
                  <View style={s.cloudFeaturePill}>
                    <Ionicons name="cloud-done-outline" size={15} color="#C97B5A" />
                    <Text style={s.cloudFeatureText}>Cloud Backup</Text>
                  </View>
                  <View style={s.cloudFeaturePill}>
                    <Ionicons name="phone-portrait-outline" size={15} color="#C97B5A" />
                    <Text style={s.cloudFeatureText}>Easy Transfer</Text>
                  </View>
                </View>
              </View>

              <View style={s.textContainer}>
                <Text style={s.title}>Private, Safe,{'\n'}& Always Yours</Text>
                <Text style={s.subtitle}>
                  Your closet is securely synced to the cloud. Switch phones anytime or restore
                  your entire collection with a single tap.
                </Text>
              </View>
            </View>
          )
        }}
      />

      {/* Unified Bottom Bar across all slides */}
      <View style={s.bottomSection}>
        {/* Progress Dots */}
        <View style={s.dots}>
          {[0, 1, 2].map(i => {
            const isActive = i === activeIndex
            return <View key={i} style={[s.dot, isActive && s.dotActive]} />
          })}
        </View>

        {/* Action Button */}
        <TouchableOpacity style={s.mainBtn} onPress={next} activeOpacity={0.85}>
          <Text style={s.mainBtnText}>{isLast ? 'Get Started' : 'Continue'}</Text>
          <Ionicons
            name={isLast ? 'arrow-forward' : 'chevron-forward'}
            size={16}
            color="#FAF7F2"
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 40,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 14,
    color: '#8C5E4A',
  },
  slide: {
    width: W,
    alignItems: 'center',
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  visualCard: {
    width: '100%',
    height: 230,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8DDD4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    shadowColor: '#2C1F1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  // Slide 1 elements
  hangerBubble: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FEF6F2',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 123, 90, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E8DDD4',
  },
  tagBadgeText: {
    fontSize: 11,
    fontFamily: 'JosefinSans_600SemiBold',
    color: '#2C1F1A',
  },
  // Slide 2 elements
  outfitPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  occasionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#C97B5A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  occasionPillText: {
    fontSize: 11,
    fontFamily: 'JosefinSans_600SemiBold',
    color: '#FAF7F2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weatherText: {
    fontSize: 12,
    fontFamily: 'JosefinSans_600SemiBold',
    color: '#8C5E4A',
  },
  outfitGarmentsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  garmentChip: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E8DDD4',
  },
  garmentChipLabel: {
    fontSize: 10,
    fontFamily: 'JosefinSans_600SemiBold',
    color: '#2C1F1A',
  },
  outfitQuote: {
    fontSize: 11,
    fontFamily: 'JosefinSans_400Regular',
    fontStyle: 'italic',
    color: '#8C5E4A',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Slide 3 elements
  shieldCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEF6F2',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 123, 90, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cloudPillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DDD4',
  },
  cloudFeatureText: {
    fontSize: 11,
    fontFamily: 'JosefinSans_600SemiBold',
    color: '#2C1F1A',
  },
  // Typography
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 32,
    lineHeight: 38,
    color: '#2C1F1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#8C5E4A',
    textAlign: 'center',
  },
  // Bottom Section
  bottomSection: {
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(201, 123, 90, 0.25)',
  },
  dotActive: {
    width: 22,
    backgroundColor: '#C97B5A',
  },
  mainBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2C1F1A',
    borderRadius: 999,
    paddingVertical: 17,
    shadowColor: '#2C1F1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  mainBtnText: {
    fontFamily: 'JosefinSans_600SemiBold',
    fontSize: 15,
    color: '#FAF7F2',
    letterSpacing: 0.5,
  },
})
