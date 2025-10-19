/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebContentsView } from "electron";
import { RecordedAction } from '@/shared/types';
import { SnapshotManager } from './SnapshotManager';

export class ActionRecorder {
  private view: WebContentsView | null = null;
  private isRecording = false;
  private actions: RecordedAction[] = [];
  private debugger: Electron.Debugger | null = null;
  public onActionCallback?: (action: RecordedAction) => void;
  private snapshotManager: SnapshotManager;

  // Tab context for current recording
  private currentTabId: string | null = null;
  private currentTabUrl: string | null = null;
  private currentTabTitle: string | null = null;
  private currentWebContentsId: number | null = null;

  private recentNetworkRequests: Array<{
    url: string;
    method: string;
    type: string;
    status?: number;
    timestamp: number;
    completed: boolean;
  }> = [];

  private pendingActions = new Map<string, {
    action: RecordedAction;
    timestamp: number;
    verificationDeadline: number;
  }>();


  constructor(view?: WebContentsView) {
    if (view) {
      this.view = view;
      this.debugger = view.webContents.debugger;
    }
    this.snapshotManager = new SnapshotManager();
  }

  /**
   * Set callback for real-time action notifications
   */
  public setActionCallback(callback: (action: RecordedAction) => void): void {
    this.onActionCallback = callback;
  }

  /**
   * Set the current tab context for recorded actions
   */
  public setTabContext(tabId: string, tabUrl: string, tabTitle: string, webContentsId: number): void {
    this.currentTabId = tabId;
    this.currentTabUrl = tabUrl;
    this.currentTabTitle = tabTitle;
    this.currentWebContentsId = webContentsId;
  }

  /**
   * Switch to a different WebContentsView during active recording
   * This is the key method for multi-tab recording support
   */
  public async switchWebContents(
    newView: WebContentsView,
    tabId: string,
    tabUrl: string,
    tabTitle: string
  ): Promise<boolean> {
    if (!this.isRecording) {
      console.warn('Cannot switch WebContents: not recording');
      return false;
    }

    try {
      console.log(`🔄 Switching recording to tab: ${tabId} (${tabTitle})`);

      // Detach from current debugger if attached
      if (this.debugger && this.debugger.isAttached()) {
        try {
          this.debugger.detach();
        } catch (error) {
          console.warn('Error detaching previous debugger:', error);
        }
      }

      // Update to new view
      this.view = newView;
      this.debugger = newView.webContents.debugger;
      this.currentTabId = tabId;
      this.currentTabUrl = tabUrl;
      this.currentTabTitle = tabTitle;
      this.currentWebContentsId = newView.webContents.id;

      // Attach debugger to new view
      this.debugger.attach('1.3');
      console.log('✅ CDP Debugger attached to new tab');

      // Re-enable CDP domains
      await this.enableCDPDomains();

      // Re-setup event listeners
      this.setupEventListeners();

      console.log(`✅ Recording switched to tab: ${tabId}`);
      return true;

    } catch (error) {
      console.error('Failed to switch WebContents:', error);
      return false;
    }
  }

