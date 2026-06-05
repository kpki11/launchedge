// src/screens/JoinBusinessScreen.tsx
// Phase 3 — Join With Code (local device lookup)
// V1: Searches local SQLite for a matching joinCode.
// V2 (after Phase 4 Drive setup): will search Google Drive.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { GoldButton } from '../components/GoldButton';
import { useBusinessStore } from '../store/useBusinessStore';
import { getBusinessByJoinCode } from '../services/database';
import { useTableStore } from '../store/useTableStore';

export default function JoinBusinessScreen({ navigation }: any) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const { setBusiness, setOnboarded } = useBusinessStore();
  const { loadTables } = useTableStore();

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (trimmed.length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-character code exactly as shared by your team owner.');
      return;
    }

    setLoading(true);
    try {
      const biz = await getBusinessByJoinCode(trimmed);
      if (!biz) {
        Alert.alert(
          'Code not found',
          'No business with this code was found on this device.\n\nAsk your team owner to:\n1. Share their phone\n2. Or set up Google Drive sync (coming soon) so you can join from any device.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Load that business as the active one
      setBusiness({
        id: biz.id,
        name: biz.name,
        type: biz.type,
        storageMode: biz.storageMode,
        googleEmail: biz.googleEmail,
        joinCode: biz.joinCode,
        isOwner: 0, // joined as member, not owner
      });
      await loadTables(biz.id);
      setOnboarded(true);
    } catch (e) {
      console.error('[JoinBusinessScreen] Error:', e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Auto-uppercase, strip non-alphanumeric, max 6 chars
    setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg_monument_clean.jpeg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.ivory} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            {/* Icon */}
            <View style={styles.iconCircle}>
              <Ionicons name="people-outline" size={28} color={Theme.primary} />
            </View>

            <Text style={styles.title}>Join a Team</Text>
            <Text style={styles.subtitle}>
              Ask your team owner for their 6-character join code, then enter it below.
            </Text>

            {/* Code input */}
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={handleCodeChange}
              placeholder="e.g.  T X L 4 8 2"
              placeholderTextColor={Theme.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />

            <Text style={styles.hint}>
              {code.length}/6 characters
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color={Theme.primary} style={{ marginTop: Spacing.xl }} />
            ) : (
              <GoldButton
                label="Join Business"
                onPress={handleJoin}
                size="lg"
                style={{ marginTop: Spacing.lg }}
                disabled={code.length !== 6}
              />
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={15} color={Theme.textDim} />
              <Text style={styles.infoText}>
                V1: works when owner's data is on this device.{'\n'}
                Google Drive sync (coming soon) will let you join from any phone.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,11,9,0.65)' },
  safe: { flex: 1 },
  kav: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
  },
  backText: { ...Typography.bodyM, color: Colors.ivory },
  card: {
    backgroundColor: Theme.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Theme.border,
    alignItems: 'center',
    marginTop: 60,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(196,150,58,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: { ...Typography.headingL, color: Theme.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  codeInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: Theme.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: 28,
    fontFamily: 'DMSans_600SemiBold',
    color: Theme.textPrimary,
    textAlign: 'center',
    letterSpacing: 10,
    backgroundColor: Theme.background,
  },
  hint: {
    ...Typography.bodyS,
    color: Theme.textDim,
    marginTop: Spacing.sm,
    alignSelf: 'flex-end',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    backgroundColor: Theme.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoText: { ...Typography.bodyS, color: Theme.textDim, flex: 1, lineHeight: 18 },
});


