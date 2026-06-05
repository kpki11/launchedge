// src/navigation/TabNavigator.tsx
import React, { useState, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Modal, PanResponder, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { useApprovalStore } from '../store/useApprovalStore';
import HomeScreen from '../screens/HomeScreen';
import TablesHomeScreen from '../screens/TablesHomeScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AIChatScreen from '../screens/AIChatScreen';
import QuickAddSheet from '../components/QuickAddSheet';
import { useTableStore } from '../store/useTableStore';

const Tab = createBottomTabNavigator();
const { width: SW, height: SH } = Dimensions.get('window');
const FAB_SIZE = 52;

// ---------- Add button ----------
function AddTabButton({ onPress }: any) {
  return (
    <TouchableOpacity style={styles.addBtnWrapper} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.addBtn}>
        <Ionicons name="add" size={28} color={Colors.ivory} />
      </View>
    </TouchableOpacity>
  );
}

// ---------- Draggable Copilot FAB ----------
function CopilotFAB({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  // Default position: bottom-right, above tab bar
  const pan = useRef(new Animated.ValueXY({ x: SW - FAB_SIZE - 18, y: SH - 160 })).current;
  const isDragging = useRef(false);
  const lastPos    = useRef({ x: SW - FAB_SIZE - 18, y: SH - 160 });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.13, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) isDragging.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gs);
      },
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        // Clamp within screen bounds
        const rawX = lastPos.current.x + gs.dx;
        const rawY = lastPos.current.y + gs.dy;
        const clampX = Math.max(8, Math.min(SW - FAB_SIZE - 8, rawX));
        const clampY = Math.max(60, Math.min(SH - FAB_SIZE - 100, rawY));
        lastPos.current = { x: clampX, y: clampY };
        Animated.spring(pan, {
          toValue: { x: clampX, y: clampY },
          useNativeDriver: false,
          bounciness: 6,
        }).start();
        if (!isDragging.current) onPress();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.fabWrapper, { left: pan.x, top: pan.y }]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[styles.fabGlow, { transform: [{ scale: pulse }] }]} />
      <View style={styles.fab}>
        <Text style={styles.fabIcon}>✦</Text>
      </View>
    </Animated.View>
  );
}

// ---------- Tab Navigator ----------
export default function TabNavigator() {
  const { pendingCount } = useApprovalStore();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 62 + insets.bottom;
  const { tables } = useTableStore();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCopilot, setShowCopilot]   = useState(false);

  return (
    <>
      <Tab.Navigator
        id="tabs"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: insets.bottom + 6 }],
          tabBarActiveTintColor: Theme.primary,
          tabBarInactiveTintColor: Theme.textSecondary,
          tabBarLabelStyle: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginBottom: 3 },
          tabBarIcon: ({ focused, color }) => {
            const icons: Record<string, string> = {
              Home:     focused ? 'home'      : 'home-outline',
              Tables:   focused ? 'grid'      : 'grid-outline',
              Insights: focused ? 'bar-chart' : 'bar-chart-outline',
              More:     focused ? 'settings'  : 'settings-outline',
            };
            return <Ionicons name={(icons[route.name] || 'help-outline') as any} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home"     component={HomeScreen} />
        <Tab.Screen name="Tables"   component={TablesHomeScreen} />
        <Tab.Screen
          name="Add"
          component={HomeScreen}
          options={{
            tabBarLabel: '',
            tabBarButton: () => (
              <AddTabButton onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowQuickAdd(true); }} />
            ),
          }}
        />
        <Tab.Screen name="Insights" component={InsightsScreen} />
        <Tab.Screen
          name="More"
          component={SettingsScreen}
          options={{ tabBarBadge: pendingCount > 0 ? pendingCount : undefined }}
        />
      </Tab.Navigator>

      {/* Draggable Copilot FAB */}
      <CopilotFAB onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCopilot(true); }} />

      {/* Copilot Modal */}
      <Modal
        visible={showCopilot}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCopilot(false)}
      >
        <AIChatScreen onClose={() => setShowCopilot(false)} />
      </Modal>

      <QuickAddSheet
        visible={showQuickAdd}
        tables={tables}
        onClose={() => setShowQuickAdd(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FAF8F3',
    borderTopWidth: 1,
    borderTopColor: 'rgba(196,150,58,0.18)',
    height: 62,
    paddingBottom: 6,
    paddingTop: 4,
    elevation: 12,
    shadowColor: '#0C0B09',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
  },
  addBtnWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -20,
  },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#C4963A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C4963A',
    shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  fabWrapper: {
    position: 'absolute',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    width: FAB_SIZE,
    height: FAB_SIZE,
  },
  fabGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(196,150,58,0.22)',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#C4963A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C4963A',
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(250,248,243,0.35)',
  },
  fabIcon: {
    fontSize: 22,
    color: '#FAF8F3',
  },
});
