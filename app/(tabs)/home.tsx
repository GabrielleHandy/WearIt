import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Image, ActivityIndicator, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import * as Location from 'expo-location'
import { loadSavedOutfits, loadWardrobe } from '@/utils/storage'
import { getWeather } from '@/utils/weather'
import { SavedOutfit, ClothingItem, CanvasItemLayout } from '@/constants/types'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: W } = Dimensions.get('window')
const OUTFIT_CARD_W = W * 0.42
const OUTFIT_CARD_H = OUTFIT_CARD_W * 1.15

// Canvas base item size — matches ITEM_SIZE in OutfitCanvas.tsx
const CANVAS_ITEM_BASE = 110

// ─── RSS feed ─────────────────────────────────────────────────────────────────

type FeedItem = { title: string; link: string; imageUrl: string; source: string }

function extractBetween(str: string, open: string, close: string): string {
  const start = str.indexOf(open)
  if (start === -1) return ''
  const end = str.indexOf(close, start + open.length)
  if (end === -1) return ''
  return str.slice(start + open.length, end)
}

function parseRSS(xml: string, source: string, limit = 6): FeedItem[] {
  const items: FeedItem[] = []
  const matches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []
  for (const raw of matches.slice(0, limit)) {
    const title = extractBetween(raw, '<title>', '</title>')
      .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim()
    const link = extractBetween(raw, '<link>', '</link>').trim()
    const imageUrl = raw.match(/url="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i)?.[1] ?? ''
    if (title && link) items.push({ title, link, imageUrl, source })
  }
  return items
}

async function fetchStyleFeed(): Promise<FeedItem[]> {
  try {
    const res = await fetch('https://www.whowhatwear.com/rss', {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    })
    const xml = await res.text()
    return parseRSS(xml, 'Who What Wear')
  } catch {
    return []
  }
}

// ─── Mini canvas preview ─────────────────────────────────────────────────────
// Scales and centers the saved canvas layout to fit the card exactly.
// Uses a bounding-box approach so items are never clipped and always centered.

const MINI_PADDING = 12 // padding inside the mini card

function MiniCanvas({ layout, wardrobe, theme }: {
  layout: CanvasItemLayout[]
  wardrobe: ClothingItem[]
  theme: Theme
}) {
  // Compute bounding box of all items in canvas coordinates
  const boxes = layout.map(entry => {
    const size = CANVAS_ITEM_BASE * entry.scale
    return { x1: entry.x, y1: entry.y, x2: entry.x + size, y2: entry.y + size }
  })

  const minX = Math.min(...boxes.map(b => b.x1))
  const minY = Math.min(...boxes.map(b => b.y1))
  const maxX = Math.max(...boxes.map(b => b.x2))
  const maxY = Math.max(...boxes.map(b => b.y2))

  const contentW = Math.max(maxX - minX, 1)
  const contentH = Math.max(maxY - minY, 1)

  // Scale to fit inside the card (uniform scale, letter-box style)
  const availW = OUTFIT_CARD_W - MINI_PADDING * 2
  const availH = OUTFIT_CARD_H - MINI_PADDING * 2
  const scale = Math.min(availW / contentW, availH / contentH)

  // Offset so scaled content is centered in the card
  const offsetX = (OUTFIT_CARD_W - contentW * scale) / 2 - minX * scale
  const offsetY = (OUTFIT_CARD_H - contentH * scale) / 2 - minY * scale

  return (
    <View style={{
      width: OUTFIT_CARD_W,
      height: OUTFIT_CARD_H,
      backgroundColor: theme.surfaceTint,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {layout.map((entry, i) => {
        const item = wardrobe.find(w => w.id === entry.clothingId)
        if (!item) return null

        const size = CANVAS_ITEM_BASE * entry.scale * scale
        const x = entry.x * scale + offsetX
        const y = entry.y * scale + offsetY

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              left: x,
              top: y,
              transform: [{ rotate: `${entry.rotation}rad` }],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.photoUri ? (
              <Image
                source={{ uri: item.photoUri }}
                style={{ width: size, height: size, borderRadius: Radius.sm }}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: size * 0.6 }}>{item.emoji}</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

// ─── Weather helpers ──────────────────────────────────────────────────────────

function weatherEmoji(desc: string): string {
  const d = desc.toLowerCase()
  if (d.includes('sun') || d.includes('clear')) return '☀️'
  if (d.includes('cloud')) return '⛅'
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌧️'
  if (d.includes('snow') || d.includes('sleet')) return '❄️'
  if (d.includes('thunder') || d.includes('storm')) return '⛈️'
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return '🌫️'
  if (d.includes('wind')) return '💨'
  return '🌤️'
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const insets = useSafeAreaInsets()

  const [weather, setWeather] = useState('')
  const [city, setCity] = useState('')
  const [outfits, setOutfits] = useState<SavedOutfit[]>([])
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(true)

  // Weather — once on mount
  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
        const [place] = await Location.reverseGeocodeAsync(loc.coords)
        const c = place.city || place.subregion || place.region || ''
        if (c) {
          setCity(c)
          const w = await getWeather(c)
          if (w) setWeather(w)
        }
      } catch {}
    })()
  }, [])

  // Style feed — once on mount
  useEffect(() => {
    fetchStyleFeed().then(items => {
      setFeed(items)
      setFeedLoading(false)
    })
  }, [])

  // Outfits + wardrobe — refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadSavedOutfits().then(o => setOutfits(o.slice(0, 8)))
      loadWardrobe().then(setWardrobe)
    }, [])
  )

  // Parse "72°F, clear sky" into parts
  const weatherTemp = weather ? weather.split(',')[0].trim() : ''
  const weatherDesc = weather ? weather.split(',').slice(1).join(',').trim() : ''

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.appName}>WearIt</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/(tabs)/settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Weather card ─────────────────────────────────────── */}
      <View style={styles.weatherCard}>
        {/* Top row: emoji + temp + desc */}
        <View style={styles.weatherTop}>
          <Text style={styles.weatherEmoji}>
            {weather ? weatherEmoji(weatherDesc) : '🌤️'}
          </Text>
          <View style={styles.weatherTextBlock}>
            {weatherTemp ? (
              <Text style={styles.weatherTemp}>{weatherTemp}</Text>
            ) : (
              <Text style={styles.weatherDescText}>Getting weather...</Text>
            )}
            {(weatherDesc || city) ? (
              <Text style={styles.weatherDescText} numberOfLines={1}>
                {weatherDesc}{city ? ` · ${city}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
        {/* CTA below, full width */}
        <TouchableOpacity
          style={styles.outfitPromptBtn}
          onPress={() => router.push('/(tabs)/outfits')}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles-outline" size={13} color={theme.textOnAccent} />
          <Text style={styles.outfitPromptText}>What should I wear?</Text>
        </TouchableOpacity>
      </View>

      {/* ── Quick actions ────────────────────────────────────── */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => router.push('/(tabs)/wardrobe')}
          activeOpacity={0.85}
        >
          <View style={styles.quickIcon}>
            <Ionicons name="shirt-outline" size={22} color={theme.accent} />
          </View>
          <Text style={styles.quickLabel}>Wardrobe</Text>
          <Text style={styles.quickSub}>
            {wardrobe.length > 0 ? `${wardrobe.length} pieces` : 'Add items'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => router.push('/(tabs)/outfits')}
          activeOpacity={0.85}
        >
          <View style={styles.quickIcon}>
            <Ionicons name="color-palette-outline" size={22} color={theme.accent} />
          </View>
          <Text style={styles.quickLabel}>Outfits</Text>
          <Text style={styles.quickSub}>
            {outfits.length > 0 ? `${outfits.length} saved` : 'Build a look'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => router.push('/(tabs)/inspo')}
          activeOpacity={0.85}
        >
          <View style={styles.quickIcon}>
            <Ionicons name="bookmark-outline" size={22} color={theme.accent} />
          </View>
          <Text style={styles.quickLabel}>Wishlist</Text>
          <Text style={styles.quickSub}>gap check</Text>
        </TouchableOpacity>
      </View>

      {/* ── Recent Looks ─────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Recent Looks</Text>
        {outfits.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/(tabs)/outfits')}>
            <Text style={styles.sectionLink}>see all</Text>
          </TouchableOpacity>
        )}
      </View>

      {outfits.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="sparkles-outline" size={32} color={theme.border} />
          <Text style={styles.emptyTitle}>No saved looks yet</Text>
          <Text style={styles.emptyBody}>
            Ask WearIt for an outfit suggestion and save your favourites.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/(tabs)/outfits')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyBtnText}>Get Styled</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.outfitStrip}
        >
          {outfits.map(outfit => {
            const previewItems = (outfit.itemIds ?? [])
              .map(id => wardrobe.find(w => w.id === id))
              .filter((item): item is ClothingItem => Boolean(item))
            const firstPhoto = previewItems.find(i => i.photoUri)?.photoUri
            const date = new Date(outfit.savedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })

            return (
              <TouchableOpacity
                key={outfit.id}
                style={styles.outfitCard}
                onPress={() => router.push('/(tabs)/outfits')}
                activeOpacity={0.85}
              >
                <View style={styles.outfitPhotoWrap}>
                  {outfit.canvasLayout && outfit.canvasLayout.length > 0 ? (
                    <MiniCanvas
                      layout={outfit.canvasLayout}
                      wardrobe={wardrobe}
                      theme={theme}
                    />
                  ) : firstPhoto ? (
                    <Image
                      source={{ uri: firstPhoto }}
                      style={styles.outfitPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.outfitEmptyPhoto}>
                      <Text style={{ fontSize: 30 }}>✨</Text>
                    </View>
                  )}
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{date}</Text>
                  </View>
                </View>
                <Text style={styles.outfitLabel} numberOfLines={2}>
                  {outfit.occasion || outfit.suggestion.split('.')[0].replace(/\*\*/g, '')}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* ── Style Feed ───────────────────────────────────────── */}
      <View style={[styles.sectionRow, { marginTop: Spacing.xl }]}>
        <Text style={styles.sectionLabel}>Style Feed</Text>
      </View>

      {feedLoading ? (
        <ActivityIndicator
          color={theme.accent}
          style={{ marginVertical: Spacing.xl }}
        />
      ) : feed.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyBody}>Trend articles couldn't load. Check your connection.</Text>
        </View>
      ) : (
        <View style={styles.feedList}>
          {feed.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.feedItem}
              onPress={() => Linking.openURL(item.link).catch(() => {})}
              activeOpacity={0.85}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.feedThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.feedThumb, styles.feedThumbEmpty]}>
                  <Ionicons name="newspaper-outline" size={22} color={theme.border} />
                </View>
              )}
              <View style={styles.feedTextWrap}>
                <Text style={styles.feedTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.feedSource}>{item.source}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.border} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: Spacing.xxl },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  greeting: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
  },
  appName: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 30,
    color: theme.textPrimary,
    lineHeight: 34,
  },
  settingsBtn: {
    width: 36, height: 36,
    borderRadius: Radius.full,
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Weather card
  weatherCard: {
    marginHorizontal: Spacing.screen,
    marginBottom: Spacing.base,
    backgroundColor: theme.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1, borderColor: theme.border,
    flexDirection: 'column',
    gap: Spacing.md,
    ...Shadow.card,
  },
  weatherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  weatherTextBlock: {
    flex: 1,
  },
  weatherEmoji: { fontSize: 40 },
  weatherTemp: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 26,
    color: theme.textPrimary,
    lineHeight: 30,
  },
  weatherDescText: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    marginTop: 2,
  },
  outfitPromptBtn: {
    backgroundColor: theme.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  outfitPromptText: {
    fontFamily: 'JosefinSans_600SemiBold',
    fontSize: 13,
    color: theme.textOnAccent,
    letterSpacing: 0.3,
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1, borderColor: theme.border,
    alignItems: 'center',
    gap: 5,
    ...Shadow.card,
  },
  quickIcon: {
    width: 44, height: 44,
    borderRadius: Radius.full,
    backgroundColor: theme.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: {
    ...Typography.styles.caption,
    fontFamily: 'JosefinSans_600SemiBold',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  quickSub: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    textAlign: 'center',
    fontSize: 10,
  },

  // Section headers
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.styles.sectionLabel,
    color: theme.sectionLabel,
  },
  sectionLink: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
  },

  // Outfit strip
  outfitStrip: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.md,
    paddingBottom: 4,
  },
  outfitCard: {
    width: OUTFIT_CARD_W,
    backgroundColor: theme.surface,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: theme.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  outfitPhotoWrap: { position: 'relative' },
  outfitPhoto: {
    width: OUTFIT_CARD_W,
    height: OUTFIT_CARD_W * 1.15,
  },
  outfitEmptyPhoto: {
    width: OUTFIT_CARD_W,
    height: OUTFIT_CARD_W * 1.15,
    backgroundColor: theme.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
  },
  dateBadge: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(26,18,24,0.65)',
    borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  dateBadgeText: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 10, color: '#FFF',
  },
  outfitLabel: {
    padding: Spacing.sm,
    ...Typography.styles.caption,
    fontFamily: 'JosefinSans_600SemiBold',
    color: theme.textPrimary,
    lineHeight: 15,
  },

  // Empty states
  emptyCard: {
    marginHorizontal: Spacing.screen,
    backgroundColor: theme.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1, borderColor: theme.border,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.styles.body,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: theme.accent,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: 4,
  },
  emptyBtnText: {
    ...Typography.styles.btnLabelSm,
    color: theme.textOnAccent,
  },

  // Style feed
  feedList: {
    marginHorizontal: Spacing.screen,
    gap: Spacing.sm,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: theme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: theme.border,
    ...Shadow.card,
  },
  feedThumb: {
    width: 64, height: 64,
    borderRadius: Radius.md,
    backgroundColor: theme.surfaceTint,
  },
  feedThumbEmpty: {
    alignItems: 'center', justifyContent: 'center',
  },
  feedTextWrap: { flex: 1, gap: 4 },
  feedTitle: {
    ...Typography.styles.bodySmall,
    fontFamily: 'JosefinSans_600SemiBold',
    color: theme.textPrimary,
    lineHeight: 18,
  },
  feedSource: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
  },
})
