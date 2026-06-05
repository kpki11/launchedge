// src/screens/TodayScreen.tsx
// v2.1 — Fix: TutorialToggleButton moved OUTSIDE of Hintable so Exit Help works on this screen.
//         The Hintable absoluteFill overlay was intercepting all taps (including the toggle button).
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Image, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { TutorialToggleButton, Hintable } from '../components/TutorialOverlay';
import { Typography, Spacing, Radius } from '../theme/typography';
import { KPICard } from '../components/KPICard';
import { SyncBadge } from '../components/SyncBadge';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import { getRecentAuditLog, getTables, getTableFields, getRecords, getTableAnalyticsConfig } from '../services/database';
import { ParticleField, GlowOrb } from '../components/ParticleField';
import { getGreeting, formatCurrency, formatRelativeTime } from '../utils/formatters';

export default function TodayScreen({ navigation }: any) {
  const { activeBusiness } = useBusinessStore();
  const { tables, loadTables } = useTableStore();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiData, setKpiData] = useState({ todaySales: 0, receivables: 0, lowStock: 0 });

  const loadData = useCallback(async () => {
    if (!activeBusiness?.id) return;
    await loadTables(activeBusiness.id);
    const log = await getRecentAuditLog(activeBusiness.id, 5);
    setRecentActivity(log);
  }, [activeBusiness?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadKPIs(); }, [activeBusiness?.id]);

  // Android hardware back → return to previous screen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) { navigation.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadKPIs = async () => {
    if (!activeBusiness?.id) return;
    try {
      setKpiLoading(true);
      const allTables = await getTables(activeBusiness.id);
      const today = new Date().toISOString().slice(0, 10);
      let todaySales = 0, receivables = 0, lowStock = 0;
      for (const t of allTables) {
        const cfg = await getTableAnalyticsConfig(t.id);
        if (!cfg || cfg.analyticsRole === 'none') continue;
        const records = await getRecords(t.id);
        if (cfg.analyticsRole === 'revenue' && cfg.primaryAmountField) {
          for (const rec of records) {
            try {
              const d = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data;
              if (cfg.primaryDateField) {
                const dateVal = String(d?.[cfg.primaryDateField] ?? '');
                if (!dateVal.startsWith(today)) continue;
              }
              const v = parseFloat(d?.[cfg.primaryAmountField] ?? 0);
              if (!isNaN(v)) todaySales += v;
            } catch {}
          }
        }
        if (cfg.analyticsRole === 'expense' && cfg.primaryAmountField) {
          for (const rec of records) {
            try {
              const d = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data;
              if (cfg.primaryDateField) {
                const dateVal = String(d?.[cfg.primaryDateField] ?? '');
                if (!dateVal.startsWith(today)) continue;
              }
              const v = parseFloat(d?.[cfg.primaryAmountField] ?? 0);
              if (!isNaN(v)) receivables += v;
            } catch {}
          }
        }
        if (cfg.analyticsRole === 'inventory' && cfg.primaryAmountField) {
          for (const rec of records) {
            try {
              const d = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data;
              const qty = parseFloat(d?.[cfg.primaryAmountField] ?? 0);
              const reorder = parseFloat(d?.[cfg.reorderField] ?? 0);
              if (!isNaN(qty) && !isNaN(reorder) && reorder > 0 && qty < reorder) lowStock++;
            } catch {}
          }
        }
      }
      setKpiData({ todaySales, receivables, lowStock });
    } catch (e) {
      console.warn('TodayScreen KPI load error:', e);
    } finally {
      setKpiLoading(false);
    }
  };

  // Animation hooks
  const greetAnim = useRef({ opacity: new Animated.Value(0), translateY: new Animated.Value(-16) }).current;
  const kpiScale  = useRef(new Animated.Value(0)).current;
  const listAnim  = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(greetAnim.opacity,    { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(greetAnim.translateY, { toValue: 0, duration: 420, useNativeDriver: true }),
      Animated.timing(kpiScale,             { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
      Animated.timing(listAnim,             { toValue: 1, duration: 400, delay: 300, useNativeDriver: true }),
    ]).start();
    const pulse = () => {
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.18, duration: 1800, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1.00, duration: 1800, useNativeDriver: true }),
      ]).start(() => pulse());
    };
    pulse();
  }, []);

  const totalRecords = tables.reduce((sum: number, t: any) => sum + (t.recordCount || 0), 0);

  return (
    <SafeAreaView style={styles.root}>
      {/* Background particles */}
      <ParticleField variant="full" count={12} height={1400} />
      <GlowOrb x={-30} y={200} size={180} color="rgba(196,150,58,0.09)" />
      <GlowOrb x={210} y={700} size={160} color="rgba(196,150,58,0.08)" />

      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name='chevron-back' size={22} color={Colors.ivory} />
        <Text style={styles.backBtnText}>Home</Text>
      </TouchableOpacity>

      {/* ── Header strip ────────────────────────────────────────────────
          IMPORTANT: TutorialToggleButton must NOT be inside the <Hintable>.
          When tutorial mode is on, Hintable renders an absoluteFill overlay
          that intercepts ALL child taps — the Exit Help button would never fire.
          Solution: wrap only the greeting text in Hintable; render
          TutorialToggleButton as a sibling outside it.
      ──────────────────────────────────────────────────────────────── */}
      <View style={styles.headerWrap}>
        <Image
          source={require('../../assets/images/hero_warm_studio.jpeg')}
          style={styles.headerStrip}
          resizeMode="cover"
        />
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          {/* Greeting wrapped in Hintable — safe because TutorialToggleButton is outside */}
          <Hintable hintId="home_hero" style={styles.headerLeft}>
            <Animated.View style={{
              opacity: greetAnim.opacity,
              transform: [{ translateY: greetAnim.translateY }],
            }}>
              <Text style={styles.greeting} numberOfLines={1}>
                {getGreeting(activeBusiness?.name || 'there')}
              </Text>
              <Text style={styles.tagline}>Everything important, right here.</Text>
            </Animated.View>
          </Hintable>
          {/* TutorialToggleButton is a direct sibling — NOT inside Hintable */}
          <View style={styles.headerRight}>
            <SyncBadge />
            <TutorialToggleButton />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.primary}
            colors={[Theme.primary]}
          />
        }
      >
        {/* KPI Grid 2x2 */}
        <Text style={styles.sectionLabel}>TODAY'S OVERVIEW</Text>
        <Hintable hintId="home_kpi_sales" style={styles.kpiGrid}>
          <Animated.View style={{ transform: [{ scale: kpiScale }] }}>
            <View style={styles.kpiRow}>
              <KPICard
                icon="cash-outline"
                label="Today's Sales"
                value={kpiLoading ? '...' : formatCurrency(kpiData.todaySales)}
                change={0}
                changeLabel="vs yesterday"
              />
              <KPICard
                icon="time-outline"
                label="Receivables"
                value={kpiLoading ? '...' : formatCurrency(kpiData.receivables)}
              />
            </View>
            <View style={styles.kpiRow}>
              <View style={{flex:1}}><KPICard
                icon="cube-outline"
                label="Low Stock"
                value={kpiLoading ? '...' : `${kpiData.lowStock} items`}
              /></View>
              <View style={{flex:1}}><KPICard
                icon="grid-outline"
                label="Total Records"
                value={`${totalRecords}`}
              /></View>
            </View>
          </Animated.View>
        </Hintable>

        {/* Quick Actions */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <Hintable
            hintId="home_quick_add"
            style={styles.actionCardWrapper}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Tables' })}
          >
            <View style={styles.actionCard}>
              <Ionicons name="add-circle-outline" size={24} color={Theme.primary} />
              <Text style={styles.actionLabel}>Add Entry</Text>
            </View>
          </Hintable>
          <Hintable
            hintId="home_quick_scan"
            style={styles.actionCardWrapper}
            onPress={() => navigation.navigate('ScanImport')}
          >
            <View style={styles.actionCard}>
              <Ionicons name="scan-outline" size={24} color={Theme.primary} />
              <Text style={styles.actionLabel}>Scan / Import</Text>
            </View>
          </Hintable>
          <Hintable
            hintId="home_quick_search"
            style={styles.actionCardWrapper}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Tables' })}
          >
            <View style={styles.actionCard}>
              <Ionicons name="search-outline" size={24} color={Theme.primary} />
              <Text style={styles.actionLabel}>Search Tables</Text>
            </View>
          </Hintable>
        </View>

        {/* Tables Summary */}
        <Hintable hintId="home_tables_row" style={{ alignSelf: 'flex-start' }}>
          <Text style={styles.sectionLabel}>YOUR TABLES ({tables.length})</Text>
        </Hintable>
        {tables.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="grid-outline" size={32} color={Theme.textDim} />
            <Text style={styles.emptyText}>No tables yet. Tap Tables below to create one.</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: listAnim }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableScrollContent}
            >
              {tables.slice(0, 6).map((t: any) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.tablePill}
                  onPress={() => navigation.navigate('TableDetail', { table: t })}
                >
                  <Ionicons name={(t.icon as any) || 'grid-outline'} size={20} color={Theme.primary} style={{ marginBottom: 4 }} />
                  <Text style={styles.tablePillName} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.tablePillCount}>{t.recordCount || 0}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Recent Activity */}
        <Hintable hintId="home_activity" style={{ alignSelf: 'flex-start' }}>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        </Hintable>
        {recentActivity.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="pulse-outline" size={32} color={Theme.textDim} />
            <Text style={styles.emptyText}>No activity yet. Start adding records!</Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {recentActivity.map((a: any, i: number) => (
              <View key={i} style={styles.activityRow}>
                <View style={styles.activityDot} />
                <View style={styles.activityBody}>
                  <Text style={styles.activityAction}>{a.action}</Text>
                  {a.details ? (
                    <Text style={styles.activityDetails} numberOfLines={1}>{a.details}</Text>
                  ) : null}
                </View>
                <Text style={styles.activityTime}>{formatRelativeTime(a.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, position: 'absolute', top: 52, left: 16, zIndex: 20, backgroundColor: 'rgba(12,11,9,0.35)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(250,248,243,0.18)' },
  backBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.ivory },
  root: { flex: 1, backgroundColor: Theme.background, position: 'relative', overflow: 'hidden' },

  // Header strip — image + overlay + content are siblings (NOT nested)
  headerWrap: { height: 120, overflow: 'hidden', position: 'relative' },
  headerStrip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,11,9,0.62)' },
  headerContent: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerLeft: { flex: 1, marginRight: Spacing.md },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  greeting: { ...Typography.headingL, color: Colors.ivory, marginBottom: 2 },
  tagline: { ...Typography.bodyS, color: 'rgba(250,248,243,0.72)' },

  scroll: { flex: 1 },
  sectionLabel: {
    ...Typography.labelCaps,
    color: Theme.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },

  // KPI grid
  kpiGrid: { paddingHorizontal: Spacing.sm },
  kpiRow: { flexDirection: 'row', gap: 8 },

  // Quick actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md },
  actionCardWrapper: { flex: 1 },
  actionCard: {
    flex: 1, backgroundColor: Theme.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Theme.border,
  },
  actionLabel: { ...Typography.label, color: Theme.textPrimary, textAlign: 'center' },

  // Tables
  tableScrollContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, flexDirection: 'row' },
  tablePill: {
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Theme.border, minWidth: 88,
  },
  tablePillName: { ...Typography.label, color: Theme.textPrimary, textAlign: 'center', marginBottom: 2 },
  tablePillCount: { ...Typography.mono, color: Theme.primary },

  // Empty state
  emptyBox: {
    alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm,
    marginHorizontal: Spacing.lg, backgroundColor: Theme.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border,
  },
  emptyText: { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center' },

  // Activity
  activityList: {
    marginHorizontal: Spacing.lg, backgroundColor: Theme.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border, overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.primary, marginTop: 6 },
  activityBody: { flex: 1 },
  activityAction: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  activityDetails: { ...Typography.bodyS, color: Theme.textSecondary },
  activityTime: { ...Typography.bodyS, color: Theme.textDim },
});
