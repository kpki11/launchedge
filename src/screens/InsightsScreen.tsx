// src/screens/InsightsScreen.tsx
// v3.0 � Full animations: header slide, KPI stagger, chart entrance, ParticleField, Help button
import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Modal, Platform, ImageBackground, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import {
  getRecords, getTableFields, getTables, getTableAnalyticsConfig,
  getUserCharts, saveUserChart, deleteUserChart,
} from '../services/database';
import { formatCurrency, parseFlexibleDate } from '../utils/formatters';
import AddChartSheet from '../components/AddChartSheet';
import { ParticleField, GlowOrb, CornerAccent } from '../components/ParticleField';
import { TutorialToggleButton, Hintable } from '../components/TutorialOverlay';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - Spacing.lg * 2 - Spacing.xl * 2;

type PresetKey = 'Today' | 'This Week' | 'This Month' | 'Custom';
const PRESETS: PresetKey[] = ['Today', 'This Week', 'This Month', 'Custom'];

function getPresetDates(preset: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'Today') {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { from: s, to: now };
  }
  if (preset === 'This Week') {
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    mon.setHours(0, 0, 0, 0);
    return { from: mon, to: now };
  }
  if (preset === 'This Month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: s, to: now };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

function fmtDate(d: Date) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

interface AnalyticsConfig {
  analyticsRole: string;
  primaryAmountField: string;
  primaryDateField: string;
  primaryLabelField?: string;
  secondaryGroupField?: string;
  reorderField?: string;
  targetAmount?: number;
}

interface KPI { icon: string; label: string; value: string; sub?: string; color: string }
interface AlertItem { icon: string; title: string; items: string[]; color: string }

function buildKPIs(
  tables: any[],
  allRecords: Record<string, any[]>,
  allFields: Record<string, any[]>,
  allConfigs: Record<string, AnalyticsConfig>,
  dateRange: { from: Date; to: Date }
): { kpis: KPI[]; alerts: AlertItem[] } {
  const kpis: KPI[] = [];
  const alerts: AlertItem[] = [];

  const totalRecs = Object.values(allRecords).reduce((s, arr) => s + arr.length, 0);
  kpis.push({ icon: 'grid-outline', label: 'Total Records', value: String(totalRecs), color: Colors.gold });

  const pendingRecs = Object.values(allRecords).flat().filter(r => r.status === 'pending_approval').length;
  if (pendingRecs > 0) {
    kpis.push({ icon: 'time-outline', label: 'Pending Approval', value: String(pendingRecs), color: Colors.info });
  }

  let totalRevenue = 0;
  let totalExpenses = 0;
  let hasRevenue = false;
  let hasExpense = false;

  for (const table of tables) {
    const cfg = allConfigs[table.id] ?? { analyticsRole: 'none', primaryAmountField: '', primaryDateField: '' };
    const { analyticsRole, primaryAmountField, primaryDateField, primaryLabelField, secondaryGroupField, reorderField, targetAmount } = cfg;

    if (analyticsRole === 'none' || !primaryAmountField) continue;

    const records = allRecords[table.id] || [];
    const fields  = allFields[table.id]  || [];

    const inRange = (r: any): boolean => {
      if (!primaryDateField) return true;
      const rawDate = r.data?.[primaryDateField] ?? r.createdAt;
      if (!rawDate) return false;
      const d = parseFlexibleDate(rawDate);
      return d !== null && d >= dateRange.from && d <= dateRange.to;
    };

    const rangeRecords = records.filter(inRange);

    if (analyticsRole === 'revenue') {
      const total = rangeRecords.reduce((sum, r) => sum + (parseFloat(r.data?.[primaryAmountField]) || 0), 0);
      totalRevenue += total;
      hasRevenue = true;
      let sub = `${rangeRecords.length} records`;
      if (targetAmount && targetAmount > 0) {
        const pct = Math.round((total / targetAmount) * 100);
        sub = `${rangeRecords.length} records � ${pct}% of ?${targetAmount.toLocaleString('en-IN')} target`;
      }
      kpis.push({ icon: 'trending-up-outline', label: `${table.name} Revenue`, value: formatCurrency(total), sub, color: Colors.success });
    }

    if (analyticsRole === 'expense') {
      const total = rangeRecords.reduce((sum, r) => sum + (parseFloat(r.data?.[primaryAmountField]) || 0), 0);
      totalExpenses += total;
      hasExpense = true;
      kpis.push({ icon: 'trending-down-outline', label: `${table.name} Expenses`, value: formatCurrency(total), sub: `${rangeRecords.length} records`, color: Colors.danger });
    }

    if (analyticsRole === 'inventory') {
      const reorderFieldObj = reorderField
        ? fields.find((f: any) => f.name === reorderField)
        : fields.find((f: any) => /reorder|minimum|min/i.test(f.name));
      const lowStock = records.filter((r: any) => {
        const stock = parseFloat(r.data?.[primaryAmountField]) || 0;
        const reorder = parseFloat(r.data?.[reorderFieldObj?.name || ''] || '10');
        return stock <= reorder;
      });
      kpis.push({ icon: 'cube-outline', label: `${table.name} � Low Stock`, value: String(lowStock.length), sub: `of ${records.length} items`, color: lowStock.length > 0 ? Colors.danger : Colors.success });
      if (lowStock.length > 0) {
        alerts.push({
          icon: 'warning-outline',
          title: `${table.name} � ${lowStock.length} items below reorder level`,
          items: lowStock.slice(0, 3).map((r: any) => `${r.data?.[fields[0]?.name] || r.id}: ${r.data?.[primaryAmountField]} left`),
          color: Colors.gold,
        });
      }
    }

    if (analyticsRole === 'people') {
      kpis.push({ icon: 'people-outline', label: table.name, value: String(records.length), sub: `${rangeRecords.length} added this period`, color: Colors.purple ?? Colors.gold });
    }
  }

  if (hasRevenue && hasExpense) {
    const grossProfit = totalRevenue - totalExpenses;
    kpis.splice(2, 0, {
      icon: grossProfit >= 0 ? 'trending-up-outline' : 'trending-down-outline',
      label: 'Gross Profit',
      value: formatCurrency(Math.abs(grossProfit)),
      sub: grossProfit >= 0 ? '? Profit' : '? Loss',
      color: grossProfit >= 0 ? Colors.success : Colors.danger,
    });
  }

  return { kpis, alerts };
}

function chartConfig(color: string) {
  return {
    backgroundColor: Theme.surface,
    backgroundGradientFrom: Theme.surface,
    backgroundGradientTo: Theme.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => color + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    labelColor: () => Theme.textDim,
    propsForDots: { r: '4', strokeWidth: '2', stroke: color },
    barPercentage: 0.6,
  };
}

export default function InsightsScreen({ navigation }: any) {
  const { activeBusiness } = useBusinessStore();
  const { tables } = useTableStore();
  const [preset, setPreset]         = useState<PresetKey>('This Month');
  const [dateRange, setDateRange]   = useState(getPresetDates('This Month'));
  const [allRecords, setAllRecords] = useState<Record<string, any[]>>({});
  const [allFields, setAllFields]   = useState<Record<string, any[]>>({});
  const [allConfigs, setAllConfigs] = useState<Record<string, AnalyticsConfig>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [freshTables, setFreshTables] = useState<any[]>([]);
  const [userCharts, setUserCharts] = useState<any[]>([]);
  const [showAddChart, setShowAddChart] = useState(false);
  const [chartMenuId, setChartMenuId] = useState<string | null>(null);

  // -- Animation refs ----------------------------------------------------------
  const headerSlide = useRef(new Animated.Value(-24)).current;
  const headerFade  = useRef(new Animated.Value(0)).current;
  const filterFade  = useRef(new Animated.Value(0)).current;
  const filterSlide = useRef(new Animated.Value(16)).current;
  const kpiAnims    = useRef(Array(12).fill(null).map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(18),
  }))).current;
  const chartFade   = useRef(new Animated.Value(0)).current;
  const chartSlide  = useRef(new Animated.Value(20)).current;

  // Custom date range picker state
  const [customModal, setCustomModal]   = useState(false);
  const [customFrom, setCustomFrom]     = useState<Date>(new Date());
  const [customTo, setCustomTo]         = useState<Date>(new Date());
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to'>('from');
  const [showPicker, setShowPicker]     = useState(false);

  const loadData = useCallback(async () => {
    if (!activeBusiness?.id) return;
    const ft = await getTables(activeBusiness.id);
    setFreshTables(ft);

    const recs: Record<string, any[]>           = {};
    const flds: Record<string, any[]>           = {};
    const cfgs: Record<string, AnalyticsConfig> = {};

    for (const t of ft) {
      const rawRecs = await getRecords(t.id);
      recs[t.id] = rawRecs.map((r: any) => ({
        ...r,
        data: typeof r.data === 'string'
          ? (() => { try { return JSON.parse(r.data); } catch { return {}; } })()
          : (r.data || {}),
      }));
      flds[t.id] = await getTableFields(t.id);
      cfgs[t.id] = await getTableAnalyticsConfig(t.id);
    }

    setAllRecords(recs);
    setAllFields(flds);
    setAllConfigs(cfgs);

    const charts = await getUserCharts(activeBusiness.id);
    setUserCharts(charts);
  }, [activeBusiness?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Entrance animations on mount
  useEffect(() => {
    // Header slides in from top
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();

    // Filter bar fades in slightly after
    Animated.parallel([
      Animated.timing(filterFade,  { toValue: 1, duration: 350, delay: 200, useNativeDriver: true }),
      Animated.timing(filterSlide, { toValue: 0, duration: 350, delay: 200, useNativeDriver: true }),
    ]).start();

    // KPI tiles stagger in
    Animated.stagger(60, kpiAnims.map(a =>
      Animated.parallel([
        Animated.timing(a.opacity,    { toValue: 1, duration: 300, delay: 350, useNativeDriver: true }),
        Animated.timing(a.translateY, { toValue: 0, duration: 300, delay: 350, useNativeDriver: true }),
      ])
    )).start();

    // Chart section fades in last
    Animated.parallel([
      Animated.timing(chartFade,  { toValue: 1, duration: 350, delay: 600, useNativeDriver: true }),
      Animated.timing(chartSlide, { toValue: 0, duration: 350, delay: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePreset = (p: PresetKey) => {
    if (p === 'Custom') {
      setCustomFrom(dateRange.from);
      setCustomTo(dateRange.to);
      setCustomModal(true);
      return;
    }
    setPreset(p);
    setDateRange(getPresetDates(p));
  };

  const openPicker = (target: 'from' | 'to') => {
    setPickerTarget(target);
    setShowPicker(true);
  };

  const handlePickerChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (!selectedDate) return;
    if (pickerTarget === 'from') setCustomFrom(selectedDate);
    else setCustomTo(selectedDate);
  };

  const applyCustom = () => {
    const from = customFrom < customTo ? customFrom : customTo;
    const to   = customFrom < customTo ? customTo   : customFrom;
    setDateRange({ from, to });
    setPreset('Custom');
    setCustomModal(false);
  };

  const handleAddChart = async (chartData: {
    title: string;
    tableId: string;
    metricField: string;
    aggregation: string;
    dateField: string;
    chartType: 'line' | 'bar' | 'number';
  }) => {
    if (!activeBusiness?.id) return;
    const newChart = {
      id: `chart-${Date.now()}`,
      businessId: activeBusiness.id,
      tableId: chartData.tableId,
      title: chartData.title,
      chartType: chartData.chartType,
      metricField: chartData.metricField,
      aggregation: chartData.aggregation,
      dateField: chartData.dateField,
      groupField: '',
      sortOrder: userCharts.length,
    };
    await saveUserChart(newChart);
    setUserCharts(prev => [...prev, newChart]);
  };

  const handleDeleteChart = async (chartId: string) => {
    await deleteUserChart(chartId);
    setUserCharts(prev => prev.filter(c => c.id !== chartId));
    setChartMenuId(null);
  };

  const computeChartData = (chart: any): { labels: string[]; data: number[] } => {
    const records = allRecords[chart.tableId] || [];

    if (chart.chartType === 'line' && chart.dateField) {
      const dailyMap: Record<string, number> = {};
      records.forEach((r: any) => {
        const raw = r.data?.[chart.dateField];
        if (!raw) return;
        const d = parseFlexibleDate(raw);
        if (!d || d < dateRange.from || d > dateRange.to) return;
        const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const val = parseFloat(r.data?.[chart.metricField]) || 0;
        dailyMap[key] = (dailyMap[key] || 0) + val;
      });
      const sortedKeys = Object.keys(dailyMap).sort();
      return {
        labels: sortedKeys.length > 0 ? sortedKeys : ['No data'],
        data:   sortedKeys.length > 0 ? sortedKeys.map(k => dailyMap[k]) : [0],
      };
    }

    if (chart.chartType === 'bar' && chart.groupField) {
      const groupMap: Record<string, number> = {};
      records.forEach((r: any) => {
        const key = r.data?.[chart.groupField] || 'Other';
        const val = parseFloat(r.data?.[chart.metricField]) || 0;
        groupMap[key] = (groupMap[key] || 0) + val;
      });
      const sorted = Object.entries(groupMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
      return {
        labels: sorted.map(([k]) => k.substring(0, 8)),
        data:   sorted.map(([, v]) => v),
      };
    }

    const filteredRecords = records.filter((r: any) => {
      if (!chart.dateField) return true;
      const raw = r.data?.[chart.dateField];
      if (!raw) return true;
      const d = parseFlexibleDate(raw);
      return d && d >= dateRange.from && d <= dateRange.to;
    });
    const total = filteredRecords.reduce(
      (s: number, r: any) => s + (parseFloat(r.data?.[chart.metricField]) || 0), 0
    );
    return { labels: [chart.title], data: [total] };
  };

  const { kpis, alerts } = buildKPIs(
    freshTables.length > 0 ? freshTables : tables,
    allRecords, allFields, allConfigs, dateRange
  );
  const rangeLabel = `${fmtDate(dateRange.from)} � ${fmtDate(dateRange.to)}`;

  const anyConfigured = Object.values(allConfigs).some(c => c.analyticsRole !== 'none' && c.primaryAmountField);
  const firstUnconfigured = (freshTables.length > 0 ? freshTables : tables).find(
    (t: any) => !allConfigs[t.id]?.primaryAmountField || allConfigs[t.id]?.analyticsRole === 'none'
  );
  const displayTables = freshTables.length > 0 ? freshTables : tables;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Full-screen background particles */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <ParticleField variant="full" count={16} height={1400} />
        <GlowOrb x={-40} y={200} size={200} color="rgba(196,150,58,0.09)" />
        <GlowOrb x={220} y={700} size={170} color="rgba(196,150,58,0.08)" />
      </View>
      {/* Animated Hero Header with ParticleField */}
      <Animated.View style={[
        styles.headerWrap,
        { opacity: headerFade, transform: [{ translateY: headerSlide }] }
      ]}>
        <ImageBackground
          source={require('../../assets/images/bg_monument_clean.jpeg')}
          style={styles.headerBg}
          resizeMode="cover"
        >
          <View style={styles.headerOverlay} />
          {/* ParticleField visible over header image */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ParticleField variant="full" count={14} height={160} />
            <GlowOrb x={screenWidth - 120} y={10} size={100} color="rgba(196,150,58,0.15)" />
            <CornerAccent position="topRight" size={70} color="rgba(196,150,58,0.20)" />
          </View>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Insights</Text>
              <Text style={styles.tagline}>Numbers that tell you where to go next.</Text>
            </View>
            <TutorialToggleButton />
          </View>
        </ImageBackground>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} />}
      >
        {/* Animated date filter */}
        <Hintable hintId="insights_date">
        <Animated.View style={[styles.filterSection, { opacity: filterFade, transform: [{ translateY: filterSlide }] }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetBar}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.presetBtn, preset === p && styles.presetBtnActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handlePreset(p); }}
              >
                <Text style={[styles.presetText, preset === p && styles.presetTextActive]}>
                  {p === 'Custom' && preset === 'Custom' ? 'Custom ?' : p}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.rangePill}>
            <Ionicons name="calendar-outline" size={12} color={Theme.textDim} />
            <Text style={styles.rangeText}>{rangeLabel}</Text>
          </View>
        </Animated.View>
        </Hintable>

        {/* Setup nudge */}
        {displayTables.length > 0 && !anyConfigured && (
          <View style={styles.setupNudge}>
            <Ionicons name="settings-outline" size={20} color={Colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeTitle}>Configure Analytics</Text>
              <Text style={styles.nudgeDesc}>
                Go to Admin Builder ? select a table ? tap the Analytics tab to set up revenue, expense, or inventory tracking.
              </Text>
            </View>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('AdminBuilder', { autoSelectTableId: firstUnconfigured?.id }); }}>
              <Text style={styles.nudgeLink}>Set up ?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* KEY METRICS � animated stagger */}
        {kpis.length === 0 ? (
          <Hintable hintId="insights_charts">
            <View style={styles.emptySection}>
              <Ionicons name="bar-chart-outline" size={40} color={Theme.textDim} />
              <Text style={styles.emptyTitle}>No data yet</Text>
              <Text style={styles.emptyDesc}>Add records to your tables to see KPIs and charts here.</Text>
            </View>
          </Hintable>
        ) : (
          <>
            <Text style={styles.sectionLabel}>KEY METRICS</Text>
            <View style={styles.kpiGrid}>
              {kpis.map((kpi, i) => (
                <Animated.View key={i} style={[
                  styles.kpiCard,
                  {
                    opacity: kpiAnims[Math.min(i, kpiAnims.length - 1)].opacity,
                    transform: [{ translateY: kpiAnims[Math.min(i, kpiAnims.length - 1)].translateY }],
                  }
                ]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: kpi.color + '20' }]}>
                    <Ionicons name={kpi.icon as any} size={20} color={kpi.color} />
                  </View>
                  <Text style={styles.kpiValue} numberOfLines={1}>{kpi.value}</Text>
                  <Text style={styles.kpiLabel} numberOfLines={2}>{kpi.label}</Text>
                  {kpi.sub ? <Text style={styles.kpiSub}>{kpi.sub}</Text> : null}
                </Animated.View>
              ))}
            </View>
          </>
        )}

        {/* ALERTS */}
        {alerts.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ALERTS</Text>
            {alerts.map((alert, i) => (
              <Hintable key={i} hintId="insights_alerts">
                <View style={[styles.alertCard, { borderLeftColor: alert.color }]}>
                  <View style={styles.alertHeader}>
                    <Ionicons name={alert.icon as any} size={16} color={alert.color} />
                    <Text style={[styles.alertTitle, { color: alert.color }]}>{alert.title}</Text>
                  </View>
                  {alert.items.map((item, j) => (
                    <Text key={j} style={styles.alertItem}>� {item}</Text>
                  ))}
                </View>
              </Hintable>
            ))}
          </>
        )}

        {/* USER-CONTROLLED CHARTS � animated entrance */}
        <Animated.View style={{ opacity: chartFade, transform: [{ translateY: chartSlide }] }}>
          <View style={styles.chartSectionHeader}>
            <Text style={styles.sectionLabel}>YOUR CHARTS</Text>
            <Hintable hintId="insights_charts" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAddChart(true); }}>
              <View style={styles.addChartBtn}>
                <Ionicons name="add" size={16} color={Theme.primary} />
                <Text style={styles.addChartBtnText}>Add chart</Text>
              </View>
            </Hintable>
          </View>

          {userCharts.length === 0 ? (
            <TouchableOpacity
              style={styles.addChartEmptyCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAddChart(true); }}
              activeOpacity={0.75}
            >
              <Ionicons name="bar-chart-outline" size={32} color={Theme.textDim} />
              <Text style={styles.addChartEmptyTitle}>No charts yet</Text>
              <Text style={styles.addChartEmptySub}>
                Tap "+ Add chart" to create your first chart from any table.
              </Text>
            </TouchableOpacity>
          ) : (
            userCharts.map((chart) => {
              const { labels, data } = computeChartData(chart);
              const validData = data.map((v: number) => (isNaN(v) ? 0 : v));
              const isNumber = chart.chartType === 'number';
              const total = validData.reduce((s: number, v: number) => s + v, 0);

              return (
                <View key={chart.id} style={styles.chartCard}>
                  <View style={styles.chartCardHeader}>
                    <Text style={styles.chartTitle} numberOfLines={1}>{chart.title}</Text>
                    <TouchableOpacity
                      onPress={() => setChartMenuId(chartMenuId === chart.id ? null : chart.id)}
                      style={styles.chartMenuBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={Theme.textDim} />
                    </TouchableOpacity>
                  </View>

                  {chartMenuId === chart.id && (
                    <View style={styles.chartMenu}>
                      <TouchableOpacity
                        style={styles.chartMenuItem}
                        onPress={() => handleDeleteChart(chart.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color={Theme.danger} />
                        <Text style={[styles.chartMenuItemText, { color: Theme.danger }]}>Delete chart</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isNumber && (
                    <View style={styles.bigNumberContainer}>
                      <Text style={styles.bigNumber}>{formatCurrency(total)}</Text>
                      <Text style={styles.bigNumberSub}>{chart.metricField} � all time</Text>
                    </View>
                  )}

                  {chart.chartType === 'line' && labels.length > 1 && (
                    <LineChart
                      data={{ labels, datasets: [{ data: validData }] }}
                      width={CHART_WIDTH} height={180}
                      yAxisLabel="" yAxisSuffix=""
                      chartConfig={chartConfig(Colors.success)}
                      bezier style={styles.chartStyle} withInnerLines={false}
                    />
                  )}

                  {chart.chartType === 'bar' && labels.length > 0 && (
                    <BarChart
                      data={{ labels, datasets: [{ data: validData }] }}
                      width={CHART_WIDTH} height={180}
                      yAxisLabel="" yAxisSuffix=""
                      chartConfig={chartConfig(Colors.gold)}
                      style={styles.chartStyle} showValuesOnTopOfBars fromZero
                    />
                  )}

                  {!isNumber && labels.length <= 1 && (
                    <View style={styles.chartNoData}>
                      <Text style={styles.chartNoDataText}>No data in selected date range.</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </Animated.View>

        {/* TABLE ACTIVITY */}
        <Text style={styles.sectionLabel}>TABLE ACTIVITY</Text>
        {displayTables.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyDesc}>No tables created yet.</Text>
          </View>
        ) : (
          <View style={styles.tableActivity}>
            {displayTables.map((t: any) => {
              const cfg = allConfigs[t.id];
              const isConfigured = !!(cfg?.primaryAmountField && cfg?.analyticsRole !== 'none');
              const records = allRecords[t.id] || [];

              let sparkBars: number[] = [];
              if (isConfigured && cfg.primaryDateField && (cfg.analyticsRole === 'revenue' || cfg.analyticsRole === 'expense')) {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const dailyTotals: number[] = Array(7).fill(0);
                records.forEach((r: any) => {
                  const d = parseFlexibleDate(r.data?.[cfg.primaryDateField] ?? r.createdAt);
                  if (!d) return;
                  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
                  if (diffDays >= 0 && diffDays < 7) {
                    dailyTotals[6 - diffDays] += parseFloat(r.data?.[cfg.primaryAmountField]) || 0;
                  }
                });
                if (dailyTotals.filter((v: number) => v > 0).length >= 2) sparkBars = dailyTotals;
              }
              const maxSpark = sparkBars.length ? Math.max(...sparkBars, 1) : 1;

              const total = isConfigured && cfg.primaryAmountField
                ? records.reduce((s: number, r: any) => s + (parseFloat(r.data?.[cfg.primaryAmountField]) || 0), 0)
                : 0;

              const lowStock = isConfigured && cfg.analyticsRole === 'inventory'
                ? records.filter((r: any) => (parseFloat(r.data?.[cfg.primaryAmountField]) || 0) <= 10).length
                : 0;

              const hasRecords = records.length > 0;
              const silentZero = isConfigured && hasRecords && total === 0 && !!cfg.primaryDateField && cfg.analyticsRole !== 'inventory' && cfg.analyticsRole !== 'people';

              return (
                <View key={t.id} style={styles.tableRow}>
                  <TouchableOpacity
                    style={styles.tableRowInner}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('AdminBuilder', { autoSelectTableId: t.id }); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tableRowLeft}>
                      {t.icon && /[^\u0000-\u00FF]/.test(t.icon)
                        ? <Text style={{ fontSize: 16 }}>{t.icon}</Text>
                        : <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(196,150,58,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name={(t.icon as any) || 'grid-outline'} size={14} color={Theme.primary} />
                          </View>
                      }
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.tableRowName} numberOfLines={1}>{t.name}</Text>
                          {isConfigured && (
                            <View style={styles.roleBadge}>
                              <Text style={styles.roleBadgeText}>{cfg.analyticsRole}</Text>
                            </View>
                          )}
                        </View>
                        {isConfigured ? (
                          <Text style={styles.tableRowMeta}>
                            {cfg.analyticsRole === 'inventory'
                              ? `${records.length} items � ${lowStock > 0 ? '? ' + lowStock + ' low' : 'all ok'}`
                              : cfg.primaryDateField
                                ? `${records.length} records this period`
                                : `${records.length} records � no date filter`
                            }
                          </Text>
                        ) : (
                          <Text style={styles.tableRowMetaDim}>Not set up yet � tap to track in 30 sec</Text>
                        )}
                      </View>
                    </View>

                    {isConfigured ? (
                      <View style={styles.tableRowRight}>
                        {cfg.analyticsRole !== 'inventory' && cfg.analyticsRole !== 'people' && (
                          <>
                            <Text style={[styles.tableRowValue, cfg.analyticsRole === 'expense' && { color: '#e05c5c' }]}>
                              {formatCurrency(total)}
                            </Text>
                            {silentZero && (
                              <Text style={{ fontSize: 11, color: '#C4963A', marginTop: 2, textAlign: 'right' }}>
                                {'?'} Date filter showing ?0 � set Date Field to None
                              </Text>
                            )}
                          </>
                        )}
                        {sparkBars.length > 0 && (
                          <View style={styles.sparkline}>
                            {sparkBars.map((v: number, i: number) => (
                              <View
                                key={i}
                                style={[
                                  styles.sparkBar,
                                  { height: Math.max(3, Math.round((v / maxSpark) * 20)) },
                                  cfg.analyticsRole === 'expense' ? { backgroundColor: '#e05c5c' } : { backgroundColor: '#4caf88' },
                                ]}
                              />
                            ))}
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={14} color={Theme.textDim} style={{ marginLeft: 4 }} />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setupBtn}
                        onPress={() => navigation.navigate('AnalyticsWizard', { tableId: t.id, tableName: t.name })}
                      >
                        <Text style={styles.setupBtnText}>+ Set up</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Export */}
        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportBtn}>
            <Ionicons name="download-outline" size={16} color={Theme.primary} />
            <Text style={styles.exportBtnText}>Export Report</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <AddChartSheet
        visible={showAddChart}
        tables={displayTables}
        allFields={allFields}
        onAdd={handleAddChart}
        onClose={() => setShowAddChart(false)}
      />

      {/* Custom Date Range Modal */}
      <Modal visible={customModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Custom Date Range</Text>

            <Text style={styles.modalLabel}>From</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => openPicker('from')}>
              <View style={styles.datePickerBtnInner}>
                <Ionicons name="calendar-outline" size={18} color={Theme.primary} />
                <Text style={styles.datePickerBtnText}>{fmtDate(customFrom)}</Text>
                <Ionicons name="chevron-down" size={14} color={Theme.textDim} />
              </View>
            </TouchableOpacity>

            <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>To</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => openPicker('to')}>
              <View style={styles.datePickerBtnInner}>
                <Ionicons name="calendar-outline" size={18} color={Theme.primary} />
                <Text style={styles.datePickerBtnText}>{fmtDate(customTo)}</Text>
                <Ionicons name="chevron-down" size={14} color={Theme.textDim} />
              </View>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={pickerTarget === 'from' ? customFrom : customTo}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handlePickerChange}
                maximumDate={new Date()}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCustomModal(false); setShowPicker(false); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyCustom}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },
  headerWrap: { overflow: 'hidden' },
  headerBg: { overflow: 'hidden' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,11,9,0.52)' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196,150,58,0.20)',
    gap: Spacing.md,
  },
  title:   { ...Typography.displayM, color: Colors.ivory },
  tagline: { ...Typography.bodyS, color: 'rgba(250,248,243,0.72)' },

  filterSection: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  presetBar: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  presetBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.surface },
  presetBtnActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  presetText: { ...Typography.label, color: Theme.textSecondary, fontSize: 12 },
  presetTextActive: { color: Colors.ivory },
  rangePill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Theme.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: Theme.border, alignSelf: 'flex-start', marginBottom: Spacing.sm },
  rangeText: { ...Typography.bodyS, color: Theme.textDim },

  setupNudge: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.md, backgroundColor: 'rgba(196,150,58,0.09)', borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(196,150,58,0.30)', padding: Spacing.lg },
  nudgeTitle: { ...Typography.headingS, color: Colors.gold, marginBottom: 2 },
  nudgeDesc:  { ...Typography.bodyS, color: Theme.textSecondary, lineHeight: 18 },
  nudgeLink:  { ...Typography.label, color: Theme.primary, marginTop: Spacing.xs },

  sectionLabel: { ...Typography.labelCaps, color: Theme.textSecondary, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },

  emptySection: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md, marginHorizontal: Spacing.lg },
  emptyTitle: { ...Typography.headingM, color: Theme.textPrimary },
  emptyDesc:  { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center' },
  emptyBox: { marginHorizontal: Spacing.lg, padding: Spacing.lg, backgroundColor: Theme.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.sm },
  kpiCard: { width: '50%', padding: Spacing.sm },
  kpiIconWrap: { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  kpiValue: { ...Typography.headingL, color: Theme.textPrimary, marginBottom: 2 },
  kpiLabel: { ...Typography.bodyS, color: Theme.textSecondary, lineHeight: 18 },
  kpiSub:   { ...Typography.bodyS, color: Theme.textDim, marginTop: 2 },

  alertCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, backgroundColor: Theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Theme.border, borderLeftWidth: 4 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  alertTitle:  { ...Typography.headingS, flex: 1 },
  alertItem:   { ...Typography.bodyS, color: Theme.textSecondary, marginBottom: 2 },

  chartSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  addChartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderRadius: Radius.full, backgroundColor: Theme.surface,
    borderWidth: 1, borderColor: Theme.border,
  },
  addChartBtnText: { ...Typography.label, color: Theme.primary, fontFamily: 'DMSans_500Medium' },
  addChartEmptyCard: {
    marginHorizontal: Spacing.lg, padding: Spacing.xl,
    borderRadius: Radius.lg, backgroundColor: Theme.surface,
    borderWidth: 1.5, borderColor: Theme.border,
    borderStyle: 'dashed', alignItems: 'center', gap: 8,
  },
  addChartEmptyTitle: { ...Typography.headingS, color: Theme.textPrimary },
  addChartEmptySub: { ...Typography.bodyS, color: Theme.textSecondary, textAlign: 'center', maxWidth: 260 },

  chartCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Theme.border, overflow: 'hidden' },
  chartCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  chartTitle: { ...Typography.headingS, color: Theme.textPrimary, flex: 1 },
  chartMenuBtn: { padding: 4 },
  chartMenu: {
    position: 'absolute', right: Spacing.lg, top: 44, zIndex: 100,
    backgroundColor: Theme.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Theme.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, minWidth: 160,
  },
  chartMenuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  chartMenuItemText: { ...Typography.bodyM },
  chartStyle: { borderRadius: Radius.md, marginLeft: -Spacing.md },
  bigNumberContainer: { alignItems: 'center', paddingVertical: Spacing.xl },
  bigNumber: { fontFamily: 'DMSans_600SemiBold', fontSize: 36, color: Theme.textPrimary },
  bigNumberSub: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 4 },
  chartNoData: { paddingVertical: Spacing.xl, alignItems: 'center' },
  chartNoDataText: { ...Typography.bodyS, color: Theme.textDim },

  tableActivity: { marginHorizontal: Spacing.lg, backgroundColor: Theme.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Theme.border },
  tableRowInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  tableRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  tableRowName:  { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  tableRowRight: { flexDirection: 'row', alignItems: 'center' },
  tableRowMeta: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 1 },
  tableRowMetaDim: { ...Typography.bodyS, color: Theme.textDim, marginTop: 1 },
  tableRowValue: { ...Typography.headingS, color: Colors.success, marginRight: 4 },
  sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 22, marginRight: 4 },
  sparkBar: { width: 4, borderRadius: 2, backgroundColor: '#4caf88' },
  roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: 'rgba(196,150,58,0.15)' },
  roleBadgeText: { ...Typography.bodyS, color: Colors.gold, fontSize: 10, textTransform: 'capitalize' },
  setupBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: 'rgba(196,150,58,0.15)', borderWidth: 1, borderColor: 'rgba(196,150,58,0.30)' },
  setupBtnText: { ...Typography.label, color: Colors.gold, fontSize: 11 },

  exportRow: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center', borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md, paddingVertical: Spacing.md, backgroundColor: Theme.surface },
  exportBtnText: { ...Typography.label, color: Theme.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,11,9,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Theme.background, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: 40 },
  modalTitle: { ...Typography.headingL, color: Theme.textPrimary, marginBottom: Spacing.lg },
  modalLabel: { ...Typography.label, color: Theme.textSecondary, marginBottom: Spacing.xs },
  datePickerBtn: { borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md, backgroundColor: Theme.surface, marginBottom: Spacing.sm, overflow: 'hidden' },
  datePickerBtnInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  datePickerBtnText: { ...Typography.bodyM, color: Theme.textPrimary, flex: 1 },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Theme.border, alignItems: 'center' },
  cancelBtnText: { ...Typography.label, color: Theme.textSecondary },
  applyBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Theme.primary, alignItems: 'center' },
  applyBtnText: { ...Typography.label, color: Colors.ivory },
});

