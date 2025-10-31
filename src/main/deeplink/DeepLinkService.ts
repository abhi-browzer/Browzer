import { app, BaseWindow, WebContents } from 'electron';
import { getRouteFromURL } from '@/shared/routes';

/**
 * DeepLinkService - Simple deep link handler
 * 
 * Responsibilities:
 * 1. Listen for OS deep link events (open-url, second-instance)
 * 2. Parse browzer:// URLs
 * 3. Send to renderer for navigation
 * 
 * Examples:
 * - browzer://settings
 * - browzer://auth/confirm-signup
 */

export interface DeepLinkData {
  url: string;
  showInTab: boolean;
  params?: Record<string, string>; // Query params or hash fragments
}

export class DeepLinkService {
  private static instance: DeepLinkService | null = null;
  private baseWindow: BaseWindow | null = null;
  private webContents: WebContents | null = null;
  private pendingDeepLink: string | null = null;

  private constructor() {
    this.setupDeepLinkHandlers();
  }

  public static getInstance(): DeepLinkService {
    if (!DeepLinkService.instance) {
      DeepLinkService.instance = new DeepLinkService();
    }
    return DeepLinkService.instance;
  }

  /**
   * Set the browser window instance for sending deep link events
   */
  public setWindow(window: BaseWindow, webContents: WebContents): void {
    this.baseWindow = window;
    this.webContents = webContents;
    
    // Process any pending deep link
    if (this.pendingDeepLink) {
      console.log('[DeepLinkService] Processing pending deep link:', this.pendingDeepLink);
      this.handleDeepLink(this.pendingDeepLink);
      this.pendingDeepLink = null;
    }
  }

  /**
   * Setup deep link event handlers for macOS and Windows
   */
  private setupDeepLinkHandlers(): void {
    // macOS: Handle deep links when app is already running
    app.on('open-url', (event, url) => {
      event.preventDefault();
      console.log('[DeepLinkService] open-url event:', url);
      this.handleDeepLink(url);
    });

    // Windows/Linux: Handle deep links via second-instance
    app.on('second-instance', (event, commandLine) => {
      console.log('[DeepLinkService] second-instance event:', commandLine);
      
      // Find the deep link URL in command line arguments
      const deepLinkUrl = commandLine.find(arg => arg.startsWith('browzer://'));
      
      if (deepLinkUrl) {
        this.handleDeepLink(deepLinkUrl);
      }

      // Focus the main window
      this.focusMainWindow();
    });

    // Handle deep links passed as command line arguments on app start
    if (process.platform !== 'darwin') {
      const deepLinkUrl = process.argv.find(arg => arg.startsWith('browzer://'));
      if (deepLinkUrl) {
        console.log('[DeepLinkService] Deep link from argv:', deepLinkUrl);
        // Store it to process after window is ready
        this.pendingDeepLink = deepLinkUrl;
      }
    }
  }

  /**
   * Parse deep link URL and extract parameters
   */
  private parseDeepLink(url: string): DeepLinkData | null {
    try {
      if (!url.startsWith('browzer://')) {
        return null;
      }

      const route = getRouteFromURL(url);
      if (!route) {
        console.warn('[DeepLinkService] Unknown route:', url);
        return null;
      }

      // Extract parameters from both query string (?) and hash fragment (#)
      const params = this.extractParams(url);

      // Build clean URL with route path and params as query string
      const cleanUrl = this.buildCleanUrl(route.path, params);

      return {
        url: cleanUrl,
        showInTab: route.showInTab,
        params,
      };
    } catch (error) {
      console.error('[DeepLinkService] Parse error:', error);
      return null;
    }
  }

  /**
   * Extract parameters from URL (both query params and hash fragments)
   * Supabase sends tokens as hash fragments: browzer://auth/confirm-signup#access_token=xxx&type=signup
   */
  private extractParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};

    // Extract query parameters (?key=value)
    const queryMatch = url.match(/\?([^#]+)/);
    if (queryMatch) {
      const queryString = queryMatch[1];
      const urlParams = new URLSearchParams(queryString);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    // Extract hash fragment parameters (#key=value&key2=value2)
    const hashMatch = url.match(/#(.+)$/);
    if (hashMatch) {
      const hashString = hashMatch[1];
      const hashParams = new URLSearchParams(hashString);
      hashParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    return params;
  }

  /**
   * Build clean URL with route path and params as query string
   */
  private buildCleanUrl(routePath: string, params: Record<string, string>): string {
    const paramEntries = Object.entries(params);
    if (paramEntries.length === 0) {
      return routePath;
    }

    const queryString = paramEntries
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return `${routePath}?${queryString}`;
  }

  /**
   * Handle incoming deep link
   */
  private handleDeepLink(url: string): void {
    const data = this.parseDeepLink(url);
    if (!data) return;

    if (!this.webContents) {
      this.pendingDeepLink = url;
      return;
    }

    this.focusMainWindow();
    this.webContents.send('deeplink:navigate', data);
  }


  /**
   * Focus the main window
   */
  private focusMainWindow(): void {
    if (this.baseWindow) {
      if (this.baseWindow.isMinimized()) {
        this.baseWindow.restore();
      }
      this.baseWindow.focus();
      this.baseWindow.show();
    }
  }

}
