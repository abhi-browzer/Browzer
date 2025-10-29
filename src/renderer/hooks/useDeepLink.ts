import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRouteFromURL } from '@/shared/routes';

/**
 * Global deep link handler
 * 
 * Two behaviors:
 * 1. showInTab=false (auth) → Hide tabs, navigate with React Router
 * 2. showInTab=true (settings) → Show tabs, load in WebContentsView tab
 */
export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = window.browserAPI.onDeepLink(async (data) => {
      const route = getRouteFromURL(data.url);
      if (!route) return;

      if (data.showInTab) {
        navigate('/');
        // IN-TAB: Show BrowserChrome, load page in tab
        await window.browserAPI.showAllTabs();
        
        // Navigate to root to show BrowserChrome (not hash route)
        if (window.location.hash) {
          window.location.hash = '';
        }
        
        // Load browzer:// URL in tab
        await window.browserAPI.navigateToTab(data.url);
      } else {
        // FULLSCREEN: Hide tabs, show auth page in React
        await window.browserAPI.hideAllTabs();
        navigate(route.path);
      }
    });

    return unsubscribe;
  }, [navigate]);
}
