// src/screens/RecordDetailScreen.tsx
// v2.1: useFocusEffect reloads record on focus so edits show immediately without manual refresh.
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { Header } from '../components/Header';
import { GoldButton } from '../components/GoldButton';
import { useApprovalStore } from '../store/useApprovalStore';
import { useBusinessStore } from '../store/useBusinessStore';
import {
  getRecentAuditLog, getLinkedRecord, getTableFields, getTables,
  deleteRecord, getRecords,
} from '../services/database';
import { formatDate, formatRelativeTime } from '../utils/formatters';
import { addToSyncQueue } from '../services/syncService';

interface LinkedItem {
  fieldName: string;
  linkedTableName: string;
  linkedRecord: any | null;
}

export default function RecordDetailScreen({ route, navigation }: any) {
  const { record: initialRecord, table, fields: initialFields = [] } = route.params;
  const { activeBusiness } = useBusinessStore();
  const { approve, reject } = useApprovalStore();

  const [record, setRecord] = useState(initialRecord);
  const [fields, setFields] = useState(initialFields);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const loadRecord = useCallback(async () => {
    try {
      // Re-fetch the record so edits show without requiring manual refresh
      const allRecords = await getRecords(table.id);
      const fresh = allRecords.find((r: any) => r.id === initialRecord.id);
      if (fresh) {
        const parsed = {
          ...fresh,
          data: typeof fresh.data === 'string'
            ? (() => { try { return JSON.parse(fresh.data); } catch { return {}; } })()
            : (fresh.data || {}),
        };
        setRecord(parsed);
      }
      // Also refresh fields in case they changed
      const freshFields = await getTableFields(table.id);
      if (freshFields.length > 0) setFields(freshFields);
    } catch (e) {
      console.error('RecordDetail loadRecord:', e);
    }
  }, [table.id, initialRecord.id]);

  // Reload every time the screen comes back into focus (after editing)
  useFocusEffect(
    useCallback(() => {
      loadRecord();
    }, [loadRecord])
  );

  useEffect(() => {
    if (!activeBusiness?.id) return;
    getRecentAuditLog(activeBusiness.id, 10).then(setAuditLog);
    resolveLinkedRecords();
  }, [record]);

  const resolveLinkedRecords = async () => {
    if (!activeBusiness?.id) return;
    const linkFields = fields.filter((f: any) => f.type === 'link' && f.linkedTableId);
    if (linkFields.length === 0) return;

    setLoadingLinks(true);
    const allTables = await getTables(activeBusiness.id);
    const items: LinkedItem[] = [];

    for (const lf of linkFields) {
      const recordIdValue = record.data?.[lf.name];
      if (!recordIdValue) {
        items.push({
          fieldName: lf.name,
          linkedTableName: allTables.find((t: any) => t.id === lf.linkedTableId)?.name ?? lf.linkedTableId,
          linkedRecord: null,
        });
        continue;
      }
      const linkedRec = await getLinkedRecord(lf.linkedTableId, recordIdValue);
      const linkedTableMeta = allTables.find((t: any) => t.id === lf.linkedTableId);
      const linkedFields = await getTableFields(lf.linkedTableId);
      const firstTextField = linkedFields.find((f: any) => f.type === 'text') || linkedFields[0];
      items.push({
        fieldName: lf.name,
        linkedTableName: linkedTableMeta?.name ?? lf.linkedTableId,
        linkedRecord: linkedRec
          ? { ...linkedRec, _displayLabel: linkedRec.data?.[firstTextField?.name] ?? linkedRec.id }
          : null,
      });
    }

    setLinkedItems(items);
    setLoadingLinks(false);
  };

  const data = record.data || {};
  const isPending = record.status === 'pending_approval';

  const getDisplayValue = (field: any) => {
    const val = data[field.name];
    if (val === undefined || val === null || val === '') return '—';
    if (field.type === 'currency') return '₹ ' + val;
    if (field.type === 'date') return formatDate(val);
    if (field.type === 'boolean') return val === 'true' ? 'Yes' : 'No';
    if (field.type === 'link') {
      const linked = linkedItems.find(li => li.fieldName === field.name);
      return linked?.linkedRecord?._displayLabel ?? val;
    }
    return String(val);
  };

  const handleApprove = async () => {
    Alert.alert('Approve Record', 'Approve this record and make it active?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        await approve(record.id, activeBusiness?.name || 'Owner');
        navigation.goBack();
      }},
    ]);
  };

  const handleReject = () => {
    Alert.prompt(
      'Reject Record',
      'Add a note explaining why this record is rejected:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async (note) => {
          await reject(record.id, activeBusiness?.name || 'Owner', note || '');
          navigation.goBack();
        }},
      ],
      'plain-text'
    );
  };

  const handleEdit = () => {
    navigation.navigate('AddRecord', { table, fields, record });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Record',
      'This record will be permanently removed. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteRecord(record.id);
            if (activeBusiness?.storageMode === 'googleDrive') {
              await addToSyncQueue({ id: ('id_' + Date.now().toString(36)), tableId: table.id, tableName: table.name, action: 'delete', timestamp: new Date().toISOString() });
            }
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete record.');
          }
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <Header
        title={`${table?.name || 'Record'} Detail`}
        subtitle="One record. The full picture."
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'trash-outline',
          onPress: handleDelete,
        }}
      />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Record ID */}
        <View style={styles.idRow}>
          <Text style={styles.idLabel}>Record ID</Text>
          <Text style={styles.idValue}>{record.id?.slice(-10).toUpperCase() || 'N/A'}</Text>
        </View>

        {/* Pending approval banner */}
        {isPending && (
          <View style={styles.approvalBanner}>
            <View style={styles.bannerHeader}>
              <Ionicons name="time-outline" size={18} color={Colors.gold} />
              <Text style={styles.bannerTitle}>Awaiting Approval</Text>
            </View>
            <Text style={styles.bannerDesc}>
              This record has been submitted and is waiting for your review.
            </Text>
            <View style={styles.bannerActions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Fields card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record Details</Text>
          {fields.length > 0 ? (
            fields.map((field: any, i: number) => (
              <View
                key={field.id || field.name}
                style={[styles.fieldRow, i < fields.length - 1 && styles.fieldRowBorder]}
              >
                <Text style={styles.fieldLabel}>{field.name}</Text>
                <Text style={styles.fieldValue}>{getDisplayValue(field)}</Text>
              </View>
            ))
          ) : (
            Object.entries(data).map(([key, val]: any, i) => (
              <View
                key={key}
                style={[styles.fieldRow, i < Object.keys(data).length - 1 && styles.fieldRowBorder]}
              >
                <Text style={styles.fieldLabel}>{key}</Text>
                <Text style={styles.fieldValue}>{String(val)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Related Records */}
        {(loadingLinks || linkedItems.length > 0) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Related Records</Text>
            {loadingLinks ? (
              <ActivityIndicator color={Theme.primary} style={{ margin: Spacing.lg }} />
            ) : (
              linkedItems.map((li, i) => (
                <View
                  key={i}
                  style={[styles.linkedRow, i < linkedItems.length - 1 && styles.fieldRowBorder]}
                >
                  <View style={styles.linkedLeft}>
                    <Ionicons name="link-outline" size={14} color={Theme.primary} />
                    <View>
                      <Text style={styles.linkedFieldName}>{li.fieldName}</Text>
                      <Text style={styles.linkedTableName}>{li.linkedTableName}</Text>
                    </View>
                  </View>
                  {li.linkedRecord ? (
                    <View style={styles.linkedRecordPill}>
                      <Text style={styles.linkedRecordLabel} numberOfLines={1}>
                        {li.linkedRecord._displayLabel}
                      </Text>
                      <Text style={styles.linkedRecordId}>
                        {li.linkedRecord.id.slice(-6).toUpperCase()}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.linkedNone}>—</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Status card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status & Timestamps</Text>
          <View style={[styles.fieldRow, styles.fieldRowBorder]}>
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: isPending ? 'rgba(196,150,58,0.15)' : 'rgba(74,140,126,0.12)' },
            ]}>
              <Text style={[
                styles.statusText,
                { color: isPending ? Colors.gold : Colors.success },
              ]}>
                {isPending ? 'Pending Approval' : record.status || 'Active'}
              </Text>
            </View>
          </View>
          <View style={[styles.fieldRow, styles.fieldRowBorder]}>
            <Text style={styles.fieldLabel}>Created by</Text>
            <Text style={styles.fieldValue}>{record.createdBy || 'Owner'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Created at</Text>
            <Text style={styles.fieldValue}>{formatDate(record.createdAt)}</Text>
          </View>
        </View>

        {/* Audit trail */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Audit Trail</Text>
          {auditLog.length === 0 ? (
            <Text style={styles.auditEmpty}>No activity recorded yet.</Text>
          ) : (
            auditLog.slice(0, 5).map((entry: any, i: number) => (
              <View
                key={i}
                style={[styles.auditRow, i < auditLog.length - 1 && styles.fieldRowBorder]}
              >
                <View style={styles.auditDot} />
                <View style={styles.auditBody}>
                  <Text style={styles.auditAction}>{entry.action}</Text>
                  <Text style={styles.auditBy}>by {entry.performedBy}</Text>
                </View>
                <Text style={styles.auditTime}>{formatRelativeTime(entry.createdAt)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <View style={styles.footer}>
        <GoldButton
          label="✏️  Edit Record"
          onPress={handleEdit}
          style={styles.editBtn}
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },
  scroll: { flex: 1 },
  idRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  idLabel: { ...Typography.label, color: Theme.textSecondary },
  idValue: { ...Typography.mono, color: Theme.primary },
  approvalBanner: {
    margin: Spacing.lg, backgroundColor: 'rgba(196,150,58,0.10)', borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: 'rgba(196,150,58,0.35)', padding: Spacing.lg,
  },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  bannerTitle: { ...Typography.headingS, color: Colors.gold },
  bannerDesc: { ...Typography.bodyM, color: Theme.textSecondary, marginBottom: Spacing.md },
  bannerActions: { flexDirection: 'row', gap: Spacing.md },
  rejectBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Theme.danger, alignItems: 'center',
  },
  rejectBtnText: { ...Typography.label, color: Theme.danger },
  approveBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Theme.success, alignItems: 'center',
  },
  approveBtnText: { ...Typography.label, color: Colors.ivory },
  card: {
    margin: Spacing.lg, marginTop: 0, marginBottom: Spacing.md,
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Theme.border, overflow: 'hidden',
  },
  cardTitle: {
    ...Typography.labelCaps, color: Theme.textSecondary,
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Theme.border,
    backgroundColor: Theme.background,
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md,
  },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: Theme.border },
  fieldLabel: { ...Typography.label, color: Theme.textSecondary, flex: 1 },
  fieldValue: {
    ...Typography.bodyM, color: Theme.textPrimary, flex: 2,
    textAlign: 'right', fontFamily: 'DMSans_500Medium',
  },
  statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { ...Typography.labelCaps, fontSize: 10 },
  linkedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md,
  },
  linkedLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  linkedFieldName: { ...Typography.label, color: Theme.textSecondary },
  linkedTableName: { ...Typography.bodyS, color: Theme.textDim },
  linkedRecordPill: {
    backgroundColor: Theme.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 4, alignItems: 'flex-end',
  },
  linkedRecordLabel: {
    ...Typography.bodyS, color: Theme.primary,
    fontFamily: 'DMSans_500Medium', maxWidth: 140,
  },
  linkedRecordId: { ...Typography.mono, fontSize: 9, color: Theme.textDim },
  linkedNone: { ...Typography.bodyM, color: Theme.textDim },
  auditEmpty: {
    ...Typography.bodyM, color: Theme.textDim,
    textAlign: 'center', padding: Spacing.xl,
  },
  auditRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md,
  },
  auditDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Theme.primary },
  auditBody: { flex: 1 },
  auditAction: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  auditBy: { ...Typography.bodyS, color: Theme.textSecondary },
  auditTime: { ...Typography.bodyS, color: Theme.textDim },
  footer: {
    padding: Spacing.lg, borderTopWidth: 1,
    borderTopColor: Theme.border, backgroundColor: Theme.background,
  },
  editBtn: { borderRadius: Radius.md },
});
