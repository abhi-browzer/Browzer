import { app, BaseWindow, WebContents } from 'electron';
import { getDeepLinkRoute, DeepLinkRouteType } from './DeepLinkRouter';

/**
 * Deep link URL structure: browzer://[route]/[...params]
 * Examples:
 * - browzer://settings (IN_TAB)
 * - browzer://history (IN_TAB)
 * - browzer://auth/confirm-signup (FULLSCREEN)
 * - browzer://auth/reset-password (FULLSCREEN)
 */

export interface DeepLinkData {
  protocol: string;
  route: string;
  params: Record<string, string>;
  fullUrl: string;
  routeType: DeepLinkRouteType | null;
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
   * Parse deep link URL into structured data
   */
  public parseDeepLink(url: string): DeepLinkData | null {
    try {
      console.log('[DeepLinkService] Parsing deep link:', url);
      
      // Remove trailing slashes
      url = url.replace(/\/+$/, '');
      
      const urlObj = new URL(url);
      
      if (urlObj.protocol !== 'browzer:') {
        console.warn('[DeepLinkService] Invalid protocol:', urlObj.protocol);
        return null;
      }

      // Extract route (hostname + pathname)
      // browzer://settings -> route: 'settings'
      // browzer://automation/session/123 -> route: 'automation/session/123'
      const route = (urlObj.hostname + urlObj.pathname).replace(/^\/+|\/+$/g, '');
      
      // Extract query parameters
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      // Determine route type
      const routeConfig = getDeepLinkRoute(route);
      const routeType = routeConfig?.type || null;

      const deepLinkData: DeepLinkData = {
        protocol: 'browzer',
        route,
        params,
        fullUrl: url,
        routeType,
      };

      console.log('[DeepLinkService] Parsed deep link:', {
        ...deepLinkData,
        routeConfig: routeConfig ? `${routeConfig.title} (${routeConfig.type})` : 'unknown'
      });
      return deepLinkData;
    } catch (error) {
      console.error('[DeepLinkService] Failed to parse deep link:', error);
      return null;
    }
  }

  /**
   * Handle incoming deep link
   */
  private handleDeepLink(url: string): void {
    console.log('[DeepLinkService] Handling deep link:', url);
    
    const deepLinkData = this.parseDeepLink(url);
    
    if (!deepLinkData) {
      console.error('[DeepLinkService] Invalid deep link URL:', url);
      return;
    }

    // If window is not ready yet, store the deep link for later
    if (!this.baseWindow || !this.webContents) {
      console.log('[DeepLinkService] Window not ready, storing deep link for later');
      this.pendingDeepLink = url;
      return;
    }

    // Focus the window
    this.focusMainWindow();

    // Send deep link to renderer process
    this.sendDeepLinkToRenderer(deepLinkData);
  }

  /**
   * Send deep link data to renderer process
   */
  private sendDeepLinkToRenderer(deepLinkData: DeepLinkData): void {
    if (!this.webContents) {
      console.error('[DeepLinkService] No webContents available to send deep link');
      return;
    }

    console.log('[DeepLinkService] Sending deep link to renderer:', deepLinkData);
    
    // Send to renderer via webContents
    this.webContents.send('deeplink:navigate', deepLinkData);
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

  /**
   * Manually trigger a deep link (for testing)
   */
  public triggerDeepLink(url: string): void {
    this.handleDeepLink(url);
  }

  /**
   * Get supported routes
   */
  public getSupportedRoutes(): string[] {
    return [
      'settings',
      'history',
      'recordings',
      'automation',
      'profile',
    ];
  }
}
