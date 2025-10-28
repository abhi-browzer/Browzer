/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer, desktopCapturer } from 'electron';
import { HistoryEntry, HistoryQuery, HistoryStats, TabInfo, AppSettings, SignUpCredentials, SignInCredentials, AuthResponse, AuthSession, User } from '@/shared/types';


export interface BrowserAPI {
  // Initialization
  initializeBrowser: () => Promise<boolean>;
  
  // Tab Management
  createTab: (url?: string) => Promise<TabInfo>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<{ tabs: TabInfo[]; activeTabId: string | null }>;

  // Navigation
  navigate: (tabId: string, url: string) => Promise<boolean>;
  goBack: (tabId: string) => Promise<boolean>;
  goForward: (tabId: string) => Promise<boolean>;
  reload: (tabId: string) => Promise<boolean>;
  stop: (tabId: string) => Promise<boolean>;

  // State queries
  canGoBack: (tabId: string) => Promise<boolean>;
  canGoForward: (tabId: string) => Promise<boolean>;

  // Sidebar Management
  setSidebarState: (visible: boolean, widthPercent: number) => Promise<boolean>;
  
  // Window Management
  toggleMaximize: () => Promise<void>;
  
  // Desktop Capturer (for video recording)
  getDesktopSources: () => Promise<Array<{ id: string; name: string; thumbnail: any }>>;

  // Recording Management
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<{ actions: any[]; duration: number; startUrl: string }>;
  saveRecording: (name: string, description: string, actions: any[]) => Promise<string>;
  getAllRecordings: () => Promise<any[]>;
  deleteRecording: (id: string) => Promise<boolean>;
  isRecording: () => Promise<boolean>;
  getRecordedActions: () => Promise<any[]>;
  exportRecording: (id: string) => Promise<{ success: boolean; filePath?: string; error?: string; cancelled?: boolean }>;
  
  // Video File Operations
  openVideoFile: (videoPath: string) => Promise<void>;
  getVideoFileUrl: (videoPath: string) => Promise<string>;

  // Password Management
  savePassword: (origin: string, username: string, password: string) => Promise<boolean>;
  getPasswordsForOrigin: (origin: string) => Promise<any[]>;
  getPassword: (credentialId: string) => Promise<string | null>;
  deletePassword: (credentialId: string) => Promise<boolean>;
  neverSaveForSite: (origin: string) => Promise<boolean>;
  isSiteBlacklisted: (origin: string) => Promise<boolean>;

  // Settings Management
  getAllSettings: () => Promise<AppSettings>;
  getSettingsCategory: (category: keyof AppSettings) => Promise<any>;
  updateSetting: (category: keyof AppSettings, key: string, value: any) => Promise<boolean>;
  updateSettingsCategory: (category: keyof AppSettings, values: any) => Promise<boolean>;
  resetAllSettings: () => Promise<boolean>;
  resetSettingsCategory: (category: keyof AppSettings) => Promise<boolean>;
  exportSettings: () => Promise<string>;
  importSettings: (jsonString: string) => Promise<boolean>;


  // History Management
  getAllHistory: (limit?: number) => Promise<HistoryEntry[]>;
  searchHistory: (query: HistoryQuery) => Promise<HistoryEntry[]>;
  getTodayHistory: () => Promise<HistoryEntry[]>;
  getLastNDaysHistory: (days: number) => Promise<HistoryEntry[]>;
  deleteHistoryEntry: (id: string) => Promise<boolean>;
  deleteHistoryEntries: (ids: string[]) => Promise<number>;
  deleteHistoryByDateRange: (startTime: number, endTime: number) => Promise<number>;
  clearAllHistory: () => Promise<boolean>;
  getHistoryStats: () => Promise<HistoryStats>;
  getMostVisited: (limit?: number) => Promise<HistoryEntry[]>;
  getRecentlyVisited: (limit?: number) => Promise<HistoryEntry[]>;

  // LLM Automation
  executeLLMAutomation: (userGoal: string, recordedSessionId: string) => Promise<{
    success: boolean;
    sessionId: string;
    message: string;
  }>;
  
  // Session Management
  loadAutomationSession: (sessionId: string) => Promise<any>;
  getAutomationSessionHistory: (limit?: number) => Promise<any[]>;
  getAutomationSessions: () => Promise<any[]>;
  getAutomationSessionDetails: (sessionId: string) => Promise<any>;
  resumeAutomationSession: (sessionId: string) => Promise<any>;
  deleteAutomationSession: (sessionId: string) => Promise<boolean>;

  // Event listeners
  onTabsUpdated: (callback: (data: { tabs: TabInfo[]; activeTabId: string | null }) => void) => () => void;
  onRecordingAction: (callback: (action: any) => void) => () => void;
  onRecordingStarted: (callback: () => void) => () => void;
  onRecordingStopped: (callback: (data: { actions: any[]; duration: number; startUrl: string }) => void) => () => void;
  onRecordingSaved: (callback: (session: any) => void) => () => void;
  onRecordingDeleted: (callback: (id: string) => void) => () => void;
  onRecordingMaxActionsReached: (callback: () => void) => () => void;
  
