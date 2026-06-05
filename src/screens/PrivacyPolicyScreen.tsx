// src/screens/PrivacyPolicyScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { ParticleField, GlowOrb } from '../components/ParticleField';
import { Typography, Spacing, Radius } from '../theme/typography';

export default function PrivacyPolicyScreen({ navigation }: any) {
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Background */}
      <ParticleField variant="full" count={10} height={1200} />
      <GlowOrb x={-30} y={120} size={180} color="rgba(196,150,58,0.09)" />
      <GlowOrb x={200} y={600} size={150} color="rgba(196,150,58,0.08)" />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Privacy Policy</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: May 2026</Text>

        <Section title="Overview">
          LaunchEdge Labs is built for small and medium business owners who want full control
          of their data. We take privacy seriously. This policy explains what data we collect,
          how we store it, and what we never do with it.
        </Section>

        <Section title="Data Storage">
          All your business data  —  tables, records, fields, approvals, and settings  —  is stored
          locally on your device using SQLite. Nothing is uploaded to our servers. We do not have
          access to your records, your business name, or any data you enter into the app.
        </Section>

        <Section title="Google Drive (Optional)">
          If you choose to connect Google Drive, your data is backed up directly to your own
          Google account. LaunchEdge does not have access to your Google Drive files. The
          connection uses OAuth 2.0 and your credentials are handled entirely by Google.
          You can disconnect at any time from Settings.
        </Section>

        <Section title="Analytics & Crash Reporting">
          We may collect anonymous, non-identifying crash logs to help fix bugs. These logs
          contain no business data, no personal information, and no record content. They only
          include technical details such as the error type and the screen where a crash occurred.
        </Section>

        <Section title="Data We Never Collect">
          We never collect, store, or transmit:{'\n'}
          {'\u2022'} Your business records or table data{'\n'}
          {'\u2022'} Your business name or type{'\n'}
          {'\u2022'} Your team member details or join codes{'\n'}
          {'\u2022'} Any financial figures you enter{'\n'}
          {'\u2022'} Photos or scanned documents
        </Section>

        <Section title="Third-Party Services">
          LaunchEdge does not sell, rent, or share your data with any third party for advertising
          or marketing purposes. The app does not display ads and is not ad-supported.
        </Section>

        <Section title="Children's Privacy">
          LaunchEdge is designed for business use by adults. We do not knowingly collect data
          from anyone under the age of 13.
        </Section>

        <Section title="Changes to This Policy">
          If we update this policy, the new version will be available within the app on this
          screen. Continued use of the app after changes means you accept the updated policy.
        </Section>

        <Section title="Contact">
          If you have questions about this policy or your data, contact us at:{'\n'}
          support@launchedgelabs.com
        </Section>

        <View style={{ height: Spacing.xxl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.body}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background, position: 'relative', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.background,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: Radius.md,
    backgroundColor: Theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
  },
  title: { ...Typography.headingM, color: Theme.textPrimary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  updated: { ...Typography.bodyS, color: Theme.textDim, marginBottom: Spacing.xl },
  section: {
    marginBottom: Spacing.xl,
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  sectionTitle: {
    ...Typography.labelCaps,
    color: Theme.primary,
    marginBottom: Spacing.sm,
  },
  body: { ...Typography.bodyM, color: Theme.textSecondary, lineHeight: 22 },
});

