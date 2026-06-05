// src/screens/TableDetailScreen.tsx
// v1.4: useFocusEffect — reloads records every time screen comes into focus (after edit/add/delete)
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { RecordRow } from '../components/RecordRow';
import { Header } from '../components/Header';
import { GoldButton } from '../components/GoldButton';
import { getRecords, getTableFields } from '../services/database';
import { formatRelativeTime } from '../utils/formatters';
import { ParticleField, GlowOrb } from '../components/ParticleField';

const STATUS_FILTERS = ['All', 'active', 'pending_approval', 'draft'];

const FILTER_LABELS: Record<string, string> = {
  All: 'All',
  active: 'Active',
  pending_approval: 'Pending',
  draft: 'Draft',
};

export default function TableDetailScreen({ route, navigation }: any) {
  const { table } = route.params;
  const [records, setRecords] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [recs, flds] = await Promise.all([
        getRecords(table.id),
        getTableFields(table.id),
      ]);
      // Ensure record.data is parsed from JSON string
      const parsedRecs = recs.map((r: any) => ({
        ...r,
        data: typeof r.data === 'string'
          ? (() => { try { return JSON.parse(r.data); } catch { return {}; } })()
          : (r.data || {}),
      }));
      setRecords(parsedRecs);
      setFields(flds);
    } catch (e) {
      console.error('TableDetail loadData:', e);
    }
  }, [table.id]);

  // Reload every time the screen comes into focus (after edit, add, delete, back-navigate)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = activeFilter === 'All'
    ? records
    : records.filter((r: any) => r.status === activeFilter);

  const getRecordPreview = (record: any) => {
    const data = record.data || {};
    const keys = Object.keys(data);
    return keys.length > 0 ? String(data[keys[0]]) : record.id;
  };

  const getRecordSecondary = (record: any) => {
    const data = record.data || {};
    const keys = Object.keys(data);
    return keys.length > 1 ? String(data[keys[1]]) : '';
  };

  const getRecordAmount = (record: any) => {
    const data = record.data || {};
    const currencyField = fields.find((f: any) => f.type === 'currency');
    if (currencyField && data[currencyField.name]) {
      return 'Rs. ' + data[currencyField.name];
    }
    return undefined;
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Background particles */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <ParticleField variant="full" count={14} height={1200} />
        <GlowOrb x={-30} y={100} size={180} color="rgba(196,150,58,0.09)" />
        <GlowOrb x={210} y={500} size={150} color="rgba(196,150,58,0.08)" />
      </View>
      <Header
        title={table.name}
        subtitle={`${records.length} records`}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'settings-outline', onPress: () => navigation.navigate('AdminBuilder', { autoSelectTableId: table.id, autoTab: 'analytics' }) }}
      />

      {/* Compact horizontal ScrollView filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersBar}
        contentContainerStyle={styles.filtersContent}
      >
        {STATUS_FILTERS.map(f => {
          const isActive = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {FILTER_LABELS[f]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Records list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={48} color={Theme.textDim} />
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptyDesc}>
            {activeFilter !== 'All'
              ? `No ${FILTER_LABELS[activeFilter]} records. Clear the filter to see all.`
              : 'Tap the button below to add your first record.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} />
          }
          renderItem={({ item }) => (
            <RecordRow
              id={item.id.slice(-6).toUpperCase()}
              primaryLabel={getRecordPreview(item)}
              secondaryLabel={getRecordSecondary(item)}
              amount={getRecordAmount(item)}
              status={item.status === 'active' ? undefined : item.status}
              date={formatRelativeTime(item.createdAt)}
              onPress={() => navigation.navigate('RecordDetail', { record: item, table, fields })}
            />
          )}
        />
      )}

      {/* Add Record FAB */}
      <View style={styles.fabRow}>
        <GoldButton
          label="+ Add Record"
          onPress={() => navigation.navigate('AddRecord', { table, fields })}
          size="lg"
          style={styles.fab}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },

  filtersBar: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    flexGrow: 0,
  },
  filtersContent: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.surface,
    alignSelf: 'flex-start',
  },
  filterChipActive: {
    backgroundColor: Theme.primary,
    borderColor: Theme.primary,
  },
  filterText: { ...Typography.label, color: Theme.textSecondary },
  filterTextActive: { color: Colors.ivory },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyTitle: { ...Typography.headingL, color: Theme.textPrimary },
  emptyDesc: {
    ...Typography.bodyM,
    color: Theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  fabRow: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    backgroundColor: Theme.background,
  },
  fab: { borderRadius: Radius.md },
});


