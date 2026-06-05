// src/store/useApprovalStore.ts
import { create } from 'zustand';
import { getPendingApprovals, approveRecord, rejectRecord } from '../services/database';

interface ApprovalStore {
  pendingApprovals: any[];
  allApprovals: any[];
  pendingCount: number;
  isLoading: boolean;
  loadApprovals: (businessId: string) => Promise<void>;
  approve: (id: string, by: string) => Promise<void>;
  reject: (id: string, by: string, note: string) => Promise<void>;
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pendingApprovals: [],
  allApprovals: [],
  pendingCount: 0,
  isLoading: false,
  loadApprovals: async (businessId) => {
    set({ isLoading: true });
    const items = await getPendingApprovals(businessId);
    set({ pendingApprovals: items, pendingCount: items.length, isLoading: false });
  },
  approve: async (id, by) => {
    await approveRecord(id, by);
    set(s => ({
      pendingApprovals: s.pendingApprovals.filter(a => a.id !== id),
      pendingCount: Math.max(0, s.pendingCount - 1),
    }));
  },
  reject: async (id, by, note) => {
    await rejectRecord(id, by, note);
    set(s => ({
      pendingApprovals: s.pendingApprovals.filter(a => a.id !== id),
      pendingCount: Math.max(0, s.pendingCount - 1),
    }));
  },
}));
