// src/screens/SettingsScreen.tsx
// v2.2 â€” Reset clears onboarding key. TutorialToggle in header. Particle background on content.
import React, { useState, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity,
  Switch, Alert, Image, Share, Modal, TextInput, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { useApprovalStore } from '../store/useApprovalStore';
import { GlowOrb, ParticleField } from '../components/ParticleField';
import { updateBusinessJoinCode, updateBusinessName } from '../services/database';
import { getTables, getTableFields, getRecords } from '../services/database';
import { File as FSFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { TutorialToggleButton, Hintable } from '../components/TutorialOverlay';

const ONBOARDING_KEY = 'launchedge:onboarding_done';
const TERMS_KEY = 'launchedge:terms_accepted';
const FORM_URL = 'https://formspree.io/f/xaqzykgn';
const SUPPORT_EMAIL = 'launchedge26@gmail.com';
const SUPPORT_PHONE = '6367903133';

// Helper sub-components
function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.sectionHeader}>{title}</Text>;
}

function SettingsRow({ icon, label, value, onPress, danger }: {
  icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={sh.row} onPress={onPress} activeOpacity={onPress ? 0.75 : 1} disabled={!onPress}>
      <View style={sh.rowLeft}>
        <View style={sh.rowIcon}><Ionicons name={icon as any} size={18} color={danger ? Theme.danger : Theme.primary} /></View>
        <View>
          <Text style={[sh.rowLabel, danger && { color: Theme.danger }]}>{label}</Text>
          {!!value && <Text style={sh.rowSub}>{value}</Text>}
        </View>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={Theme.textDim} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const { activeBusiness, setBusiness, logout, clearAllData, requireApprovalNew, requireApprovalEdit, setRequireApprovalNew, setRequireApprovalEdit } = useBusinessStore();
  const { pendingCount } = useApprovalStore();
  const [editingName, setEditingName] = useState(false);
  const [termsAccepted, setTermsAccepted]   = useState(false);
  const [showTermsGate, setShowTermsGate]   = useState(false);
  const [pendingAction, setPendingAction]   = useState<'joinCode' | 'drive' | null>(null);
  const [nameInput, setNameInput] = useState('');

  const headerAnim = useRef({ opacity: new Animated.Value(0), translateY: new Animated.Value(-20) }).current;
  const cardAnims = useRef(
    Array.from({ length: 8 }, () => ({ opacity: new Animated.Value(0), translateY: new Animated.Value(24) }))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim.opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerAnim.translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    cardAnims.forEach((anim, i) => {
      Animated.parallel([
        Animated.timing(anim.opacity,    { toValue: 1, duration: 350, delay: 100 + i * 65, useNativeDriver: true }),
        Animated.timing(anim.translateY, { toValue: 0, duration: 350, delay: 100 + i * 65, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  // Load terms acceptance status
  useEffect(() => {
    AsyncStorage.getItem(TERMS_KEY).then(v => { if (v === 'true') setTermsAccepted(true); });
  }, []);

  // Gate: require T&C before join code or Drive
  const requireTerms = (action: 'joinCode' | 'drive') => {
    if (termsAccepted) {
      action === 'joinCode' ? handleGenerateJoinCode() : handleConnectDrive();
    } else {
      setPendingAction(action);
      setShowTermsGate(true);
    }
  };

  const handleAcceptTerms = async () => {
    await AsyncStorage.setItem(TERMS_KEY, 'true');
    setTermsAccepted(true);
    setShowTermsGate(false);
    if (pendingAction === 'joinCode') handleGenerateJoinCode();
    else if (pendingAction === 'drive') handleConnectDrive();
    setPendingAction(null);
  };

  const isCloudMode = activeBusiness?.storageMode === 'googleDrive';
  const [exporting, setExporting] = useState(false);
  const [joinCodeVisible, setJoinCodeVisible] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const handleExportAll = async () => {
    if (!activeBusiness?.id) return;
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      Alert.alert('Not supported', 'Sharing is not available on this device.');
      return;
    }
    setExporting(true);
    setExportProgress('Reading tables...');
    try {
      const tables = await getTables(activeBusiness.id);
      if (tables.length === 0) {
        Alert.alert('Nothing to export', 'You have no tables yet. Create some tables and add records first.');
        setExporting(false);
        return;
      }

      const exportedFiles: string[] = [];

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setExportProgress('Exporting table ' + (i + 1) + ' of ' + tables.length + ': ' + table.name);
        const fields = await getTableFields(table.id);
        const records = await getRecords(table.id);

        // Build CSV headers
        const systemCols = ['ID', 'Status', 'Created At', 'Created By'];
        const fieldNames = fields.map((f: any) => f.name);
        const headers = [...systemCols, ...fieldNames];

        // Helper: escape a CSV cell value
        const escapeCell = (val: any): string => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        };

        const rows: string[] = [headers.map(escapeCell).join(',')];

        for (const rec of records) {
          let data: Record<string, any> = {};
          try {
            data = typeof rec.data === 'string' ? JSON.parse(rec.data) : (rec.data || {});
          } catch { data = {}; }
          const row = [
            escapeCell(rec.id),
            escapeCell(rec.status || 'approved'),
            escapeCell(rec.createdAt || ''),
            escapeCell(rec.createdBy || 'owner'),
            ...fieldNames.map((fn: string) => escapeCell(data[fn] ?? '')),
          ];
          rows.push(row.join(','));
        }

        const csvContent = rows.join('\n');
        const safeName = table.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const outFile = new FSFile(Paths.cache, 'launchedge_' + safeName + '.csv');
        await outFile.write(csvContent);
        exportedFiles.push(outFile.uri);
      }

      setExporting(false);
      setExportProgress('');

      // Share files one by one (expo-sharing does not support multi-file)
      for (let i = 0; i < exportedFiles.length; i++) {
        setExportProgress('Sharing ' + (i + 1) + ' of ' + exportedFiles.length + '...');
        await Sharing.shareAsync(exportedFiles[i], {
          mimeType: 'text/csv',
          dialogTitle: 'Export: ' + tables[i].name,
          UTI: 'public.comma-separated-values-text',
        });
      }
      setExportProgress('');

    } catch (e: any) {
      setExporting(false);
      setExportProgress('');
      Alert.alert('Export failed', e?.message || 'Something went wrong during export. Please try again.');
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { Alert.alert('Required', 'Business name cannot be empty.'); return; }
    if (!activeBusiness) return;
    try {
      await updateBusinessName(activeBusiness.id, trimmed);
      setBusiness({ ...activeBusiness, name: trimmed });
      setEditingName(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save name. Please try again.');
    }
  };

  const handleGenerateJoinCode = async () => {
    if (!activeBusiness) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    try {
      await updateBusinessJoinCode(activeBusiness.id, code);
      setBusiness({ ...activeBusiness, joinCode: code });
    } catch (e) {
      Alert.alert('Error', 'Could not generate code. Please try again.');
    }
  };

  const handleConnectDrive = () => {
    Alert.alert('Coming Soon', 'Google Drive sync will be available in the next update. Your data is safely stored on this device.', [{ text: 'Got it' }]);
  };

  const handleDisconnectDrive = () => {
    Alert.alert('Disconnect Google Drive', 'Your data will remain on device. No data will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => {
        if (activeBusiness) setBusiness({ ...activeBusiness, storageMode: 'local', googleEmail: undefined });
      }},
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'You will return to the welcome screen. Your data stays on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  // Full reset: wipes DB, AsyncStorage (including onboarding key) â€” sends user back to Landing
  const handleResetEverything = () => {
    Alert.alert(
      'Reset Everything',
      'This will delete ALL your tables, records, and settings, and restart the app completely from scratch. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset & Start Fresh', style: 'destructive', onPress: () => {
          Alert.alert(
            'Absolutely sure?',
            'Every table, record, and setting will be permanently gone.',
            [
              { text: 'Go back', style: 'cancel' },
              { text: 'Yes, reset everything', style: 'destructive', onPress: async () => {
                try {
                  await clearAllData();
                  // Also clear the onboarding_done key so LandingScreen shows fresh
                  await AsyncStorage.removeItem(ONBOARDING_KEY);
                } catch (e) {
                  console.warn('Reset error:', e);
                }
              }},
            ]
          );
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Hero Image */}
      <Image
        source={require('../../assets/images/hero_brush_pot.jpeg')}
        style={styles.heroImage}
        resizeMode="cover"
      />

      {/* Full-screen background decorations */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ParticleField variant="full" height={1400} count={18} />
        <GlowOrb x={-40} y={120} size={220} color="rgba(196,150,58,0.10)" />
        <GlowOrb x={200} y={600} size={180} color="rgba(196,150,58,0.08)" />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Page Header */}
        <Animated.View style={[styles.pageHeader, { opacity: headerAnim.opacity, transform: [{ translateY: headerAnim.translateY }] }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSub}>Your data lives where you want it.</Text>
          </View>
          <TutorialToggleButton />
        </Animated.View>

        {/* Approvals Quick Access */}
        <Hintable hintId="settings_approvals" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Approvals'); }}>
          <View style={styles.approvalLink}>
            <View style={styles.approvalLeft}>
              <View style={styles.approvalIcon}>
                <Ionicons name="shield-checkmark-outline" size={20} color={Theme.primary} />
              </View>
              <View>
                <Text style={styles.approvalLinkTitle}>Approvals Queue</Text>
                <Text style={styles.approvalLinkSub}>
                  {pendingCount > 0 ? `${pendingCount} pending approval${pendingCount > 1 ? 's' : ''}` : 'No pending approvals'}
                </Text>
              </View>
            </View>
            <View style={styles.approvalRight}>
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={Theme.textDim} />
            </View>
          </View>
        </Hintable>

        {/* Section: Tools */}
        <SectionHeader title="Tools" />
        <Animated.View style={[styles.card, { opacity: cardAnims[0].opacity, transform: [{ translateY: cardAnims[0].translateY }] }]}>
          <SettingsRow icon="construct-outline" label="Admin Builder" value="Manage tables, fields and analytics" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('AdminBuilder'); }} />
          <View style={styles.divider} />
          <SettingsRow icon="library-outline" label="Template Library" value="29 ready-made table structures" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('TemplateLibrary'); }} />
        </Animated.View>

        {/* Section: Business Profile */}
        <SectionHeader title="Business Profile" />
        <Animated.View style={[styles.card, { opacity: cardAnims[1].opacity, transform: [{ translateY: cardAnims[1].translateY }] }]}>
          <Hintable hintId="settings_biz" onPress={() => { setNameInput(activeBusiness?.name || ''); setEditingName(true); }}>
            {editingName ? (
              <View style={styles.inlineEditRow}>
                <View style={styles.rowIcon}><Ionicons name="business-outline" size={18} color={Theme.primary} /></View>
                <TextInput
                  style={styles.inlineInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  maxLength={60}
                />
                <TouchableOpacity onPress={handleSaveName} style={styles.inlineSave}>
                  <Ionicons name="checkmark" size={18} color={Theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingName(false)} style={styles.inlineCancel}>
                  <Ionicons name="close" size={18} color={Theme.textDim} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowIcon}><Ionicons name="business-outline" size={18} color={Theme.primary} /></View>
                  <View>
                    <Text style={styles.rowLabel}>Business Name</Text>
                    <Text style={styles.rowSub}>{activeBusiness?.name || 'Not set'}</Text>
                  </View>
                </View>
                <Ionicons name="create-outline" size={18} color={Theme.textDim} />
              </View>
            )}
          </Hintable>
          <View style={styles.divider} />
          <SettingsRow icon="grid-outline" label="Business Type" value={activeBusiness?.type || 'Not set'} onPress={() => Alert.alert('Business Type', 'To change your business type, reset everything and re-onboard.')} />
        </Animated.View>

        {/* Section: Team */}
        <SectionHeader title="Team" />
        <Animated.View style={[styles.card, { opacity: cardAnims[2].opacity, transform: [{ translateY: cardAnims[2].translateY }] }]}>
          <Hintable hintId="settings_join">
            {activeBusiness?.joinCode ? (
              <View style={styles.joinCodeRow}>
                <View style={styles.joinCodeLeft}>
                  <Text style={styles.joinCodeLabel}>Your Join Code</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <Text style={styles.joinCode}>
                      {joinCodeVisible ? activeBusiness.joinCode : '? ? ? ? ? ?'}
                    </Text>
                    <TouchableOpacity onPress={() => setJoinCodeVisible(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={joinCodeVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={Theme.textDim} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="lock-closed-outline" size={11} color={Theme.danger} />
                    <Text style={[styles.joinCodeSub, { color: Theme.danger, fontSize: 10 }]}>
                      {joinCodeVisible ? 'Keep this private � share only with trusted teammates' : 'Tap eye to reveal � keep this code private'}
                    </Text>
                  </View>
                  <Text style={styles.joinCodeSub}>Share with your team to let them join your business.</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => { Share.share({ message: 'LaunchEdge Join Code: ' + (activeBusiness.joinCode ?? ''), title: 'LaunchEdge Join Code' }); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-social-outline" size={18} color={Theme.primary} />
                  <Text style={styles.copyBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.joinCodeGenerateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.joinCodeLabel}>No Join Code Yet</Text>
                  <Text style={styles.joinCodeSub}>Generate a code to let teammates join your business.</Text>
                </View>
                <TouchableOpacity style={styles.generateBtn} onPress={() => requireTerms('joinCode')} activeOpacity={0.75}>
                  <Ionicons name="key-outline" size={16} color={Theme.primary} />
                  <Text style={styles.generateBtnText}>Generate Code</Text>
                </TouchableOpacity>
              </View>
            )}
          </Hintable>
        </Animated.View>

        {/* Section: Storage & Sync */}
        <SectionHeader title="Storage & Sync" />
        <Animated.View style={[styles.card, { opacity: cardAnims[3].opacity, transform: [{ translateY: cardAnims[3].translateY }] }]}>
          <View style={styles.storageStatus}>
            <View style={styles.storageLeft}>
              <Ionicons name={isCloudMode ? 'cloud-done-outline' : 'phone-portrait-outline'} size={22} color={isCloudMode ? Theme.success : Theme.textDim} />
              <View>
                <Text style={styles.storageMode}>{isCloudMode ? 'Google Drive Sync' : 'Local Storage'}</Text>
                <Text style={styles.storageEmail}>{isCloudMode ? activeBusiness?.googleEmail || 'Connected' : 'Data stored on this device only'}</Text>
              </View>
            </View>
          </View>
          {isCloudMode ? (
            <TouchableOpacity style={styles.dangerRow} onPress={handleDisconnectDrive}>
              <Ionicons name="cloud-offline-outline" size={18} color={Theme.danger} />
              <Text style={styles.dangerText}>Disconnect Google Drive</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.driveBtn} onPress={() => requireTerms('drive')}>
              <Ionicons name="logo-google" size={18} color={Theme.primary} />
              <Text style={styles.driveBtnText}>Connect Google Drive</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Section: Approvals */}
        <SectionHeader title="Approval Settings" />
        <Animated.View style={[styles.card, { opacity: cardAnims[4].opacity, transform: [{ translateY: cardAnims[4].translateY }] }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Require approval for new records</Text>
              <Text style={styles.toggleSub}>New entries go to queue before being saved</Text>
            </View>
            <Switch value={requireApprovalNew} onValueChange={setRequireApprovalNew} trackColor={{ false: Theme.border, true: Theme.primary }} thumbColor={Colors.ivory} />
          </View>
          <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: Theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Require approval for edits</Text>
              <Text style={styles.toggleSub}>Changes require your sign-off</Text>
            </View>
            <Switch value={requireApprovalEdit} onValueChange={setRequireApprovalEdit} trackColor={{ false: Theme.border, true: Theme.primary }} thumbColor={Colors.ivory} />
          </View>
        </Animated.View>

        {/* Section: Data */}
        <SectionHeader title="Data" />
        <Animated.View style={[styles.card, { opacity: cardAnims[5].opacity, transform: [{ translateY: cardAnims[5].translateY }] }]}>
          <Hintable hintId="settings_export" onPress={handleExportAll}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}><Ionicons name="download-outline" size={18} color={Theme.primary} /></View>
                <View><Text style={styles.rowLabel}>Export All Data</Text><Text style={styles.rowSub}>{exporting ? exportProgress || 'Preparing...' : 'Download all tables as CSV files'}</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.textDim} />
            </View>
          </Hintable>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.dangerRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={Theme.danger} />
            <Text style={styles.dangerText}>Log out / switch business</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <Hintable hintId="settings_reset" onPress={handleResetEverything}>
            <View style={styles.dangerRow}>
              <Ionicons name="refresh-outline" size={18} color={Theme.danger} />
              <Text style={styles.dangerText}>Reset Everything & Start Fresh</Text>
            </View>
          </Hintable>
        </Animated.View>

        {/* Section: Help & Support */}
        <SectionHeader title="Help & Support" />
        <Animated.View style={[styles.card, { opacity: cardAnims[5].opacity, transform: [{ translateY: cardAnims[5].translateY }] }]}>
          <SettingsRow icon="chatbubble-ellipses-outline" label="AI Copilot" value="Ask questions about your data" onPress={() => navigation.navigate('Copilot')} />
          <View style={styles.divider} />
          <SettingsRow icon="document-text-outline" label="Feedback Form" value="Share feedback or report issues" onPress={() => Linking.openURL(FORM_URL)} />
          <View style={styles.divider} />
          <SettingsRow icon="mail-outline" label="Email Support" value={SUPPORT_EMAIL} onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL)} />
          <View style={styles.divider} />
          <SettingsRow icon="call-outline" label="Call Support" value={'+91 ' + SUPPORT_PHONE} onPress={() => Linking.openURL('tel:+91' + SUPPORT_PHONE)} />
        </Animated.View>

        {/* Section: About */}
        <SectionHeader title="About" />
        <Animated.View style={[styles.card, { opacity: cardAnims[6].opacity, transform: [{ translateY: cardAnims[6].translateY }] }]}>
          <SettingsRow icon="information-circle-outline" label="Version" value="1.0.0" />
          <View style={styles.divider} />
          <SettingsRow icon="shield-outline" label="Privacy Policy" value="How we handle your data" onPress={() => navigation.navigate('PrivacyPolicy')} />
          <View style={styles.divider} />
          <SettingsRow icon="document-text-outline" label="Terms of Service" value="Usage terms and conditions" onPress={() => navigation.navigate('Terms')} />
          <View style={styles.divider} />
          <SettingsRow icon="star-outline" label="Rate the App" value="" onPress={() => Alert.alert('Rate', 'App store listing coming soon.')} />
        </Animated.View>

        <View style={{ height: Spacing.xxl * 2 }} />
      </ScrollView>

      {/* Terms & Conditions Gate Modal */}
      <Modal visible={showTermsGate} transparent animationType="fade">
        <View style={styles.gateOverlay}>
          <View style={styles.gateCard}>
            <Ionicons name="shield-checkmark-outline" size={36} color={Theme.primary} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.gateTitle}>Before you continue</Text>
            <Text style={styles.gateBody}>
              To use this feature you need to review and accept our Terms of Service and Privacy Policy.
            </Text>
            <View style={styles.gateLinkRow}>
              <TouchableOpacity onPress={() => { setShowTermsGate(false); navigation.navigate('Terms'); }}>
                <Text style={styles.gateLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.gateDot}>�</Text>
              <TouchableOpacity onPress={() => { setShowTermsGate(false); navigation.navigate('PrivacyPolicy'); }}>
                <Text style={styles.gateLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.gateAcceptBtn} onPress={handleAcceptTerms} activeOpacity={0.8}>
              <Text style={styles.gateAcceptText}>I Accept � Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTermsGate(false)} style={{ marginTop: Spacing.md }}>
              <Text style={styles.gateCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Local helper styles for SettingsRow (since it's a local component now)
const sh = StyleSheet.create({
  sectionHeader: { ...Typography.labelCaps, color: Theme.textSecondary, paddingHorizontal: Spacing.lg, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Theme.primaryLight, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  rowSub: { ...Typography.bodyS, color: Theme.textSecondary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.background },
  heroImage: { width: '100%', height: 180 },
  content: { paddingBottom: Spacing.xxl },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  pageTitle: { ...Typography.displayM, color: Theme.textPrimary },
  pageSub: { ...Typography.bodyS, color: Theme.textSecondary },

  approvalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Theme.border,
    padding: Spacing.lg,
  },
  approvalLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  approvalIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Theme.primaryLight, justifyContent: 'center', alignItems: 'center' },
  approvalLinkTitle: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  approvalLinkSub: { ...Typography.bodyS, color: Theme.textSecondary },
  approvalRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { backgroundColor: Theme.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: Colors.ivory, fontSize: 11, fontFamily: 'DMSans_600SemiBold' },

  card: { marginHorizontal: Spacing.lg, backgroundColor: Theme.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border, overflow: 'hidden', marginBottom: Spacing.xs },
  divider: { height: 1, backgroundColor: Theme.border, marginLeft: Spacing.lg + 32 + Spacing.md },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Theme.primaryLight, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  rowSub: { ...Typography.bodyS, color: Theme.textSecondary },

  inlineEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg },
  inlineInput: { flex: 1, ...Typography.bodyM, color: Theme.textPrimary, borderBottomWidth: 1, borderBottomColor: Theme.primary, paddingBottom: 2 },
  inlineSave: { padding: Spacing.sm },
  inlineCancel: { padding: Spacing.sm },

  joinCodeRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  joinCodeLeft: { flex: 1 },
  joinCodeLabel: { ...Typography.label, color: Theme.textSecondary, marginBottom: 4 },
  joinCode: { ...Typography.mono, color: Theme.primary, fontSize: 22, letterSpacing: 4 },
  joinCodeSub: { ...Typography.bodyS, color: Theme.textDim, marginTop: 4 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Theme.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Theme.border },
  copyBtnText: { ...Typography.label, color: Theme.primary },

  joinCodeGenerateRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Theme.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Theme.border },
  generateBtnText: { ...Typography.label, color: Theme.primary, fontSize: 12 },

  storageStatus: { padding: Spacing.lg },
  storageLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  storageMode: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  storageEmail: { ...Typography.bodyS, color: Theme.textSecondary },

  driveBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, margin: Spacing.lg, marginTop: 0, backgroundColor: Theme.primaryLight, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Theme.border, justifyContent: 'center' },
  driveBtnText: { ...Typography.label, color: Theme.primary },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  dangerText: { ...Typography.bodyM, color: Theme.danger, fontFamily: 'DMSans_500Medium' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  toggleLabel: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  toggleSub: { ...Typography.bodyS, color: Theme.textSecondary },
  gateOverlay: { flex: 1, backgroundColor: 'rgba(12,11,9,0.72)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  gateCard: { backgroundColor: Theme.background, borderRadius: Radius.xl, padding: Spacing.xxl, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: Theme.border },
  gateTitle: { ...Typography.headingM, color: Theme.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  gateBody: { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 22 },
  gateLinkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  gateLink: { ...Typography.bodyM, color: Theme.primary, textDecorationLine: 'underline' },
  gateDot: { ...Typography.bodyM, color: Theme.textDim },
  gateAcceptBtn: { backgroundColor: Theme.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, width: '100%', alignItems: 'center' },
  gateAcceptText: { ...Typography.headingS, color: Colors.ivory },
  gateCancelText: { ...Typography.bodyM, color: Theme.textDim },
});



