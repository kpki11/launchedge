// src/screens/HomeScreen.tsx
// v4 ? ImageBackground hero, KPI stagger, Today shortcut, Hintable wraps, loading spinner
import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, Image, StyleSheet, ScrollView, TouchableOpacity,
  ImageBackground, Animated, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { KPICard } from '../components/KPICard';
import { ParticleField } from '../components/ParticleField';
import AddMetricSheet from '../components/AddMetricSheet';
import { TutorialToggleButton, Hintable } from '../components/TutorialOverlay';
import { useBusinessStore, PinnedMetric } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import { getTables, getTableFields, getRecords, getTableAnalyticsConfig, getRecentAuditLog } from '../services/database';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';

export default function HomeScreen({ navigation }: any) {
  const { activeBusiness, isOnboarded, pinnedMetrics, removePinnedMetric, addPinnedMetric } = useBusinessStore();
  const { tables, loadTables } = useTableStore();
  const showDashboard = isOnboarded && !!activeBusiness;
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiRevenue, setKpiRevenue] = useState(0);
  const [kpiExpenses, setKpiExpenses] = useState(0);
  const [kpiLowStock, setKpiLowStock] = useState(0);
  const [kpiPending, setKpiPending] = useState(0);
  const [editingKPIs, setEditingKPIs] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [allFields, setAllFields] = useState<Record<string, any[]>>({});
  const [allRecordsMap, setAllRecordsMap] = useState<Record<string, any[]>>({});
  const [hasRevenueCfg, setHasRevenueCfg] = useState(false);
  const [revHasDateField, setRevHasDateField] = useState(false);
  const [hasExpenseCfg, setHasExpenseCfg] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heroY    = useRef(new Animated.Value(24)).current;
  const kpiAnims = useRef(Array(4).fill(null).map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(20),
  }))).current;

  const loadDashboardData = useCallback(async () => {
    if (!activeBusiness?.id) return;
    await loadTables(activeBusiness.id);
    const allTables = await getTables(activeBusiness.id);
    const fieldsMap: Record<string, any[]> = {};
    const recordsMap: Record<string, any[]> = {};
    for (const t of allTables) {
      const [fields, records] = await Promise.all([getTableFields(t.id), getRecords(t.id)]);
      fieldsMap[t.id] = fields;
      recordsMap[t.id] = records;
    }
    setAllFields(fieldsMap);
    setAllRecordsMap(recordsMap);

    let revenue = 0, expenses = 0, lowStock = 0, pending = 0;
    let foundRevenue = false, foundExpense = false, revDate = false;

    for (const t of allTables) {
      const cfg = await getTableAnalyticsConfig(t.id);
      if (!cfg) continue;
      const records = recordsMap[t.id] || [];

      if (cfg.analyticsRole === 'revenue' && cfg.primaryAmountField) {
        foundRevenue = true;
        if (cfg.primaryDateField) revDate = true;
        const today = new Date().toISOString().slice(0, 10);
        for (const rec of records) {
          try {
            const d = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data;
            if (cfg.primaryDateField) {
              const dateVal = d?.[cfg.primaryDateField] ?? '';
              if (!String(dateVal).startsWith(today)) continue;
            }
            const v = parseFloat(d?.[cfg.primaryAmountField] ?? 0);
            if (!isNaN(v)) revenue += v;
          } catch {}
        }
      }

      if (cfg.analyticsRole === 'expense' && cfg.primaryAmountField) {
        foundExpense = true;
        const today = new Date().toISOString().slice(0, 10);
        for (const rec of records) {
          try {
            const d = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data;
            if (cfg.primaryDateField) {
              const dateVal = d?.[cfg.primaryDateField] ?? '';
              if (!String(dateVal).startsWith(today)) continue;
            }
            const v = parseFloat(d?.[cfg.primaryAmountField] ?? 0);
            if (!isNaN(v)) expenses += v;
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

      if (cfg.analyticsRole === 'approvals') {
        for (const rec of records) { if (rec.status === 'pending') pending++; }
      }
    }
    setKpiRevenue(revenue); setKpiExpenses(expenses); setKpiLowStock(lowStock); setKpiPending(pending);
    setHasRevenueCfg(foundRevenue); setHasExpenseCfg(foundExpense); setRevHasDateField(revDate);
    const log = await getRecentAuditLog(activeBusiness.id, 6);
    setRecentActivity(log);
    setKpiLoading(false);
  }, [activeBusiness?.id]);

  useFocusEffect(useCallback(() => { loadDashboardData(); }, [loadDashboardData]));

  useEffect(() => {
    if (!showDashboard) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(heroY,    { toValue: 0, duration: 420, useNativeDriver: true }),
      ...kpiAnims.map((a, i) => Animated.parallel([
        Animated.timing(a.opacity,    { toValue: 1, duration: 300, delay: 120 + i * 60, useNativeDriver: true }),
        Animated.spring(a.translateY, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }),
      ])),
    ]).start();
  }, [showDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // LOADING SPINNER (onboarded but activeBusiness not yet loaded)
  if (isOnboarded && !activeBusiness) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center', gap: Spacing.md }]} edges={['top']}>
        <ActivityIndicator color={Theme.primary} size='large' />
        <Text style={{ ...Typography.bodyM, color: Theme.textSecondary }}>Loading your business\u2026</Text>
      </SafeAreaView>
    );
  }

  if (!showDashboard) {
    return (
      <View style={{ flex: 1 }}>
        <ImageBackground
          source={require('../../assets/images/bg_monument_clean.jpeg')}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(12,11,9,0.55)', justifyContent: 'flex-end', padding: 28, paddingBottom: 60 }}>
            <Image source={require('../../assets/logo.png')} style={{ width: 42, height: 42, resizeMode: 'contain', marginBottom: 12 }} />
            <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 32, color: Colors.ivory, lineHeight: 38, marginBottom: 10 }}>
              {'Your business.\nYour data.\nYour rules.'}
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: 'rgba(250,248,243,0.78)', lineHeight: 22, marginBottom: 28 }}>
              Privacy-first operations app for Indian MSME owners.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }}>
              {['Privacy First','Works Offline','Your Data','Made in India'].map(b => (
                <View key={b} style={{ flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(196,150,58,0.22)', borderRadius:99, paddingHorizontal:14, paddingVertical:7, marginRight:8, borderWidth:1, borderColor:'rgba(196,150,58,0.35)' }}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={Colors.gold} />
                  <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:Colors.ivory }}>{b}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={{ backgroundColor: Theme.primary, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Onboarding'); }}
            >
              <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: Colors.ivory }}>Get Started</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.ivory} />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} />}
        >
          {/* -- HERO -------------------------------------------- */}
          <Animated.View style={{ transform: [{ translateY: heroY }] }}>
            <Hintable hintId='home_hero'>
              <ImageBackground
                source={require('../../assets/images/hero_warm_studio.jpeg')}
                style={styles.hero}
                imageStyle={styles.heroImage}
              >
                <View style={styles.heroOverlay}>
                  <View style={styles.heroTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroGreeting}>
                        {activeBusiness?.name ?? 'Dashboard'}
                      </Text>
                      <Text style={styles.heroSub}>
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </Text>
                    </View>
                    <TutorialToggleButton />
                  </View>
                  <TouchableOpacity
                    style={styles.todayBtn}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Today'); }}
                  >
                    <Ionicons name='today-outline' size={15} color={Colors.ivory} />
                    <Text style={styles.todayBtnText}>Today's View</Text>
                    <Ionicons name='chevron-forward' size={13} color='rgba(250,248,243,0.7)' />
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            </Hintable>
          </Animated.View>

          {/* -- KPI GRID ---------------------------------------- */}
          <View style={styles.dashboardContainer}>
            <ParticleField variant='full' count={8} height={400} />
            <View style={styles.kpiHeader}>
              <Text style={styles.sectionLabel}>KEY METRICS</Text>
              <Hintable hintId='home_edit_btn'>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingKPIs(e => !e)}
                >
                  <Ionicons name={editingKPIs ? 'checkmark-circle-outline' : 'pencil-outline'} size={16} color={Theme.primary} />
                  <Text style={styles.editBtnText}>{editingKPIs ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
              </Hintable>
            </View>

            {/* KPI skeleton ? shown while data loads */}
            {kpiLoading ? (
              <View style={styles.kpiRow}>
                {[0,1,2,3].map(idx => (
                  <View key={idx} style={[styles.kpiTileWrap, styles.kpiSkeleton]}>
                    <View style={styles.kpiSkeletonIcon} />
                    <View style={styles.kpiSkeletonVal} />
                    <View style={styles.kpiSkeletonNote} />
                  </View>
                ))}
              </View>
            ) : (
              <>
            {/* Unified KPI tiles ? built-ins use pre-computed values; custom ones compute from live data */}
            <View style={styles.kpiRow}>
              {pinnedMetrics.map((m: PinnedMetric, i: number) => {
                // -- Built-in tiles -----------------------------------------
                if (m.type === 'built-in') {
                  const BUILTIN_MAP: Record<string, { icon: string; label: string; value: string; note: string; hintId: string }> = {
                    sales:    { icon: 'cash-outline',          label: 'Revenue',   value: formatCurrency(kpiRevenue),  note: hasRevenueCfg ? (revHasDateField ? 'today' : 'all-time') : 'link a table', hintId: 'home_kpi_sales' },
                    expenses: { icon: 'trending-down-outline', label: 'Expenses',  value: formatCurrency(kpiExpenses), note: hasExpenseCfg ? 'today' : 'link a table', hintId: 'home_kpi_exp' },
                    lowstock: { icon: 'cube-outline',          label: 'Low Stock', value: `${kpiLowStock}`,            note: 'items below reorder',  hintId: 'home_kpi_stock' },
                    pending:  { icon: 'time-outline',          label: 'Pending',   value: `${kpiPending}`,             note: 'awaiting approval',    hintId: 'home_kpi_pending' },
                  };
                  const tile = BUILTIN_MAP[m.builtIn ?? ''];
                  if (!tile) return null;
                  return (
                    <Animated.View
                      key={m.id}
                      style={[styles.kpiTileWrap, {
                        opacity: kpiAnims[i]?.opacity ?? new Animated.Value(1),
                        transform: [{ translateY: kpiAnims[i]?.translateY ?? new Animated.Value(0) }],
                      }]}
                    >
                      <Hintable hintId={tile.hintId}>
                        <KPICard
                          icon={tile.icon} label={tile.label} value={tile.value} subNote={tile.note}
                          onRemove={editingKPIs ? () => removePinnedMetric(m.id) : undefined}
                        />
                      </Hintable>
                    </Animated.View>
                  );
                }

                // -- Custom tiles -------------------------------------------
                const tableRecs   = allRecordsMap[m.tableId ?? ''] ?? [];
                const tableFields = allFields[m.tableId ?? ''] ?? [];
                const valField    = tableFields.find((f: any) => f.name === m.fieldName);
                let total = 0;
                if (m.aggregation === 'count') {
                  total = tableRecs.length;
                } else if (m.aggregation === 'latest') {
                  const last = tableRecs[tableRecs.length - 1];
                  if (last) {
                    try { const d = typeof last.data === 'string' ? JSON.parse(last.data) : last.data; total = parseFloat(d?.[m.fieldName ?? ''] ?? 0) || 0; } catch {}
                  }
                } else {
                  // default: sum
                  for (const rec of tableRecs) {
                    try { const d = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data; const v = parseFloat(d?.[m.fieldName ?? ''] ?? 0); if (!isNaN(v)) total += v; } catch {}
                  }
                }
                const displayVal = valField && ['number','currency'].includes(valField.type) ? formatCurrency(total) : `${total}`;
                return (
                  <View key={m.id} style={styles.kpiTileWrap}>
                    <Hintable hintId={`home_kpi_custom_${m.id}`}>
                      <KPICard
                        icon={m.icon ?? 'stats-chart-outline'}
                        label={m.label ?? m.tableName ?? 'Metric'}
                        value={displayVal}
                        subNote={m.aggregation ?? 'sum'}
                        onRemove={editingKPIs ? () => removePinnedMetric(m.id) : undefined}
                      />
                    </Hintable>
                  </View>
                );
              })}
            </View>
            </>
            )}

            {editingKPIs && (
              <TouchableOpacity style={styles.addMetricBtn} onPress={() => setShowAddMetric(true)}>
                <Ionicons name='add-circle-outline' size={18} color={Theme.primary} />
                <Text style={styles.addMetricText}>Pin a Custom Metric</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* -- QUICK ACTIONS -------------------------------- */}
          <View style={styles.section}>
            <Hintable hintId='home_quick_actions' style={{ alignSelf: 'flex-start' }}>
              <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
            </Hintable>
            {/* True table-grid: cells share borders */}
            <View style={styles.quickGrid}>
              {([
                { icon: 'grid-outline',            label: 'Tables',       screen: 'MainTabs',    params: { screen: 'Tables' } },
                { icon: 'scan-outline',            label: 'Scan / Import',screen: 'ScanImport',  params: undefined },
                { icon: 'checkmark-done-outline',  label: 'Approvals',    screen: 'Approvals',   params: undefined },
                { icon: 'bar-chart-outline',       label: 'Insights',     screen: 'MainTabs',    params: { screen: 'Insights' } },
                { icon: 'hammer-outline',          label: 'Admin Builder',screen: 'AdminBuilder',params: undefined },
                { icon: 'sparkles-outline',        label: 'Analytics',    screen: 'AnalyticsWizard', params: undefined },
              ] as const).map((q, index) => (
                <Hintable key={q.label} hintId={`home_qa_${q.label.toLowerCase().replace(/[^a-z]/g,'_')}`} style={{ width: '33.33%' }}>
                  <TouchableOpacity
                    style={[
                      styles.quickCard,
                      (index + 1) % 3 === 0 && styles.quickCardNoRight,
                      index >= 3 && styles.quickCardNoBottom,
                    ]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(q.screen as any, q.params as any); }}
                  >
                    <Ionicons name={q.icon as any} size={22} color={Theme.primary} />
                    <Text style={styles.quickLabel}>{q.label}</Text>
                  </TouchableOpacity>
                </Hintable>
              ))}
            </View>
          </View>

          {/* -- RECENT ACTIVITY ------------------------------ */}
          {recentActivity.length > 0 && (
            <View style={styles.section}>
              <Hintable hintId='home_recent_activity' style={{ alignSelf: 'flex-start' }}>
                <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
              </Hintable>
              <View style={styles.activityList}>
                {recentActivity.map((item: any, i: number) => (
                  <View key={i} style={styles.activityRow}>
                    <View style={styles.activityDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityText} numberOfLines={1}>{item.details ? `${item.action}: ${item.details}` : item.action}</Text>
                      <Text style={styles.activityTime}>{formatRelativeTime(item.createdAt)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </Animated.View>

      <AddMetricSheet
        visible={showAddMetric}
        onClose={() => setShowAddMetric(false)}
        tables={tables}
        allFields={allFields}
        onAdd={(m: PinnedMetric) => { addPinnedMetric(m); setShowAddMetric(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Theme.background },
  flex:         { flex: 1 },
  scrollContent:{ paddingBottom: Spacing.xxl },

  // Hero
  hero:         { minHeight: 180, justifyContent: 'flex-end' },
  heroImage:    { resizeMode: 'cover' },
  heroOverlay: {
    flex: 1, padding: Spacing.lg, paddingBottom: Spacing.lg,
    backgroundColor: 'rgba(12,11,9,0.44)', justifyContent: 'space-between',
    minHeight: 180,
  },
  heroTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  heroGreeting: { fontFamily: 'DMSans_600SemiBold', fontSize: 20, color: Colors.ivory, lineHeight: 26 },
  heroSub:      { ...Typography.bodyS, color: 'rgba(250,248,243,0.75)', marginTop: 2 },
  todayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(196,150,58,0.28)', borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(196,150,58,0.40)',
    marginTop: Spacing.md,
  },
  todayBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.ivory },

  // Fallback
  getStartedBtn: {
    backgroundColor: Theme.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.lg,
  },
  getStartedText: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: Colors.ivory },

  // Dashboard container
  dashboardContainer: {
    position: 'relative', overflow: 'hidden',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },

  // KPI
  kpiHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, marginTop: Spacing.md },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Theme.primaryLight,
    backgroundColor: Theme.primaryLight,
  },
  editBtnText:  { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Theme.primary },
  kpiRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  kpiTileWrap:  { width: '47%' },
  kpiSkeleton:  { backgroundColor: Theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Theme.border, minHeight: 80, gap: Spacing.sm, justifyContent: 'center' },
  kpiSkeletonIcon: { width: 28, height: 28, borderRadius: Radius.md, backgroundColor: 'rgba(196,150,58,0.14)' },
  kpiSkeletonVal:  { width: '55%', height: 18, borderRadius: Radius.sm, backgroundColor: 'rgba(196,150,58,0.10)', marginTop: 4 },
  kpiSkeletonNote: { width: '38%', height: 10, borderRadius: Radius.sm, backgroundColor: 'rgba(196,150,58,0.07)', marginTop: 2 },
  addMetricBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Theme.primaryLight, backgroundColor: Theme.primaryLight, marginTop: Spacing.sm },
  addMetricText:{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: Theme.primary },

  // Sections
  section:      { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  sectionLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: Theme.textDim, letterSpacing: 1, marginBottom: Spacing.sm },

  // Quick actions � true table grid with shared borders between cells
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.lg,
    overflow: 'hidden', backgroundColor: Theme.surface,
  },
  quickCard: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Theme.surface,
    paddingVertical: Spacing.xl, paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: Theme.border,
  },
  quickCardNoRight:  { borderRightWidth: 0 },
  quickCardNoBottom: { borderBottomWidth: 0 },
  quickLabel: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Theme.textSecondary, textAlign: 'center' },

  // Recent activity
  activityList: { gap: Spacing.sm },
  activityRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  activityDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.primary, marginTop: 5 },
  activityText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Theme.textPrimary },
  activityTime: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Theme.textDim, marginTop: 2 },
});



