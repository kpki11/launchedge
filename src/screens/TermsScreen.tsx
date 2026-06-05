// src/screens/TermsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { ParticleField, GlowOrb } from '../components/ParticleField';
import { Typography, Spacing, Radius } from '../theme/typography';

export default function TermsScreen({ navigation }: any) {
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
        <Text style={s.title}>Terms of Service</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: May 2026</Text>

        <Section title="Acceptance of Terms">
          By downloading or using LaunchEdge Labs, you agree to these Terms of Service.
          If you do not agree, please do not use the app. These terms apply to all users
          including individual business owners and team members.
        </Section>

        <Section title="What LaunchEdge Does">
          LaunchEdge Labs is a business record-keeping app. It lets you create custom tables,
          add records, manage approvals, scan documents, and view business insights. It is
          provided as a tool to help you organise your business data.
        </Section>

        <Section title="Your Data, Your Responsibility">
          All data you enter into the app is stored on your device. You are responsible for
          maintaining backups (via Google Drive or other means). LaunchEdge Labs is not liable
          for data loss caused by device failure, accidental deletion, or app removal.
        </Section>

        <Section title="Acceptable Use">
          You agree to use LaunchEdge only for lawful business purposes. You must not:{'\n'}
          {'\u2022'} Use the app to store illegal, harmful, or fraudulent data{'\n'}
          {'\u2022'} Attempt to reverse-engineer or modify the app{'\n'}
          {'\u2022'} Use the app to harm, deceive, or defraud others{'\n'}
          {'\u2022'} Share your join code with anyone outside your authorised team
        </Section>

        <Section title="Team Features">
          The join code feature allows team members to submit records for approval. The
          account owner (the person who set up the business) is responsible for managing
          team access, approving or rejecting submissions, and revoking access when needed.
        </Section>

        <Section title="No Warranties">
          LaunchEdge Labs is provided "as is" without warranty of any kind. We do not
          guarantee the app will be error-free, uninterrupted, or suitable for every
          specific business need. Use the app at your own risk.
        </Section>

        <Section title="Limitation of Liability">
          To the fullest extent permitted by law, LaunchEdge Labs and its developers are
          not liable for any indirect, incidental, or consequential damages arising from
          your use of the app, including but not limited to loss of business data or revenue.
        </Section>

        <Section title="Updates to Terms">
          We may update these terms as the app evolves. When we do, the updated terms will
          be available on this screen. Continued use of the app after updates constitutes
          acceptance of the revised terms.
        </Section>

        <Section title="Governing Law">
          These terms are governed by the laws of India. Any disputes shall be subject to
          the jurisdiction of the courts of India.
        </Section>

        <Section title="Contact">
          For questions about these terms:{'\n'}
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
