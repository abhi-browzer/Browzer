/**
 * SINGLE SOURCE OF TRUTH for all internal routes
 * 
 * This file defines ALL routes in the application:
 * - Auth routes (fullscreen, no tabs)
 * - Internal routes (in-tab, with browzer:// protocol)
 */

export interface RouteConfig {
  path: string;
  title: string;
  showInTab: boolean; // true = load in tab, false = fullscreen
}

/**
 * Auth routes - Always fullscreen, no tabs visible
 */
export const AUTH_ROUTES: Record<string, RouteConfig> = {
  'confirm-signup': {
    path: '/auth/confirm-signup',
    title: 'Confirm Email',
    showInTab: false,
  },
  'reset-password': {
    path: '/auth/reset-password',
    title: 'Reset Password',
    showInTab: false,
  },
};

/**
 * Internal routes - Load in tabs with browzer:// protocol
 */
export const INTERNAL_ROUTES: Record<string, RouteConfig> = {
  settings: {
    path: '/settings',
    title: 'Settings',
    showInTab: true,
  },
  history: {
    path: '/history',
    title: 'History',
    showInTab: true,
  },
  recordings: {
    path: '/recordings',
    title: 'Recordings',
    showInTab: true,
  },
  automation: {
    path: '/automation',
    title: 'Automation',
    showInTab: true,
  },
  profile: {
    path: '/profile',
    title: 'Profile',
    showInTab: true,
  },
};

/**
 * All routes combined
 */
export const ALL_ROUTES = {
  ...AUTH_ROUTES,
  ...INTERNAL_ROUTES,
};

/**
 * Get route config from browzer:// URL
 * Example: browzer://settings -> { path: '/settings', title: 'Settings', showInTab: true }
 */
export function getRouteFromURL(url: string): RouteConfig | null {
  // Extract route from browzer://route or browzer://auth/route
  const match = url.match(/^browzer:\/\/(.+?)(?:\?|$)/);
  if (!match) return null;

  const routePath = match[1];
  
  // Check internal routes first
  if (INTERNAL_ROUTES[routePath]) {
    return INTERNAL_ROUTES[routePath];
  }
  
  // Check auth routes (e.g., auth/confirm-signup -> confirm-signup)
  const authKey = routePath.replace('auth/', '');
  if (AUTH_ROUTES[authKey]) {
    return AUTH_ROUTES[authKey];
  }
  
  return null;
}

/**
 * Check if route should show tabs
 */
export function shouldShowTabs(url: string): boolean {
  const route = getRouteFromURL(url);
  return route?.showInTab ?? false;
}

/**
 * Get all internal route paths for NavigationManager
 */
export function getInternalRoutePaths(): string[] {
  return Object.keys(INTERNAL_ROUTES);
}
