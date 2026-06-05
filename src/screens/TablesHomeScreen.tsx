// src/screens/TablesHomeScreen.tsx
// v2.2 — Hintable wraps + TutorialToggleButton added to header and table cards.
import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ScrollView, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { TableCard } from '../components/TableCard';
import { EmptyStateIllustration } from '../components/EmptyStateIllustration';
import { TutorialToggleButton, Hintable } from '../components/TutorialOverlay';
import { ParticleField, GlowOrb } from '../components/ParticleField';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import { deleteTable } from '../services/database';

const CATEGORIES = ['All', 'Finance', 'Sales', 'Inventory', 'People', 'Operations', 'Logistics', 'Compliance', 'Custom'];

export default function TablesHomeScreen({ navigation }: any) {
  const { activeBusiness } = useBusinessStore();
  const { tables, isLoading, loadTables } = useTableStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const cardAnims = useRef(Array(20).fill(null).map(() => ({
    opacity: new Animated.Value(0),
    scale:   new Animated.Value(0.94),
  }))).current;

  useEffect(() => {
    if (activeBusiness?.id) loadTables(activeBusiness.id);
  }, [activeBusiness?.id]);

  const filtered = tables.filter((t: any) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || t.category === activeCategory;
    return matchSearch && matchCat;
  });

  useEffect(() => {
    cardAnims.forEach(a => { a.opacity.setValue(0); a.scale.setValue(0.94); });
    Animated.stagger(55, filtered.slice(0, 20).map((_, i) =>
      Animated.parallel([
        Animated.timing(cardAnims[i].opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(cardAnims[i].scale,   { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      ])
    )).start();
  }, [filtered.length, activeCategory, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeBusiness?.id) await loadTables(activeBusiness.id);
    setRefreshing(false);
  };

  const handleLongPressTable = (item: any) => {
    Alert.alert(
      'Delete Table',
      `Permanently delete "${item.name}" and all its records?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTable(item.id);
              if (activeBusiness?.id) await loadTables(activeBusiness.id);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete table.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Background decorations - full screen */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        <ParticleField variant="full" count={18} height={1400} />
        <GlowOrb x={-40} y={80}  size={200} color="rgba(196,150,58,0.09)" />
        <GlowOrb x={180} y={500} size={160} color="rgba(196,150,58,0.08)" />
      </View>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Tables</Text>
            <Text style={styles.tagline}>All your business data, organized.</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={styles.templateBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('TemplateLibrary'); }}
            >
              <Ionicons name="library-outline" size={16} color={Theme.primary} />
              <Text style={styles.templateBtnLabel}>Templates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('AdminBuilder'); }}
            >
              <Ionicons name="add" size={20} color={Colors.ivory} />
            </TouchableOpacity>
            <TutorialToggleButton />
          </View>
        </View>

        {/* Search bar */}
        <Hintable hintId="tables_search" style={{}}><View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tables..."
            placeholderTextColor={Theme.textDim}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View></Hintable>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, activeCategory === cat && styles.chipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* TABLE COUNT BAR */}
      {tables.length > 0 && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {filtered.length} of {tables.length} table{tables.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* GRID */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          {tables.length === 0 ? (
            <>
              <EmptyStateIllustration
                variant="flame"
                title="No tables yet"
                subtitle="Start from a pre-built template or build your own from scratch."
              />
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('TemplateLibrary'); }}
              >
                <Ionicons name="library-outline" size={18} color={Colors.ivory} />
                <Text style={styles.emptyPrimaryBtnText}>Browse Template Library</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptySecondaryBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('AdminBuilder'); }}
              >
                <Ionicons name="construct-outline" size={16} color={Theme.primary} />
                <Text style={styles.emptySecondaryBtnText}>Build Custom Table</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={36} color={Theme.textDim} />
              <Text style={styles.emptyTitle}>No match</Text>
              <Text style={styles.emptyDesc}>No tables matching your filter.</Text>
              <TouchableOpacity
                style={styles.emptySecondaryBtn}
                onPress={() => { setSearch(''); setActiveCategory('All'); }}
              >
                <Text style={styles.emptySecondaryBtnText}>Clear filters</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={Theme.primary} colors={[Theme.primary]} />
          }
          renderItem={({ item, index }) => {
            const anim = cardAnims[Math.min(index, cardAnims.length - 1)];
            return (
              <Animated.View style={{
                flex: 1,
                opacity: anim.opacity,
                transform: [{ scale: anim.scale }],
              }}>
                <Hintable
                  hintId="tables_card"
                  onPress={() => navigation.navigate('TableDetail', { table: item })}
                  style={{ flex: 1 }}
                >
                  <TableCard
                    name={item.name}
                    icon={item.icon || 'grid-outline'}
                    recordCount={item.recordCount || 0}
                    updatedAt={item.updatedAt || item.createdAt}
                    category={item.category}
                    onPress={() => navigation.navigate('TableDetail', { table: item })}
                    onLongPress={() => handleLongPressTable(item)}
                  />
                </Hintable>
              </Animated.View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },

  header: {
    backgroundColor: Theme.background,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    paddingBottom: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  title: { ...Typography.displayM, color: Theme.textPrimary },
  tagline: { ...Typography.bodyS, color: Theme.textSecondary },

  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Theme.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Theme.primaryLight ?? '#FDF6E7',
  },
  templateBtnLabel: { ...Typography.label, color: Theme.primary, fontSize: 12 },

  newBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Theme.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Theme.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyM,
    color: Theme.textPrimary,
  },

  chips: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.surface,
  },
  chipActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  chipText: { ...Typography.label, color: Theme.textSecondary, fontSize: 12 },
  chipTextActive: { color: Colors.ivory },

  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.background,
  },
  countText: { ...Typography.bodyS, color: Theme.textDim },

  grid: { padding: Spacing.sm },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(196,150,58,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.headingL, color: Theme.textPrimary },
  emptyDesc: {
    ...Typography.bodyM,
    color: Theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Theme.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  emptyPrimaryBtnText: { ...Typography.label, color: Colors.ivory, fontSize: 15 },
  emptySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Theme.surface,
  },
  emptySecondaryBtnText: { ...Typography.label, color: Theme.primary },
});

