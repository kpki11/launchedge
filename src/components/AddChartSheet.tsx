// src/components/AddChartSheet.tsx
// 3-step bottom sheet for adding a user-controlled chart to InsightsScreen.
// Step 1: Pick a table
// Step 2: Pick which field to measure (numeric fields only)
// Step 3: Pick chart type (Line / Bar / Big Number) + optional date field + optional title

import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

interface Props {
  visible: boolean;
  tables: any[];
  allFields: Record<string, any[]>;
  onAdd: (chart: {
    title: string;
    tableId: string;
    tableName: string;
    metricField: string;
    aggregation: string;
    dateField: string;
    chartType: 'line' | 'bar' | 'number';
  }) => void;
  onClose: () => void;
}

const CHART_TYPES = [
  {
    type: 'line' as const,
    label: 'Line chart — over time',
    desc: 'Shows how your metric changes day by day. Needs a date field.',
    icon: 'trending-up-outline',
  },
  {
    type: 'bar' as const,
    label: 'Bar chart — by category',
    desc: 'Compares values across groups (e.g. by customer, by product).',
    icon: 'bar-chart-outline',
  },
  {
    type: 'number' as const,
    label: 'Big number — single total',
    desc: 'Just shows the total as a large number. Clean and simple.',
    icon: 'calculator-outline',
  },
];

export default function AddChartSheet({ visible, tables, allFields, onAdd, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [selectedField, setSelectedField] = useState('');
  const [selectedDateField, setSelectedDateField] = useState('');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'number'>('bar');
  const [title, setTitle] = useState('');

  const reset = () => {
    setStep(1);
    setSelectedTable(null);
    setSelectedField('');
    setSelectedDateField('');
    setChartType('bar');
    setTitle('');
  };

  const handleClose = () => { reset(); onClose(); };

  const numericFields = selectedTable
    ? (allFields[selectedTable.id] || []).filter((f: any) =>
        f.type === 'currency' || f.type === 'number' ||
        ['amount', 'rate', 'qty', 'total', 'price', 'salary', 'wage', 'subtotal', 'cost']
          .some(k => f.name.toLowerCase().includes(k))
      )
    : [];

  const dateFields = selectedTable
    ? (allFields[selectedTable.id] || []).filter((f: any) =>
        f.type === 'date' ||
        ['date', 'day', 'month'].some(k => f.name.toLowerCase().includes(k))
      )
    : [];

  const handleAdd = () => {
    if (!selectedTable || !selectedField) return;
    const autoTitle = title.trim() || `${selectedTable.name} — ${selectedField}`;
    onAdd({
      title: autoTitle,
      tableId: selectedTable.id,
      tableName: selectedTable.name,
      metricField: selectedField,
      aggregation: 'sum',
      dateField: selectedDateField,
      chartType,
    });
    handleClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Theme.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            {step === 1 ? 'Pick a table' : step === 2 ? 'Pick a field' : 'Choose chart type'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Step dots */}
        <View style={styles.stepRow}>
          {[1, 2, 3].map(s => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Step 1: Pick table */}
          {step === 1 && tables.map((t: any) => (
            <TouchableOpacity
              key={t.id}
              style={styles.optionRow}
              onPress={() => { setSelectedTable(t); setStep(2); }}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{t.name}</Text>
                <Text style={styles.optionSub}>{t.recordCount || 0} records</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.textDim} />
            </TouchableOpacity>
          ))}

          {/* Step 2: Pick field */}
          {step === 2 && (
            numericFields.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No numeric fields in {selectedTable?.name}.</Text>
                <Text style={styles.emptySubText}>
                  Add a number or currency field to this table first.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.stepSectionLabel}>WHICH NUMBER TO TRACK</Text>
                {numericFields.map((f: any) => (
                  <TouchableOpacity
                    key={f.id || f.name}
                    style={styles.optionRow}
                    onPress={() => { setSelectedField(f.name); setStep(3); }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.optionLabel}>{f.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={Theme.textDim} />
                  </TouchableOpacity>
                ))}
              </>
            )
          )}

          {/* Step 3: Chart type + optional date field + title */}
          {step === 3 && (
            <>
              <Text style={styles.stepSectionLabel}>CHART TYPE</Text>
              {CHART_TYPES.map(ct => (
                <TouchableOpacity
                  key={ct.type}
                  style={[styles.optionRow, chartType === ct.type && styles.optionRowSelected]}
                  onPress={() => setChartType(ct.type)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={ct.icon as any} size={22} color={Theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{ct.label}</Text>
                    <Text style={styles.optionSub}>{ct.desc}</Text>
                  </View>
                  {chartType === ct.type && (
                    <Ionicons name="checkmark-circle" size={20} color={Theme.primary} />
                  )}
                </TouchableOpacity>
              ))}

              {/* Date field selector — only shown for line charts */}
              {chartType === 'line' && dateFields.length > 0 && (
                <>
                  <Text style={[styles.stepSectionLabel, { marginTop: Spacing.lg }]}>
                    DATE FIELD (for time axis)
                  </Text>
                  {dateFields.map((f: any) => (
                    <TouchableOpacity
                      key={f.id || f.name}
                      style={[styles.optionRow, selectedDateField === f.name && styles.optionRowSelected]}
                      onPress={() => setSelectedDateField(
                        selectedDateField === f.name ? '' : f.name
                      )}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.optionLabel}>{f.name}</Text>
                      {selectedDateField === f.name && (
                        <Ionicons name="checkmark-circle" size={20} color={Theme.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <Text style={[styles.stepSectionLabel, { marginTop: Spacing.lg }]}>
                CHART TITLE (OPTIONAL)
              </Text>
              <TextInput
                style={styles.labelInput}
                placeholder={`e.g. "Sales This Month"`}
                placeholderTextColor={Theme.textDim}
                value={title}
                onChangeText={setTitle}
              />

              <TouchableOpacity
                style={[styles.addBtn, (!selectedTable || !selectedField) && styles.addBtnDisabled]}
                onPress={handleAdd}
                activeOpacity={0.85}
                disabled={!selectedTable || !selectedField}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Add chart</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,11,9,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Theme.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 36, maxHeight: '82%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: Theme.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  backBtn: { marginRight: Spacing.md },
  headerTitle: { ...Typography.headingM, color: Theme.textPrimary, flex: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Theme.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  stepRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: Spacing.sm },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Theme.border },
  stepDotActive: { backgroundColor: Theme.primary },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 20 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, gap: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(196,150,58,0.08)',
    borderRadius: Radius.md, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 0, marginBottom: 1,
  },
  optionLabel: { ...Typography.headingS, color: Theme.textPrimary, flex: 1 },
  optionSub: { ...Typography.bodyS, color: Theme.textSecondary },
  stepSectionLabel: { ...Typography.labelCaps, color: Theme.textDim, marginBottom: Spacing.sm },
  labelInput: {
    backgroundColor: Theme.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Theme.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    ...Typography.bodyM, color: Theme.textPrimary,
    marginBottom: Spacing.xl,
  },
  addBtn: {
    backgroundColor: Theme.primary, borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md + 2,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { ...Typography.headingS, color: '#fff' },
  emptyState: { padding: Spacing.xl, alignItems: 'center', gap: 8 },
  emptyText: { ...Typography.headingS, color: Theme.textPrimary, textAlign: 'center' },
  emptySubText: { ...Typography.bodyS, color: Theme.textSecondary, textAlign: 'center' },
});
