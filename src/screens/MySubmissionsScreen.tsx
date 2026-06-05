// src/screens/MySubmissionsScreen.tsx
// Bug 19 — Employee-facing "My Submissions" view.
// Shows all records submitted by the current user with Pending / Approved / Rejected status.

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { getMySubmissions } from '../services/database';
import { formatRelativeTime } from '../utils/formatters';

const STATUS_FILTERS = ['All', 'active', 'pending_approval', 'draft'];
const STATUS_LABELS: Record<string, string> = {
  All: 'All',
  active: 'Approved',
  pending_approval: 'Pending',
  draft: 'Draft',
};
const STATUS_COLORS: Record<string, string> = {
  active: Colors.success,
  pending_approval: Colors.gold,
  draft: '#888',
  deleted: Colors.danger,
};
const STATUS_ICONS: Record<string, string> = {
  active: 'checkmark-circle',
  pending_approval: 'time',
  draft: 'document-outline',
  deleted: 'close-circle',
};

export default function MySubmissionsScreen({ navigation }: any) {
  const { activeBusiness } = useBusinessStore();
  const submittedBy = activeBusiness?.name || 'Owner';

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const loadData = useCallback(async () => {
    if (!activeBusiness?.id) return;
    try {
      const recs = await getMySubmissions(activeBusiness.id, submittedBy, 100);
      setSubmissions(recs);
    } catch (e) {
      console.error('MySubmissions loadData:', e);
    }
  }, [activeBusiness?.id, submittedBy]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = activeFilter === 'All'
    ? submissions
    : submissions.filter(s => s.status === activeFilter);

  // Stats
  const pendingCount  = submissions.filter(s => s.status === 'pending_approval').length;
  const approvedCount = submissions.filter(s => s.status === 'active').length;
  const totalCount    = submissions.length;

  const getPreview = (item: any) => {
    const data = item.data || {};
    const keys = Object.keys(data);
    if (keys.length === 0) return item.id;
    const primary = String(data[keys[0]] ?? '').trim();
    const secondary = keys.length > 1 ? String(data[keys[1]] ?? '').trim() : '';
    return primary + (secondary ? ` · ${secondary}` : '');
  };

  const renderItem = ({ item }: any) => {
    const statusColor = STATUS_COLORS[item.status] ?? Theme.textDim;
    const statusIcon  = STATUS_ICONS[item.status] ?? 'help-circle';
    const preview     = getPreview(item);

    return (
      <View style={styles.card}>
        {/* Left accent bar by status */}
        <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />

        <View style={styles.cardBody}>
          {/* Table name + time */}
          <View style={styles.cardTopRow}>
            <View style={styles.tableTag}>
              <Ionicons name={(item.tableIcon as any) || 'grid-outline'} size={11} color={Theme.primary} />
              <Text style={styles.tableTagText} numberOfLines={1}>{item.tableName}</Text>
            </View>
            <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
          </View>

          {/* Record preview */}
          <Text style={styles.previewText} numberOfLines={2}>{preview}</Text>

          {/* Status badge */}
          <View style={styles.cardBottomRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '50' }]}>
              <Ionicons name={statusIcon as any} size={12} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.recordId}>{item.id.slice(-8).toUpperCase()}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Submissions</Text>
          <Text style={styles.subtitle}>Records you've submitted across all tables.</Text>
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.gold }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.success }]}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => {
          const isActive = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {STATUS_LABELS[f]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.primary} />
          <Text style={styles.loadingText}>Loading your submissions…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={52} color={Theme.textDim} />
          <Text style={styles.emptyTitle}>
            {activeFilter === 'All' ? 'No submissions yet' : `No ${STATUS_LABELS[activeFilter]} submissions`}
          </Text>
          <Text style={styles.emptyDesc}>
            {activeFilter === 'All'
              ? 'Records you add will appear here, including their approval status.'
              : 'Clear the filter to see all submissions.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border, gap: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Theme.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Theme.border,
  },
  title:    { ...Typography.headingL, color: Theme.textPrimary },
  subtitle: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 2 },

  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.surface,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border,
    paddingVertical: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...Typography.headingL, color: Theme.textPrimary },
  statLabel: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Theme.border },

  filterRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Theme.border,
    backgroundColor: Theme.surface,
  },
  filterChipActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  filterText:       { ...Typography.label, color: Theme.textSecondary, fontSize: 12 },
  filterTextActive: { color: Colors.ivory },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },

  card: {
    flexDirection: 'row',
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Theme.border,
    overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md },

  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.xs,
  },
  tableTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(196,150,58,0.10)', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tableTagText: { ...Typography.bodyS, color: Theme.primary, fontSize: 11 },
  timeText:     { ...Typography.bodyS, color: Theme.textDim },

  previewText: { ...Typography.bodyM, color: Theme.textPrimary, lineHeight: 20, marginBottom: Spacing.sm },

  cardBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1,
  },
  statusText: { ...Typography.labelCaps, fontSize: 10 },
  recordId:   { ...Typography.mono, fontSize: 9, color: Theme.textDim },

  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md,
  },
  loadingText: { ...Typography.bodyM, color: Theme.textSecondary },
  emptyTitle:  { ...Typography.headingM, color: Theme.textPrimary, textAlign: 'center' },
  emptyDesc:   { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center', lineHeight: 22 },
});
