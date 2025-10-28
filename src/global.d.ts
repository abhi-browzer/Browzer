import type { BrowserAPI, AuthAPI } from './preload';

declare global {
  interface Window {
    browserAPI: BrowserAPI;
    authAPI: AuthAPI;
    electronAPI: {
      getDesktopSources: () => Promise<Array<{ id: string; name: string; thumbnail: any }>>;
    };
  }

  // Vite Electron Forge globals
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const MAIN_WINDOW_VITE_NAME: string;
}

export {};
