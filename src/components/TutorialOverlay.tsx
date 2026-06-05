// src/components/TutorialOverlay.tsx
// v3: Exit Help works from any screen · banner auto-dismisses after 4s · badge inside element
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

const { width: SW, height: SH } = Dimensions.get('window');

export interface HintDef {
  id: string;
  title: string;
  body: string;
  icon?: string;
}

export const HINTS: Record<string, HintDef> = {
  home_hero:        { id: 'home_hero',        icon: 'flame-outline',          title: 'Your Dashboard',            body: 'This is your command centre. All your key business numbers are here at a glance.' },
  home_metrics:     { id: 'home_metrics',     icon: 'stats-chart-outline',    title: 'Your Metrics',              body: 'These tiles show live totals pulled from your tables. Tap Edit to pin or remove metrics.' },
  home_edit_btn:    { id: 'home_edit_btn',    icon: 'create-outline',         title: 'Edit Metrics',              body: 'Tap Edit to enter edit mode. You can remove tiles by tapping the red X, or add a new metric.' },
  home_kpi_sales:   { id: 'home_kpi_sales',   icon: 'cash-outline',           title: 'Total Sales',               body: 'Sum of all amounts in tables marked as "Revenue". Set up via Analytics Wizard.' },
  home_kpi_exp:     { id: 'home_kpi_exp',     icon: 'trending-down-outline',  title: 'Total Expenses',            body: 'Sum of all amounts in tables marked as "Expense". Set up via Analytics Wizard.' },
  home_kpi_stock:   { id: 'home_kpi_stock',   icon: 'cube-outline',           title: 'Low Stock',                 body: 'Count of inventory items at or below the reorder level (10 units).' },
  home_kpi_pending: { id: 'home_kpi_pending', icon: 'time-outline',           title: 'Pending Approval',          body: 'Records waiting for your approval before they are committed to the table.' },
  home_quick_add:   { id: 'home_quick_add',   icon: 'add-circle-outline',     title: 'Add Entry',                 body: 'Quickly add a new record to any table without leaving the home screen.' },
  home_quick_scan:  { id: 'home_quick_scan',  icon: 'scan-outline',           title: 'Scan / Import',             body: 'Import records in bulk from a CSV or Excel file, or scan a document with your camera.' },
  home_quick_search:{ id: 'home_quick_search',icon: 'search-outline',         title: 'Search Tables',             body: 'Jump straight to the Tables screen and search across all your data.' },
  home_tables_row:  { id: 'home_tables_row',  icon: 'grid-outline',           title: 'Your Tables',               body: 'A quick glance at your most recent tables. Tap any pill to open it, or go to the Tables tab for all.' },
  home_activity:    { id: 'home_activity',    icon: 'pulse-outline',          title: 'Recent Activity',           body: 'A live log of every record added, edited, or approved in the last 24 hours.' },
  home_quick_today: { id: 'home_quick_today', icon: 'today-outline',          title: 'Today View',                body: 'Jump straight to the Today screen for your daily overview - greeting, KPIs, quick actions, and recent activity.' },
  tables_grid:      { id: 'tables_grid',      icon: 'grid-outline',           title: 'Tables Grid',               body: 'Each card is a table. Tap to open it and view or add records. Long-press to delete.' },
  tables_search:    { id: 'tables_search',    icon: 'search-outline',         title: 'Search Tables',             body: 'Filter your tables by name. Use the category chips to filter by Finance, Sales, etc.' },
  tables_template:  { id: 'tables_template',  icon: 'library-outline',        title: 'Template Library',          body: 'Choose from 29 ready-made table templates built for Indian MSMEs. You can customise them after adding.' },
  tables_new:       { id: 'tables_new',       icon: 'add-circle-outline',     title: 'New Table',                 body: 'Build a custom table from scratch. Define fields, types, and approval rules.' },
  tables_card:      { id: 'tables_card',      icon: 'albums-outline',         title: 'Table Card',                body: 'Shows the table name, number of records, and when it was last updated. Long-press to delete.' },
  fab_plus:         { id: 'fab_plus',         icon: 'add-circle-outline',     title: 'Quick Add',                 body: 'Opens the Quick Add sheet where you can add a record to any table or import a CSV file.' },
  insights_charts:  { id: 'insights_charts',  icon: 'bar-chart-outline',      title: 'Charts',                    body: 'Tap the + button to create a chart from any numeric field in your tables.' },
  insights_date:    { id: 'insights_date',    icon: 'calendar-outline',       title: 'Date Filter',               body: 'Filter all chart data by Today, This Week, This Month, or a custom date range.' },
  insights_alerts:  { id: 'insights_alerts',  icon: 'alert-circle-outline',   title: 'Alerts',                    body: 'Automatic alerts for low stock and overdue items. Configured via Analytics Wizard.' },
  settings_biz:     { id: 'settings_biz',     icon: 'business-outline',       title: 'Business Profile',          body: 'Your business name and type. Tap the pencil to rename your business.' },
  settings_reset:   { id: 'settings_reset',   icon: 'refresh-outline',        title: 'Reset Everything',          body: 'Wipes all data and restarts the app completely. Use this to start fresh from onboarding.' },
  settings_approvals:{ id:'settings_approvals',icon: 'checkmark-circle-outline',title: 'Approval Rules',          body: 'When enabled, new records need your approval before they are saved. Good for team setups.' },
  settings_export:  { id: 'settings_export',  icon: 'download-outline',       title: 'Export Data',               body: 'Download all your table data as CSV files you can open in Excel or Google Sheets.' },
  settings_join:    { id: 'settings_join',    icon: 'people-outline',         title: 'Team Join Code',            body: 'Share this 6-character code with team members so they can join and submit records for approval.' },
  admin_tables:     { id: 'admin_tables',     icon: 'grid-outline',           title: 'Your Tables',               body: 'All the custom tables you have built. Tap a table to manage its fields, analytics, and links.' },
  admin_add_table:  { id: 'admin_add_table',  icon: 'add-circle-outline',     title: 'Create Table',              body: 'Build a brand-new table from scratch. You will define its name, fields, and data types.' },
  admin_fields_tab: { id: 'admin_fields_tab', icon: 'list-outline',           title: 'Fields Tab',                body: 'View and manage every field in this table. Tap Add Field to insert a new column.' },
  admin_add_field:     { id: 'admin_add_field',     icon: 'create-outline',         title: 'Add Field',              body: 'Add a new column to this table. Choose from text, number, currency, date, select, or link types.' },
  admin_analytics_role: { id: 'admin_analytics_role', icon: 'bar-chart-outline',   title: 'Analytics Role',            body: 'Tell the app how to treat this table in Insights. Revenue tables power sales charts; inventory tables track stock levels.' },
  admin_analytics_save: { id: 'admin_analytics_save', icon: 'save-outline',         title: 'Save Analytics Config',     body: 'Saves the analytics role and field mappings for this table so Insights can build charts and KPIs from it.' },
  admin_relationships: { id: 'admin_relationships', icon: 'link-outline',         title: 'Table Relationships',       body: 'Link a field in this table to a field in another table. Useful for relating Orders to Customers, for example.' },
  admin_add_link:      { id: 'admin_add_link',      icon: 'add-circle-outline',   title: 'Add Link',                  body: 'Create a new relationship between tables. Choose the local field, target table, and target field to link them.' },
  admin_rel_row:       { id: 'admin_rel_row',       icon: 'link-outline',          title: 'Table Link',                body: 'This link connects a field in this table to a field in another table. Tap the trash icon to remove it.' },
  admin_analytics_amount_field: { id: 'admin_analytics_amount_field', icon: 'cash-outline', title: 'Amount Field',   body: 'Choose which field holds the monetary or quantity value. This powers revenue totals and stock counts.' },
  admin_analytics_date_field:   { id: 'admin_analytics_date_field',   icon: 'calendar-outline', title: 'Date Field', body: 'Choose a date field to enable time-based filtering in Insights - monthly, weekly, and daily views.' },
  admin_analytics_target:       { id: 'admin_analytics_target',       icon: 'trophy-outline', title: 'Monthly Target', body: 'Set a revenue target for this table. Insights will show how close you are to hitting it each month.' },
  admin_analytics_reorder:      { id: 'admin_analytics_reorder',      icon: 'warning-outline', title: 'Reorder Level', body: 'Optional: pick a field that stores the reorder threshold. Items below this threshold show as Low Stock on the dashboard.' },
  scan_add_record:  { id: 'scan_add_record',  icon: 'add-circle-outline',     title: 'Add Record',                body: 'Manually fill in a new record to any of your tables step by step.' },
  scan_document:    { id: 'scan_document',    icon: 'scan-outline',           title: 'Scan Document',             body: 'Point your camera at a bill, invoice, or form and the app will auto-fill a new record for you.' },
  scan_import_file: { id: 'scan_import_file', icon: 'document-text-outline',  title: 'Import File',               body: 'Pick a CSV or Excel file from your device and map its columns to any existing table in seconds.' },
  approval_card:    { id: 'approval_card',    icon: 'checkmark-circle-outline',title: 'Approval Card',            body: 'Each card is a record waiting for your review. Tap Approve to commit it or Reject to discard with a note.' },
  onboard_name:     { id: 'onboard_name',     icon: 'storefront-outline',     title: 'Business Name',             body: 'Enter the name of your business. This appears on your dashboard and in exports.' },
  onboard_type:     { id: 'onboard_type',     icon: 'briefcase-outline',      title: 'Business Type',             body: 'Selecting your type helps us suggest the most relevant table templates for your industry.' },
  onboard_storage:  { id: 'onboard_storage',  icon: 'server-outline',         title: 'Storage Choice',            body: 'Local keeps data only on this phone. Google Drive backs it up to your personal account. We never store your data.' },
  onboard_templates:{ id: 'onboard_templates',icon: 'albums-outline',         title: 'Table Templates',           body: 'These are pre-built tables for common business needs. Select any you want, or skip and create your own later.' },
};

