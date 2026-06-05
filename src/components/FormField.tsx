// src/components/FormField.tsx
// v1.3: Added native date picker for type === 'date' using @react-native-community/datetimepicker
// v1.2: Added 'link' type — searchable record picker modal with linkedTableId support
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Modal, FlatList, Switch, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { searchLinkedRecords, getTableFields } from '../services/database';
import DateTimePicker from '@react-native-community/datetimepicker';

interface FormFieldProps {
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'select' | 'link' | 'formula' | 'boolean';
  value: string;
  onChange: (v: string) => void;
  isRequired?: boolean;
  placeholder?: string;
  options?: string[];
  linkedTableId?: string;
  linkedTableName?: string;
}

// Parse DD/MM/YYYY → Date
function parseDMY(s: string): Date {
  if (!s) return new Date();
  const parts = s.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Format Date → DD/MM/YYYY
function formatDMY(d: Date): string {
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function FormField({
  label, type, value, onChange, isRequired,
  placeholder, options, linkedTableId, linkedTableName,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedRecords, setLinkedRecords] = useState<any[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [firstFieldName, setFirstFieldName] = useState('');

  // Resolve display value when 'value' (record ID) changes
  useEffect(() => {
    if (type !== 'link' || !value || !linkedTableId) return;
    (async () => {
      const fields = await getTableFields(linkedTableId);
      const ff = fields.find((f: any) => f.type === 'text') || fields[0];
      if (!ff) return;
      setFirstFieldName(ff.name);
      const results = await searchLinkedRecords(linkedTableId, '', 200);
      const found = results.find(r => r.id === value);
      if (found) setDisplayValue(found.data?.[ff.name] ?? value);
    })();
  }, [value, linkedTableId, type]);

  const openLinkPicker = async () => {
    if (!linkedTableId) return;
    setShowPicker(true);
    setLoadingLinks(true);
    setSearchQuery('');
    const fields = await getTableFields(linkedTableId);
    const ff = fields.find((f: any) => f.type === 'text') || fields[0];
    setFirstFieldName(ff?.name ?? '');
    const results = await searchLinkedRecords(linkedTableId, '', 50);
    setLinkedRecords(results);
    setLoadingLinks(false);
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!linkedTableId) return;
    const results = await searchLinkedRecords(linkedTableId, q, 50);
    setLinkedRecords(results);
  };

  const selectLinkedRecord = (record: any) => {
    onChange(record.id);
    setDisplayValue(record.data?.[firstFieldName] ?? record.id);
    setShowPicker(false);
  };

  // ── Formula: read-only computed
  if (type === 'formula') {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}<Text style={styles.formulaBadge}> ƒ computed</Text></Text>
        <View style={[styles.input, styles.formulaInput]}>
          <Ionicons name="calculator-outline" size={16} color={Colors.gold} style={{ marginRight: 6 }} />
          <Text style={[styles.inputText, { color: Colors.gold }]}>{value || '—'}</Text>
        </View>
      </View>
    );
  }

  // ── Boolean / Toggle
  if (type === 'boolean') {
    return (
      <View style={styles.wrapper}>
        <View style={styles.boolRow}>
          <Text style={styles.label}>{label}{isRequired ? <Text style={styles.req}> *</Text> : null}</Text>
          <Switch
            value={value === 'true'}
            onValueChange={v => onChange(v ? 'true' : 'false')}
            trackColor={{ false: Theme.border, true: Colors.gold + '80' }}
            thumbColor={value === 'true' ? Colors.gold : Theme.surface}
          />
        </View>
      </View>
    );
  }

  // ── Date picker
  if (type === 'date') {
    const dateValue = value ? parseDMY(value) : new Date();
    return (
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}{isRequired ? <Text style={styles.req}> *</Text> : null}</Text>
        <TouchableOpacity
          style={[styles.input, styles.selectInput]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={16} color={Theme.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.inputText, !value && styles.placeholder]}>
            {value || 'Select date'}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display={Platform.OS === 'android' ? 'default' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                onChange(formatDMY(selectedDate));
              }
            }}
          />
        )}
      </View>
    );
  }

  // ── Link picker
  if (type === 'link') {
    const isConfigured = !!linkedTableId;
    return (
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}{isRequired ? <Text style={styles.req}> *</Text> : null}</Text>
        <TouchableOpacity
          style={[styles.input, styles.selectInput, !isConfigured && styles.inputDisabled]}
          onPress={isConfigured ? openLinkPicker : undefined}
          activeOpacity={isConfigured ? 0.7 : 1}
        >
          <Ionicons name="link-outline" size={14} color={isConfigured ? Theme.primary : Theme.textDim} style={{ marginRight: 6 }} />
          <Text style={[styles.inputText, !displayValue && styles.placeholder]} numberOfLines={1}>
            {!isConfigured
              ? 'No table linked — configure in Admin Builder'
              : displayValue || `Select from ${linkedTableName || 'linked table'}…`}
          </Text>
          {isConfigured && <Ionicons name="chevron-down" size={16} color={Theme.textDim} />}
        </TouchableOpacity>

        <Modal visible={showPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{linkedTableName || 'Select Record'}</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Ionicons name="close" size={22} color={Theme.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color={Theme.textDim} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Search records…"
                  placeholderTextColor={Theme.textDim}
                  autoFocus
                />
              </View>
              {loadingLinks ? (
                <ActivityIndicator color={Theme.primary} style={{ margin: Spacing.xl }} />
              ) : linkedRecords.length === 0 ? (
                <View style={styles.emptyLinks}>
                  <Text style={styles.emptyLinksText}>No records found</Text>
                </View>
              ) : (
                <FlatList
                  data={linkedRecords}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => {
                    const primary = item.data?.[firstFieldName] ?? Object.values(item.data)[0];
                    const isSelected = item.id === value;
                    return (
                      <TouchableOpacity
                        style={[styles.linkRow, isSelected && styles.linkRowSelected]}
                        onPress={() => selectLinkedRecord(item)}
                      >
                        <View style={styles.linkRowContent}>
                          <Text style={[styles.linkRowPrimary, isSelected && styles.linkRowPrimarySelected]} numberOfLines={1}>
                            {String(primary ?? '—')}
                          </Text>
                          <Text style={styles.linkRowId}>{item.id.slice(-8).toUpperCase()}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={18} color={Theme.primary} />}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // ── Select picker
  if (type === 'select' && options && options.length > 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}{isRequired ? <Text style={styles.req}> *</Text> : null}</Text>
        <TouchableOpacity style={[styles.input, styles.selectInput]} onPress={() => setShowPicker(true)}>
          <Text style={value ? styles.inputText : styles.placeholder}>
            {value || `Select ${label.toLowerCase()}`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Theme.textDim} />
        </TouchableOpacity>
        <Modal visible={showPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>{label}</Text>
              <FlatList
                data={options}
                keyExtractor={i => i}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => { onChange(item); setShowPicker(false); }}
                  >
                    <Text style={[styles.optionText, item === value && styles.optionSelected]}>{item}</Text>
                    {item === value && <Ionicons name="checkmark" size={16} color={Theme.primary} />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // ── Default: text / number / currency
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}{isRequired ? <Text style={styles.req}> *</Text> : null}</Text>
      <View style={[styles.input, focused && styles.inputFocused]}>
        {type === 'currency' ? <Text style={styles.prefix}>₹ </Text> : null}
        <TextInput
          style={styles.inputText}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={type === 'number' ? 'numeric' : type === 'currency' ? 'decimal-pad' : 'default'}
          placeholder={placeholder || (type === 'currency' ? '0' : '')}
          placeholderTextColor={Theme.textDim}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:      { marginBottom: Spacing.md },
  label:        { ...Typography.label, color: Theme.textSecondary, marginBottom: Spacing.xs },
  req:          { color: Theme.danger },
  formulaBadge: { ...Typography.bodyS, color: Colors.gold, fontStyle: 'italic' },
  boolRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Theme.surface,
  },
  inputFocused:  { borderColor: Theme.primary },
  inputDisabled: { opacity: 0.55, backgroundColor: Theme.background },
  formulaInput:  { backgroundColor: 'rgba(196,150,58,0.08)', borderColor: 'rgba(196,150,58,0.35)' },
  selectInput:   { justifyContent: 'space-between' },
  prefix:        { ...Typography.bodyM, color: Theme.textSecondary, marginRight: 4 },
  inputText:     { ...Typography.bodyM, color: Theme.textPrimary, flex: 1 },
  placeholder:   { ...Typography.bodyM, color: Theme.textDim, flex: 1 },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:    {
    backgroundColor: Theme.background, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  modalTitle:  { ...Typography.headingM, color: Theme.textPrimary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    margin: Spacing.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md,
    backgroundColor: Theme.surface,
  },
  searchInput:  { ...Typography.bodyM, flex: 1, color: Theme.textPrimary },
  emptyLinks:   { padding: Spacing.xxl, alignItems: 'center' },
  emptyLinksText: { ...Typography.bodyM, color: Theme.textDim },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  linkRowSelected:  { backgroundColor: 'rgba(196,150,58,0.08)' },
  linkRowContent:   { flex: 1 },
  linkRowPrimary:   { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  linkRowPrimarySelected: { color: Theme.primary },
  linkRowId:        { ...Typography.mono, fontSize: 10, color: Theme.textDim, marginTop: 2 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  optionText:    { ...Typography.bodyM, color: Theme.textPrimary },
  optionSelected: { color: Theme.primary, fontFamily: 'DMSans_600SemiBold' },
});
