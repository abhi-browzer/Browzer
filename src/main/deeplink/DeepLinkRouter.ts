/**
 * DeepLinkRouter - Categorizes and routes deep links
 * 
 * Two types of routes:
 * 1. FULLSCREEN: Auth pages, onboarding - hide all tabs, show only browserUI
 * 2. IN_TAB: Settings, history, recordings - load inside a tab with browzer:// URL
 */

export enum DeepLinkRouteType {
  FULLSCREEN = 'fullscreen',  // Covers entire window, no tabs visible
  IN_TAB = 'in-tab',          // Loads inside a tab
}

export interface DeepLinkRoute {
  name: string;
  type: DeepLinkRouteType;
  title: string;
  description: string;
}

/**
 * Route configuration for all deep links
 */
export const DEEP_LINK_ROUTES: Record<string, DeepLinkRoute> = {
  // ============================================================================
  // FULLSCREEN ROUTES - Cover entire window, no tabs
  // ============================================================================
  'auth/confirm-signup': {
    name: 'auth/confirm-signup',
    type: DeepLinkRouteType.FULLSCREEN,
    title: 'Confirm Signup',
    description: 'Confirm your email',
  },
  'auth/reset-password': {
    name: 'auth/reset-password',
    type: DeepLinkRouteType.FULLSCREEN,
    title: 'Reset Password',
    description: 'Set a new password',
  },

  // ============================================================================
  // IN-TAB ROUTES - Load inside a tab with browzer:// URL
  // ============================================================================
  'settings': {
    name: 'settings',
    type: DeepLinkRouteType.IN_TAB,
    title: 'Settings',
    description: 'Application settings',
  },
  'history': {
    name: 'history',
    type: DeepLinkRouteType.IN_TAB,
    title: 'History',
    description: 'Browsing history',
  },
  'recordings': {
    name: 'recordings',
    type: DeepLinkRouteType.IN_TAB,
    title: 'Recordings',
    description: 'Recorded workflows',
  },
  'automation': {
    name: 'automation',
    type: DeepLinkRouteType.IN_TAB,
    title: 'Automation',
    description: 'Automation sessions',
  },
  'profile': {
    name: 'profile',
    type: DeepLinkRouteType.IN_TAB,
    title: 'Profile',
    description: 'User profile',
  },
};

/**
 * Get route configuration for a given route path
 */
export function getDeepLinkRoute(routePath: string): DeepLinkRoute | null {
  // Normalize route path
  const normalizedPath = routePath.replace(/^\/+|\/+$/g, '');
  
  // Direct match
  if (DEEP_LINK_ROUTES[normalizedPath]) {
    return DEEP_LINK_ROUTES[normalizedPath];
  }
  
  // Try to match parent route for nested paths
  // e.g., 'settings/privacy' -> 'settings'
  const parts = normalizedPath.split('/');
  if (parts.length > 1) {
    const parentRoute = parts[0];
    if (DEEP_LINK_ROUTES[parentRoute]) {
      return DEEP_LINK_ROUTES[parentRoute];
    }
  }
  
  return null;
}

/**
 * Check if a route should be loaded in fullscreen mode
 */
export function isFullscreenRoute(routePath: string): boolean {
  const route = getDeepLinkRoute(routePath);
  return route?.type === DeepLinkRouteType.FULLSCREEN;
}

/**
 * Check if a route should be loaded in a tab
 */
export function isInTabRoute(routePath: string): boolean {
  const route = getDeepLinkRoute(routePath);
  return route?.type === DeepLinkRouteType.IN_TAB;
}

/**
 * Get all fullscreen routes
 */
export function getFullscreenRoutes(): DeepLinkRoute[] {
  return Object.values(DEEP_LINK_ROUTES).filter(
    route => route.type === DeepLinkRouteType.FULLSCREEN
  );
}

/**
 * Get all in-tab routes
 */
export function getInTabRoutes(): DeepLinkRoute[] {
  return Object.values(DEEP_LINK_ROUTES).filter(
    route => route.type === DeepLinkRouteType.IN_TAB
  );
}
