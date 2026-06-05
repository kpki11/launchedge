// src/screens/DataCleaningScreen.tsx
// Bug 11 — Data Hygiene: view/fix null fields, trim whitespace, find duplicates.

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, ScrollView, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { getTables, getTableFields, getNullFieldRecords, trimRecordFields, bulkFillField, findDuplicates } from '../services/database';
import { ParticleField, GlowOrb } from '../components/ParticleField';

type TabKey = 'nullFields' | 'duplicates';

export default function DataCleaningScreen({ navigation }: any) {
  const { activeBusiness } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<TabKey>('nullFields');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Null-field state
  const [nullRecords, setNullRecords] = useState<any[]>([]);
  const [fixingAll, setFixingAll] = useState(false);

  // Duplicates state
  const [tables, setTables] = useState<any[]>([]);
  const [dupTableId, setDupTableId] = useState('');
  const [dupField, setDupField] = useState('');
  const [dupFields, setDupFields] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<{ key: string; records: any[] }[]>([]);
  const [searchingDups, setSearchingDups] = useState(false);

  // Fill modal
  const [fillModal, setFillModal] = useState(false);
  const [fillTableId, setFillTableId] = useState('');
  const [fillFieldName, setFillFieldName] = useState('');
  const [fillValue, setFillValue] = useState('');
  const [filling, setFilling] = useState(false);

  const loadNullRecords = useCallback(async () => {
    if (!activeBusiness?.id) return;
    try {
      const records = await getNullFieldRecords(activeBusiness.id);
      setNullRecords(records);
    } catch (e) {
      console.error('DataCleaning loadNullRecords:', e);
    }
  }, [activeBusiness?.id]);

  const loadTables = useCallback(async () => {
    if (!activeBusiness?.id) return;
    try {
      const t = await getTables(activeBusiness.id);
      setTables(t);
      if (t.length > 0 && !dupTableId) setDupTableId(t[0].id);
    } catch (e) { console.error('DataCleaning loadTables:', e); }
  }, [activeBusiness?.id]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([loadNullRecords(), loadTables()]).finally(() => setLoading(false));
  }, [loadNullRecords, loadTables]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadNullRecords(), loadTables()]);
    setRefreshing(false);
  };

  // When user picks a table for duplicate search, load its fields
  const onPickDupTable = async (tableId: string) => {
    setDupTableId(tableId);
    setDupField('');
    setDuplicates([]);
    try {
      const fields = await getTableFields(tableId);
      setDupFields(fields);
      if (fields.length > 0) setDupField(fields[0].name);
    } catch { setDupFields([]); }
  };

  const handleFindDuplicates = async () => {
    if (!dupTableId || !dupField) return;
    setSearchingDups(true);
    try {
      const dups = await findDuplicates(dupTableId, dupField);
      setDuplicates(dups);
      if (dups.length === 0) Alert.alert('No Duplicates', `No duplicate values found for "${dupField}".`);
    } catch (e) {
      Alert.alert('Error', 'Could not search for duplicates.');
    } finally {
      setSearchingDups(false);
    }
  };

  const handleTrimAll = async () => {
    Alert.alert(
      'Trim Whitespace',
      `Trim leading/trailing spaces in all ${nullRecords.length} affected records?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Trim All', onPress: async () => {
          setFixingAll(true);
          try {
            await Promise.all(nullRecords.map(r => trimRecordFields(r.recordId)));
            await loadNullRecords();
            Alert.alert('Done', 'Whitespace trimmed on all records.');
          } catch { Alert.alert('Error', 'Could not trim records.'); }
          finally { setFixingAll(false); }
        }},
      ]
    );
  };

  const openFillModal = (tableId: string, fieldName: string) => {
    setFillTableId(tableId);
    setFillFieldName(fieldName);
    setFillValue('');
    setFillModal(true);
  };

  const handleBulkFill = async () => {
    if (!fillValue.trim()) {
      Alert.alert('Enter Value', 'Please enter a value to fill empty fields.');
      return;
    }
    setFilling(true);
    try {
      const count = await bulkFillField(fillTableId, fillFieldName, fillValue.trim());
      setFillModal(false);
      await loadNullRecords();
      Alert.alert('Done', `Filled ${count} empty "${fillFieldName}" fields with "${fillValue.trim()}".`);
    } catch { Alert.alert('Error', 'Could not fill fields.'); }
    finally { setFilling(false); }
  };

  // Group null records by table + field
  const groupedByField: Record<string, { tableId: string; tableName: string; fieldName: string; count: number }> = {};
  for (const r of nullRecords) {
    for (const f of r.emptyFields) {
      const key = `${r.tableId}:${f}`;
      if (!groupedByField[key]) {
        groupedByField[key] = { tableId: r.tableId, tableName: r.tableName, fieldName: f, count: 0 };
      }
      groupedByField[key].count++;
    }
  }
  const fieldGroups = Object.values(groupedByField).sort((a, b) => b.count - a.count);

  const renderNullTab = () => (
    <>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{nullRecords.length}</Text>
          <Text style={styles.summaryLabel}>Records with gaps</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{fieldGroups.length}</Text>
          <Text style={styles.summaryLabel}>Field-table combos</Text>
        </View>
        <View style={styles.summaryDivider} />
        <TouchableOpacity style={styles.summaryItem} onPress={handleTrimAll} disabled={fixingAll || nullRecords.length === 0}>
          {fixingAll
            ? <ActivityIndicator size="small" color={Theme.primary} />
            : <Text style={[styles.summaryAction, nullRecords.length === 0 && { color: Theme.textDim }]}>Trim All</Text>
          }
          <Text style={styles.summaryLabel}>Whitespace</Text>
        </TouchableOpacity>
      </View>

      {fieldGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={52} color={Colors.success} />
          <Text style={styles.emptyTitle}>All Clean!</Text>
          <Text style={styles.emptyDesc}>No null or empty fields found across your tables.</Text>
        </View>
      ) : (
        <FlatList
          data={fieldGroups}
          keyExtractor={item => `${item.tableId}:${item.fieldName}`}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          renderItem={({ item }) => (
            <View style={styles.fieldCard}>
              <View style={styles.fieldCardLeft}>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{item.count}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>{item.fieldName}</Text>
                  <Text style={styles.tableName}>{item.tableName}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.fillBtn}
                onPress={() => openFillModal(item.tableId, item.fieldName)}
              >
                <Ionicons name="pencil-outline" size={13} color={Colors.ivory} />
                <Text style={styles.fillBtnText}>Fill</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </>
  );

  const renderDuplicatesTab = () => (
    <ScrollView contentContainerStyle={styles.listContent}>
      {/* Table picker */}
      <Text style={styles.inputLabel}>Table</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {tables.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, dupTableId === t.id && styles.chipActive]}
              onPress={() => onPickDupTable(t.id)}
            >
              <Text style={[styles.chipText, dupTableId === t.id && styles.chipTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Field picker */}
      {dupFields.length > 0 && (
        <>
          <Text style={styles.inputLabel}>Check field for duplicates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {dupFields.map((f: any) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.chip, dupField === f.name && styles.chipActive]}
                  onPress={() => setDupField(f.name)}
                >
                  <Text style={[styles.chipText, dupField === f.name && styles.chipTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <TouchableOpacity
        style={[styles.searchBtn, (!dupTableId || !dupField) && { opacity: 0.5 }]}
        onPress={handleFindDuplicates}
        disabled={searchingDups || !dupTableId || !dupField}
      >
        {searchingDups
          ? <ActivityIndicator size="small" color={Colors.ivory} />
          : <>
              <Ionicons name="search-outline" size={16} color={Colors.ivory} />
              <Text style={styles.searchBtnText}>Find Duplicates</Text>
            </>
        }
      </TouchableOpacity>

      {/* Results */}
      {duplicates.map((group, i) => (
        <View key={i} style={styles.dupGroup}>
          <View style={styles.dupGroupHeader}>
            <Ionicons name="copy-outline" size={14} color={Colors.gold} />
            <Text style={styles.dupGroupKey}>"{group.key}" — {group.records.length} records</Text>
          </View>
          {group.records.map((rec: any, j: number) => {
            const keys = Object.keys(rec.data || {}).slice(0, 3);
            return (
              <View key={j} style={styles.dupRecord}>
                <Text style={styles.dupRecordId}>{rec.id.slice(-10).toUpperCase()}</Text>
                <Text style={styles.dupRecordData} numberOfLines={1}>
                  {keys.map(k => `${k}: ${rec.data[k]}`).join(' · ')}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Background particles */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <ParticleField variant="full" count={14} height={1400} />
        <GlowOrb x={-30} y={20} size={150} color="rgba(196,150,58,0.09)" />
        <GlowOrb x="60%" y={60} size={110} color="rgba(196,150,58,0.08)" />
      </View>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Data Hygiene</Text>
          <Text style={styles.subtitle}>Find and fix null fields, trim whitespace, spot duplicates.</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['nullFields', 'duplicates'] as TabKey[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'nullFields' ? 'Null / Empty Fields' : 'Duplicates'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.primary} />
        </View>
      ) : activeTab === 'nullFields' ? (
        <FlatList
          data={[]}
          keyExtractor={() => 'placeholder'}
          renderItem={null}
          ListHeaderComponent={renderNullTab()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} />}
        />
      ) : (
        renderDuplicatesTab()
      )}

      {/* Fill modal */}
      <Modal visible={fillModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bulk Fill — {fillFieldName}</Text>
            <Text style={styles.modalDesc}>
              Enter a value to fill all empty "{fillFieldName}" cells in this table.
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter fill value…"
              placeholderTextColor={Theme.textDim}
              value={fillValue}
              onChangeText={setFillValue}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setFillModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={handleBulkFill} disabled={filling}>
                {filling
                  ? <ActivityIndicator size="small" color={Colors.ivory} />
                  : <Text style={styles.applyBtnText}>Fill Fields</Text>
                }
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

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Theme.border,
    backgroundColor: Theme.surface,
  },
  tab: {
    flex: 1, paddingVertical: Spacing.md, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Theme.primary },
  tabText:   { ...Typography.label, color: Theme.textSecondary },
  tabTextActive: { color: Theme.primary },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.surface,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border,
    paddingVertical: Spacing.md,
  },
  summaryItem:   { flex: 1, alignItems: 'center' },
  summaryValue:  { ...Typography.headingL, color: Theme.textPrimary },
  summaryAction: { ...Typography.headingL, color: Theme.primary },
  summaryLabel:  { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Theme.border },

  emptyState: {
    alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md, marginTop: Spacing.lg,
  },
  emptyTitle: { ...Typography.headingM, color: Theme.textPrimary },
  emptyDesc:  { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center', lineHeight: 22 },

  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxl },

  fieldCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Theme.border, padding: Spacing.md, gap: Spacing.md,
  },
  fieldCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  countBadge: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: 'rgba(196,150,58,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  countBadgeText: { ...Typography.headingS, color: Colors.gold },
  fieldName: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  tableName: { ...Typography.bodyS, color: Theme.textSecondary },
  fillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Theme.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  fillBtnText: { ...Typography.label, color: Colors.ivory, fontSize: 12 },

  inputLabel: { ...Typography.label, color: Theme.textSecondary, marginBottom: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.surface,
  },
  chipActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  chipText:   { ...Typography.label, color: Theme.textSecondary, fontSize: 12 },
  chipTextActive: { color: Colors.ivory },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Theme.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, marginBottom: Spacing.lg,
  },
  searchBtnText: { ...Typography.label, color: Colors.ivory },

  dupGroup: {
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Theme.border, marginBottom: Spacing.md, overflow: 'hidden',
  },
  dupGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(196,150,58,0.1)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  dupGroupKey: { ...Typography.label, color: Colors.gold },
  dupRecord:  { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Theme.border },
  dupRecordId:   { ...Typography.mono, fontSize: 10, color: Theme.textDim },
  dupRecordData: { ...Typography.bodyS, color: Theme.textSecondary },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,11,9,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Theme.background, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: 40,
  },
  modalTitle: { ...Typography.headingL, color: Theme.textPrimary, marginBottom: Spacing.xs },
  modalDesc:  { ...Typography.bodyM, color: Theme.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
  textInput: {
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    ...Typography.bodyM, color: Theme.textPrimary, backgroundColor: Theme.surface,
    marginBottom: Spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Theme.border, alignItems: 'center' },
  cancelBtnText: { ...Typography.label, color: Theme.textSecondary },
  applyBtn:  { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Theme.primary, alignItems: 'center' },
  applyBtnText: { ...Typography.label, color: Colors.ivory },
});
