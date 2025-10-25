import path from 'node:path';
import { INTERNAL_PAGES } from '@/main/constants';

/**
 * NavigationManager - Handles URL normalization and internal page routing
 * 
 * Responsibilities:
 * - Normalize user input to valid URLs
 * - Handle internal browzer:// protocol
 * - Generate internal page URLs with hash routing
 * - Detect internal pages from URLs
 */
export class NavigationManager {
  /**
   * Normalize URL (add protocol if missing, handle search queries)
   */
  public normalizeURL(url: string): string {
    const trimmed = url.trim();
    
    if (trimmed.startsWith('browzer://')) {
      return this.handleInternalURL(trimmed);
    }
    
    // If it looks like a URL with protocol, use it as is
    if (/^[a-z]+:\/\//i.test(trimmed)) {
      return trimmed;
    }
    
    // If it looks like a domain, add https://
    if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    
    // Otherwise, treat as search query
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  /**
   * Handle internal browzer:// URLs
   * Supports: settings, history, recordings, downloads, etc.
   */
  private handleInternalURL(url: string): string {
    const internalPath = url.replace('browzer://', '');
    
    const validPages = INTERNAL_PAGES.map(page => page.path);
    
    if (validPages.includes(internalPath)) {
      return this.generateInternalPageURL(internalPath);
    }
    
    console.warn(`Unknown internal page: ${internalPath}`);
    return 'https://www.google.com';
  }

  /**
   * Generate internal page URL with hash routing
   * @param pageName - Name of the internal page (settings, history, etc.)
   */
  private generateInternalPageURL(pageName: string): string {
    // In development, use the dev server with a hash route
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      return `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${pageName}`;
    }
    
    // In production, use file protocol with hash route
    return `file://${path.join(__dirname, `../../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}#/${pageName}`;
  }

  /**
   * Get internal page info from URL
   * Returns null if not an internal page
   */
  public getInternalPageInfo(url: string): { url: string; title: string } | null {
    for (const page of INTERNAL_PAGES) {
      if (url.includes(`#/${page.path}`)) {
        return {
          url: `browzer://${page.path}`,
          title: page.title,
        };
      }
    }

    return null;
  }

  /**
   * Get internal page title from URL
   */
  public getInternalPageTitle(url: string): string | null {
    const info = this.getInternalPageInfo(url);
    return info?.title || null;
  }

  /**
   * Check if URL is an internal page
   */
  public isInternalPage(url: string): boolean {
    return url.startsWith('browzer://') || 
           url.includes('index.html#/') ||
           INTERNAL_PAGES.some(page => url.includes(`#/${page.path}`));
  }
}