  // Automation event listeners
  onAutomationProgress: (callback: (data: { sessionId: string; event: any }) => void) => () => void;
  onAutomationComplete: (callback: (data: { sessionId: string; result: any }) => void) => () => void;
  onAutomationError: (callback: (data: { sessionId: string; error: string }) => void) => () => void;
}

export interface AuthAPI {
  // Authentication
  signUp: (credentials: SignUpCredentials) => Promise<AuthResponse>;
  signIn: (credentials: SignInCredentials) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  
  // Session Management
  getCurrentSession: () => Promise<AuthSession | null>;
  getCurrentUser: () => Promise<User | null>;
  refreshSession: () => Promise<AuthResponse>;
  
  // Profile Management
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<AuthResponse>;
  
  // Password Management
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const browserAPI: BrowserAPI = {
  initializeBrowser: () => ipcRenderer.invoke('browser:initialize'),
  createTab: (url?: string) => ipcRenderer.invoke('browser:create-tab', url),
  closeTab: (tabId: string) => ipcRenderer.invoke('browser:close-tab', tabId),
  switchTab: (tabId: string) => ipcRenderer.invoke('browser:switch-tab', tabId),
  getTabs: () => ipcRenderer.invoke('browser:get-tabs'),

  navigate: (tabId: string, url: string) => ipcRenderer.invoke('browser:navigate', tabId, url),
  goBack: (tabId: string) => ipcRenderer.invoke('browser:go-back', tabId),
  goForward: (tabId: string) => ipcRenderer.invoke('browser:go-forward', tabId),
  reload: (tabId: string) => ipcRenderer.invoke('browser:reload', tabId),
  stop: (tabId: string) => ipcRenderer.invoke('browser:stop', tabId),

  canGoBack: (tabId: string) => ipcRenderer.invoke('browser:can-go-back', tabId),
  canGoForward: (tabId: string) => ipcRenderer.invoke('browser:can-go-forward', tabId),

  setSidebarState: (visible: boolean, widthPercent: number) => 
    ipcRenderer.invoke('browser:set-sidebar-state', visible, widthPercent),

  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),

  startRecording: () => ipcRenderer.invoke('browser:start-recording'),
  stopRecording: () => ipcRenderer.invoke('browser:stop-recording'),
  saveRecording: (name: string, description: string, actions: any[]) => 
    ipcRenderer.invoke('browser:save-recording', name, description, actions),
  getAllRecordings: () => ipcRenderer.invoke('browser:get-all-recordings'),
  deleteRecording: (id: string) => ipcRenderer.invoke('browser:delete-recording', id),
  isRecording: () => ipcRenderer.invoke('browser:is-recording'),
  getRecordedActions: () => ipcRenderer.invoke('browser:get-recorded-actions'),
  exportRecording: (id: string) => ipcRenderer.invoke('browser:export-recording', id),

