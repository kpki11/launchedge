// src/store/useBusinessStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveBusiness, clearAllData } from '../services/database';

export interface Business {
  id: string;
  name: string;
  type: string;
  storageMode: 'local' | 'googleDrive';
  googleEmail?: string;
  joinCode?: string;
  isOwner?: number; // 1 = owner, 0 = joined member
}

export type PinnedMetric = {
  id: string;
  type: 'built-in' | 'custom';
  builtIn?: 'sales' | 'expenses' | 'lowstock' | 'pending';
  tableId?: string;
  tableName?: string;
  fieldName?: string;
  aggregation?: 'sum' | 'count' | 'latest';
  label?: string;
  icon?: string;
};

const DEFAULT_PINNED_METRICS: PinnedMetric[] = [
  { id: 'built-in-sales',    type: 'built-in', builtIn: 'sales',    icon: 'cash-outline' },
  { id: 'built-in-expenses', type: 'built-in', builtIn: 'expenses', icon: 'trending-down-outline' },
  { id: 'built-in-lowstock', type: 'built-in', builtIn: 'lowstock', icon: 'cube-outline' },
  { id: 'built-in-pending',  type: 'built-in', builtIn: 'pending',  icon: 'time-outline' },
];

interface BusinessStore {
  activeBusiness: Business | null;
  isLoading: boolean;
  isOnboarded: boolean;
  requireApprovalNew: boolean;
  requireApprovalEdit: boolean;
  pinnedMetrics: PinnedMetric[];
  setBusiness: (b: Business) => void;
  setLoading: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;
  setRequireApprovalNew: (v: boolean) => void;
  setRequireApprovalEdit: (v: boolean) => void;
  loadBusiness: () => Promise<void>;
  addPinnedMetric: (metric: PinnedMetric) => void;
  removePinnedMetric: (id: string) => void;
  setPinnedMetrics: (metrics: PinnedMetric[]) => void;
  savePinnedMetrics: (metrics: PinnedMetric[]) => Promise<void>;
  loadPinnedMetrics: () => Promise<void>;
  logout: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useBusinessStore = create<BusinessStore>()(
  persist(
    (set, get) => ({
      activeBusiness: null,
      isLoading: false,
      isOnboarded: false,
      requireApprovalNew: false,
      requireApprovalEdit: false,
      pinnedMetrics: DEFAULT_PINNED_METRICS,

      setBusiness: (b) => set({ activeBusiness: b }),
      setLoading: (v) => set({ isLoading: v }),
      setOnboarded: (v) => set({ isOnboarded: v }),
      setRequireApprovalNew: (v) => set({ requireApprovalNew: v }),
      setRequireApprovalEdit: (v) => set({ requireApprovalEdit: v }),

      loadBusiness: async () => {
        set({ isLoading: true });
        const b = await getActiveBusiness();
        set({ activeBusiness: b || null, isLoading: false, isOnboarded: !!b });
        await get().loadPinnedMetrics();
      },

      addPinnedMetric: (metric) => {
        const updated = [...get().pinnedMetrics, metric];
        set({ pinnedMetrics: updated });
        get().savePinnedMetrics(updated);
      },

      removePinnedMetric: (id) => {
        const updated = get().pinnedMetrics.filter(m => m.id !== id);
        set({ pinnedMetrics: updated });
        get().savePinnedMetrics(updated);
      },

      setPinnedMetrics: (metrics) => {
        set({ pinnedMetrics: metrics });
        get().savePinnedMetrics(metrics);
      },

      savePinnedMetrics: async (metrics) => {
        try {
          await AsyncStorage.setItem('pinnedMetrics', JSON.stringify(metrics));
        } catch (e) {
          console.warn('Could not save pinnedMetrics:', e);
        }
      },

      logout: async () => {
        await AsyncStorage.multiRemove(['business-storage', 'pinnedMetrics']);
        set({
          activeBusiness: null,
          isOnboarded: false,
          pinnedMetrics: DEFAULT_PINNED_METRICS,
        });
      },

      clearAllData: async () => {
        await clearAllData();
        await AsyncStorage.multiRemove(['business-storage', 'pinnedMetrics', 'launchedge:onboarding_done', 'launchedge:last_import_file_v2']);
        set({
          activeBusiness: null,
          isOnboarded: false,
          pinnedMetrics: DEFAULT_PINNED_METRICS,
        });
      },

      loadPinnedMetrics: async () => {
        try {
          const raw = await AsyncStorage.getItem('pinnedMetrics');
          if (raw) {
            const parsed = JSON.parse(raw);
            set({ pinnedMetrics: parsed });
          }
        } catch (e) {
          console.warn('Could not load pinnedMetrics:', e);
        }
      },
    }),
    {
      name: 'business-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

