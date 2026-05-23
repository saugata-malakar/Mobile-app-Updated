import {NativeModules, Platform} from 'react-native';

/**
 * In __DEV__, point the API at the same host that serves the JS bundle (Metro).
 * - Android emulator bundle is often @10.0.2.2:8081 → API @10.0.2.2:5001
 * - Physical device on Wi‑Fi uses the machine’s LAN IP from Metro → Flask must listen on 0.0.0.0:5001
 * - With `adb reverse tcp:5001 tcp:5001`, you can instead set port to match reverse (host still from Metro URL)
 */
function resolveDevApiBaseUrl(): string {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (scriptURL) {
    const m = scriptURL.match(/:\/\/([^:/?]+)(?::(\d+))?/);
    if (m?.[1]) {
      const host = m[1];
      if (Platform.OS === 'ios' && (host === 'localhost' || host === '127.0.0.1')) {
        return 'http://localhost:5001';
      }
      // Android emulator often loads the bundle as http://localhost:8081 (adb reverse).
      // localhost inside the emulator is not the host machine — use the emulator→host alias.
      if (
        Platform.OS === 'android' &&
        (host === 'localhost' || host === '127.0.0.1')
      ) {
        return 'http://10.0.2.2:5001';
      }
      return `http://${host}:5001`;
    }
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }
  return 'http://localhost:5001';
}

/** Flask API base (Android emulator → host via Metro-derived IP when possible). */
export const API_BASE_URL = __DEV__
  ? resolveDevApiBaseUrl()
  : 'https://api.diabetescareai.in';
