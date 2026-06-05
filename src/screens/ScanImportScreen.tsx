// src/screens/ScanImportScreen.tsx
// v2.1 � Added screenFade/screenSlide entrance animation refs + useEffect.
//
// FLOW:
//   menu ? [pick file] ? (if >1 sheet) sheetPicker ? preview ? selectTable | createTable ? importing
//
// PERSISTENCE:
//   After a successful parse, the ParsedFile (headers + rows) is saved to
//   AsyncStorage. On next open the menu shows a "Continue with <filename>"
//   card so the user never has to re-pick the same file.
//
// FILE READING:
//   Uses native fetch() on the content:// URI from DocumentPicker.
//   NO expo-file-system � not even /legacy � zero deprecated-API issues.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert,
  ActivityIndicator, ScrollView, TextInput, BackHandler, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Theme, Colors } from '../theme/colors';
import { TutorialToggleButton, Hintable } from '../components/TutorialOverlay';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import { getTables, createTable, addRecordsBatch, getTableFields } from '../services/database';
import { ParticleField, GlowOrb } from '../components/ParticleField';

const SAVED_FILE_KEY = 'launchedge:last_import_file_v2';

// --- Types -------------------------------------------------------------------

interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  fileName: string;
  sheetName: string;
}

// sheetPicker = user must choose which Excel sheet to import
type Step = 'menu' | 'sheetPicker' | 'preview' | 'selectTable' | 'createTable' | 'importing';

// --- Helpers -----------------------------------------------------------------

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/** Read the raw workbook from a content:// or file:// URI using fetch(). */
async function readWorkbook(asset: { uri: string; name: string }): Promise<XLSX.WorkBook> {
  const isCSV = /\.(csv|tsv)$/i.test(asset.name ?? '');
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error(`Could not open file (HTTP ${response.status})`);

  if (isCSV) {
    const text = await response.text();
    if (!text || text.trim().length === 0) throw new Error('The file is empty.');
    return XLSX.read(text, { type: 'string' });
  } else {
    const blob = await response.blob();
    const b64 = await blobToBase64(blob);
    if (!b64) throw new Error('File read returned empty data.');
    return XLSX.read(b64, { type: 'base64' });
  }
}

