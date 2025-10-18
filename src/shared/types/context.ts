/**
 * Browser Context Extraction Types
 * 
 * Comprehensive types for extracting and representing browser context
 * for LLM-based automation and error recovery
 */

/**
 * Interactive element information for automation
 */
export interface InteractiveElement {
  // Element identification
  selector: string;
  tagName: string;
  role?: string;
  
  // Semantic information
  ariaLabel?: string;
  ariaDescription?: string;
  title?: string;
  placeholder?: string;
  text?: string;
  value?: string;
  
  // Visual context
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Interaction capabilities
  isDisabled: boolean;
  
  // Context
  parentSelector?: string;
  
  // Attributes
  attributes: Record<string, string>;
}

/**
 * DOM structure with semantic annotations
 */
export interface DOMContext {
  forms: Array<{
    action?: string;
    method?: string;
    selector: string;
    fields: Array<{
      name: string;
      type: string;
      label?: string;
      required: boolean;
      selector: string;
    }>;
  }>;
  
  // All interactive elements combined
  allInteractiveElements: InteractiveElement[];
  
  // Statistics
  stats: {
    totalElements: number;
    interactiveElements: number;
    forms: number;
    links: number;
    images: number;
    iframes: number;
  };
}

/**
 * Accessibility tree for better element understanding
 */
export interface AccessibilityContext {
  // Focused element
  focusedElement?: {
    role: string;
    name?: string;
    selector: string;
  };
  
  // Accessibility tree nodes (simplified)
  nodes: Array<{
    role: string;
    name?: string;
    description?: string;
    value?: string;
    selector?: string;
    children?: number; // Number of children
  }>;
  
  // ARIA live regions
  liveRegions: Array<{
    politeness: 'polite' | 'assertive' | 'off';
    selector: string;
    content: string;
  }>;
}

/**
 * Visual and layout context
 */
export interface VisualContext {
  // Viewport
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  
  // Scroll position
  scroll: {
    x: number;
    y: number;
    maxX: number;
    maxY: number;
  };
  
  // Visible area
  visibleElements: number;
  
  // Layout information
  hasFixedHeader: boolean;
  hasFixedFooter: boolean;
  hasSidebar: boolean;
  
  // Modals/Overlays
  activeModals: Array<{
    selector: string;
    role?: string;
    ariaLabel?: string;
    zIndex: number;
  }>;
}

/**
 * JavaScript execution context
 */
export interface JavaScriptContext {
  // Detected frameworks/libraries
  frameworks: Array<{
    name: string;
    version?: string;
    confidence: number; // 0-100
  }>;
  
  // Global variables (sanitized)
  globalVariables: string[];
  
  // Page readiness
  readyState: 'loading' | 'interactive' | 'complete';
  
  // Console errors (recent)
  consoleErrors: Array<{
    message: string;
    timestamp: number;
    level: 'error' | 'warning';
  }>;
  
  // Performance metrics
  performance?: {
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint?: number;
  };
}

/**
 * Network and resource context
 */
export interface NetworkContext {
  // Active requests
  activeRequests: number;
  
  // Recent network activity
  recentRequests: Array<{
    url: string;
    method: string;
    status?: number;
    type: string;
    timestamp: number;
  }>;
  
  // Cookies (sanitized)
  cookieCount: number;
  
  // Local/Session storage
  localStorage: {
    itemCount: number;
    keys: string[]; // Key names only, not values
  };
  
  sessionStorage: {
    itemCount: number;
    keys: string[];
  };
}

/**
 * Page metadata
 */
export interface PageMetadata {
  title: string;
  description?: string;
  keywords?: string[];
  author?: string;
  language?: string;
  charset?: string;
  
  // Open Graph / Social
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  
  // Canonical URL
  canonicalUrl?: string;
  
  // Favicon
  favicon?: string;
}

/**
 * Complete browser context
 */
export interface BrowserContext {
  // Timestamp
  extractedAt: number;
  
  // Tab information
  tabId: string;
  url: string;
  title: string;
  
  // Context components
  dom: DOMContext;
  // accessibility: AccessibilityContext;
  // visual: VisualContext;
  // javascript: JavaScriptContext;
  // network: NetworkContext;
  // metadata: PageMetadata;
  
  // // Summary for LLM
  // summary: {
  //   pageType: string; // e.g., "login page", "search results", "article", "dashboard"
  //   mainPurpose: string;
  //   keyElements: string[];
  //   currentState: string; // e.g., "form ready", "loading", "error state"
  //   suggestedActions: string[];
  // };
  
  // // Raw data (optional, for debugging)
  // raw?: {
  //   htmlSnapshot?: string; // Simplified HTML
  //   accessibilityTree?: string; // Full a11y tree
  // };
}

/**
 * Context extraction options
 */
export interface ContextExtractionOptions {
  // What to extract
  includeDOM?: boolean;
  // includeAccessibility?: boolean;
  // includeVisual?: boolean;
  // includeJavaScript?: boolean;
  // includeNetwork?: boolean;
  // includeMetadata?: boolean;
  
  // Detail level
  maxInteractiveElements?: number; // Limit number of elements
  // includeHiddenElements?: boolean;
  // includeRawData?: boolean; // Include raw HTML/a11y tree
  
  // Performance
  timeout?: number; // Max extraction time in ms
}

/**
 * Context extraction result
 */
export interface ContextExtractionResult {
  success: boolean;
  context?: BrowserContext;
  error?: string;
  duration: number; // Extraction time in ms
}
