import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GapAnalysisResult, ClothingItem, WishlistItem } from '@/constants/types'
import { getWishlistItem, loadWardrobe } from '@/utils/storage'
import { analyzeGap } from '@/utils/claude'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

export default function WishlistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const insets = useSafeAreaInsets()

  const [item, setItem] = useState<WishlistItem | null>(null)
  const [result, setResult] = useState<GapAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  useFocusEffect(
    useCallback(() => {
      getWishlistItem(id).then(setItem)
      // Reset analysis when coming back to this screen
      setResult(null)
      setAnalyzed(false)
    }, [id])
  )

  const handleAnalyze = async () => {
    if (!item) return
    setAnalyzing(true)
    try {
      const wardrobe = await loadWardrobe()
      const analysis = await analyzeGap(item, wardrobe)
      setResult(analysis)
      setAnalyzed(true)
    } finally {
      setAnalyzing(false)
    }
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={theme.accent} />
        <Text style={styles.backText}>Inspo</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Photo */}
        <View style={styles.photoWrap}>
          <Image source={{ uri: item.photoUri }} style={styles.photo} resizeMode="cover" />
        </View>

        {/* Item info */}
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {item.color ? `${item.color} · ` : ''}{item.category}
          {item.sourceNote ? ` · ${item.sourceNote}` : ''}
        </Text>

        {/* Analyze button */}
        {!analyzed && (
          <TouchableOpacity
            style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <View style={styles.row}>
                <ActivityIndicator color={theme.textOnAccent} size="small" />
                <Text style={styles.analyzeBtnText}>Checking your wardrobe...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeBtnText}>Check closet gap</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Results */}
        {result && (
          <View style={styles.results}>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>{result.summary}</Text>
            </View>

            {/* Matches */}
            <Text style={styles.sectionLabel}>You Already Own</Text>
            {result.matches.length === 0 ? (
              <Text style={styles.emptyNote}>Nothing similar in your wardrobe yet.</Text>
            ) : (
              result.matches.map(match => (
                <MatchCard key={match.id} item={match} theme={theme} styles={styles} />
              ))
            )}

            {/* Missing */}
            <Text style={styles.sectionLabel}>Still Need</Text>
            {result.missing.length === 0 ? (
              <Text style={styles.emptyNote}>You've got everything to pull this off! 🎉</Text>
            ) : (
              result.missing.map((piece, i) => (
                <View key={i} style={styles.missingRow}>
                  <Text style={styles.missingDot}>·</Text>
                  <Text style={styles.missingText}>{piece}</Text>
                </View>
              ))
            )}

            {/* Re-analyze button */}
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setResult(null); setAnalyzed(false) }}>
              <Text style={styles.retryText}>Run again</Text>
            </TouchableOpacity>

          </View>
        )}

      </ScrollView>
    </View>
  )
}

function MatchCard({ item, theme, styles }: { item: ClothingItem; theme: Theme; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.matchCard}>
      {item.photoUri ? (
        <Image source={{ uri: item.photoUri }} style={styles.matchPhoto} resizeMode="cover" />
      ) : (
        <View style={styles.matchEmoji}>
          <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
        </View>
      )}
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.name}</Text>
        <Text style={styles.matchMeta}>{item.color ? `${item.color} · ` : ''}{item.category}</Text>
      </View>
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
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
  },
  backText: {
    fontSize: 16,
    color: theme.accent,
    fontWeight: '500',
    fontFamily: 'JosefinSans_600SemiBold',
  },
  scroll: {
    paddingTop: Spacing.base,
    paddingHorizontal: Spacing.screen,
    paddingBottom: 60,
    alignItems: 'center',
  },
  photoWrap: {
    width: 220,
    height: 280,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: Typography.xl,
    fontFamily: Typography.displayBold,
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  meta: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  analyzeBtn: {
    backgroundColor: theme.accent,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    width: '100%',
  },
  analyzeBtnDisabled: {
    opacity: 0.7,
  },
  analyzeBtnText: {
    ...Typography.styles.btnLabel,
    color: theme.textOnAccent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  results: {
    width: '100%',
    gap: Spacing.base,
  },
  summaryCard: {
    backgroundColor: theme.surfaceTint,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: Spacing.sm,
  },
  summaryText: {
    ...Typography.styles.body,
    color: theme.textPrimary,
    lineHeight: 22,
  },
  sectionLabel: {
    ...Typography.styles.sectionLabel,
    color: theme.sectionLabel,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  emptyNote: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  matchCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  matchPhoto: {
    width: 60,
    height: 60,
  },
  matchEmoji: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceTint,
  },
  matchInfo: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    gap: 2,
  },
  matchName: {
    ...Typography.styles.body,
    color: theme.textPrimary,
  },
  matchMeta: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
  },
  missingRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'flex-start',
  },
  missingDot: {
    fontSize: 18,
    color: theme.accent,
    lineHeight: 22,
  },
  missingText: {
    ...Typography.styles.body,
    color: theme.textPrimary,
    flex: 1,
  },
  retryBtn: {
    alignSelf: 'center',
    marginTop: Spacing.base,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: theme.accent,
  },
  retryText: {
    fontSize: Typography.sm,
    fontFamily: Typography.body,
    color: theme.accent,
  },
})
