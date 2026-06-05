// App.tsx
import React, { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { TutorialProvider } from './src/components/TutorialOverlay';

import { useFonts } from 'expo-font';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
} from '@expo-google-fonts/jetbrains-mono';

SplashScreen.preventAutoHideAsync();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <ScrollView style={styles.errScreen} contentContainerStyle={styles.errContent}>
          <Text style={styles.errTitle}>CRASH DETAILS</Text>
          <Text style={styles.errName}>{err.name}: {err.message}</Text>
          <Text style={styles.errStack}>{err.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    JetBrainsMono_400Regular,
  });

  // FIX: Hide splash screen via useEffect, not onLayout.
  // onLayout can fire before fonts resolve or not fire at all on certain
  // Android versions, leaving the splash screen stuck forever.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // FIX: Add a hard 5-second timeout fallback so the app never gets
  // permanently stuck on the splash screen even if fonts fail silently.
  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <TutorialProvider>
          <View style={{ flex: 1 }}>
            <AppNavigator />
          </View>
        </TutorialProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errScreen: { flex: 1, backgroundColor: '#1a1a2e' },
  errContent: { padding: 20, paddingTop: 60 },
  errTitle: { color: '#ff6b6b', fontSize: 20, fontFamily: 'DMSans_600SemiBold', marginBottom: 12 },
  errName: { color: '#ffd93d', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  errStack: { color: '#c8c8c8', fontSize: 11, lineHeight: 16 },
});
