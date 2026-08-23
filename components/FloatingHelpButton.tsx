import { useMemo } from 'react'
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type Theme, Radius, Shadow, Typography } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

export function FloatingHelpButton() {
  const { theme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  const styles = useMemo(() => makeStyles(theme, insets.bottom), [theme, insets.bottom])

  // Hide on Help screen, Onboarding flow, or Tag Outfit screen
  if (
    pathname === '/help' ||
    pathname === '/onboarding' ||
    pathname?.includes('tag-outfit')
  ) {
    return null
  }

  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/help')}
      activeOpacity={0.85}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.content}>
        <Ionicons name="sparkles" size={16} color={theme.textOnAccent} />
        <Text style={styles.label}>Help</Text>
      </View>
    </TouchableOpacity>
  )
}

const makeStyles = (theme: Theme, bottomInset: number) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 16,
      bottom: Math.max(bottomInset + 64, 76),
      backgroundColor: theme.accent,
      borderRadius: Radius.full,
      paddingHorizontal: 14,
      paddingVertical: 9,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.22,
      shadowRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    label: {
      ...Typography.styles.caption,
      color: theme.textOnAccent,
      fontFamily: Typography.bodyMedium,
      fontSize: 12,
      letterSpacing: 0.3,
    },
  })
