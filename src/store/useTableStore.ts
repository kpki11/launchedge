// src/store/useTableStore.ts
import { create } from 'zustand';
import { getTables, getRecords, getTableFields } from '../services/database';

interface TableStore {
  tables: any[];
  activeTable: any | null;
  records: any[];
  activeFields: any[];
  isLoading: boolean;
  loadTables: (businessId: string) => Promise<void>;
  setActiveTable: (t: any) => void;
  loadRecords: (tableId: string) => Promise<void>;
  loadFields: (tableId: string) => Promise<void>;
  refreshAll: (businessId: string) => Promise<void>;
}

export const useTableStore = create<TableStore>((set, get) => ({
  tables: [],
  activeTable: null,
  records: [],
  activeFields: [],
  isLoading: false,
  loadTables: async (businessId) => {
    set({ isLoading: true });
    const tables = await getTables(businessId);
    set({ tables, isLoading: false });
  },
  setActiveTable: (t) => set({ activeTable: t }),
  loadRecords: async (tableId) => {
    set({ isLoading: true });
    const records = await getRecords(tableId);
    set({ records, isLoading: false });
  },
  loadFields: async (tableId) => {
    const fields = await getTableFields(tableId);
    set({ activeFields: fields });
  },
  refreshAll: async (businessId) => {
    await get().loadTables(businessId);
  },
}));
