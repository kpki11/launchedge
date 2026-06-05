// src/screens/TemplateLibraryScreen.tsx
// Tagline: "Your business, pre-wired. Pick a template, start in seconds."
// Full browseable library of 30+ pre-built table templates grouped by category.
// Search, preview fields, and create in one tap.

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import { createTable } from '../services/database';
import {
  TEMPLATE_CATEGORIES,
  ALL_TEMPLATES,
  Template,
  TemplateField,
} from '../data/templates';

const uuidv4 = () =>
  'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

const COLOR_TAG_MAP: Record<string, string> = {
  gold:   '#C4963A',
  green:  '#3A9C6A',
  blue:   '#3A70C4',
  red:    '#C44A3A',
  purple: '#7A3AC4',
  teal:   '#3AAFC4',
};

const FIELD_TYPE_ICON: Record<string, string> = {
  text:     'text-outline',
  number:   'calculator-outline',
  currency: 'cash-outline',
  date:     'calendar-outline',
  select:   'list-outline',
  link:     'link-outline',
};
// Fix 6 — role-based category stripe colors
function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'finance':    return '#C4963A';
    case 'sales':      return '#7aab8a';
    case 'inventory':  return '#5A8FC4';
    case 'people':     return '#9A6AC4';
    case 'operations': return '#8A8A8A';
    default:           return '#C4963A';
  }
}

type FilterCategory = 'All' | string;

