// src/components/SyncBadge.tsx
// v2: Shows real pending sync count from the queue.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { hasPendingSync, getSyncQueue } from '../services/syncService';

export function SyncBadge() {
  const { activeBusiness } = useBusinessStore();
  const isCloud = activeBusiness?.storageMode === 'googleDrive';
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const queue = await getSyncQueue();
      if (!cancelled) setPending(queue.length);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const hasPending = isCloud && pending > 0;
  const dotColor = !isCloud ? Colors.dim : hasPending ? '#e8a030' : Colors.success;
  const label = !isCloud ? 'Local' : hasPending ? `Syncing (${pending})` : 'Synced';

  return (
    <View style={[styles.badge, { backgroundColor: isCloud ? 'rgba(74,140,126,0.12)' : 'rgba(160,152,128,0.12)' }]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, { color: dotColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { ...Typography.labelCaps, fontSize: 10 },
});