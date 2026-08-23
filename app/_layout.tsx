import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  JosefinSans_300Light,
  JosefinSans_400Regular,
  JosefinSans_600SemiBold,
} from '@expo-google-fonts/josefin-sans';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { setPendingSharedUri } from '@/utils/shareIntent';
import { AIProvider } from '@/contexts/AIContext';
import { WearItThemeProvider } from '@/contexts/ThemeContext';
import { View } from 'react-native';
import { installBugLogger } from '@/utils/bugLogger';
import { FloatingHelpButton } from '@/components/FloatingHelpButton';

installBugLogger();

const ONBOARDING_KEY = 'wearit_has_seen_onboarding';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { shareIntent, resetShareIntent } = useShareIntent();
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    JosefinSans_300Light,
    JosefinSans_400Regular,
    JosefinSans_600SemiBold,
  });

  // First-launch onboarding
  // TODO Phase 4: swap for auth check — no session -> /onboarding with sign-up CTA on last slide
  useEffect(() => {
    if (!fontsLoaded) return;
    AsyncStorage.getItem(ONBOARDING_KEY).then(seen => {
      if (!seen) router.replace('/onboarding');
    });
  }, [fontsLoaded]);

  useEffect(() => {
    const imageFile = shareIntent?.files?.find(f => f.mimeType?.startsWith('image/')) as any;
    if (imageFile?.uri) {
      setPendingSharedUri(imageFile.uri);
      resetShareIntent();
      router.push('/(tabs)/shopping');
    }
  }, [shareIntent]);

  if (!fontsLoaded) return null;

  return (
    <AIProvider>
      <WearItThemeProvider>
        <View style={{ flex: 1 }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="help" options={{ presentation: 'modal', title: 'Help & Guide' }} />
            <Stack.Screen name="bug-report" options={{ title: 'Report a Bug' }} />
            <Stack.Screen name="tag-outfit" options={{ headerShown: false }} />
          </Stack>
          <FloatingHelpButton />
        </View>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </WearItThemeProvider>
    </AIProvider>
  );
}
