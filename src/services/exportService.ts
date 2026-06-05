// src/services/exportService.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getRecords } from './database';
import { formatDate } from '../utils/formatters';

function escapeCSV(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = rows.map(row =>
    headers.map(h => escapeCSV(row[h] ?? '')).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

export async function exportTableToCSV(
  tableId: string,
  tableName: string,
  fieldNames: string[]
): Promise<void> {
  const records = await getRecords(tableId);
  if (records.length === 0) throw new Error('No records to export');

  const allHeaders = ['ID', 'Created At', ...fieldNames];
  const rows = records.map(r => ({
    'ID': r.id,
    'Created At': formatDate(r.createdAt),
    ...r.data,
  }));

  const csv = buildCSV(allHeaders, rows);
  const safeName = tableName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeName}_${Date.now()}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  } else {
    throw new Error('Sharing not available on this device');
  }
}

export async function exportAllTablesToJSON(
  tables: any[],
  allRecords: Record<string, any[]>
): Promise<void> {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    tables: tables.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      records: allRecords[t.id] || [],
    })),
  };

  const fileName = `launchedge_backup_${Date.now()}.json`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(exportData, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, { mimeType: 'application/json' });
  }
}