  /**
   * Start recording user actions
   */
  public async startRecording(
    tabId?: string,
    tabUrl?: string,
    tabTitle?: string,
    webContentsId?: number,
    recordingId?: string
  ): Promise<void> {
    if (this.isRecording) {
      console.warn('Recording already in progress');
      return;
    }

    if (!this.view) {
      throw new Error('No WebContentsView set for recording');
    }

    try {
      this.debugger = this.view.webContents.debugger;
      
      // Attach debugger if not already attached (could be attached by PasswordAutomation)
      if (!this.debugger.isAttached()) {
        this.debugger.attach('1.3');
        console.log('✅ CDP Debugger attached');
      } else {
        console.log('✅ CDP Debugger already attached, reusing existing connection');
      }

      this.actions = [];
      this.isRecording = true;

      // Set initial tab context
      if (tabId && tabUrl && tabTitle) {
        this.currentTabId = tabId;
        this.currentTabUrl = tabUrl;
        this.currentTabTitle = tabTitle;
        this.currentWebContentsId = webContentsId || this.view.webContents.id;
      }

      // Initialize snapshot manager for this recording
      if (recordingId) {
        await this.snapshotManager.initializeRecording(recordingId);
      }

      await this.enableCDPDomains();
      this.setupEventListeners();

      console.log('🎬 Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop recording
   */
  public async stopRecording(): Promise<RecordedAction[]> {
    if (!this.isRecording) {
      console.warn('No recording in progress');
      return [];
    }

    try {
      if (this.debugger && this.debugger.isAttached()) {
        this.debugger.detach();
      }

      this.isRecording = false;
      this.actions.sort((a, b) => a.timestamp - b.timestamp);
      
      // Finalize snapshots
      await this.snapshotManager.finalizeRecording();
      
      console.log(`⏹️ Recording stopped. Captured ${this.actions.length} actions`);
      
      // Reset tab context
      this.currentTabId = null;
      this.currentTabUrl = null;
      this.currentTabTitle = null;
      this.currentWebContentsId = null;
      
      return [...this.actions];
    } catch (error) {
      console.error('Error stopping recording:', error);
      return [...this.actions];
    }
  }

  /**
   * Check if currently recording
   */
  public isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get all recorded actions
   */
  public getActions(): RecordedAction[] {
    return [...this.actions];
  }

  /**
   * Add an action directly to the recorded actions
   * Used for synthetic actions like tab-switch
   */
  public addAction(action: RecordedAction): void {
    this.actions.push(action);
  }

  /**
   * Get snapshot statistics
   */
  public async getSnapshotStats() {
    return await this.snapshotManager.getSnapshotStats();
  }

  /**
   * Get snapshots directory for a recording
   */
  public getSnapshotsDirectory(recordingId: string): string {
    return this.snapshotManager.getSnapshotsDirectory(recordingId);
  }

  /**
   * Get current tab context
   */
  public getCurrentTabContext(): { tabId: string | null; tabUrl: string | null; tabTitle: string | null; webContentsId: number | null } {
    return {
      tabId: this.currentTabId,
      tabUrl: this.currentTabUrl,
      tabTitle: this.currentTabTitle,
      webContentsId: this.currentWebContentsId
    };
  }

  /**
   * Set the view for recording (used when initializing or switching)
   */
  public setView(view: WebContentsView): void {
    this.view = view;
    this.debugger = view.webContents.debugger;
  }

  /**
   * Update tab title from current page
   */
  private async updateTabTitle(): Promise<void> {
    if (!this.view) return;
    
    try {
      const title = this.view.webContents.getTitle();
      if (title) {
        this.currentTabTitle = title;
      }
    } catch (error) {
      console.error('Failed to update tab title:', error);
    }
  }

  /**
   * Enable required CDP domains
   */
  private async enableCDPDomains(): Promise<void> {
    if (!this.debugger) {
      throw new Error('Debugger not initialized');
    }

    try {
      await this.debugger.sendCommand('DOM.enable');
      console.log('✓ DOM domain enabled');
      await this.debugger.sendCommand('Page.enable');
      console.log('✓ Page domain enabled');
      await this.debugger.sendCommand('Runtime.enable');
      console.log('✓ Runtime domain enabled');
      await this.debugger.sendCommand('Network.enable');
      console.log('✓ Network domain enabled');
      await this.debugger.sendCommand('Log.enable');
      console.log('✓ Log domain enabled');
      await this.debugger.sendCommand('DOM.getDocument', { depth: -1 });
      console.log('✓ DOM document loaded');

      await this.debugger.sendCommand('Page.setLifecycleEventsEnabled', { 
        enabled: true 
      });
      await this.injectEventTracker();
      console.log('✓ Event tracker injected');

    } catch (error) {
      console.error('Error enabling CDP domains:', error);
      throw error;
    }
  }

  /**
   * Inject event tracking script into the page
   */
  private async injectEventTracker(): Promise<void> {
    if (!this.debugger) return;

    const script = this.generateMonitoringScript();
    await this.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: script,
      runImmediately: true
    });
    await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      includeCommandLineAPI: false
    });
    console.log('✅ Event tracker injected (CSP-proof)');
  }

  private generateMonitoringScript(): string {
    return `
      (function() {
        if (window.__browzerRecorderInstalled) return;
        window.__browzerRecorderInstalled = true;
        
        /**
         * Optimized element extraction - aligned with BrowserContextExtractor
         * Extracts only essential information with attributes and parentSelector
         */
        function extractElementTarget(element) {
          const rect = element.getBoundingClientRect();
          
          // Collect all attributes
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }
          
          return {
            selector: getSelector(element),
            tagName: element.tagName,
            text: (element.innerText || element.textContent || '').substring(0, 200).trim() || undefined,
            value: element.value || undefined,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            parentSelector: element.parentElement ? getSelector(element.parentElement) : undefined,
            isDisabled: element.disabled || element.getAttribute('aria-disabled') === 'true' || undefined,
            attributes: attributes
          };
        }
        
        /**
         * Generate optimized CSS selector
         */
        function getSelector(element) {
          if (element.id) return '#' + CSS.escape(element.id);
          if (element.hasAttribute('data-testid')) {
            return '[data-testid="' + element.getAttribute('data-testid') + '"]';
          }
          
          let path = [];
          let current = element;
          while (current && current.nodeType === Node.ELEMENT_NODE && path.length < 4) {
            let selector = current.nodeName.toLowerCase();
            if (current.id) {
              selector += '#' + CSS.escape(current.id);
              path.unshift(selector);
              break;
            }
            if (current.hasAttribute('data-testid')) {
              selector += '[data-testid="' + current.getAttribute('data-testid') + '"]';
              path.unshift(selector);
              break;
            }
            if (current.className && typeof current.className === 'string') {
              const classes = current.className.trim().split(/\\s+/)
                .filter(c => c && !c.match(/^(ng-|_)/))
                .slice(0, 2)
                .map(c => CSS.escape(c))
                .join('.');
              if (classes) selector += '.' + classes;
            }
            path.unshift(selector);
            current = current.parentElement;
          }
          return path.join(' > ');
        }
        
        /**
         * Find interactive parent element
         */
        function findInteractiveParent(element, maxDepth = 5) {
          let current = element;
          let depth = 0;
          while (current && depth < maxDepth) {
            if (isInteractiveElement(current)) return current;
            current = current.parentElement;
            depth++;
          }
          return element;
        }
        
        /**
         * Check if element is interactive
         */
        function isInteractiveElement(element) {
          const tagName = element.tagName.toLowerCase();
          const role = element.getAttribute('role');
          const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
          if (interactiveTags.includes(tagName)) return true;
          const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'option', 'textbox', 'searchbox', 'combobox'];
          if (role && interactiveRoles.includes(role)) return true;
          if (element.onclick || element.hasAttribute('onclick')) return true;
          const style = window.getComputedStyle(element);
          if (style.cursor === 'pointer') return true;
          if (element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1') return true;
          return false;
        }
        
        document.addEventListener('click', (e) => {
          const clickedElement = e.target;
          const interactiveElement = findInteractiveParent(clickedElement);
          const targetInfo = extractElementTarget(interactiveElement);
          
          console.info('[BROWZER_ACTION]', JSON.stringify({
            type: 'click',
            timestamp: Date.now(),
            target: targetInfo,
            position: { x: e.clientX, y: e.clientY }
          }));
        }, true);
        let inputDebounce = {};
        document.addEventListener('input', (e) => {
          const target = e.target;
          const tagName = target.tagName;
          const inputType = target.type?.toLowerCase();
          if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
            const key = target.id || target.name || getSelector(target);
            const immediateTypes = ['checkbox', 'radio', 'file', 'range', 'color'];
            const isImmediate = immediateTypes.includes(inputType);
            
            if (isImmediate) {
              handleInputAction(target);
            } else {
              clearTimeout(inputDebounce[key]);
              inputDebounce[key] = setTimeout(() => {
                handleInputAction(target);
              }, 500);
            }
          }
        }, true);
        document.addEventListener('change', (e) => {
          const target = e.target;
          const tagName = target.tagName;
          const inputType = target.type?.toLowerCase();
          
          if (tagName === 'SELECT') {
            handleSelectAction(target);
          } else if (inputType === 'checkbox') {
            handleCheckboxAction(target);
          } else if (inputType === 'radio') {
            handleRadioAction(target);
          } else if (inputType === 'file') {
            handleFileUploadAction(target);
          }
        }, true);
        function handleInputAction(target) {
          const inputType = target.type?.toLowerCase();
          let actionType = 'input';
          let value = target.value;
          
          if (inputType === 'checkbox') {
            actionType = 'checkbox';
            value = target.checked;
          } else if (inputType === 'radio') {
            actionType = 'radio';
            value = target.value;
          }
          
          console.info('[BROWZER_ACTION]', JSON.stringify({
            type: actionType,
            timestamp: Date.now(),
            target: extractElementTarget(target),
            value: value
          }));
        }
        function handleSelectAction(target) {
          const isMultiple = target.multiple;
          let selectedValues = [];
          
          if (isMultiple) {
            const options = Array.from(target.selectedOptions);
            selectedValues = options.map(opt => opt.value);
          } else {
            const selectedOption = target.options[target.selectedIndex];
            selectedValues = [selectedOption?.value];
          }
          
          console.info('[BROWZER_ACTION]', JSON.stringify({
            type: 'select',
            timestamp: Date.now(),
            target: extractElementTarget(target),
            value: isMultiple ? selectedValues : selectedValues[0]
          }));
        }
        function handleCheckboxAction(target) {
          console.info('[BROWZER_ACTION]', JSON.stringify({
            type: 'checkbox',
            timestamp: Date.now(),
            target: extractElementTarget(target),
            value: target.checked
          }));
        }
        function handleRadioAction(target) {
          console.info('[BROWZER_ACTION]', JSON.stringify({
            type: 'radio',
            timestamp: Date.now(),
            target: extractElementTarget(target),
            value: target.value
          }));
        }
        function handleFileUploadAction(target) {
          const files = Array.from(target.files || []);
          console.info('[BROWZER_ACTION]', JSON.stringify({
            type: 'file-upload',
            timestamp: Date.now(),
            target: extractElementTarget(target),
            value: files.map(f => f.name).join(', ')
          }));
        }
        document.addEventListener('submit', (e) => {
          const target = e.target;
          
          console.info('[BROWZER_ACTION]', JSON.stringify({
            type: 'submit',
            timestamp: Date.now(),
            target: extractElementTarget(target)
          }));
        }, true);
        document.addEventListener('keydown', (e) => {
          const importantKeys = [
            'Enter', 'Escape', 'Tab', 'Backspace', 'Delete',
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'Home', 'End', 'PageUp', 'PageDown'
          ];
          const isShortcut = (e.ctrlKey || e.metaKey || e.altKey) && e.key.length === 1;
          const isImportantKey = importantKeys.includes(e.key);
          
          if (isShortcut || isImportantKey) {
            const focusedElement = document.activeElement;
            
            console.info('[BROWZER_ACTION]', JSON.stringify({
              type: 'keypress',
              timestamp: Date.now(),
              value: e.key,
              target: focusedElement ? extractElementTarget(focusedElement) : undefined
            }));
          }
        }, true);
      })();
    `;
  }

  /**
   * Setup CDP event listeners
   */
  private setupEventListeners(): void {
    if (!this.debugger) return;

    // Remove all existing listeners to prevent duplicates
    this.debugger.removeAllListeners('message');
    this.debugger.removeAllListeners('detach');

    // Add fresh listeners
    this.debugger.on('message', async (_event, method, params) => {
      if (!this.isRecording) return;

      try {
        await this.handleCDPEvent(method, params);
      } catch (error) {
        console.error('Error handling CDP event:', error);
      }
    });
    this.debugger.on('detach', (_event, reason) => {
      console.log('Debugger detached:', reason);
      // Don't set isRecording to false here - we might be switching tabs
    });
  }

  /**
   * Handle CDP events and extract semantic actions
   */
  private async handleCDPEvent(method: string, params: any): Promise<void> {
    switch (method) {
      case 'Runtime.consoleAPICalled':
        if (params.type === 'info' && params.args.length >= 2) {
          const firstArg = params.args[0].value;
          if (firstArg === '[BROWZER_ACTION]') {
            try {
              const actionData = JSON.parse(params.args[1].value);
              await this.handlePendingAction(actionData);
              
            } catch (error) {
              console.error('Error parsing action:', error);
            }
          }
        }
        break;
      case 'Network.requestWillBeSent':
        this.recentNetworkRequests.push({
          url: params.request.url,
          method: params.request.method || 'GET',
          type: params.type || 'other',
          timestamp: Date.now(),
          completed: false
        });
        break;

      case 'Network.responseReceived':
      case 'Network.loadingFinished':
        const completedReq = this.recentNetworkRequests.find(
          r => r.url === params.response?.url && !r.completed
        );
        if (completedReq) {
          completedReq.completed = true;
        }
        break;
      case 'Page.lifecycleEvent':
        if (params.name === 'networkIdle') {
          console.log('🌐 Network is idle');
          await this.processPendingActions();
        }
        break;
      case 'Page.frameNavigated':
        if (params.frame.parentId === undefined) {
          const newUrl = params.frame.url;
          
          // Update current tab URL to reflect navigation
          this.currentTabUrl = newUrl;
          
          if (this.isSignificantNavigation(newUrl)) {
            this.recordNavigation(newUrl);
          }
        }
        break;
      
      case 'Page.loadEventFired':
        console.log('📄 Page loaded');
        await this.injectEventTracker();
        // Update tab title after page load
        await this.updateTabTitle();
        break;

      default:
        break;
    }
  }

  /**
   * 🆕 Handle pending action (await verification)
   */
  private async handlePendingAction(actionData: RecordedAction): Promise<void> {
    const actionId = `${actionData.type}-${actionData.timestamp}`;
    
    // Add tab context to action
    const enrichedAction: RecordedAction = {
      ...actionData,
      tabId: this.currentTabId || undefined,
      tabUrl: this.currentTabUrl || undefined,
      tabTitle: this.currentTabTitle || undefined,
      webContentsId: this.currentWebContentsId || undefined
    };
    
    // For keypress and certain actions, verify immediately without waiting
    const immediateVerificationTypes = ['keypress', 'input', 'checkbox', 'radio', 'select'];
    const shouldVerifyImmediately = immediateVerificationTypes.includes(actionData.type);
    
    if (shouldVerifyImmediately) {
      // Verify immediately and record
      enrichedAction.verified = true;
      enrichedAction.verificationTime = 0;
      
      // Capture snapshot asynchronously (non-blocking)
      if (this.view) {
        this.snapshotManager.captureSnapshot(this.view, enrichedAction).then(snapshotPath => {
          if (snapshotPath) {
            enrichedAction.snapshotPath = snapshotPath;
          }
        }).catch(err => console.error('Snapshot capture failed:', err));
      }
      
      this.actions.push(enrichedAction);
      console.log(`✅ Action immediately verified: ${actionData.type}`);
      if (this.onActionCallback) {
        this.onActionCallback(enrichedAction);
      }
      return;
    }
    
    // For other actions (like clicks), use verification with shorter deadline
    const verificationDeadline = Date.now() + 500; // Reduced from 1000ms to 500ms
    
    this.pendingActions.set(actionId, {
      action: enrichedAction,
      timestamp: Date.now(),
      verificationDeadline
    });
    
    setTimeout(async () => {
      await this.verifyAndFinalizeAction(actionId);
    }, 500);
  }

  /**
   * 🆕 Verify action effects and finalize
   */
  private async verifyAndFinalizeAction(actionId: string): Promise<void> {
    const pending = this.pendingActions.get(actionId);
    if (!pending) return;
    
    const { action, timestamp } = pending;
    const preClickState = action.metadata?.preClickState;
    const effects = await this.detectClickEffects(timestamp, preClickState);
    const verifiedAction: RecordedAction = {
      ...action,
      verified: true,
      verificationTime: Date.now() - timestamp,
      effects
    };
    
    // Capture snapshot asynchronously for verified click actions
    if (this.view) {
      this.snapshotManager.captureSnapshot(this.view, verifiedAction).then(snapshotPath => {
        if (snapshotPath) {
          verifiedAction.snapshotPath = snapshotPath;
        }
      }).catch(err => console.error('Snapshot capture failed:', err));
    }
    
    this.actions.push(verifiedAction);
    if (this.onActionCallback) {
      this.onActionCallback(verifiedAction);
    }
    this.pendingActions.delete(actionId);
  }

  /**
   * Detect comprehensive click effects
   */
  private async detectClickEffects(clickTimestamp: number, preClickState?: any): Promise<any> {
    const effects: any = {};
    const effectSummary: string[] = [];
    const allNetworkActivity = this.recentNetworkRequests.filter(
      req => req.timestamp >= clickTimestamp && req.timestamp <= clickTimestamp + 1500
    );
    const significantRequests = allNetworkActivity.filter(req => 
      this.isSignificantNetworkRequest(req.url, req.method, req.type)
    );
    
    if (significantRequests.length > 0) {
      effects.network = {
        requestCount: significantRequests.length,
        requests: significantRequests.map(req => ({
          url: req.url,
          method: req.method,
          type: req.type,
          status: req.status,
          timing: req.timestamp - clickTimestamp
        }))
      };
      effectSummary.push(`${significantRequests.length} network request(s)`);
    }
    try {
      const pageEffects = await this.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          (function() {
            const effects = {
              modal: null,
              focus: null,
              scroll: null,
              stateChange: null
            };
            const currentState = {
              url: window.location.href,
              scrollY: window.scrollY,
              scrollX: window.scrollX,
              activeElement: document.activeElement?.tagName,
              visibleModals: Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
              }).length
            };
            return {
              currentState: currentState,
              effects: effects
            };
          })();
        `,
        returnByValue: true
      });
      
      if (pageEffects.result?.value) {
        const result = pageEffects.result.value;
        const currentState = result.currentState;
        const focused = currentState.activeElement;
        if (focused && focused !== 'BODY' && focused !== 'HTML') {
          const meaningfulFocusTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
          if (meaningfulFocusTags.includes(focused)) {
            effects.focus = {
              changed: true,
              newFocusTagName: focused
            };
            effectSummary.push('focus changed to ' + focused.toLowerCase());
          }
        }
        const scrollDistance = Math.max(
          Math.abs(currentState.scrollY),
          Math.abs(currentState.scrollX)
        );
        if (scrollDistance > 200) { // Significant scroll only
          effects.scroll = {
            occurred: true,
            distance: scrollDistance
          };
          effectSummary.push('page scrolled');
        }
      }
    } catch (error) {
      console.error('Error detecting page effects:', error);
    }
    effects.summary = effectSummary.length > 0 
      ? effectSummary.join(', ')
      : 'no significant effects detected';
    
    return effects;
  }

  /**
   * 🆕 Process all pending actions (called on networkIdle)
   */
  private async processPendingActions(): Promise<void> {
    const pending = Array.from(this.pendingActions.keys());
    for (const actionId of pending) {
      await this.verifyAndFinalizeAction(actionId);
    }
  }


  /**
   * Filter: Check if navigation is significant (not analytics/tracking)
   */
  private isSignificantNavigation(url: string): boolean {
    const ignorePatterns = [
      'data:',
      'about:',
      'chrome:',
      'chrome-extension:',
      '/log?',
      '/analytics',
      '/tracking',
    ];

    return !ignorePatterns.some(pattern => url.startsWith(pattern) || url.includes(pattern));
  }

  /**
   * Filter: Check if network request is significant (not analytics/tracking/ping)
   */
  private isSignificantNetworkRequest(url: string, method: string, type: string): boolean {
    if (type === 'Ping' || type === 'ping' || type === 'beacon') {
      return false;
    }
    const ignorePatterns = [
      '/gen_204',           // Google analytics
      '/collect',           // Google Analytics
      '/analytics',
      '/tracking',
      '/track',
      '/beacon',
      '/ping',
      '/log',
      '/telemetry',
      'google-analytics.com',
      'googletagmanager.com',
      'doubleclick.net',
      'facebook.com/tr',
      'mixpanel.com',
      'segment.com',
      'amplitude.com',
      'hotjar.com',
      '/pixel',
      '/impression',
      'clarity.ms',
      'bing.com/api/log'
    ];
    
    if (ignorePatterns.some(pattern => url.includes(pattern))) {
      return false;
    }
    if (type === 'Document') {
      return true;
    }
    if (type === 'XHR' || type === 'Fetch') {
      const apiPatterns = ['/api/', '/v1/', '/v2/', '/graphql', '/rest/', '/data/'];
      const isApiCall = apiPatterns.some(pattern => url.includes(pattern));
      const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
      
      return isApiCall || isStateChanging;
    }
    
    return false;
  }



  /**
   * Record navigation
   */
  private recordNavigation(url: string, timestamp?: number): void {
    const action: RecordedAction = {
      type: 'navigate',
      timestamp: timestamp || Date.now(),
      url,
      tabId: this.currentTabId || undefined,
      tabUrl: this.currentTabUrl || undefined,
      tabTitle: this.currentTabTitle || undefined,
      webContentsId: this.currentWebContentsId || undefined,
      verified: true, // Navigation is always verified
      verificationTime: 0,
    };

    this.actions.push(action);
    if (this.onActionCallback) {
      this.onActionCallback(action);
    }
  }
}
