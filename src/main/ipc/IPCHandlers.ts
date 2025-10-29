/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcMain, shell } from 'electron';
import { BrowserManager } from '@/main/BrowserManager';
import { LayoutManager } from '@/main/window/LayoutManager';
import { WindowManager } from '@/main/window/WindowManager';
import { SettingsStore } from '@/main/settings/SettingsStore';
import { PasswordManager } from '@/main/password/PasswordManager';
import { AuthService } from '@/main/auth';
import { RecordedAction, HistoryQuery, AppSettings, SignUpCredentials, SignInCredentials } from '@/shared/types';

/**
 * IPCHandlers - Centralized IPC communication setup
 * Registers all IPC handlers for main <-> renderer communication
 */
export class IPCHandlers {
  private settingsStore: SettingsStore;
  private passwordManager: PasswordManager;
  private authService: AuthService;

  constructor(
    private browserManager: BrowserManager,
    private layoutManager: LayoutManager,
    private windowManager: WindowManager
  ) {
    this.settingsStore = new SettingsStore();
    // Use the existing PasswordManager from BrowserManager instead of creating a new one
    this.passwordManager = this.browserManager.getPasswordManager();
    this.authService = new AuthService();
    this.setupHandlers();

    console.log('IPCHandlers initialized');
  }

  private setupHandlers(): void {
    this.setupBrowserHandlers();
    this.setupTabHandlers();
    this.setupNavigationHandlers();
    this.setupSidebarHandlers();
    this.setupRecordingHandlers();
    this.setupSettingsHandlers();
    this.setupHistoryHandlers();
    this.setupPasswordHandlers();
    this.setupWindowHandlers();
    this.setupAutomationHandlers();
    this.setupAuthHandlers();
  }

  private setupBrowserHandlers(): void {
    // Initialize browser after authentication
    ipcMain.handle('browser:initialize', async () => {
      this.browserManager.initializeBrowser();
      return true;
    });

    // Check if browser is initialized
    ipcMain.handle('browser:is-initialized', async () => {
      return this.browserManager.isInitialized();
    });
  }

  private setupTabHandlers(): void {
    ipcMain.handle('browser:create-tab', async (_, url?: string) => {
      return this.browserManager.createTab(url);
    });

    ipcMain.handle('browser:close-tab', async (_, tabId: string) => {
      return this.browserManager.closeTab(tabId);
    });

    ipcMain.handle('browser:switch-tab', async (_, tabId: string) => {
      return this.browserManager.switchToTab(tabId);
    });

    ipcMain.handle('browser:get-tabs', async () => {
      return this.browserManager.getAllTabs();
    });
  }

  private setupNavigationHandlers(): void {
    ipcMain.handle('browser:navigate', async (_, tabId: string, url: string) => {
      return this.browserManager.navigate(tabId, url);
    });

    ipcMain.handle('browser:go-back', async (_, tabId: string) => {
      return this.browserManager.goBack(tabId);
    });

    ipcMain.handle('browser:go-forward', async (_, tabId: string) => {
      return this.browserManager.goForward(tabId);
    });

    ipcMain.handle('browser:reload', async (_, tabId: string) => {
      return this.browserManager.reload(tabId);
    });

    ipcMain.handle('browser:stop', async (_, tabId: string) => {
      return this.browserManager.stop(tabId);
    });

    ipcMain.handle('browser:can-go-back', async (_, tabId: string) => {
      return this.browserManager.canGoBack(tabId);
    });

    ipcMain.handle('browser:can-go-forward', async (_, tabId: string) => {
      return this.browserManager.canGoForward(tabId);
    });
  }

  private setupSidebarHandlers(): void {
    ipcMain.handle('browser:set-sidebar-state', async (_, visible: boolean, widthPercent: number) => {
      this.layoutManager.setSidebarState(visible, widthPercent);
      this.updateLayout();
      return true;
    });
  }

