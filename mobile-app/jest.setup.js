global.__OFFLINE_USE_ASYNC_ONLY__ = true;

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/tmp/hs-cache',
  writeFile: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve({isConnected: true})),
  },
}));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-biometrics', () =>
  jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn(() => Promise.resolve({available: false})),
    simplePrompt: jest.fn(() => Promise.resolve({success: false})),
  })),
);

jest.mock('react-native-signature-canvas', () => 'SignatureCanvas');
jest.mock('react-native-webview', () => ({
  WebView: () => null,
}));