// --- Context -------------------------------------------------------------------

interface TutorialCtx {
  showHint: (hintId: string, anchorY?: number) => void;
  isTutorialMode: boolean;
  setTutorialMode: (v: boolean) => void;
  exitTutorialMode: () => void;
}

const TutorialContext = createContext<TutorialCtx>({
  showHint: () => {},
  isTutorialMode: false,
  setTutorialMode: () => {},
  exitTutorialMode: () => {},
});

export function useTutorial() {
  return useContext(TutorialContext);
}

// --- Provider -----------------------------------------------------------------

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isTutorialMode, setTutorialModeState] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [activeHint, setActiveHint] = useState<HintDef | null>(null);
  const [anchorY, setAnchorY] = useState(200);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const bannerFade = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single exit function — works from any screen
  const exitTutorialMode = useCallback(() => {
    setTutorialModeState(false);
    setActiveHint(null);
    setBannerVisible(false);
    bannerFade.setValue(0);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  const setTutorialMode = useCallback((v: boolean) => {
    if (!v) { exitTutorialMode(); return; }
    setTutorialModeState(true);
    setActiveHint(null);
    // Show banner, auto-dismiss after 4s
    setBannerVisible(true);
    bannerFade.setValue(0);
    Animated.timing(bannerFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerFade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setBannerVisible(false);
      });
    }, 4000);
  }, [exitTutorialMode]);

  const showHint = useCallback((hintId: string, ay?: number) => {
    const hint = HINTS[hintId];
    if (!hint) return;
    setActiveHint(hint);
    setAnchorY(ay ?? SH / 2);
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  const dismiss = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setActiveHint(null);
    });
  }, []);

  const tooltipY = Math.min(Math.max(anchorY - 20, 60), SH - 260);

  return (
    <TutorialContext.Provider value={{ showHint, isTutorialMode, setTutorialMode, exitTutorialMode }}>
      {children}

      {/* Banner — auto-dismisses after 4s */}
      {isTutorialMode && bannerVisible && !activeHint && (
        <Animated.View style={[s.tutorialBanner, { opacity: bannerFade }]} pointerEvents="none">
          <Ionicons name="help-circle" size={16} color={Colors.gold} />
          <Text style={s.tutorialBannerText}>Tutorial mode  —  tap any element to learn what it does</Text>
        </Animated.View>
      )}

      {/* Tooltip overlay */}
      {activeHint && (
        <Modal transparent animationType="none" onRequestClose={dismiss}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={dismiss}>
            <Animated.View
              style={[s.tooltip, { top: tooltipY, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              <View style={s.tooltipAccent} />
              <View style={s.tooltipHeader}>
                {activeHint.icon && (
                  <View style={s.tooltipIconWrap}>
                    <Ionicons name={activeHint.icon as any} size={18} color={Theme.primary} />
                  </View>
                )}
                <Text style={s.tooltipTitle}>{activeHint.title}</Text>
                <TouchableOpacity onPress={dismiss} style={s.dismissBtn}>
                  <Ionicons name="close" size={18} color={Theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={s.tooltipBody}>{activeHint.body}</Text>
              <TouchableOpacity style={s.gotItBtn} onPress={dismiss}>
                <Text style={s.gotItText}>Got it</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
    </TutorialContext.Provider>
  );
}

// --- Hintable wrapper ---------------------------------------------------------

interface HintableProps {
  hintId: string;
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
}

export function Hintable({ hintId, children, onPress, style, disabled }: HintableProps) {
  const { isTutorialMode, showHint } = useTutorial();
  const ref = useRef<View>(null);

  const handleTutorialPress = useCallback(() => {
    ref.current?.measure((_x, _y, _w, _h, _px, py) => {
      showHint(hintId, py);
    });
  }, [hintId, showHint]);

  if (isTutorialMode) {
    return (
      <View ref={ref} style={[{ position: 'relative' }, style]}>
        {children}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleTutorialPress}
          activeOpacity={0.15}
        />
        {/* Badge sits INSIDE the element at bottom-right — no overflow clipping issues */}
        <View style={s.hintBadge} pointerEvents="none">
          <Ionicons name="help-circle" size={12} color={Colors.ivory} />
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={style} disabled={disabled}>
      {children}
    </TouchableOpacity>
  );
}

// TutorialToggleButton — calls exitTutorialMode() so it works from ANY screen
export function TutorialToggleButton() {
  const { isTutorialMode, exitTutorialMode, setTutorialMode } = useTutorial();
  return (
    <TouchableOpacity
      style={[s.toggleBtn, isTutorialMode && s.toggleBtnActive]}
      onPress={() => isTutorialMode ? exitTutorialMode() : setTutorialMode(true)}
      activeOpacity={0.75}
    >
      <Ionicons
        name={isTutorialMode ? 'close-circle-outline' : 'help-circle-outline'}
        size={18}
        color={isTutorialMode ? Colors.ivory : Theme.primary}
      />
      <Text style={[s.toggleBtnText, isTutorialMode && s.toggleBtnTextActive]}>
        {isTutorialMode ? 'Exit Help' : 'Help'}
      </Text>
    </TouchableOpacity>
  );
}

// --- Styles -------------------------------------------------------------------

const s = StyleSheet.create({
  tutorialBanner: {
    position: 'absolute',
    bottom: 80,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: 'rgba(12,11,9,0.90)',
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    zIndex: 999,
  },
  tutorialBannerText: {
    ...Typography.bodyS,
    color: Colors.ivory,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,11,9,0.45)',
  },
  tooltip: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Theme.background,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Theme.primary,
    padding: Spacing.xl,
    shadowColor: '#0C0B09',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 16,
  },
  tooltipAccent: {
    position: 'absolute',
    top: 0,
    left: Spacing.xl,
    width: 40,
    height: 3,
    backgroundColor: Theme.primary,
    borderRadius: 2,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  tooltipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipTitle: {
    ...Typography.headingS,
    color: Theme.textPrimary,
    flex: 1,
  },
  dismissBtn: { padding: 4 },
  tooltipBody: {
    ...Typography.bodyM,
    color: Theme.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  gotItBtn: {
    alignSelf: 'flex-end',
    backgroundColor: Theme.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  gotItText: {
    ...Typography.label,
    color: Colors.ivory,
    fontFamily: 'DMSans_600SemiBold',
  },
  // Badge sits INSIDE the element (bottom-right), not floating outside
  hintBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: Theme.primary,
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Theme.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Theme.surface,
  },
  toggleBtnActive: {
    backgroundColor: Theme.primary,
    borderColor: Theme.primary,
  },
  toggleBtnText: {
    ...Typography.label,
    color: Theme.primary,
    fontSize: 12,
  },
  toggleBtnTextActive: {
    color: Colors.ivory,
  },
});
