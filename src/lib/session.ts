import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Sesión: el refresh token se guarda cifrado (Keystore de Android / Keychain de iOS). */
export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch s
  user: { id: string; email: string };
};

const KEY = 'optogether.session.v1';
const web = Platform.OS === 'web';

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = web ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: Session | null) {
  if (web) {
    if (s) await AsyncStorage.setItem(KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(KEY);
    return;
  }
  if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(KEY);
}