  onTabsUpdated: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: { tabs: TabInfo[]; activeTabId: string | null }) => callback(data);
    ipcRenderer.on('browser:tabs-updated', subscription);
    
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('browser:tabs-updated', subscription);
    };
  },

  onRecordingAction: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, action: any) => callback(action);
    ipcRenderer.on('recording:action-captured', subscription);
    return () => ipcRenderer.removeListener('recording:action-captured', subscription);
  },

  onRecordingStarted: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('recording:started', subscription);
    return () => ipcRenderer.removeListener('recording:started', subscription);
  },

  onRecordingStopped: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('recording:stopped', subscription);
    return () => ipcRenderer.removeListener('recording:stopped', subscription);
  },

  onRecordingSaved: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, session: any) => callback(session);
    ipcRenderer.on('recording:saved', subscription);
    return () => ipcRenderer.removeListener('recording:saved', subscription);
  },

  onRecordingDeleted: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('recording:deleted', subscription);
    return () => ipcRenderer.removeListener('recording:deleted', subscription);
  },

  onRecordingMaxActionsReached: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('recording:max-actions-reached', subscription);
    return () => ipcRenderer.removeListener('recording:max-actions-reached', subscription);
  },

  // Settings API
  getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
  getSettingsCategory: (category: keyof AppSettings) => ipcRenderer.invoke('settings:get-category', category),
  updateSetting: (category: keyof AppSettings, key: string, value: any) => 
    ipcRenderer.invoke('settings:update', category, key, value),
  updateSettingsCategory: (category: keyof AppSettings, values: any) => 
    ipcRenderer.invoke('settings:update-category', category, values),
  resetAllSettings: () => ipcRenderer.invoke('settings:reset-all'),
  resetSettingsCategory: (category: keyof AppSettings) => 
    ipcRenderer.invoke('settings:reset-category', category),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: (jsonString: string) => ipcRenderer.invoke('settings:import', jsonString),

  // History API
  getAllHistory: (limit?: number) => ipcRenderer.invoke('history:get-all', limit),
  searchHistory: (query: HistoryQuery) => ipcRenderer.invoke('history:search', query),
  getTodayHistory: () => ipcRenderer.invoke('history:get-today'),
  getLastNDaysHistory: (days: number) => ipcRenderer.invoke('history:get-last-n-days', days),
  deleteHistoryEntry: (id: string) => ipcRenderer.invoke('history:delete-entry', id),
  deleteHistoryEntries: (ids: string[]) => ipcRenderer.invoke('history:delete-entries', ids),
  deleteHistoryByDateRange: (startTime: number, endTime: number) => 
    ipcRenderer.invoke('history:delete-by-date-range', startTime, endTime),
  clearAllHistory: () => ipcRenderer.invoke('history:clear-all'),
  getHistoryStats: () => ipcRenderer.invoke('history:get-stats'),
  getMostVisited: (limit?: number) => ipcRenderer.invoke('history:get-most-visited', limit),
  getRecentlyVisited: (limit?: number) => ipcRenderer.invoke('history:get-recently-visited', limit),
  
  // Desktop Capturer API
  getDesktopSources: async () => {
    const sources = await desktopCapturer.getSources({ 
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  },
  
  // Video File Operations
  openVideoFile: (videoPath: string) => ipcRenderer.invoke('video:open-file', videoPath),
  getVideoFileUrl: (videoPath: string) => ipcRenderer.invoke('video:get-file-url', videoPath),

  // Password Management API
  savePassword: (origin: string, username: string, password: string) => 
    ipcRenderer.invoke('password:save', origin, username, password),
  getPasswordsForOrigin: (origin: string) => 
    ipcRenderer.invoke('password:get-for-origin', origin),
  getPassword: (credentialId: string) => 
    ipcRenderer.invoke('password:get-password', credentialId),
  deletePassword: (credentialId: string) => 
    ipcRenderer.invoke('password:delete', credentialId),
  neverSaveForSite: (origin: string) => 
    ipcRenderer.invoke('password:add-to-blacklist', origin),
  isSiteBlacklisted: (origin: string) => 
    ipcRenderer.invoke('password:is-blacklisted', origin),

  // LLM Automation API
  executeLLMAutomation: (userGoal: string, recordedSessionId: string) =>
    ipcRenderer.invoke('automation:execute-llm', userGoal, recordedSessionId),
  
  // Session Management API
  loadAutomationSession: (sessionId: string) =>
    ipcRenderer.invoke('automation:load-session', sessionId),
  getAutomationSessionHistory: (limit?: number) =>
    ipcRenderer.invoke('automation:get-session-history', limit),
  getAutomationSessions: () =>
    ipcRenderer.invoke('automation:get-sessions'),
  getAutomationSessionDetails: (sessionId: string) =>
    ipcRenderer.invoke('automation:get-session-details', sessionId),
  resumeAutomationSession: (sessionId: string) =>
    ipcRenderer.invoke('automation:resume-session', sessionId),
  deleteAutomationSession: (sessionId: string) =>
    ipcRenderer.invoke('automation:delete-session', sessionId),
  
  // Automation event listeners
  onAutomationProgress: (callback) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('automation:progress', subscription);
    return () => ipcRenderer.removeListener('automation:progress', subscription);
  },
  onAutomationComplete: (callback) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('automation:complete', subscription);
    return () => ipcRenderer.removeListener('automation:complete', subscription);
  },
  onAutomationError: (callback) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('automation:error', subscription);
    return () => ipcRenderer.removeListener('automation:error', subscription);
  },
};

// Auth API implementation
const authAPI: AuthAPI = {
  signUp: (credentials: SignUpCredentials) => ipcRenderer.invoke('auth:sign-up', credentials),
  signIn: (credentials: SignInCredentials) => ipcRenderer.invoke('auth:sign-in', credentials),
  signInWithGoogle: () => ipcRenderer.invoke('auth:sign-in-google'),
  signOut: () => ipcRenderer.invoke('auth:sign-out'),
  getCurrentSession: () => ipcRenderer.invoke('auth:get-session'),
  getCurrentUser: () => ipcRenderer.invoke('auth:get-user'),
  refreshSession: () => ipcRenderer.invoke('auth:refresh-session'),
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => 
    ipcRenderer.invoke('auth:update-profile', updates),
  resetPassword: (email: string) => ipcRenderer.invoke('auth:reset-password', email),
};

contextBridge.exposeInMainWorld('browserAPI', browserAPI);
contextBridge.exposeInMainWorld('authAPI', authAPI);
