// src/screens/AddRecordScreen.tsx
// v2.1: Bug 10 — inferFieldType() auto-detects number/date/boolean from field name keywords. — if route.params.record is provided, pre-fills form and calls updateRecord.
// Tagline: "Add a record in seconds. Never lose a detail."
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { FormField } from '../components/FormField';
import { GoldButton } from '../components/GoldButton';
import { Header } from '../components/Header';
import { useBusinessStore } from '../store/useBusinessStore';
import { addRecord, updateRecord, logAction } from '../services/database';
import { addToSyncQueue } from '../services/syncService';
import { ParticleField, GlowOrb } from '../components/ParticleField';

const uuidv4 = () =>
  'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

// Bug 10: infer display type from field name keywords when stored type is generic 'text'
function inferFieldType(field: any): any {
  const storedType = field.type || 'text';
  // Only upgrade 'text' fields — never downgrade an explicit type
  if (storedType !== 'text') return storedType;
  const name = (field.name || '').toLowerCase();
  const numberKw = ['amount', 'price', 'qty', 'quantity', 'stock', 'count', 'rate', 'total',
    'cost', 'salary', 'wage', 'units', 'weight', 'size', 'number', 'no.', 'num', 'age',
    'score', 'percent', '%', 'discount', 'tax', 'gst', 'revenue', 'expense', 'balance',
    'target', 'invoice', 'bill', 'due', 'paid', 'pending'];
  const dateKw = ['date', 'day', 'month', 'year', 'time', 'dob', 'doj', 'joining',
    'delivery', 'expiry', 'purchase', 'order', 'created', 'due', 'deadline', 'born'];
  const boolKw = ['active', 'paid', 'approved', 'verified', 'enabled', 'completed',
    'done', 'yes/no', 'y/n', 'status flag'];
  if (numberKw.some(k => name.includes(k))) return 'number';
  if (dateKw.some(k => name.includes(k))) return 'date';
  if (boolKw.some(k => name.includes(k))) return 'boolean';
  return 'text';
}

export default function AddRecordScreen({ route, navigation }: any) {
  const { table, fields = [], record } = route.params;
  const isEdit = !!record;
  const { activeBusiness } = useBusinessStore();

  // Pre-fill with existing record data when editing
  const [formValues, setFormValues] = useState<Record<string, string>>(
    isEdit ? { ...(record.data || {}) } : {}
  );
  const [loading, setLoading] = useState(false);

  // Evaluate formula fields: {Field Name} * {Other Field}
  const evaluateFormulas = (values: Record<string, string>): Record<string, string> => {
    const computed = { ...values };
    fields.forEach((f: any) => {
      if (f.type === 'formula' && f.formula) {
        try {
          let expr = f.formula;
          expr = expr.replace(/\{([^}]+)\}/g, (_: string, name: string) => {
            const v = parseFloat(computed[name] || '0');
            return isNaN(v) ? '0' : String(v);
          });
          const result = Function('"use strict"; return (' + expr + ')')();
          computed[f.name] = isNaN(result) ? '' : String(Math.round(result * 100) / 100);
        } catch {
          computed[f.name] = '';
        }
      }
    });
    return computed;
  };

  const setValue = (fieldName: string, value: string) => {
    setFormValues(prev => {
      const updated = { ...prev, [fieldName]: value };
      return evaluateFormulas(updated);
    });
  };

  const validate = () => {
    const requiredFields = fields.filter((f: any) => f.isRequired);
    for (const field of requiredFields) {
      if (!formValues[field.name]?.trim()) {
        Alert.alert('Required Field', `"${field.name}" is required.`);
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await updateRecord(record.id, formValues);
        await logAction({
          id: uuidv4(),
          businessId: activeBusiness?.id || '',
          tableId: table.id,
          recordId: record.id,
          action: 'Record Updated (Draft)',
          performedBy: activeBusiness?.name || 'Owner',
        });
      } else {
        const recordId = uuidv4();
        await addRecord({
          id: recordId, tableId: table.id, data: formValues,
          createdBy: activeBusiness?.name || 'Owner', requiresApproval: false,
        });
        await logAction({
          id: uuidv4(), businessId: activeBusiness?.id || '',
          tableId: table.id, recordId, action: 'Saved Draft',
          performedBy: activeBusiness?.name || 'Owner',
        });
        if (activeBusiness?.storageMode === 'googleDrive') {
          await addToSyncQueue({ id: uuidv4(), tableId: table.id, tableName: table.name, action: 'upsert', timestamp: new Date().toISOString() });
        }
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await updateRecord(record.id, formValues);
        await logAction({
          id: uuidv4(),
          businessId: activeBusiness?.id || '',
          tableId: table.id,
          recordId: record.id,
          action: 'Record Edited',
          performedBy: activeBusiness?.name || 'Owner',
          details: `Edited in ${table.name}`,
        });
      } else {
        const recordId = uuidv4();
        await addRecord({
          id: recordId, tableId: table.id, data: formValues,
          createdBy: activeBusiness?.name || 'Owner', requiresApproval: false,
        });
        await logAction({
          id: uuidv4(), businessId: activeBusiness?.id || '',
          tableId: table.id, recordId, action: 'Record Added',
          performedBy: activeBusiness?.name || 'Owner',
          details: `Added to ${table.name}`,
        });
        if (activeBusiness?.storageMode === 'googleDrive') {
          await addToSyncQueue({ id: uuidv4(), tableId: table.id, tableName: table.name, action: 'upsert', timestamp: new Date().toISOString() });
        }
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save record. Please try again.');
    } finally {
      setLoading(false);
    }
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
        title={isEdit ? `Edit ${table.name} Record` : `Add ${table.name}`}
        subtitle={isEdit ? 'Update the fields below.' : 'Add a record in seconds. Never lose a detail.'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {fields.length === 0 ? (
            <View style={styles.noFields}>
              <Ionicons name="warning-outline" size={32} color={Theme.textDim} />
              <Text style={styles.noFieldsText}>
                This table has no fields configured.{'\n'}
                Go to Admin Builder to add fields.
              </Text>
            </View>
          ) : (
            fields.map((field: any) => (
              <FormField
                key={field.id || field.name}
                label={field.name}
                type={inferFieldType(field) as any}
                value={formValues[field.name] || ''}
                onChange={(v) => setValue(field.name, v)}
                isRequired={field.isRequired === 1 || field.isRequired === true}
                options={field.options ? field.options.split(',') : undefined}
              />
            ))
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>

        {/* Footer buttons */}
        <View style={styles.footer}>
          {!isEdit && (
            <TouchableOpacity
              style={styles.draftBtn}
              onPress={handleSaveDraft}
              disabled={loading}
            >
              <Ionicons name="document-outline" size={16} color={Theme.primary} />
              <Text style={styles.draftBtnText}>Save Draft</Text>
            </TouchableOpacity>
          )}
          <GoldButton
            label={isEdit ? 'Save Changes' : 'Submit Record'}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },

  noFields: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md },
  noFieldsText: {
    ...Typography.bodyM, color: Theme.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },

  footer: {
    flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.background,
  },
  draftBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, borderWidth: 1.5, borderColor: Theme.primary,
    borderRadius: Radius.md, paddingVertical: Spacing.md,
  },
  draftBtnText: { ...Typography.label, color: Theme.primary, fontSize: 14 },
  submitBtn: { flex: 2, borderRadius: Radius.md },
});
