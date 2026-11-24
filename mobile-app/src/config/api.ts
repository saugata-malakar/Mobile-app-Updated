import {NativeModules, Platform} from 'react-native';
import RNFS from 'react-native-fs';

export const DEFAULT_LAN_URL = 'http://192.168.31.94:8000';
export const DEFAULT_EMULATOR_URL = 'http://10.0.2.2:8000';
export const DEFAULT_LOCALHOST_URL = 'http://localhost:8000';

const SERVER_URL_FILE = `${RNFS.DocumentDirectoryPath}/diabetescare_server_url.txt`;

function resolveDevApiBaseUrl(): string {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (scriptURL) {
    const m = scriptURL.match(/:\/\/([^:/?]+)(?::(\d+))?/);
    if (m?.[1]) {
      const host = m[1];
      if (Platform.OS === 'ios' && (host === 'localhost' || host === '127.0.0.1')) {
        return DEFAULT_LOCALHOST_URL;
      }
      if (
        Platform.OS === 'android' &&
        (host === 'localhost' || host === '127.0.0.1')
      ) {
        return DEFAULT_EMULATOR_URL;
      }
      return `http://${host}:8000`;
    }
  }
  if (Platform.OS === 'android') {
    return DEFAULT_EMULATOR_URL;
  }
  return DEFAULT_LAN_URL;
}

const initialDefaultUrl =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? resolveDevApiBaseUrl()
    : DEFAULT_LAN_URL;

let customApiBaseUrl: string | null = null;

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return initialDefaultUrl;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

export function getApiBaseUrl(): string {
  return customApiBaseUrl || initialDefaultUrl;
}

export async function initApiBaseUrl(): Promise<string> {
  try {
    const exists = await RNFS.exists(SERVER_URL_FILE);
    if (exists) {
      const saved = await RNFS.readFile(SERVER_URL_FILE, 'utf8');
      if (saved && saved.trim()) {
        customApiBaseUrl = normalizeBaseUrl(saved);
      }
    }
  } catch {
    // fallback to detected URL
  }
  return getApiBaseUrl();
}

export async function setApiBaseUrl(url: string): Promise<string> {
  const normalized = normalizeBaseUrl(url);
  customApiBaseUrl = normalized;
  try {
    await RNFS.writeFile(SERVER_URL_FILE, normalized, 'utf8');
  } catch {
    // keep in memory even if disk write fails
  }
  return normalized;
}

export async function resetApiBaseUrl(): Promise<string> {
  customApiBaseUrl = null;
  try {
    const exists = await RNFS.exists(SERVER_URL_FILE);
    if (exists) {
      await RNFS.unlink(SERVER_URL_FILE);
    }
  } catch {
    // ignore
  }
  return getApiBaseUrl();
}

export const API_BASE_URL = initialDefaultUrl;