/** Parse a specific sheet from an already-loaded workbook into a ParsedFile. */
function parseSheet(workbook: XLSX.WorkBook, sheetName: string, fileName: string): ParsedFile {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found.`);

  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (rawRows.length === 0) {
    const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = ((grid?.[0] ?? []) as any[]).map(String).filter(Boolean);
    if (headers.length === 0) throw new Error('No column headers found. Is the first row a header row?');
    return { headers, rows: [], totalRows: 0, fileName, sheetName };
  }

  const headers = Object.keys(rawRows[0]).filter(Boolean);
  if (headers.length === 0) throw new Error('No column headers detected.');

  const rows = rawRows.map((r) => {
    const clean: Record<string, string> = {};
    headers.forEach((h) => { clean[h] = String(r[h] ?? ''); });
    return clean;
  });

  return { headers, rows, totalRows: rows.length, fileName, sheetName };
}

// --- Persistence helpers ------------------------------------------------------

async function saveFileToStorage(file: ParsedFile): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_FILE_KEY, JSON.stringify(file));
  } catch (e) {
    console.warn('Could not save file to AsyncStorage:', e);
  }
}

async function loadFileFromStorage(): Promise<ParsedFile | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_FILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function clearSavedFile(): Promise<void> {
  try { await AsyncStorage.removeItem(SAVED_FILE_KEY); } catch { /* ignore */ }
}

// --- Component ---------------------------------------------------------------

export default function ScanImportScreen() {
  const navigation = useNavigation<any>();
  const { activeBusiness } = useBusinessStore();
  const { loadTables } = useTableStore();

  const [step, setStep] = useState<Step>('menu');
  const [tables, setTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [savedFile, setSavedFile] = useState<ParsedFile | null>(null);   // from AsyncStorage
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);  // held for sheet picker
  const [pendingAsset, setPendingAsset] = useState<{ uri: string; name: string } | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [creatingTable, setCreatingTable] = useState(false);
  const [intent, setIntent] = useState<'addRecord' | 'import'>('import');

  // Ref to resetState so BackHandler closure doesn't go stale
  const resetStateRef = useRef<(() => void) | null>(null);

  // -- Entrance animation refs ------------------------------------------------
  const screenFade  = useRef(new Animated.Value(0)).current;
  const screenSlide = useRef(new Animated.Value(18)).current;

  // Load saved file on mount + fire entrance animation
  useEffect(() => {
    loadFileFromStorage().then(setSavedFile);
    Animated.parallel([
      Animated.timing(screenFade,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(screenSlide, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchTables = useCallback(async () => {
    if (!activeBusiness?.id) return;
    setLoadingTables(true);
    try { setTables(await getTables(activeBusiness.id)); }
    catch (e) { console.error('fetchTables:', e); }
    finally { setLoadingTables(false); }
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (step === 'selectTable') fetchTables();
  }, [step, fetchTables]);

  // Hardware back button: go to menu instead of leaving the tab
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (step !== 'menu') {
          if (step === 'selectTable' || step === 'createTable') setStep('preview');
          else if (step === 'preview' || step === 'sheetPicker') resetStateRef.current?.();
          else resetStateRef.current?.();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [step])
  );

  // -- Pick file -------------------------------------------------------------

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const supported = ['.csv', '.xlsx', '.xls', '.ods', '.tsv'];
      if (!supported.some((e) => asset.name?.toLowerCase().endsWith(e))) {
        Alert.alert('Unsupported file', `Supported: Excel (.xlsx .xls), CSV (.csv), ODS (.ods)\n\nYou picked: ${asset.name}`);
        return;
      }

      setParsing(true);
      try {
        const wb = await readWorkbook(asset);

        if (wb.SheetNames.length > 1) {
          setWorkbook(wb);
          setPendingAsset(asset);
          setStep('sheetPicker');
          return;
        }

        // Single sheet � go straight to preview
        const pf = parseSheet(wb, wb.SheetNames[0], asset.name ?? 'file');
        await saveFileToStorage(pf);
        setSavedFile(pf);
        setParsedFile(pf);
        setStep('preview');
      } catch (e: any) {
        Alert.alert('Could not read file', e?.message ?? 'Unknown error');
      } finally {
        setParsing(false);
      }
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        Alert.alert('Picker error', e?.message ?? 'Unknown error');
      }
    }
  };

  const handleSheetSelect = async (sheetName: string) => {
    if (!workbook || !pendingAsset) return;
    setParsing(true);
    try {
      const pf = parseSheet(workbook, sheetName, pendingAsset.name ?? 'file');
      await saveFileToStorage(pf);
      setSavedFile(pf);
      setParsedFile(pf);
      setStep('preview');
    } catch (e: any) {
      Alert.alert('Parse error', e?.message ?? 'Unknown error');
    } finally {
      setParsing(false);
    }
  };

  const handleUseSavedFile = () => {
    if (!savedFile) return;
    setParsedFile(savedFile);
    setStep('preview');
  };

  const handleClearSavedFile = async () => {
    await clearSavedFile();
    setSavedFile(null);
  };

  // -- Import records --------------------------------------------------------

  const runImport = async (tableId: string) => {
    if (!parsedFile || !activeBusiness?.id) return;
    setStep('importing');
    try {
      const tableFields = await getTableFields(tableId);
      const fieldNames = tableFields.map((f: any) => f.name);
      const rows = parsedFile.rows.map(row => {
        const data: Record<string, string> = {};
        fieldNames.forEach((name: string) => {
          // Try exact match, then case-insensitive
          const val = row[name] ??
            row[Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase()) ?? ''] ??
            '';
          data[name] = String(val);
        });
        return data;
      });
      await addRecordsBatch(tableId, rows, 'owner');
      if (activeBusiness?.id) await loadTables(activeBusiness.id);
      await clearSavedFile();
      setSavedFile(null);
      Alert.alert('Import Complete', `${rows.length} records added successfully.`, [
        { text: 'View Table', onPress: () => {
          const table = tables.find(t => t.id === tableId);
          if (table) navigation.navigate('TableDetail', { table });
          else resetState();
        }},
        { text: 'Done', onPress: resetState },
      ]);
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? 'Unknown error');
      setStep('selectTable');
    }
  };

  const handleTableSelect = (table: any) => {
    if (!parsedFile) return;
    Alert.alert(
      'Import into table',
      `Import ${parsedFile.totalRows} rows into "${table.name}"?\n\nColumns will be matched by name.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: () => runImport(table.id) },
      ]
    );
  };

  const handleCreateAndImport = async () => {
    if (!newTableName.trim()) { Alert.alert('Required', 'Please enter a table name.'); return; }
    if (!parsedFile || !activeBusiness?.id) return;
    setCreatingTable(true);
    try {
      const tableId = `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fields = parsedFile.headers.map((h, i) => ({
        name: h, type: 'text' as const, isRequired: false, defaultValue: '', options: '', sortOrder: i,
      }));
      await createTable({
        id: tableId, businessId: activeBusiness.id, name: newTableName.trim(),
        icon: 'grid', category: 'Custom', description: '', fields,
      });
      await runImport(tableId);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create table.');
      setStep('createTable');
    } finally {
      setCreatingTable(false);
    }
  };

  const resetState = () => {
    setStep('menu');
    setParsedFile(null);
    setNewTableName('');
    setWorkbook(null);
    setPendingAsset(null);
    setIntent('import');
    // Keep savedFile intact � user may want to import again
  };
  resetStateRef.current = resetState;

  // --- Render: Importing ----------------------------------------------------

  if (step === 'importing') {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={Theme.primary} />
        <Text style={styles.statusText}>Importing records�</Text>
        <Text style={styles.statusSub}>Please wait, do not close the app.</Text>
      </SafeAreaView>
    );
  }

  // --- Render: Sheet picker -------------------------------------------------

  if (step === 'sheetPicker' && workbook) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={resetState} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Choose a Sheet</Text>
            <Text style={styles.sheetSub}>{pendingAsset?.name} � {workbook.SheetNames.length} sheets found</Text>
          </View>
        </View>
        {parsing
          ? <ActivityIndicator style={{ marginTop: Spacing.xxl }} color={Theme.primary} />
          : <FlatList
              data={workbook.SheetNames}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.tableList}
              renderItem={({ item, index }) => (
                <TouchableOpacity style={styles.tableRow} onPress={() => handleSheetSelect(item)}>
                  <View style={styles.tableIcon}>
                    <Ionicons name="grid-outline" size={20} color={Theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableName}>{item}</Text>
                    <Text style={styles.tableCount}>Sheet {index + 1}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Theme.textSecondary} />
                </TouchableOpacity>
              )}
            />
        }
      </SafeAreaView>
    );
  }

  // --- Render: Preview ------------------------------------------------------

  if (step === 'preview' && parsedFile) {
    const preview = parsedFile.rows.slice(0, 3);
    const isCSV = parsedFile.fileName.toLowerCase().endsWith('.csv');
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={resetState} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.sheetTitle}>File Preview</Text>
        </View>
        <ScrollView contentContainerStyle={styles.previewContainer}>
          <View style={styles.fileBanner}>
            <Ionicons name={isCSV ? 'document-text' : 'grid'} size={22} color={Theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName}>{parsedFile.fileName}</Text>
              <Text style={styles.fileStats}>
                Sheet: {parsedFile.sheetName} � {parsedFile.totalRows} rows � {parsedFile.headers.length} cols
              </Text>
            </View>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.successText}>Ready</Text>
            </View>
          </View>

          <Text style={styles.previewLabel}>Columns detected</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
            {parsedFile.headers.map((h, i) => (
              <View key={i} style={styles.colChip}><Text style={styles.colChipText}>{h}</Text></View>
            ))}
          </ScrollView>

          {preview.length > 0 && (
            <>
              <Text style={styles.previewLabel}>First {preview.length} row{preview.length !== 1 ? 's' : ''}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.previewHeaderRow}>
                    {parsedFile.headers.map((h, i) => <Text key={i} style={styles.previewHeaderCell}>{h}</Text>)}
                  </View>
                  {preview.map((row, ri) => (
                    <View key={ri} style={[styles.previewDataRow, ri % 2 === 1 && styles.previewDataRowAlt]}>
                      {parsedFile.headers.map((h, ci) => (
                        <Text key={ci} style={styles.previewDataCell} numberOfLines={1}>{row[h] || '-'}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
              {parsedFile.totalRows > 3 && <Text style={styles.moreRows}>+ {parsedFile.totalRows - 3} more rows</Text>}
            </>
          )}

          <Text style={[styles.previewLabel, { marginTop: Spacing.xl }]}>Where to import?</Text>
          <TouchableOpacity style={styles.goldBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('selectTable'); }}>
            <Ionicons name="arrow-forward" size={18} color={Colors.ivory} />
            <Text style={styles.goldBtnText}>Choose Existing Table</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('createTable'); }}>
            <Ionicons name="add-circle-outline" size={18} color={Theme.primary} />
            <Text style={styles.outlineBtnText}>Create New Table & Import</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Render: Create table -------------------------------------------------

  if (step === 'createTable') {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('preview'); }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.sheetTitle}>Create New Table</Text>
        </View>
        <ScrollView contentContainerStyle={styles.createContainer}>
          <Text style={styles.fieldLabel}>Table Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Products, Expenses, Staff"
            placeholderTextColor={Theme.textDim}
            value={newTableName}
            onChangeText={setNewTableName}
            autoFocus
          />
          {parsedFile && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>
                Fields from your file ({parsedFile.headers.length} columns)
              </Text>
              {parsedFile.headers.map((h, i) => (
                <View key={i} style={styles.fieldChip}>
                  <Ionicons name="reorder-two" size={16} color={Theme.textSecondary} />
                  <Text style={styles.fieldChipText}>{h}</Text>
                  <View style={styles.fieldTypeBadge}><Text style={styles.fieldTypeText}>text</Text></View>
                </View>
              ))}
              <Text style={styles.hint}>Field types can be changed later in Admin Builder.</Text>
            </>
          )}
          <TouchableOpacity
            style={[styles.goldBtn, creatingTable && { opacity: 0.6 }]}
            onPress={handleCreateAndImport}
            disabled={creatingTable}
          >
            {creatingTable
              ? <ActivityIndicator color={Colors.ivory} />
              : <>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.ivory} />
                  <Text style={styles.goldBtnText}>
                    Create Table & Import {parsedFile?.totalRows} Records
                  </Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Render: Select table -------------------------------------------------

  if (step === 'selectTable') {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('preview'); }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.sheetTitle}>Select a Table</Text>
        </View>
        {parsedFile && (
          <View style={styles.fileBannerSmall}>
            <Ionicons name="document-text" size={14} color={Theme.primary} />
            <Text style={styles.fileBannerSmallText}>
              {parsedFile.totalRows} rows from "{parsedFile.fileName}" � sheet "{parsedFile.sheetName}"
            </Text>
          </View>
        )}
        {loadingTables
          ? <ActivityIndicator style={{ marginTop: Spacing.xxl }} color={Theme.primary} />
          : <FlatList
              data={tables}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.tableList}
              ListEmptyComponent={<Text style={styles.emptyText}>No tables yet.</Text>}
              ListFooterComponent={
                <TouchableOpacity style={styles.createTableRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('createTable'); }}>
                  <View style={styles.createTableIcon}><Ionicons name="add" size={22} color={Theme.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.createTableLabel}>Create New Table</Text>
                    <Text style={styles.createTableSub}>Create a table and import this file into it</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Theme.textSecondary} />
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.tableRow} onPress={() => handleTableSelect(item)}>
                  <View style={styles.tableIcon}>
                    <Ionicons name={(item.icon as any) ?? 'grid'} size={20} color={Theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableName}>{item.name}</Text>
                    <Text style={styles.tableCount}>{item.recordCount ?? 0} records</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Theme.textSecondary} />
                </TouchableOpacity>
              )}
            />
        }
      </SafeAreaView>
    );
  }

  // --- Render: Main menu ----------------------------------------------------

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Background particles and glows � visible, not clipped */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ParticleField variant="full" count={12} height={900} />
        <GlowOrb x={-30} y={100} size={160} color="rgba(196,150,58,0.10)" />
        <GlowOrb x={250} y={500} size={120} color="rgba(196,150,58,0.08)" />
      </View>

      {/* Animated entrance wrapper for all menu content */}
      <Animated.View style={{ flex: 1, opacity: screenFade, transform: [{ translateY: screenSlide }] }}>
        {/* Header */}
        <View style={styles.menuHeader}>
          <View>
            <Text style={styles.title}>Add or Import</Text>
            <Text style={styles.subtitle}>Scan it, snap it, import it. Done.</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
          {/* Saved file resume card */}
          {savedFile && (
            <View style={styles.savedCard}>
              <View style={styles.savedCardLeft}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedCardTitle} numberOfLines={1}>{savedFile.fileName}</Text>
                  <Text style={styles.savedCardSub}>
                    Sheet: {savedFile.sheetName} � {savedFile.totalRows} rows � {savedFile.headers.length} cols
                  </Text>
                </View>
              </View>
              <View style={styles.savedCardActions}>
                <TouchableOpacity style={styles.savedResumeBtn} onPress={handleUseSavedFile}>
                  <Text style={styles.savedResumeBtnText}>Import Again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClearSavedFile} style={styles.savedCloseBtn}>
                  <Ionicons name="close-circle" size={24} color={Theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.optionList}>
            <Hintable hintId="scan_add_record">
            <TouchableOpacity style={styles.optionCard} onPress={() => { setIntent('addRecord'); setStep('selectTable'); }}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(196,150,58,0.12)' }]}>
                <Ionicons name="add-circle" size={28} color={Theme.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Add Record</Text>
                <Text style={styles.optionSub}>Manually fill in a new record to any table</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.textSecondary} />
            </TouchableOpacity>
            </Hintable>

            <Hintable hintId="scan_document">
            <TouchableOpacity style={styles.optionCard} onPress={() => Alert.alert('Coming Soon', 'Document scanning will be available in the next update.')}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(74,122,199,0.12)' }]}>
                <Ionicons name="scan" size={28} color={Colors.info} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Scan Document</Text>
                <Text style={styles.optionSub}>Point camera at a bill or form to auto-fill</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.textSecondary} />
            </TouchableOpacity>
            </Hintable>

            <Hintable hintId="scan_import_file">
            <TouchableOpacity style={styles.optionCard} onPress={handlePickFile} disabled={parsing}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(74,140,126,0.12)' }]}>
                {parsing ? <ActivityIndicator color={Colors.success} /> : <Ionicons name="document-text" size={28} color={Colors.success} />}
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Import File</Text>
                <Text style={styles.optionSub}>Import records from CSV or Excel (.xlsx)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.textSecondary} />
            </TouchableOpacity>
            </Hintable>
          </View>

          {/* Info section */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={Theme.primary} />
            <Text style={styles.infoText}>
              CSV / Excel files are read directly on your device. Your data never leaves your phone.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Theme.background },
  center: { flex: 1, backgroundColor: Theme.background, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  statusText: { ...Typography.headingM, color: Theme.textPrimary },
  statusSub: { ...Typography.bodyM, color: Theme.textSecondary },

  menuHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  title: { ...Typography.displayM, color: Theme.textPrimary },
  subtitle: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 2 },

  savedCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(74,140,126,0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(74,140,126,0.25)',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  savedCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  savedCardTitle: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  savedCardSub: { ...Typography.bodyS, color: Theme.textSecondary },
  savedCardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  savedResumeBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: Theme.primary, borderRadius: Radius.md,
  },
  savedResumeBtnText: { ...Typography.label, color: Colors.ivory, fontSize: 12 },
  savedCloseBtn: { padding: 2 },

  optionList: { padding: Spacing.md, gap: Spacing.sm },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Theme.border,
  },
  optionIcon: { width: 52, height: 52, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  optionText: { flex: 1 },
  optionTitle: { ...Typography.headingS, color: Theme.textPrimary },
  optionSub: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 2, lineHeight: 18 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: 'rgba(196,150,58,0.08)',
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(196,150,58,0.18)',
  },
  infoText: { ...Typography.bodyS, color: Theme.textSecondary, flex: 1, lineHeight: 18 },

  // Sheet picker / sub-screens
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
    backgroundColor: Theme.background,
  },
  backBtn: { padding: Spacing.xs },
  sheetTitle: { ...Typography.headingM, color: Theme.textPrimary },
  sheetSub: { ...Typography.bodyS, color: Theme.textSecondary },

  tableList: { padding: Spacing.md, gap: Spacing.sm },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Theme.border,
  },
  tableIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: 'rgba(196,150,58,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  tableName: { ...Typography.headingS, color: Theme.textPrimary },
  tableCount: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 1 },
  createTableRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Theme.background, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1.5, borderColor: Theme.border, borderStyle: 'dashed',
  },
  createTableIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: 'rgba(196,150,58,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  createTableLabel: { ...Typography.headingS, color: Theme.primary },
  createTableSub: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 1 },
  emptyText: { ...Typography.bodyM, color: Theme.textDim, textAlign: 'center', padding: Spacing.xl },

  // Preview
  previewContainer: { padding: Spacing.lg, gap: Spacing.md },
  fileBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Theme.border,
  },
  fileName: { ...Typography.headingS, color: Theme.textPrimary },
  fileStats: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 1 },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  successText: { ...Typography.label, color: Colors.success, fontSize: 12 },
  fileBannerSmall: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(196,150,58,0.08)',
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  fileBannerSmallText: { ...Typography.bodyS, color: Theme.textSecondary },
  previewLabel: { ...Typography.label, color: Theme.textSecondary },
  colChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 4, marginRight: Spacing.xs,
    backgroundColor: Theme.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Theme.border,
  },
  colChipText: { ...Typography.bodyS, color: Theme.textPrimary },
  previewHeaderRow: { flexDirection: 'row', backgroundColor: 'rgba(196,150,58,0.10)' },
  previewHeaderCell: { ...Typography.label, color: Theme.primary, width: 120, padding: Spacing.sm, fontSize: 11 },
  previewDataRow: { flexDirection: 'row' },
  previewDataRowAlt: { backgroundColor: 'rgba(0,0,0,0.03)' },
  previewDataCell: { ...Typography.bodyS, color: Theme.textPrimary, width: 120, padding: Spacing.sm },
  moreRows: { ...Typography.bodyS, color: Theme.textDim, textAlign: 'center', marginTop: Spacing.sm },
  goldBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Theme.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  goldBtnText: { ...Typography.label, color: Colors.ivory },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderWidth: 1.5, borderColor: Theme.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, backgroundColor: Theme.background,
  },
  outlineBtnText: { ...Typography.label, color: Theme.primary },

  // Create table
  createContainer: { padding: Spacing.lg, gap: Spacing.sm },
  fieldLabel: { ...Typography.label, color: Theme.textSecondary },
  input: {
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md,
    backgroundColor: Theme.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    ...Typography.bodyM, color: Theme.textPrimary,
  },
  fieldChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Theme.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Theme.border,
  },
  fieldChipText: { ...Typography.bodyM, color: Theme.textPrimary, flex: 1 },
  fieldTypeBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    backgroundColor: 'rgba(196,150,58,0.12)', borderRadius: Radius.full,
  },
  fieldTypeText: { ...Typography.bodyS, color: Colors.gold, fontSize: 10 },
  hint: { ...Typography.bodyS, color: Theme.textDim, fontStyle: 'italic' },
});