  private setupRecordingHandlers(): void {
    // Start recording
    ipcMain.handle('browser:start-recording', async () => {
      return this.browserManager.startRecording();
    });

    // Stop recording - returns actions
    ipcMain.handle('browser:stop-recording', async () => {
      return this.browserManager.stopRecording();
    });

    // Save recording
    ipcMain.handle('browser:save-recording', async (_, name: string, description: string, actions: RecordedAction[]) => {
      return this.browserManager.saveRecording(name, description, actions);
    });

    // Get all recordings
    ipcMain.handle('browser:get-all-recordings', async () => {
      return this.browserManager.getRecordingStore().getAllRecordings();
    });

    // Delete recording
    ipcMain.handle('browser:delete-recording', async (_, id: string) => {
      return this.browserManager.deleteRecording(id);
    });

    // Check if recording is active
    ipcMain.handle('browser:is-recording', async () => {
      return this.browserManager.isRecordingActive();
    });

    // Get recorded actions
    ipcMain.handle('browser:get-recorded-actions', async () => {
      return this.browserManager.getRecordedActions();
    });

    // Export recording as JSON
    ipcMain.handle('browser:export-recording', async (_, id: string) => {
      return await this.browserManager.getRecordingStore().exportRecording(id);
    });
    
    // Video file operations
    ipcMain.handle('video:open-file', async (_, videoPath: string) => {
      try {
        await shell.openPath(videoPath);
      } catch (error) {
        console.error('Failed to open video file:', error);
        throw error;
      }
    });
    
    ipcMain.handle('video:get-file-url', async (_, videoPath: string) => {
      try {
        // Use custom protocol that Electron can serve
        return `video-file://${encodeURIComponent(videoPath)}`;
      } catch (error) {
        console.error('Failed to get video file URL:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
  }

  private setupSettingsHandlers(): void {
    ipcMain.handle('settings:get-all', async () => {
      return this.settingsStore.getAllSettings();
    });

    ipcMain.handle('settings:get-category', async (_, category: keyof AppSettings) => {
      return this.settingsStore.getSetting(category);
    });

    ipcMain.handle('settings:update', async (_, category: keyof AppSettings, key: string, value: unknown) => {
      this.settingsStore.updateSetting(category, key as never, value as never);
      return true;
    });

    ipcMain.handle('settings:update-category', async (_, category: keyof AppSettings, values: unknown) => {
      this.settingsStore.updateCategory(category, values as never);
      return true;
    });

    ipcMain.handle('settings:reset-all', async () => {
      this.settingsStore.resetToDefaults();
      return true;
    });

    ipcMain.handle('settings:reset-category', async (_, category: keyof AppSettings) => {
      this.settingsStore.resetCategory(category);
      return true;
    });

    ipcMain.handle('settings:export', async () => {
      return this.settingsStore.exportSettings();
    });

    ipcMain.handle('settings:import', async (_, jsonString: string) => {
      return this.settingsStore.importSettings(jsonString);
    });
  }

  private setupHistoryHandlers(): void {
    const historyService = this.browserManager.getHistoryService();

    ipcMain.handle('history:get-all', async (_, limit?: number) => {
      return historyService.getAll(limit);
    });

    ipcMain.handle('history:search', async (_, query: HistoryQuery) => {
      return historyService.search(query);
    });

    ipcMain.handle('history:get-today', async () => {
      return historyService.getToday();
    });

    ipcMain.handle('history:get-last-n-days', async (_, days: number) => {
      return historyService.getLastNDays(days);
    });

    ipcMain.handle('history:delete-entry', async (_, id: string) => {
      return historyService.deleteEntry(id);
    });

    ipcMain.handle('history:delete-entries', async (_, ids: string[]) => {
      return historyService.deleteEntries(ids);
    });

    ipcMain.handle('history:delete-by-date-range', async (_, startTime: number, endTime: number) => {
      return historyService.deleteByDateRange(startTime, endTime);
    });

    ipcMain.handle('history:clear-all', async () => {
      return historyService.clearAll();
    });

    ipcMain.handle('history:get-stats', async () => {
      return historyService.getStats();
    });

    ipcMain.handle('history:get-most-visited', async (_, limit?: number) => {
      return historyService.getMostVisited(limit);
    });

    ipcMain.handle('history:get-recently-visited', async (_, limit?: number) => {
      return historyService.getRecentlyVisited(limit);
    });
  }

  private updateLayout(): void {
    const agentUIView = this.windowManager.getAgentUIView();
    const baseWindow = this.windowManager.getWindow();
    
    if (!baseWindow) return;

    const bounds = baseWindow.getBounds();
    const sidebarState = this.layoutManager.getSidebarState();
    const sidebarWidth = sidebarState.visible 
      ? Math.floor(bounds.width * (sidebarState.widthPercent / 100))
      : 0;

    if (agentUIView) {
      const agentUIBounds = this.layoutManager.calculateAgentUIBounds();
      agentUIView.setBounds(agentUIBounds);
    }
    
    this.browserManager.updateLayout(bounds.width, bounds.height, sidebarWidth);
  }

  private setupWindowHandlers(): void {
    ipcMain.handle('window:toggle-maximize', async () => {
      const window = this.windowManager.getWindow();
      if (window) {
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
      }
    });
  }

   private setupPasswordHandlers(): void {
    // Save password
    ipcMain.handle('password:save', async (_, origin: string, username: string, password: string) => {
      return this.passwordManager.saveCredential(origin, username, password);
    });

    // Get credentials for origin
    ipcMain.handle('password:get-for-origin', async (_, origin: string) => {
      return this.passwordManager.getCredentialsForOrigin(origin);
    });

    // Get decrypted password
    ipcMain.handle('password:get-password', async (_, credentialId: string) => {
      return this.passwordManager.getPassword(credentialId);
    });

    // Delete credential
    ipcMain.handle('password:delete', async (_, credentialId: string) => {
      return this.passwordManager.deleteCredential(credentialId);
    });

    // Add to blacklist
    ipcMain.handle('password:add-to-blacklist', async (_, origin: string) => {
      this.passwordManager.addToBlacklist(origin);
      return true;
    });

    // Check if blacklisted
    ipcMain.handle('password:is-blacklisted', async (_, origin: string) => {
      return this.passwordManager.isBlacklisted(origin);
    });
  }

  /**
   * Automation test handlers
   */
  private setupAutomationHandlers(): void {
    ipcMain.handle('automation:execute-llm', async (_, userGoal: string, recordedSessionId: string) => {
     return await this.browserManager.executeIterativeAutomation(userGoal, recordedSessionId);
    });
    
    // Session management handlers
    ipcMain.handle('automation:load-session', async (_, sessionId: string) => {
      return await this.browserManager.loadAutomationSession(sessionId);
    });
    
    ipcMain.handle('automation:get-session-history', async (_, limit?: number) => {
      return await this.browserManager.getAutomationSessionHistory(limit);
    });
    
    ipcMain.handle('automation:get-sessions', async () => {
      return await this.browserManager.getAutomationSessions();
    });
    
    ipcMain.handle('automation:get-session-details', async (_, sessionId: string) => {
      return await this.browserManager.getAutomationSessionDetails(sessionId);
    });
    
    ipcMain.handle('automation:resume-session', async (_, sessionId: string) => {
      return await this.browserManager.resumeAutomationSession(sessionId);
    });
    
    ipcMain.handle('automation:delete-session', async (_, sessionId: string) => {
      return await this.browserManager.deleteAutomationSession(sessionId);
    });
  }

  /**
   * Authentication handlers
   */
  private setupAuthHandlers(): void {
    // Sign up
    ipcMain.handle('auth:sign-up', async (_, credentials: SignUpCredentials) => {
      return await this.authService.signUp(credentials);
    });

    // Sign in
    ipcMain.handle('auth:sign-in', async (_, credentials: SignInCredentials) => {
      return await this.authService.signIn(credentials);
    });

    // Sign in with Google
    ipcMain.handle('auth:sign-in-google', async () => {
      return await this.authService.signInWithGoogle();
    });

    // Sign out
    ipcMain.handle('auth:sign-out', async () => {
      return await this.authService.signOut();
    });

    // Get current session
    ipcMain.handle('auth:get-session', async () => {
      return this.authService.getSession();
    });

    // Get current user
    ipcMain.handle('auth:get-user', async () => {
      return this.authService.getUser();
    });

    // Check if authenticated
    ipcMain.handle('auth:is-authenticated', async () => {
      return this.authService.isAuthenticated();
    });

    // Reset password
    ipcMain.handle('auth:reset-password', async (_, email: string) => {
      return await this.authService.resetPassword(email);
    });

    // Update password
    ipcMain.handle('auth:update-password', async (_, newPassword: string) => {
      return await this.authService.updatePassword(newPassword);
    });

    // Update user metadata
    ipcMain.handle('auth:update-user-metadata', async (_, metadata: Record<string, unknown>) => {
      return await this.authService.updateUserMetadata(metadata);
    });

    // Handle OAuth callback
    ipcMain.handle('auth:handle-oauth-callback', async (_, url: string) => {
      return await this.authService.handleOAuthCallback(url);
    });
  }

  public cleanup(): void {
    ipcMain.removeAllListeners('browser:initialize');
    ipcMain.removeAllListeners('browser:is-initialized');
    ipcMain.removeAllListeners('browser:create-tab');
    ipcMain.removeAllListeners('browser:close-tab');
    ipcMain.removeAllListeners('browser:switch-tab');
    ipcMain.removeAllListeners('browser:get-tabs');
    ipcMain.removeAllListeners('browser:navigate');
    ipcMain.removeAllListeners('browser:go-back');
    ipcMain.removeAllListeners('browser:go-forward');
    ipcMain.removeAllListeners('browser:reload');
    ipcMain.removeAllListeners('browser:stop');
    ipcMain.removeAllListeners('browser:can-go-back');
    ipcMain.removeAllListeners('browser:can-go-forward');
    ipcMain.removeAllListeners('browser:set-sidebar-state');
    ipcMain.removeAllListeners('browser:start-recording');
    ipcMain.removeAllListeners('browser:stop-recording');
    ipcMain.removeAllListeners('browser:save-recording');
    ipcMain.removeAllListeners('browser:get-all-recordings');
    ipcMain.removeAllListeners('browser:delete-recording');
    ipcMain.removeAllListeners('browser:is-recording');
    ipcMain.removeAllListeners('browser:get-recorded-actions');
    ipcMain.removeAllListeners('browser:export-recording');
    ipcMain.removeAllListeners('settings:get-all');
    ipcMain.removeAllListeners('settings:get-category');
    ipcMain.removeAllListeners('settings:update');
    ipcMain.removeAllListeners('settings:update-category');
    ipcMain.removeAllListeners('settings:reset-all');
    ipcMain.removeAllListeners('settings:reset-category');
    ipcMain.removeAllListeners('settings:export');
    ipcMain.removeAllListeners('settings:import');
    ipcMain.removeAllListeners('history:get-all');
    ipcMain.removeAllListeners('history:search');
    ipcMain.removeAllListeners('history:get-today');
    ipcMain.removeAllListeners('history:get-last-n-days');
    ipcMain.removeAllListeners('history:delete-entry');
    ipcMain.removeAllListeners('history:delete-entries');
    ipcMain.removeAllListeners('history:delete-by-date-range');
    ipcMain.removeAllListeners('history:clear-all');
    ipcMain.removeAllListeners('history:get-stats');
    ipcMain.removeAllListeners('history:get-most-visited');
    ipcMain.removeAllListeners('history:get-recently-visited');
    
    // Password manager cleanup
    ipcMain.removeAllListeners('password:save');
    ipcMain.removeAllListeners('password:get-for-origin');
    ipcMain.removeAllListeners('password:get-password');
    ipcMain.removeAllListeners('password:delete');
    ipcMain.removeAllListeners('password:add-to-blacklist');
    ipcMain.removeAllListeners('password:is-blacklisted');
    
    // Window handlers cleanup
    ipcMain.removeAllListeners('window:toggle-maximize');
    
    // Automation handlers cleanup
    ipcMain.removeAllListeners('automation:initialize');
    ipcMain.removeAllListeners('automation:execute');
    ipcMain.removeAllListeners('automation:generate-plan');
    ipcMain.removeAllListeners('automation:get-status');
    ipcMain.removeAllListeners('automation:cancel');
    
    // Auth handlers cleanup
    ipcMain.removeAllListeners('auth:sign-up');
    ipcMain.removeAllListeners('auth:sign-in');
    ipcMain.removeAllListeners('auth:sign-in-google');
    ipcMain.removeAllListeners('auth:sign-out');
    ipcMain.removeAllListeners('auth:get-session');
    ipcMain.removeAllListeners('auth:get-user');
    ipcMain.removeAllListeners('auth:is-authenticated');
    ipcMain.removeAllListeners('auth:reset-password');
    ipcMain.removeAllListeners('auth:update-password');
    ipcMain.removeAllListeners('auth:update-user-metadata');
    ipcMain.removeAllListeners('auth:handle-oauth-callback');
    
    // Cleanup auth service
    this.authService.destroy();
  }
}
