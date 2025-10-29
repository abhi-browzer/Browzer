import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global deep link handler hook
 * Handles two types of deep links:
 * 1. FULLSCREEN routes (auth pages) - Hide tabs, navigate in browserUI
 * 2. IN_TAB routes (settings, etc.) - Load inside a tab with browzer:// URL
 */
export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[useDeepLink] 🔗 Setting up global deep link listener');

    const unsubscribe = window.browserAPI.onDeepLink(async (data) => {
      console.log('[useDeepLink] 📨 Received deep link event:', {
        protocol: data.protocol,
        route: data.route,
        params: data.params,
        fullUrl: data.fullUrl,
        routeType: data.routeType
      });
      
      if (!data.route) {
        console.warn('[useDeepLink] ⚠️ No route in deep link data, ignoring');
        return;
      }

      // Remove any leading slashes from route
      const route = data.route.replace(/^\/+/, '');
      
      console.log('[useDeepLink] 🧭 Processing route:', route);
      console.log('[useDeepLink] 📦 Route type:', data.routeType);

      // Handle based on route type
      if (data.routeType === 'fullscreen') {
        // FULLSCREEN ROUTES: Auth pages, onboarding, etc.
        console.log('[useDeepLink] 🖥️ FULLSCREEN route - hiding tabs');
        
        // Hide all browser tabs
        await window.browserAPI.hideAllTabs();
        
        // Navigate using React Router (for auth pages)
        const path = `/${route}`;
        console.log('[useDeepLink] 🎯 Navigating to:', path);
        navigate(path);
        
        console.log('[useDeepLink] ✅ Fullscreen navigation complete');
        
      } else if (data.routeType === 'in-tab') {
        // IN-TAB ROUTES: Settings, history, recordings, etc.
        console.log('[useDeepLink] 📑 IN-TAB route - loading in tab');
        
        // Show tabs if they were hidden
        await window.browserAPI.showAllTabs();
        
        // Navigate to browzer:// URL in a tab
        await window.browserAPI.navigateToTab(data.fullUrl);
        
        console.log('[useDeepLink] ✅ In-tab navigation complete');
        
      } else {
        // Unknown route type - fallback to hash navigation
        console.warn('[useDeepLink] ⚠️ Unknown route type, using hash fallback');
        window.location.hash = `#/${route}`;
      }
      
      // Log query parameters if present
      if (data.params && Object.keys(data.params).length > 0) {
        console.log('[useDeepLink] 🔑 Query params available:', data.params);
      }
    });

    return () => {
      console.log('[useDeepLink] 🧹 Cleaning up global deep link listener');
      unsubscribe();
    };
  }, [navigate]);
}
