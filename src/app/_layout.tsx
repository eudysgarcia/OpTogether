import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHousehold } from '../api/household';
import { Toaster } from '../components/ui';
import { persister, queryClient } from '../lib/queryClient';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { backendConfigured, useBackend } from '../store/backend';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: 'v1' }}
          >
            <AuthProvider>
              <RootNavigator />
              <Toaster />
            </AuthProvider>
          </PersistQueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { colors, dark } = useTheme();
  const { session, loading } = useAuth();
  useBackend((s) => s.url + s.anonKey); // re-render al configurar el backend
  const configured = backendConfigured();
  const hh = useHousehold();
  const hasHousehold = !!hh.data?.household;
  const resolving = loading || (!!session && hh.isPending && !hh.data);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  useEffect(() => {
    if (!resolving) SplashScreen.hideAsync().catch(() => {});
  }, [resolving]);

  if (resolving) return null;
  // Destino según el estado: cualquier ruta protegida no accesible redirige aquí.
  const home = !configured ? '/connect' : !session ? '/sign-in' : !hasHousehold ? '/onboarding' : '/';

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!configured} redirectTo={home}>
          <Stack.Screen name="connect" />
        </Stack.Protected>
        <Stack.Protected guard={configured && !session} redirectTo={home}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={configured && !!session && !hasHousehold} redirectTo={home}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={configured && !!session && hasHousehold} redirectTo={home}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Screen name="reset-password" />
      </Stack>
    </>
  );
}
