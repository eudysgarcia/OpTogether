import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform } from 'react-native';
import { isNetworkError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // datos sincronizados disponibles offline una semana
      retry: (count, err) => isNetworkError(err) && count < 2,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'online', retry: 0 },
  },
});

/** Cache persistente: permite consultar datos ya sincronizados sin conexión. */
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'optogether-cache', throttleTime: 2000 });

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)),
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}

/** Tras cualquier operación financiera se refresca todo lo derivado (saldos, presupuestos, reportes). */
export const invalidateFinance = () =>
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
