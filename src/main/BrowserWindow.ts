import { BrowserManager } from '@/main/BrowserManager';
import { WindowManager } from '@/main/window/WindowManager';
import { LayoutManager } from '@/main/window/LayoutManager';
import { IPCHandlers } from '@/main/ipc/IPCHandlers';
import { DeepLinkService } from '@/main/deeplink/DeepLinkService';
import { ConnectionManager, ConnectionManagerConfig } from './api';
import { AuthService } from '@/main/auth/AuthService';

export class BrowserWindow {
  private windowManager: WindowManager;
  private layoutManager: LayoutManager;
  private browserManager: BrowserManager;
  private connectionManager: ConnectionManager;
  private authService: AuthService;
  private ipcHandlers: IPCHandlers;
  private deepLinkService: DeepLinkService;

  constructor() {
    // 1. Initialize window and views
    this.windowManager = new WindowManager();
    
    const baseWindow = this.windowManager.getWindow();
    const browserUIView = this.windowManager.getAgentUIView();

    if (!baseWindow || !browserUIView) {
      throw new Error('Failed to initialize window');
    }
    this.layoutManager = new LayoutManager(baseWindow);

    // 2. Initialize browser manager (tabs + recording)
    this.browserManager = new BrowserManager(baseWindow, browserUIView);

    // 3. Initialize AuthService
    this.authService = new AuthService(this.browserManager);

    // 4. Initialize connection manager callbacks
    const connectionConfig: ConnectionManagerConfig = {
      apiBaseURL: process.env.BACKEND_API_URL || 'http://localhost:8080',
      apiKey: process.env.BACKEND_API_KEY || '',
      getAccessToken: () => this.authService.getAccessToken(),
      clearSession: () => this.authService.clearSession(),
    };
    
    this.connectionManager = new ConnectionManager(connectionConfig);
    this.connectionManager.initialize();

    // 5. Setup IPC communication
    this.ipcHandlers = new IPCHandlers(
      this.browserManager,
      this.layoutManager,
      this.windowManager,
      this.authService
    );

    // 6. Initialize deep link service
    this.deepLinkService = DeepLinkService.getInstance();
    this.deepLinkService.setWindow(baseWindow, browserUIView.webContents);

    // 7. Initial layout
    this.updateLayout();
  }

  /**
   * Update layout when sidebar state or window size changes
   */
  private updateLayout(): void {
    const browserUIView = this.windowManager.getAgentUIView();
    const baseWindow = this.windowManager.getWindow();
    
    if (!baseWindow) return;

    const bounds = baseWindow.getBounds();
    const sidebarState = this.layoutManager.getSidebarState();
    const sidebarWidth = sidebarState.visible 
      ? Math.floor(bounds.width * (sidebarState.widthPercent / 100))
      : 0;

    // Update agent UI bounds
    if (browserUIView) {
      const browserUIBounds = this.layoutManager.calculateAgentUIBounds();
      browserUIView.setBounds(browserUIBounds);
    }

    // Update browser manager with window dimensions and sidebar width
    this.browserManager.updateLayout(bounds.width, bounds.height, sidebarWidth);
  }

  public getWindow() {
    return this.windowManager.getWindow();
  }

  public getAgentUIView() {
    return this.windowManager.getAgentUIView();
  }

  public destroy(): void {
    this.ipcHandlers.cleanup();
    this.browserManager.destroy();
    this.windowManager.destroy();
  }
}

