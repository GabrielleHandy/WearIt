import { useState, useEffect } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type Theme, Spacing, Radius, Typography } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { SHOPPING_STORES, StoreOption, buildSearchQuery, openStoreSearch } from '@/utils/shoppingLinks'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

type Props = {
  visible: boolean
  onClose: () => void
  itemName: string
  category?: string
  color?: string
}

export function ShopSimilarModal({
  visible,
  onClose,
  itemName,
  category,
  color,
}: Props) {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (visible && itemName) {
      setQuery(buildSearchQuery(itemName, category, color))
    }
  }, [visible, itemName, category, color])

  const handleSelectStore = async (store: StoreOption) => {
    if (!query.trim()) return
    await openStoreSearch(store, query.trim())
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
          {/* Header handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          {/* Title & Close */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Find Similar & Dupes</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Search across stores for matches and price comparisons
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search query box */}
          <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search" size={16} color={theme.accent} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search keyword (e.g. Linen Shirt Cream)"
              placeholderTextColor={theme.textPlaceholder}
              autoCapitalize="words"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Store Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.storesList}
          >
            {SHOPPING_STORES.map(store => (
              <TouchableOpacity
                key={store.id}
                style={[styles.storeCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => handleSelectStore(store)}
                activeOpacity={0.82}
              >
                <View style={[styles.storeIconWrap, { backgroundColor: store.badgeBg + '18' }]}>
                  <Ionicons name={store.icon as any} size={22} color={store.color} />
                </View>

                <View style={styles.storeInfo}>
                  <View style={styles.storeTitleRow}>
                    <Text style={[styles.storeName, { color: theme.textPrimary }]}>{store.name}</Text>
                    <View style={[styles.badge, { backgroundColor: store.badgeBg }]}>
                      <Text style={styles.badgeText}>{store.badge}</Text>
                    </View>
                  </View>
                  <Text style={[styles.storeTagline, { color: theme.textSecondary }]} numberOfLines={1}>
                    {store.tagline}
                  </Text>
                </View>

                <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    maxHeight: SCREEN_HEIGHT * 0.82,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 22,
    lineHeight: 26,
  },
  subtitle: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.base,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'JosefinSans_600SemiBold',
    fontSize: 13,
    padding: 0,
  },
  storesList: {
    gap: 10,
    paddingBottom: 16,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: {
    flex: 1,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  storeName: {
    fontFamily: 'JosefinSans_600SemiBold',
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8,
    fontFamily: 'JosefinSans_600SemiBold',
    color: '#FAF7F2',
    letterSpacing: 0.5,
  },
  storeTagline: {
    fontFamily: 'JosefinSans_400Regular',
    fontSize: 11,
  },
})
