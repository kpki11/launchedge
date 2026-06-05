// src/screens/AdminBuilderScreen.tsx
// v7.0 — Fixed header JSX, proper animations: header slide-in, panel fade, ParticleField + GlowOrbs.
// v7.1 — Fixed openRelModal/closeRelModal infinite recursion. Added separate fieldModal spring animation.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Switch, Alert, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { EmptyStateIllustration } from '../components/EmptyStateIllustration';
import { TutorialToggleButton, Hintable } from '../components/TutorialOverlay';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import {
  getTables, createTable, getTableFields,
  renameTable, deleteTable, saveAnalyticsConfig,
  getTableRelationships, createTableRelationship, deleteTableRelationship,
} from '../services/database';
import { ParticleField, GlowOrb, CornerAccent } from '../components/ParticleField';

type FieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'link';
type TabKey = 'fields' | 'analytics' | 'relationships';

const ANALYTICS_ROLES = [
  { value: 'none',      label: 'None',      icon: 'remove-circle-outline',   desc: 'Not tracked in Insights' },
  { value: 'revenue',   label: 'Revenue',   icon: 'trending-up-outline',     desc: 'Sales, income, invoices' },
  { value: 'expense',   label: 'Expense',   icon: 'trending-down-outline',   desc: 'Costs, purchases, wages' },
  { value: 'inventory', label: 'Inventory', icon: 'cube-outline',            desc: 'Stock levels & reorder alerts' },
  { value: 'people',    label: 'People',    icon: 'people-outline',          desc: 'Staff, customers, vendors' },
];

interface FieldDraft {
  name: string; type: FieldType; isRequired: boolean; defaultValue: string; options: string;
}
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'currency', label: 'Currency (₹)' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'link',     label: 'Link' },
];
const DEFAULT_FIELD: FieldDraft = { name: '', type: 'text', isRequired: false, defaultValue: '', options: '' };

const uuidv4 = () => 'rel_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

