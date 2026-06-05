// src/components/QuickAddSheet.tsx
// Bottom sheet that opens when the user taps the centre "+" tab button.
// Shows all tables for quick record entry in one tap.
// ✅ Session 6: Fixed handleScanImport — navigate('ScanImport') instead of broken MainTabs/Add path

import React, { useEffect, useRef } from 'react';
import {
  Animated, FlatList, Modal, StyleSheet, Text,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Theme } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

interface Props {
  visible: boolean;
  tables: any[];
  onClose: () => void;
}

export default function QuickAddSheet({ visible, tables, onClose }: Props) {
  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0,   duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1,   duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleTablePress = (table: any) => {
    onClose();
    setTimeout(() => {
      navigation.navigate('AddRecord', { table });
    }, 150);
  };

  const handleScanImport = () => {
    onClose();
    setTimeout(() => {
      // Navigate to ScanImport as a stack screen (registered in AppNavigator)
      // Previously: navigate('MainTabs', { screen: 'Add' }) — caused "action NAVIGATE not handled" error
      navigation.getParent()?.navigate('ScanImport');
    }, 150);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      {/* Dark backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add to which table?</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={Theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Table list */}
        {tables.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="grid-outline" size={36} color={Theme.textSecondary} />
            <Text style={styles.emptyText}>No tables yet.</Text>
            <Text style={styles.emptySubText}>Create a table first in the Tables tab.</Text>
          </View>
        ) : (
          <FlatList
            data={tables}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: table }) => (
              <TouchableOpacity
                style={styles.tableRow}
                onPress={() => handleTablePress(table)}
                activeOpacity={0.75}
              >
                <View style={styles.tableIcon}>
                  {table.icon && /\p{Emoji}/u.test(table.icon)
                    ? <Text style={{ fontSize: 18 }}>{table.icon}</Text>
                    : <Ionicons name={(table.icon || 'grid-outline') as any} size={18} color={Theme.primary} />
                  }
                </View>
                <View style={styles.tableInfo}>
                  <Text style={styles.tableName}>{table.name}</Text>
                  <Text style={styles.tableCount}>{table.recordCount || 0} records</Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={Theme.primary} />
              </TouchableOpacity>
            )}
          />
        )}

        {/* Scan/Import option at the bottom */}
        <TouchableOpacity style={styles.scanRow} onPress={handleScanImport} activeOpacity={0.75}>
          <Ionicons name="scan-outline" size={18} color={Theme.textSecondary} />
          <Text style={styles.scanText}>Or scan / import from CSV</Text>
          <Ionicons name="chevron-forward" size={16} color={Theme.textSecondary} />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,11,9,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Theme.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  headerTitle: {
    ...Typography.headingM,
    color: Theme.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${Theme.border}88`,
    gap: Spacing.md,
  },
  tableIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(196,150,58,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableInfo: {
    flex: 1,
  },
  tableName: {
    ...Typography.headingS,
    color: Theme.textPrimary,
  },
  tableCount: {
    ...Typography.bodyS,
    color: Theme.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    ...Typography.headingS,
    color: Theme.textPrimary,
  },
  emptySubText: {
    ...Typography.bodyS,
    color: Theme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    gap: Spacing.sm,
  },
  scanText: {
    ...Typography.bodyM,
    color: Theme.textSecondary,
    flex: 1,
  },
});