export default function TemplateLibraryScreen({ navigation }: any) {
  const { activeBusiness } = useBusinessStore();
  const { loadTables } = useTableStore();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('All');
  const [preview, setPreview] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  // Category pill list
  const categoryLabels = ['All', ...TEMPLATE_CATEGORIES.map(c => c.label)];

  // Filtered templates
  const filtered = useMemo(() => {
    let list = ALL_TEMPLATES;
    if (activeCategory !== 'All') {
      const cat = TEMPLATE_CATEGORIES.find(c => c.label === activeCategory);
      list = cat ? cat.templates : [];
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, activeCategory]);

  // Group filtered into their categories for section display
  const sections = useMemo(() => {
    if (activeCategory !== 'All' || search.trim()) {
      return [{ label: activeCategory === 'All' ? 'Search Results' : activeCategory.replace(/^.*?\s/, ''), templates: filtered }];
    }
    return TEMPLATE_CATEGORIES.map(c => ({ label: c.label, templates: c.templates }));
  }, [filtered, activeCategory, search]);

  const handleCreate = async (template: Template) => {
    if (!activeBusiness?.id) {
      Alert.alert('No Business', 'Set up your business first in Settings.');
      return;
    }
    setCreating(true);
    try {
      await createTable({
        id: uuidv4(),
        businessId: activeBusiness.id,
        name: template.name,
        icon: template.icon,
        category: template.category,
        description: template.description,
        fields: template.fields.map((f, i) => ({
          ...f,
          id: uuidv4(),
          sortOrder: i,
        })),
      });
      await loadTables(activeBusiness.id);
      setPreview(null);
      Alert.alert(
        '? Table Created',
        `"${template.name}" is ready. You can start adding records now.`,
        [
          { text: 'Go to Tables', onPress: () => navigation.navigate('MainTabs', { screen: 'Tables' }) },
          { text: 'Add Another', style: 'cancel' },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create table.');
    } finally {
      setCreating(false);
    }
  };

  const renderTemplateCard = ({ item }: { item: Template }) => {
    const accentColor = getCategoryColor(item.category);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setPreview(item)}
        activeOpacity={0.82}
      >
        {/* Color accent stripe */}
        <View style={[styles.cardStripe, { backgroundColor: getCategoryColor(item.category) }]} />

        <View style={styles.cardBody}>
          <View style={[styles.cardIconWrap, { backgroundColor: getCategoryColor(item.category) + '18' }]}><Ionicons name={(item.icon || 'document-text-outline') as any} size={24} color={getCategoryColor(item.category)} /></View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <View style={[styles.categoryBadge, { borderColor: accentColor + '60', backgroundColor: accentColor + '12' }]}>
                <Text style={[styles.categoryBadgeText, { color: accentColor }]}>{item.category}</Text>
              </View>
              <Text style={styles.fieldCount}>{item.fields.length} fields</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = ({ item }: { item: { label: string; templates: Template[] } }) => {
    if (item.templates.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{item.label}</Text>
        {item.templates.map(t => <React.Fragment key={t.id}>{renderTemplateCard({ item: t })}</React.Fragment>)}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* -- HEADER --------------------------- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Template Library</Text>
          <Text style={styles.subtitle}>{ALL_TEMPLATES.length} ready-made tables</Text>
        </View>
      </View>

      {/* -- SEARCH --------------------------- */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Theme.textDim} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search templates"
          placeholderTextColor={Theme.textDim}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={Theme.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {/* -- CATEGORY PILLS ------------------- */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContent}
        style={styles.pillsRow}
      >
        {categoryLabels.map(label => {
          const isActive = activeCategory === label;
          const cat = TEMPLATE_CATEGORIES.find(c => c.label === label);
          const emoji = cat ? cat.icon : '?';
          return (
            <TouchableOpacity
              key={label}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setActiveCategory(label)}
            >
              {label !== 'All' && <Ionicons name={emoji as any} size={13} color={isActive ? Colors.ivory : Theme.primary} />}
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {label === 'All' ? '?  All' : label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* -- TEMPLATE LIST -------------------- */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>??</Text>
          <Text style={styles.emptyTitle}>No templates found</Text>
          <Text style={styles.emptyDesc}>
            Try a different search term, or build a custom table from the Admin Builder.
          </Text>
          <TouchableOpacity style={styles.buildCustomBtn} onPress={() => navigation.navigate('AdminBuilder')}>
            <Ionicons name="construct-outline" size={16} color={Theme.primary} />
            <Text style={styles.buildCustomText}>Build Custom Table</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={item => item.label}
          renderItem={renderSection}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <TouchableOpacity style={styles.customFooter} onPress={() => navigation.navigate('AdminBuilder')}>
              <Ionicons name="construct-outline" size={18} color={Theme.primary} />
              <Text style={styles.customFooterText}>
                Don't see what you need? Build a custom table ?
              </Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* -- PREVIEW MODAL -------------------- */}
      <Modal visible={!!preview} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {preview && (
              <>
                {/* Modal header */}
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIconWrap, { backgroundColor: (COLOR_TAG_MAP[preview.colorTag] || Colors.gold) + '1A' }]}>
                    <Text style={styles.modalIcon}>{preview.icon}</Text>
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>{preview.name}</Text>
                    <Text style={styles.modalCategory}>{preview.category}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setPreview(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={22} color={Theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalDesc}>{preview.description}</Text>

                {/* Field preview */}
                <Text style={styles.modalFieldsLabel}>
                  FIELDS INCLUDED ({preview.fields.length})
                </Text>
                <ScrollView style={styles.modalFieldsScroll} showsVerticalScrollIndicator={false}>
                  {preview.fields.map((f: TemplateField, i: number) => (
                    <View key={i} style={styles.fieldRow}>
                      <View style={styles.fieldIconWrap}>
                        <Ionicons
                          name={(FIELD_TYPE_ICON[f.type] || 'text-outline') as any}
                          size={14}
                          color={Theme.textSecondary}
                        />
                      </View>
                      <Text style={styles.fieldName}>{f.name}</Text>
                      <View style={styles.fieldTypeBadge}>
                        <Text style={styles.fieldTypeText}>{f.type}</Text>
                      </View>
                      {f.isRequired && (
                        <View style={styles.requiredBadge}>
                          <Text style={styles.requiredText}>req</Text>
                        </View>
                      )}
                    </View>
                  ))}

                  {/* Options preview for select fields */}
                  {preview.fields.filter(f => f.type === 'select' && f.options).length > 0 && (
                    <View style={styles.optionsHint}>
                      <Ionicons name="information-circle-outline" size={13} color={Theme.textDim} />
                      <Text style={styles.optionsHintText}>
                        Select fields come pre-loaded with relevant options. You can edit them anytime in the Admin Builder.
                      </Text>
                    </View>
                  )}
                  <View style={{ height: Spacing.xl }} />
                </ScrollView>

                {/* Action buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setPreview(null)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.createBtn,
                      { backgroundColor: COLOR_TAG_MAP[preview.colorTag] || Colors.gold },
                    ]}
                    onPress={() => handleCreate(preview)}
                    disabled={creating}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={Colors.ivory} />
                    <Text style={styles.createBtnText}>
                      {creating ? 'Creating' : 'Add This Table'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
  },
  headerText: { flex: 1 },
  title: { ...Typography.headingL, color: Theme.textPrimary },
  subtitle: { ...Typography.bodyS, color: Theme.textSecondary },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Theme.border,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    ...Typography.bodyM,
    color: Theme.textPrimary,
    paddingVertical: Spacing.md,
  },
  clearBtn: { padding: 4 },

  // Category pills
  pillsRow: { maxHeight: 48 },
  pillsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  pillActive: {
    backgroundColor: Theme.primary,
    borderColor: Theme.primary,
  },
  pillEmoji: { fontSize: 13 },
  pillText: { ...Typography.label, color: Theme.textSecondary, fontSize: 11, maxWidth: 90 },
  pillTextActive: { color: Colors.ivory },

  // Section list
  listContent: { padding: Spacing.lg, paddingTop: Spacing.md },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    ...Typography.labelCaps,
    color: Theme.textSecondary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },

  // Template card
  card: {
    flexDirection: 'row',
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Theme.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cardStripe: { width: 4 },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  cardIconWrap: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardMeta: { flex: 1 },
  cardName: { ...Typography.headingS, color: Theme.textPrimary, marginBottom: 4 },
  cardDesc: { ...Typography.bodyS, color: Theme.textSecondary, lineHeight: 19, marginBottom: Spacing.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  categoryBadge: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryBadgeText: { fontSize: 11, fontFamily: 'DMSans_500Medium' },
  fieldCount: { ...Typography.bodyS, color: Theme.textDim },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...Typography.headingM, color: Theme.textPrimary },
  emptyDesc: { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  buildCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Theme.border,
    backgroundColor: Theme.surface,
  },
  buildCustomText: { ...Typography.label, color: Theme.primary },

  // Footer
  customFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  customFooterText: { ...Typography.bodyM, color: Theme.primary },

  // Preview modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12,11,9,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Theme.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '88%',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl ?? 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIcon: { fontSize: 28 },
  modalHeaderText: { flex: 1 },
  modalTitle: { ...Typography.headingL, color: Theme.textPrimary },
  modalCategory: { ...Typography.bodyS, color: Theme.textSecondary },
  modalClose: { padding: Spacing.sm },

  modalDesc: {
    ...Typography.bodyM,
    color: Theme.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },

  modalFieldsLabel: {
    ...Typography.labelCaps,
    color: Theme.textSecondary,
    marginBottom: Spacing.md,
  },
  modalFieldsScroll: { maxHeight: 280 },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  fieldIconWrap: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    backgroundColor: Theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
  },
  fieldName: { ...Typography.bodyM, color: Theme.textPrimary, flex: 1 },
  fieldTypeBadge: {
    backgroundColor: Theme.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  fieldTypeText: { fontSize: 10, color: Theme.textDim, fontFamily: 'JetBrainsMono_400Regular' },
  requiredBadge: {
    backgroundColor: '#C44A3A18',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#C44A3A40',
  },
  requiredText: { fontSize: 10, color: '#C44A3A', fontFamily: 'DMSans_500Medium' },

  optionsHint: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Theme.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  optionsHintText: { ...Typography.bodyS, color: Theme.textDim, flex: 1, lineHeight: 18 },

  // Modal action buttons
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.surface,
  },
  cancelBtnText: { ...Typography.label, color: Theme.textSecondary },
  createBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  createBtnText: { ...Typography.label, color: Colors.ivory, fontSize: 15 },
});






