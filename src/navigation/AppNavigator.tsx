// src/navigation/AppNavigator.tsx
// v3 - Fix: after onboarding, explicitly reset nav to MainTabs so user never
//      gets stuck on "Setting up...". Belt-and-suspenders alongside stack swap.
import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useBusinessStore } from '../store/useBusinessStore';
import { initDatabase } from '../services/database';
import { Theme } from '../theme/colors';
import LandingScreen from '../screens/LandingScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import JoinBusinessScreen from '../screens/JoinBusinessScreen';
import TabNavigator from './TabNavigator';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { activeBusiness, isOnboarded: storeIsOnboarded, loadBusiness } = useBusinessStore();
  const [bootstrapping, setBootstrapping] = useState(true);
  const navRef = useRef<NavigationContainerRef<any>>(null);
  const prevOnboarded = useRef(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initDatabase();
        await loadBusiness();
      } catch (e) {
        console.error('[AppNavigator] Bootstrap error:', e);
      } finally {
        setBootstrapping(false);
      }
    };
    bootstrap();
  }, []);

  // When activeBusiness flips from null ? truthy (just finished onboarding),
  // force-navigate to MainTabs so we never hang on "Setting up..."
  useEffect(() => {
    const isNow = !!activeBusiness;
    if (!prevOnboarded.current && isNow && !bootstrapping) {
      setTimeout(() => {
        try {
          navRef.current?.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        } catch (_) {}
      }, 80);
    }
    prevOnboarded.current = isNow;
  }, [activeBusiness, bootstrapping]);

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Theme.primary} size="large" />
      </View>
    );
  }

  const isOnboarded = !!activeBusiness;

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
        {!isOnboarded ? (
          <>
            <Stack.Screen name="Landing"       component={LandingScreen} />
            <Stack.Screen name="Onboarding"    component={OnboardingScreen} />
            <Stack.Screen name="JoinBusiness"  component={JoinBusinessScreen} />
            <Stack.Screen name="Terms"         component={require('../screens/TermsScreen').default} />
            <Stack.Screen name="PrivacyPolicy" component={require('../screens/PrivacyPolicyScreen').default} />
            {/* MainTabs included here so reset() can target it immediately after onboarding */}
            <Stack.Screen name="MainTabs"      component={TabNavigator} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs"        component={TabNavigator} />
            <Stack.Screen name="TableDetail"     component={require('../screens/TableDetailScreen').default} />
            <Stack.Screen name="AddRecord"       component={require('../screens/AddRecordScreen').default} />
            <Stack.Screen name="RecordDetail"    component={require('../screens/RecordDetailScreen').default} />
            <Stack.Screen name="AdminBuilder"    component={require('../screens/AdminBuilderScreen').default} />
            <Stack.Screen name="Approvals"       component={require('../screens/ApprovalsScreen').default} />
            <Stack.Screen name="TemplateLibrary" component={require('../screens/TemplateLibraryScreen').default} />
            <Stack.Screen name="MySubmissions"   component={require('../screens/MySubmissionsScreen').default} />
            <Stack.Screen name="DataCleaning"    component={require('../screens/DataCleaningScreen').default} />
            <Stack.Screen name="AnalyticsWizard" component={require('../screens/AnalyticsWizardScreen').default} />
            <Stack.Screen name="PrivacyPolicy"   component={require('../screens/PrivacyPolicyScreen').default} />
            <Stack.Screen name="Terms"           component={require('../screens/TermsScreen').default} />
            <Stack.Screen name="ScanImport"      component={require('../screens/ScanImportScreen').default} />
            <Stack.Screen name="Today"           component={require('../screens/TodayScreen').default} />
            <Stack.Screen name="Onboarding"      component={require('../screens/OnboardingScreen').default} />
            <Stack.Screen name="JoinBusiness"    component={require('../screens/JoinBusinessScreen').default} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