export default function AdminBuilderScreen({ navigation, route }: any) {
  const { activeBusiness } = useBusinessStore();
  const { loadTables } = useTableStore();

  // -- Entrance animations --------------------------------------------------
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const panelFade   = useRef(new Animated.Value(0)).current;
  const panelSlide  = useRef(new Animated.Value(24)).current;

  const [tables,        setTables]        = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [fields,        setFields]        = useState<any[]>([]);
  const [activeTab,     setActiveTab]     = useState<TabKey>('fields');
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);

  // New table modal
  const [showNewTableModal, setShowNewTableModal] = useState(false);
  const [newTableName,      setNewTableName]      = useState('');
  const [creatingTable,     setCreatingTable]     = useState(false);

  // Rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue,     setRenameValue]     = useState('');

  // Add field modal
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldDraft,     setFieldDraft]     = useState<FieldDraft>(DEFAULT_FIELD);
  const [savingField,    setSavingField]    = useState(false);

  // Analytics config
  const [analyticsRole,       setAnalyticsRole]       = useState('none');
  const [primaryAmountField,  setPrimaryAmountField]  = useState('');
  const [primaryDateField,    setPrimaryDateField]    = useState('');
  const [primaryLabelField,   setPrimaryLabelField]   = useState('');
  const [secondaryGroupField, setSecondaryGroupField] = useState('');
  const [reorderField,        setReorderField]        = useState('');
  const [targetAmount,        setTargetAmount]        = useState('');
  const [savingAnalytics,     setSavingAnalytics]     = useState(false);

  // Relationships
  const [relationships,      setRelationships]      = useState<any[]>([]);
  const [loadingRels,        setLoadingRels]        = useState(false);
  const [showRelModal,       setShowRelModal]       = useState(false);

  // ✅ FIX: Separate Reanimated spring values for each modal (field + relationship)
  // Previously both modals shared relModalAnimStyle, and openRelModal/closeRelModal
  // called themselves recursively causing an infinite loop / stack overflow.

  // — Relationship modal spring —
  const relModalTranslateY = useSharedValue(500);
  const relModalOpacity    = useSharedValue(0);
  const relModalAnimStyle  = useAnimatedStyle(() => ({
    transform: [{ translateY: relModalTranslateY.value }],
    opacity: relModalOpacity.value,
  }));

  const openRelModal = () => {
    relModalTranslateY.value = 500;
    relModalOpacity.value = 0;
    setShowRelModal(true);  // ✅ was: openRelModal() — infinite recursion
    relModalTranslateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    relModalOpacity.value    = withTiming(1, { duration: 160 });
  };

  const closeRelModal = () => {
    relModalTranslateY.value = withSpring(500, { damping: 22, stiffness: 200 });
    relModalOpacity.value    = withTiming(0, { duration: 140 });
    setTimeout(() => setShowRelModal(false), 150);  // ✅ was: closeRelModal() — infinite loop
  };

  // — Field modal spring (separate values so it animates independently) —
  const fieldModalTranslateY = useSharedValue(500);
  const fieldModalOpacity    = useSharedValue(0);
  const fieldModalAnimStyle  = useAnimatedStyle(() => ({
    transform: [{ translateY: fieldModalTranslateY.value }],
    opacity: fieldModalOpacity.value,
  }));

  const openFieldModal = () => {
    fieldModalTranslateY.value = 500;
    fieldModalOpacity.value = 0;
    setShowFieldModal(true);
    fieldModalTranslateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    fieldModalOpacity.value    = withTiming(1, { duration: 160 });
  };

  const closeFieldModal = () => {
    fieldModalTranslateY.value = withSpring(500, { damping: 22, stiffness: 200 });
    fieldModalOpacity.value    = withTiming(0, { duration: 140 });
    setTimeout(() => { setShowFieldModal(false); setFieldDraft(DEFAULT_FIELD); }, 150);
  };

  const [relFromField,       setRelFromField]       = useState('');
  const [relToTableId,       setRelToTableId]       = useState('');
  const [relToField,         setRelToField]         = useState('');
  const [relLabel,           setRelLabel]           = useState('');
  const [relToFields,        setRelToFields]        = useState<any[]>([]);
  const [savingRel,          setSavingRel]          = useState(false);

  // -- Load tables -----------------------------------------------------------
  const fetchTables = useCallback(async () => {
    if (!activeBusiness?.id) return;
    setLoadingTables(true);
    try { setTables(await getTables(activeBusiness.id)); }
    catch (e) { console.error('AdminBuilder fetchTables:', e); }
    finally { setLoadingTables(false); }
  }, [activeBusiness?.id]);

  // Entrance animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(panelFade,  { toValue: 1, duration: 380, delay: 120, useNativeDriver: true }),
      Animated.timing(panelSlide, { toValue: 0, duration: 380, delay: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // Auto-select table from nav params
  useEffect(() => {
    const autoId  = route?.params?.autoSelectTableId;
    const autoTab = route?.params?.autoTab as TabKey | undefined;
    if (autoId && tables.length > 0 && !selectedTable) {
      const found = tables.find((t: any) => t.id === autoId);
      if (found) { setSelectedTable(found); setActiveTab(autoTab ?? 'analytics'); }
    }
  }, [tables]);

  // -- Load fields + analytics + relationships when table selected -----------
  useEffect(() => {
    if (!selectedTable) { setFields([]); setRelationships([]); return; }
    setLoadingFields(true);
    getTableFields(selectedTable.id)
      .then(f => {
        setFields(f);
        setAnalyticsRole(selectedTable.analyticsRole ?? 'none');
        setPrimaryAmountField(selectedTable.primaryAmountField ?? '');
        setPrimaryDateField(selectedTable.primaryDateField ?? '');
        setPrimaryLabelField(selectedTable.primaryLabelField ?? '');
        setSecondaryGroupField(selectedTable.secondaryGroupField ?? '');
        setReorderField(selectedTable.reorderField ?? '');
        setTargetAmount(String(selectedTable.targetAmount ?? ''));
      })
      .catch(e => console.error('getTableFields:', e))
      .finally(() => setLoadingFields(false));
    // Load relationships
    setLoadingRels(true);
    getTableRelationships(selectedTable.id)
      .then(setRelationships)
      .catch(e => console.error('getTableRelationships:', e))
      .finally(() => setLoadingRels(false));
  }, [selectedTable]);

  // When toTable changes in rel modal, load its fields
  useEffect(() => {
    if (!relToTableId) { setRelToFields([]); setRelToField(''); return; }
    getTableFields(relToTableId).then(f => { setRelToFields(f); setRelToField(f[0]?.name ?? ''); });
  }, [relToTableId]);

  // -- Create table ----------------------------------------------------------
  const handleCreateTable = async () => {
    if (!newTableName.trim()) { Alert.alert('Name required', 'Please enter a table name.'); return; }
    if (!activeBusiness?.id) { Alert.alert('Error', 'No active business.'); return; }
    setCreatingTable(true);
    try {
      const tableId = `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await createTable({
        id: tableId, businessId: activeBusiness.id,
        name: newTableName.trim(), icon: 'grid-outline', category: 'Custom', description: '',
        fields: [{ name: 'Name', type: 'text', isRequired: true }],
      });
      if (activeBusiness?.id) await loadTables(activeBusiness.id);
      await fetchTables();
      setNewTableName(''); setShowNewTableModal(false);
      const refreshed = await getTables(activeBusiness.id);
      const created = refreshed.find(t => t.id === tableId);
      if (created) setSelectedTable(created);
    } catch (e: any) {
      Alert.alert('Error', `Could not create table: ${e?.message ?? 'Unknown error'}`);
    } finally { setCreatingTable(false); }
  };

  // -- Rename table ----------------------------------------------------------
  const handleRenameTable = async () => {
    if (!renameValue.trim() || !selectedTable) return;
    try {
      await renameTable(selectedTable.id, renameValue.trim());
      await fetchTables();
      setSelectedTable({ ...selectedTable, name: renameValue.trim() });
      setShowRenameModal(false);
    } catch (e: any) { Alert.alert('Error', `Could not rename: ${e?.message}`); }
  };

  // -- Delete table ----------------------------------------------------------
  const handleDeleteTable = (table?: any) => {
    const t = table ?? selectedTable;
    if (!t) return;
    Alert.alert('Delete Table', `Delete "${t.name}"? All its records will be hidden.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteTable(t.id);
          if (activeBusiness?.id) await loadTables(activeBusiness.id);
          await fetchTables();
          if (selectedTable?.id === t.id) setSelectedTable(null);
        } catch (e: any) { Alert.alert('Error', `Could not delete: ${e?.message}`); }
      }},
    ]);
  };

  // -- Save analytics --------------------------------------------------------
  const handleSaveAnalytics = async () => {
    if (!selectedTable) return;
    setSavingAnalytics(true);
    try {
      await saveAnalyticsConfig(selectedTable.id, {
        analyticsRole, primaryAmountField, primaryDateField,
        primaryLabelField, secondaryGroupField, reorderField,
        targetAmount: parseFloat(targetAmount) || 0,
      });
      await fetchTables();
      if (activeBusiness?.id) await loadTables(activeBusiness.id);
      Alert.alert('Saved ✓', 'Analytics config saved. Open Insights to see your charts.');
    } catch (e: any) {
      Alert.alert('Error', `Could not save: ${e?.message}`);
    } finally { setSavingAnalytics(false); }
  };

  // -- Add field -------------------------------------------------------------
  const handleSaveField = async () => {
    if (!fieldDraft.name.trim()) { Alert.alert('Field name required'); return; }
    setSavingField(true);
    try {
      const { getDb } = await import('../services/database');
      const db = await getDb();
      const fieldId = 'fld_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      await db.runAsync(
        'INSERT INTO table_fields (id, tableId, name, type, isRequired, defaultValue, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fieldId, selectedTable.id, fieldDraft.name.trim(), fieldDraft.type, fieldDraft.isRequired ? 1 : 0, fieldDraft.defaultValue, fields.length]
      );
      const updated = await getTableFields(selectedTable.id);
      setFields(updated);
      closeFieldModal();  // ✅ use animated close instead of bare setState
    } catch (e: any) {
      Alert.alert('Error', `Could not add field: ${e?.message}`);
    } finally { setSavingField(false); }
  };

  // -- Add relationship ------------------------------------------------------
  const handleSaveRelationship = async () => {
    if (!selectedTable || !relFromField || !relToTableId || !relToField) {
      Alert.alert('Required', 'Please fill in all relationship fields.');
      return;
    }
    setSavingRel(true);
    try {
      const rel = {
        id: uuidv4(),
        fromTableId: selectedTable.id,
        fromField: relFromField,
        toTableId: relToTableId,
        toField: relToField,
        label: relLabel || `${relFromField} → ${relToField}`,
      };
      await createTableRelationship(rel);
      const updated = await getTableRelationships(selectedTable.id);
      setRelationships(updated);
      closeRelModal();
      setRelFromField(''); setRelToTableId(''); setRelToField(''); setRelLabel('');
    } catch (e: any) {
      Alert.alert('Error', `Could not create relationship: ${e?.message}`);
    } finally { setSavingRel(false); }
  };

  const handleDeleteRelationship = async (relId: string) => {
    Alert.alert('Remove Link', 'Remove this table relationship?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await deleteTableRelationship(relId);
          const updated = await getTableRelationships(selectedTable.id);
          setRelationships(updated);
        } catch (e: any) { Alert.alert('Error', `Could not remove: ${e?.message}`); }
      }},
    ]);
  };

  // -- Render ----------------------------------------------------------------
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Background particles — visible, not behind content */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ParticleField variant="full" count={10} height={120} />
        <GlowOrb x={-40} y={20} size={140} color="rgba(196,150,58,0.08)" />
        <GlowOrb x="70%" y={60} size={100} color="rgba(196,150,58,0.09)" />
        <CornerAccent position="topRight" size={60} color="rgba(196,150,58,0.12)" />
      </View>

      {/* Header — animated slide-in */}
      <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Admin Builder</Text>
          <Text style={styles.headerSub}>Design the system your business needs.</Text>
        </View>
        <Hintable hintId="admin_add_table">
        <TouchableOpacity style={styles.addTableBtn} onPress={() => setShowNewTableModal(true)}>
          <Ionicons name="add" size={22} color={Colors.ivory} />
        </TouchableOpacity>
        </Hintable>
      </Animated.View>

      {/* Two-panel layout — animated fade+slide up */}
      <Animated.View style={[styles.twoPanel, { opacity: panelFade, transform: [{ translateY: panelSlide }] }]}>
        {/* LEFT: Table list */}
        <View style={styles.leftPanel}>
          {loadingTables
            ? <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Theme.primary} />
            : tables.length === 0
              ? (
                <View style={styles.leftEmpty}>
                  <Ionicons name="grid-outline" size={28} color={Theme.textDim} />
                  <Text style={styles.leftEmptyText}>{"No tables.\nTap + to create."}</Text>
                </View>
              )
              : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {tables.map((item: any) => (
                    <Hintable key={item.id} hintId="admin_tables">
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.tableListRow, selectedTable?.id === item.id && styles.tableListRowActive]}
                      onPress={() => { setSelectedTable(item); setActiveTab('fields'); }}
                      onLongPress={() => handleDeleteTable(item)}
                    >
                      <View style={styles.tableListIcon}>
                        <Ionicons name={(item.icon as any) ?? 'grid-outline'} size={16}
                          color={selectedTable?.id === item.id ? Theme.primary : Theme.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tableListName, selectedTable?.id === item.id && styles.tableListNameActive]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.tableListCount}>{item.recordCount ?? 0} rec</Text>
                      </View>
                    </TouchableOpacity>
                    </Hintable>
                  ))}
                  <View style={{ height: 60 }} />
                </ScrollView>
              )
          }
          <Text style={styles.leftHint}>Long-press to delete</Text>
        </View>

        {/* RIGHT: Editor */}
        <View style={styles.rightPanel}>
          {selectedTable ? (
            <View style={{ flex: 1 }}>
              {/* Table name row */}
              <View style={styles.editorHeader}>
                <Text style={styles.editorTitle} numberOfLines={1}>{selectedTable.name}</Text>
                <TouchableOpacity style={styles.renameBtn} onPress={() => { setRenameValue(selectedTable.name); setShowRenameModal(true); }}>
                  <Ionicons name="pencil-outline" size={16} color={Theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTable()}>
                  <Ionicons name="trash-outline" size={16} color={Theme.danger} />
                </TouchableOpacity>
              </View>

              {/* Tab bar — 3 tabs */}
              <Hintable hintId="admin_fields_tab">
              <View style={styles.tabBar}>
                {(['fields', 'analytics', 'relationships'] as TabKey[]).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Ionicons
                      name={tab === 'fields' ? 'list-outline' : tab === 'analytics' ? 'bar-chart-outline' : 'git-branch-outline'}
                      size={13}
                      color={activeTab === tab ? Theme.primary : Theme.textDim}
                    />
                    <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                      {tab === 'fields' ? 'Fields' : tab === 'analytics' ? 'Analytics' : 'Links'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              </Hintable>

              {/* -- FIELDS TAB -- */}
              {activeTab === 'fields' && (
                loadingFields
                  ? <ActivityIndicator style={{ margin: Spacing.lg }} color={Theme.primary} />
                  : (
                    <ScrollView style={styles.tabContent}>
                      {fields.length === 0 && <EmptyStateIllustration variant="flame" title="No fields yet" subtitle="Tap Add Field to define columns for this table." />}
                      {fields.map((f, i) => (
                        <View key={f.id ?? i} style={styles.fieldRow}>
                          <Ionicons name="reorder-two" size={18} color={Theme.textDim} />
                          <View style={styles.fieldInfo}>
                            <Text style={styles.fieldName}>{f.name}</Text>
                            {f.isRequired === 1 && <Text style={styles.reqTag}>Required</Text>}
                          </View>
                          <View style={styles.fieldTypePill}>
                            <Text style={styles.fieldTypeText}>{f.type}</Text>
                          </View>
                        </View>
                      ))}
                      <Hintable hintId="admin_add_field">
                      <TouchableOpacity style={styles.addFieldBtn} onPress={openFieldModal}>
                        <Ionicons name="add-circle" size={20} color={Theme.primary} />
                        <Text style={styles.addFieldText}>Add Field</Text>
                      </TouchableOpacity>
                      </Hintable>
                      <View style={{ height: 60 }} />
                    </ScrollView>
                  )
              )}

              {/* -- ANALYTICS TAB -- */}
              {activeTab === 'analytics' && (
                <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
                  <Text style={styles.analyticsHint}>
                    Set an analytics role so Insights can build charts and KPIs from this table.
                  </Text>
                  <Hintable hintId="admin_analytics_role">
                  <View>
                  <Text style={styles.analyticsLabel}>Analytics Role</Text>
                  {ANALYTICS_ROLES.map(role => (
                    <TouchableOpacity
                      key={role.value}
                      style={[styles.roleRow, analyticsRole === role.value && styles.roleRowActive]}
                      onPress={() => setAnalyticsRole(role.value)}
                    >
                      <Ionicons name={role.icon as any} size={18}
                        color={analyticsRole === role.value ? Theme.primary : Theme.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleLabel, analyticsRole === role.value && { color: Theme.primary }]}>{role.label}</Text>
                        <Text style={styles.roleDesc}>{role.desc}</Text>
                      </View>
                      {analyticsRole === role.value && <Ionicons name="checkmark-circle" size={18} color={Theme.primary} />}
                    </TouchableOpacity>
                  ))}
                  </View>
                  </Hintable>

                  {analyticsRole !== 'none' && (
                    <>
                      <Hintable hintId="admin_analytics_amount_field">
                      <Text style={[styles.analyticsLabel, { marginTop: Spacing.lg }]}>Amount / Quantity Field</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                        {fields.filter(f => ['number','currency','text'].includes(f.type)).map(f => (
                          <TouchableOpacity
                            key={f.id}
                            style={[styles.fieldPill, primaryAmountField === f.name && styles.fieldPillActive]}
                            onPress={() => setPrimaryAmountField(f.name)}
                          >
                            <Text style={[styles.fieldPillText, primaryAmountField === f.name && { color: Colors.ivory }]}>{f.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      </Hintable>

                      <Hintable hintId="admin_analytics_date_field">
                      <Text style={styles.analyticsLabel}>Date Field (for time filters)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                        <TouchableOpacity
                          style={[styles.fieldPill, primaryDateField === '' && styles.fieldPillActive]}
                          onPress={() => setPrimaryDateField('')}
                        >
                          <Text style={[styles.fieldPillText, primaryDateField === '' && { color: Colors.ivory }]}>None</Text>
                        </TouchableOpacity>
                        {fields.filter(f => ['date','text'].includes(f.type)).map(f => (
                          <TouchableOpacity
                            key={f.id}
                            style={[styles.fieldPill, primaryDateField === f.name && styles.fieldPillActive]}
                            onPress={() => setPrimaryDateField(f.name)}
                          >
                            <Text style={[styles.fieldPillText, primaryDateField === f.name && { color: Colors.ivory }]}>{f.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      </Hintable>

                      {analyticsRole === 'revenue' && (
                        <>
                          <Hintable hintId="admin_analytics_target">
                          <Text style={styles.analyticsLabel}>Monthly Target (₹) — optional</Text>
                          <TextInput
                            style={styles.analyticsInput}
                            value={targetAmount}
                            onChangeText={setTargetAmount}
                            placeholder="e.g. 500000"
                            placeholderTextColor={Theme.textDim}
                            keyboardType="numeric"
                          />
                          </Hintable>
                        </>
                      )}

                      {analyticsRole === 'inventory' && (
                        <>
                          <Hintable hintId="admin_analytics_reorder">
                          <Text style={styles.analyticsLabel}>Reorder Level Field — optional</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                            <TouchableOpacity
                              style={[styles.fieldPill, reorderField === '' && styles.fieldPillActive]}
                              onPress={() => setReorderField('')}
                            >
                              <Text style={[styles.fieldPillText, reorderField === '' && { color: Colors.ivory }]}>None (default=10)</Text>
                            </TouchableOpacity>
                            {fields.filter(f => ['number','text'].includes(f.type)).map(f => (
                              <TouchableOpacity
                                key={f.id}
                                style={[styles.fieldPill, reorderField === f.name && styles.fieldPillActive]}
                                onPress={() => setReorderField(f.name)}
                              >
                                <Text style={[styles.fieldPillText, reorderField === f.name && { color: Colors.ivory }]}>{f.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          </Hintable>
                        </>
                      )}
                    </>
                  )}

                  <Hintable hintId="admin_analytics_save">
                  <TouchableOpacity
                    style={[styles.saveAnalyticsBtn, savingAnalytics && { opacity: 0.6 }]}
                    onPress={handleSaveAnalytics}
                    disabled={savingAnalytics}
                  >
                    {savingAnalytics
                      ? <ActivityIndicator color={Colors.ivory} size="small" />
                      : <Text style={styles.saveAnalyticsBtnText}>Save Analytics Config</Text>
                    }
                  </TouchableOpacity>
                  </Hintable>
                  <View style={{ height: 60 }} />
                </ScrollView>
              )}

              {/* -- RELATIONSHIPS TAB -- */}
              {activeTab === 'relationships' && (
                <ScrollView style={styles.tabContent}>
                  <Hintable hintId="admin_relationships">
                  <Text style={styles.analyticsHint}>
                    Link fields across tables — e.g. Customer ID in Orders → Customers table.
                  </Text>
                  </Hintable>
                  {loadingRels
                    ? <ActivityIndicator color={Theme.primary} />
                    : relationships.length === 0
                      ? <EmptyStateIllustration variant='link' title='No links yet' subtitle='Link fields across tables to relate data — e.g. Customer ID in Orders.' />
                      : relationships.map((rel: any) => {
                          const toTable = tables.find((t: any) => t.id === rel.toTableId);
                          return (
                            <Hintable key={rel.id} hintId="admin_rel_row"><View style={styles.relRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.relLabel}>{rel.label || `${rel.fromField} → ${rel.toField}`}</Text>
                                <Text style={styles.relMeta}>{rel.fromField} → {toTable?.name ?? rel.toTableId}.{rel.toField}</Text>
                              </View>
                              <TouchableOpacity onPress={() => handleDeleteRelationship(rel.id)}>
                                <Ionicons name="trash-outline" size={16} color={Theme.danger} />
                              </TouchableOpacity>
                            </View></Hintable>
                          );
                        })
                  }
                  <Hintable hintId="admin_add_link">
                  <TouchableOpacity style={styles.addFieldBtn} onPress={() => {
                    setRelFromField(fields[0]?.name ?? '');
                    setRelToTableId(tables.filter((t: any) => t.id !== selectedTable?.id)[0]?.id ?? '');
                    openRelModal();
                  }}>
                    <Ionicons name="add-circle" size={20} color={Theme.primary} />
                    <Text style={styles.addFieldText}>Add Link</Text>
                  </TouchableOpacity>
                  </Hintable>
                  <View style={{ height: 60 }} />
                </ScrollView>
              )}
            </View>
          ) : (
            <View style={styles.noTableSelected}>
              <View style={styles.noTableIconWrap}>
                <Ionicons name="arrow-back-outline" size={28} color={Theme.textDim} />
              </View>
              <Text style={styles.noTableTitle}>Select a table</Text>
              <Text style={styles.noTableSub}>Pick a table from the left panel to edit its fields and analytics.</Text>
              <TouchableOpacity style={styles.createFirstBtn} onPress={() => setShowNewTableModal(true)}>
                <Ionicons name="add" size={18} color={Colors.ivory} />
                <Text style={styles.createFirstBtnText}>Create Table</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      {/* -- New Table Modal -- */}
      <Modal visible={showNewTableModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Table</Text>
              <TextInput
                style={styles.modalInput}
                value={newTableName}
                onChangeText={setNewTableName}
                placeholder="Table name (e.g. Sales, Staff, Products)"
                placeholderTextColor={Theme.textDim}
                autoFocus
                onSubmitEditing={handleCreateTable}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowNewTableModal(false); setNewTableName(''); }}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, creatingTable && { opacity: 0.6 }]}
                  onPress={handleCreateTable}
                  disabled={creatingTable}
                >
                  {creatingTable
                    ? <ActivityIndicator color={Colors.ivory} size="small" />
                    : <Text style={styles.modalConfirmText}>Create</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* -- Rename Modal -- */}
      <Modal visible={showRenameModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Rename Table</Text>
              <TextInput
                style={styles.modalInput}
                value={renameValue}
                onChangeText={setRenameValue}
                autoFocus
                onSubmitEditing={handleRenameTable}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRenameModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleRenameTable}>
                  <Text style={styles.modalConfirmText}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* -- Add Field Modal — uses fieldModalAnimStyle (its own spring, not rel modal's) -- */}
      <Modal visible={showFieldModal} transparent animationType="none">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
              <Reanimated.View style={[styles.fieldModalCard, fieldModalAnimStyle]}>
                <Text style={styles.modalTitle}>Add Field</Text>

                <Text style={styles.fieldModalLabel}>Field Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={fieldDraft.name}
                  onChangeText={v => setFieldDraft(d => ({ ...d, name: v }))}
                  placeholder="e.g. Amount, Date, Customer Name"
                  placeholderTextColor={Theme.textDim}
                  autoFocus
                />

                <Text style={styles.fieldModalLabel}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                  {FIELD_TYPES.map(ft => (
                    <TouchableOpacity
                      key={ft.value}
                      style={[styles.fieldPill, fieldDraft.type === ft.value && styles.fieldPillActive]}
                      onPress={() => setFieldDraft(d => ({ ...d, type: ft.value }))}
                    >
                      <Text style={[styles.fieldPillText, fieldDraft.type === ft.value && { color: Colors.ivory }]}>{ft.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.fieldRequiredRow}>
                  <Text style={styles.fieldModalLabel}>Required</Text>
                  <Switch
                    value={fieldDraft.isRequired}
                    onValueChange={v => setFieldDraft(d => ({ ...d, isRequired: v }))}
                    trackColor={{ true: Theme.primary }}
                  />
                </View>

                {fieldDraft.type === 'select' && (
                  <>
                    <Text style={styles.fieldModalLabel}>Options (comma-separated)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={fieldDraft.options}
                      onChangeText={v => setFieldDraft(d => ({ ...d, options: v }))}
                      placeholder="e.g. Pending,Approved,Rejected"
                      placeholderTextColor={Theme.textDim}
                    />
                  </>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={closeFieldModal}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, savingField && { opacity: 0.6 }]}
                    onPress={handleSaveField}
                    disabled={savingField}
                  >
                    {savingField
                      ? <ActivityIndicator color={Colors.ivory} size="small" />
                      : <Text style={styles.modalConfirmText}>Add Field</Text>
                    }
                  </TouchableOpacity>
                </View>
              </Reanimated.View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* -- Relationship Modal -- */}
      <Modal visible={showRelModal} transparent animationType="none">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <Reanimated.View style={[styles.fieldModalCard, relModalAnimStyle]}>
              <Text style={styles.modalTitle}>Add Table Link</Text>

              <Text style={styles.fieldModalLabel}>From Field (this table)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                {fields.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.fieldPill, relFromField === f.name && styles.fieldPillActive]}
                    onPress={() => setRelFromField(f.name)}
                  >
                    <Text style={[styles.fieldPillText, relFromField === f.name && { color: Colors.ivory }]}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldModalLabel}>To Table</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                {tables.filter((t: any) => t.id !== selectedTable?.id).map((t: any) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.fieldPill, relToTableId === t.id && styles.fieldPillActive]}
                    onPress={() => setRelToTableId(t.id)}
                  >
                    <Text style={[styles.fieldPillText, relToTableId === t.id && { color: Colors.ivory }]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {relToFields.length > 0 && (
                <>
                  <Text style={styles.fieldModalLabel}>Match Field (target table)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                    {relToFields.map(f => (
                      <TouchableOpacity
                        key={f.id}
                        style={[styles.fieldPill, relToField === f.name && styles.fieldPillActive]}
                        onPress={() => setRelToField(f.name)}
                      >
                        <Text style={[styles.fieldPillText, relToField === f.name && { color: Colors.ivory }]}>{f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.fieldModalLabel}>Label (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={relLabel}
                onChangeText={setRelLabel}
                placeholder="e.g. Customer link"
                placeholderTextColor={Theme.textDim}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => closeRelModal()}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, savingRel && { opacity: 0.6 }]}
                  onPress={handleSaveRelationship}
                  disabled={savingRel}
                >
                  {savingRel
                    ? <ActivityIndicator color={Colors.ivory} size="small" />
                    : <Text style={styles.modalConfirmText}>Add Link</Text>
                  }
                </TouchableOpacity>
              </View>
            </Reanimated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Theme.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.background,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs, marginRight: Spacing.xs },
  headerTitle: { ...Typography.headingL, color: Theme.textPrimary },
  headerSub: { ...Typography.bodyS, color: Theme.textSecondary },
  addTableBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Theme.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  twoPanel: {
    flex: 1, flexDirection: 'row',
  },

  leftPanel: {
    width: 140,
    borderRightWidth: 1,
    borderRightColor: Theme.border,
    backgroundColor: Theme.surface,
    paddingTop: Spacing.sm,
    paddingBottom: 40,
  },
  leftEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
  leftEmptyText: { ...Typography.bodyS, color: Theme.textDim, textAlign: 'center', marginTop: Spacing.sm },
  leftHint: {
    position: 'absolute', bottom: Spacing.sm, left: 0, right: 0,
    textAlign: 'center', ...Typography.bodyS, color: Theme.textDim, fontSize: 10,
  },
  tableListRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md, gap: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  tableListRowActive: { backgroundColor: 'rgba(196,150,58,0.08)' },
  tableListIcon: {
    width: 28, height: 28, borderRadius: Radius.sm,
    backgroundColor: 'rgba(196,150,58,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  tableListName: { ...Typography.bodyS, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  tableListNameActive: { color: Theme.primary },
  tableListCount: { ...Typography.bodyS, color: Theme.textDim, fontSize: 10 },

  rightPanel: { flex: 1 },
  editorHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border, gap: Spacing.sm,
  },
  editorTitle: { ...Typography.headingM, color: Theme.textPrimary, flex: 1 },
  renameBtn: { padding: Spacing.xs },
  deleteBtn: { padding: Spacing.xs },

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Theme.border,
    backgroundColor: Theme.surface,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Theme.primary, backgroundColor: Theme.background },
  tabLabel: { ...Typography.bodyS, color: Theme.textDim, fontSize: 11 },
  tabLabelActive: { color: Theme.primary, fontFamily: 'DMSans_500Medium' },

  tabContent: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  emptyText: { ...Typography.bodyS, color: Theme.textDim, textAlign: 'center', marginTop: Spacing.lg },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  fieldInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fieldName: { ...Typography.bodyM, color: Theme.textPrimary },
  reqTag: {
    ...Typography.bodyS, color: Theme.danger, fontSize: 10,
    backgroundColor: 'rgba(196,80,74,0.10)',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  fieldTypePill: {
    backgroundColor: 'rgba(196,150,58,0.12)',
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full,
  },
  fieldTypeText: { ...Typography.bodyS, color: Colors.gold, fontSize: 10 },
  addFieldBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  addFieldText: { ...Typography.bodyM, color: Theme.primary },

  analyticsHint: { ...Typography.bodyS, color: Theme.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  analyticsLabel: { ...Typography.label, color: Theme.textSecondary, marginBottom: Spacing.xs },
  analyticsInput: {
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md,
    backgroundColor: Theme.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    ...Typography.bodyM, color: Theme.textPrimary, marginBottom: Spacing.sm,
  },
  roleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Theme.border, backgroundColor: Theme.surface, marginBottom: Spacing.sm,
  },
  roleRowActive: { borderColor: Theme.primary, backgroundColor: 'rgba(196,150,58,0.08)' },
  roleLabel: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  roleDesc: { ...Typography.bodyS, color: Theme.textSecondary },
  fieldPill: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Theme.border,
    backgroundColor: Theme.surface, marginRight: Spacing.sm, marginBottom: Spacing.xs,
  },
  fieldPillActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  fieldPillText: { ...Typography.label, color: Theme.textSecondary, fontSize: 12 },
  saveAnalyticsBtn: {
    backgroundColor: Theme.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  saveAnalyticsBtnText: { ...Typography.label, color: Colors.ivory },

  relRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Theme.surface,
    borderRadius: Radius.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Theme.border,
  },
  relLabel: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  relMeta: { ...Typography.bodyS, color: Theme.textSecondary },

  noTableSelected: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  noTableIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(196,150,58,0.10)',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  noTableTitle: { ...Typography.headingM, color: Theme.textPrimary, marginBottom: 4 },
  noTableSub: { ...Typography.bodyS, color: Theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  createFirstBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Theme.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginTop: Spacing.lg,
  },
  createFirstBtnText: { ...Typography.label, color: Colors.ivory },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12,11,9,0.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Theme.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, paddingBottom: 36,
  },
  fieldModalCard: {
    backgroundColor: Theme.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, paddingBottom: 36, maxHeight: '80%',
  },
  modalTitle: { ...Typography.headingL, color: Theme.textPrimary, marginBottom: Spacing.lg },
  fieldModalLabel: { ...Typography.label, color: Theme.textSecondary, marginBottom: Spacing.xs },
  modalInput: {
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md,
    backgroundColor: Theme.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    ...Typography.bodyM, color: Theme.textPrimary, marginBottom: Spacing.md,
  },
  fieldRequiredRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalCancelBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Theme.border, alignItems: 'center',
  },
  modalCancelText: { ...Typography.label, color: Theme.textSecondary },
  modalConfirmBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Theme.primary, alignItems: 'center',
  },
  modalConfirmText: { ...Typography.label, color: Colors.ivory },
});
