import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Sesión: se guarda cifrada (Keystore de Android / Keychain de iOS) solo si el usuario eligió "Recordarme". */
export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch s
  user: { id: string; email: string };
};

const KEY = 'optogether.session.v1';
const REMEMBER = 'optogether.remember';
const LAST_EMAIL = 'optogether.lastEmail';
const web = Platform.OS === 'web';

export async function getRemember(): Promise<boolean> {
  return (await AsyncStorage.getItem(REMEMBER)) !== '0';
}

export async function setRemember(v: boolean) {
  await AsyncStorage.setItem(REMEMBER, v ? '1' : '0');
}

export const getLastEmail = () => AsyncStorage.getItem(LAST_EMAIL);
export const setLastEmail = (email: string | null) =>
  email ? AsyncStorage.setItem(LAST_EMAIL, email) : AsyncStorage.removeItem(LAST_EMAIL);

export async function loadSession(): Promise<Session | null> {
  try {
    if (!(await getRemember())) return null;
    const raw = web ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: Session | null) {
  const persist = s ? await getRemember() : false;
  if (web) {
    if (persist) await AsyncStorage.setItem(KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(KEY);
    return;
  }
  if (persist) await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(KEY);
}
