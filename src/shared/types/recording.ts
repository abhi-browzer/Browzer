
/**
 * Selector strategy with confidence score
 */
export interface SelectorStrategy {
  strategy: 'id' | 'data-testid' | 'data-cy' | 'aria-label' | 'role' | 'text' | 'css' | 'xpath';
  selector: string;
  score: number; // 0-100, higher is more reliable
  description?: string;
}

/**
 * Enhanced target information with multiple selector strategies
 */
export interface ElementTarget {
  // Primary selector (best one)
  selector: string;
  
  // Multiple selector strategies for fallback
  selectors?: SelectorStrategy[];
  
  // Element identification
  tagName: string;
  id?: string;
  className?: string;
  name?: string;
  type?: string; // input type, button type, etc.
  
  // Semantic attributes
  role?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  title?: string;
  placeholder?: string;
  
  // Content
  text?: string;
  value?: string;
  href?: string; // for links
  
  // Data attributes (for testing)
  dataTestId?: string;
  dataCy?: string;
  
  // Visual properties
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  isVisible?: boolean;
  
  // Computed properties
  isInteractive?: boolean; // Is this element clickable/interactive?
  interactiveParent?: ElementTarget; // If clicked element is non-interactive, this is the interactive parent
}

export interface RecordedAction {
  type: 'click' | 'input' | 'navigate' | 'keypress' | 'submit' | 'select' | 'checkbox' | 'radio' | 'toggle' | 'file-upload' | 'tab-switch';
  timestamp: number;
  target?: ElementTarget;
  value?: string | string[] | boolean;
  url?: string;
  position?: { x: number; y: number };
  metadata?: Record<string, any>;

  // Multi-tab recording metadata
  tabId?: string;
  tabUrl?: string;
  tabTitle?: string;
  webContentsId?: number;

  // Verification metadata (added by ActionRecorder)
  verified?: boolean;
  verificationTime?: number;
  effects?: ClickEffects;
}

/**
 * Comprehensive click effect tracking
 */
export interface ClickEffects {
  // Navigation effects
  navigation?: {
    occurred: boolean;
    url?: string;
    type?: 'full' | 'spa' | 'hash'; // Full page reload, SPA navigation, or hash change
    timing?: number; // ms after click
  };
  
  // Network activity
  network?: {
    requestCount: number;
    requests?: Array<{
      url: string;
      method: string;
      status?: number;
      type?: string; // xhr, fetch, document, etc.
      timing: number; // ms after click
    }>;
  };
  
  // DOM changes
  dom?: {
    mutationCount: number;
    addedNodes?: number;
    removedNodes?: number;
    attributeChanges?: number;
    significantChanges?: boolean; // Large structural changes
  };
  
  // Modal/Overlay/Dialog detection
  modal?: {
    appeared: boolean;
    type?: 'modal' | 'dialog' | 'dropdown' | 'popover' | 'sheet' | 'toast';
    selector?: string;
    role?: string;
    ariaLabel?: string;
    timing?: number;
  };
  
  // Form submission
  formSubmit?: {
    occurred: boolean;
    formSelector?: string;
    method?: string;
    action?: string;
    timing?: number;
  };
  
  // Element state changes
  stateChange?: {
    occurred: boolean;
    type?: 'toggle' | 'expand' | 'collapse' | 'select' | 'activate' | 'disable';
    targetChanged?: boolean; // Did the clicked element itself change?
    ariaExpanded?: boolean;
    ariaSelected?: boolean;
    ariaChecked?: boolean;
    classChanges?: string[]; // Classes added/removed
  };
  
  // Focus changes
  focus?: {
    changed: boolean;
    newFocusSelector?: string;
    newFocusTagName?: string;
  };
  
  // Scroll behavior
  scroll?: {
    occurred: boolean;
    direction?: 'vertical' | 'horizontal' | 'both';
    distance?: number;
  };
  
  // Download triggered
  download?: {
    occurred: boolean;
    filename?: string;
  };
  
  // New window/tab
  newWindow?: {
    occurred: boolean;
    url?: string;
  };
  
  // Summary
  summary?: string; // Human-readable effect description for LLM
}


/**
 * Tab metadata for multi-tab recording sessions
 */
export interface RecordingTabInfo {
  tabId: string;
  webContentsId: number;
  title: string;
  url: string;
  firstActiveAt: number; // When this tab first became active during recording
  lastActiveAt: number; // When this tab was last active during recording
  actionCount: number; // Number of actions recorded in this tab
}

export interface RecordingSession {
  id: string;
  name: string;
  description?: string;
  actions: RecordedAction[];
  createdAt: number;
  duration: number; // in milliseconds
  actionCount: number;
  url?: string; // Starting URL (deprecated, use startTabId instead)
  
  // Multi-tab recording metadata
  startTabId?: string; // Tab where recording started
  tabs?: RecordingTabInfo[]; // All tabs that were active during recording
  tabSwitchCount?: number; // Number of tab switches during recording
  
  // Video recording metadata
  videoPath?: string; // Absolute path to the video file
  videoSize?: number; // Video file size in bytes
  videoFormat?: string; // Video format (e.g., 'webm')
  videoDuration?: number; // Actual video duration in milliseconds
}