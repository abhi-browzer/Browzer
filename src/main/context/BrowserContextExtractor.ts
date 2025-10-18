/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebContentsView } from 'electron';
import {
  BrowserContext,
  ContextExtractionOptions,
  ContextExtractionResult,
  DOMContext,
} from '@/shared/types/context';

/**
 * BrowserContextExtractor - Advanced CDP-based browser context extraction
 * 
 * Uses Chrome DevTools Protocol to extract comprehensive browser context
 * for LLM-based automation and intelligent error recovery.
 * 
 * Features:
 * - DOM structure with semantic annotations
 */
export class BrowserContextExtractor {
  private view: WebContentsView | null = null;
  private debugger: Electron.Debugger | null = null;
  private isAttached = false;

  constructor(view?: WebContentsView) {
    if (view) {
      this.setView(view);
    }
  }

  /**
   * Set the WebContentsView to extract context from
   */
  public setView(view: WebContentsView): void {
    this.view = view;
    this.debugger = view.webContents.debugger;
  }

  /**
   * Extract complete browser context
   */
  public async extractContext(
    tabId: string,
    options: ContextExtractionOptions = {}
  ): Promise<ContextExtractionResult> {
    const startTime = Date.now();

    // Default options - optimized for minimal context
    const opts: Required<ContextExtractionOptions> = {
      includeDOM: options.includeDOM ?? true,
      maxInteractiveElements: options.maxInteractiveElements ?? 200,
      timeout: options.timeout ?? 10000
    };

    if (!this.view) {
      return {
        success: false,
        error: 'No WebContentsView set',
        duration: Date.now() - startTime
      };
    }

    try {
      // Attach debugger if not already attached
      const wasAttached = await this.ensureDebuggerAttached();

      // Extract only DOM context (optimized)
      const dom = opts.includeDOM ? await this.extractDOMContext(opts) : null;

      // Get basic page info
      const url = this.view.webContents.getURL();
      const title = this.view.webContents.getTitle();

      const context: BrowserContext = {
        extractedAt: Date.now(),
        tabId,
        url,
        title,
        dom: dom as DOMContext,
      };

      // Detach debugger if we attached it
      if (!wasAttached && this.isAttached) {
        await this.detachDebugger();
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Browser context extracted in ${duration}ms`);

      return {
        success: true,
        context,
        duration
      };

    } catch (error) {
      console.error('Failed to extract browser context:', error);
      
      // Try to detach debugger on error
      try {
        if (this.isAttached) {
          await this.detachDebugger();
        }
      } catch (detachError) {
        console.error('Failed to detach debugger:', detachError);
      }

      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Extract DOM context with semantic annotations
   */
  private async extractDOMContext(options: Required<ContextExtractionOptions>): Promise<DOMContext> {
    if (!this.debugger) throw new Error('Debugger not initialized');

    // Get document to ensure DOM is ready
    await this.debugger.sendCommand('DOM.getDocument', { depth: -1 });

    // Execute script to extract DOM information
    const script = this.generateDOMExtractionScript(options);
    const result = await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true,
      awaitPromise: true
    });

    if (result.exceptionDetails) {
      throw new Error(`DOM extraction failed: ${result.exceptionDetails.text}`);
    }

    return result.result.value as DOMContext;
  }

  /**
   * Generate script for DOM extraction (optimized for minimal context)
   */
  private generateDOMExtractionScript(options: Required<ContextExtractionOptions>): string {
    return `
      (async function() {
        const maxElements = ${options.maxInteractiveElements};
        
        // Helper: Check if element is visible (ALWAYS check, never include hidden)
        function isVisible(el) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 style.opacity !== '0' &&
                 rect.width > 0 && 
                 rect.height > 0;
        }
        
        // Helper: Generate selector
        function getSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          if (el.hasAttribute('data-testid')) {
            return '[data-testid="' + el.getAttribute('data-testid') + '"]';
          }
          
          let path = [];
          let current = el;
          while (current && current.nodeType === Node.ELEMENT_NODE && path.length < 4) {
            let selector = current.nodeName.toLowerCase();
            if (current.id) {
              selector += '#' + CSS.escape(current.id);
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
        
        // Helper: Get nearby text for context
        function getNearbyText(el) {
          const parent = el.parentElement;
          if (!parent) return '';
          const text = parent.innerText || '';
          return text.substring(0, 100).trim();
        }
        
        // Helper: Extract interactive element info (OPTIMIZED - only essential fields)
        function extractInteractiveElement(el) {
          const rect = el.getBoundingClientRect();
          
          // Collect all attributes
          const attributes = {};
          for (const attr of el.attributes) {
            attributes[attr.name] = attr.value;
          }
          
          // Only include essential fields
          return {
            selector: getSelector(el),
            tagName: el.tagName,
            text: (el.innerText || el.textContent || '').substring(0, 200).trim() || undefined,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            parentSelector: el.parentElement ? getSelector(el.parentElement) : undefined,
            isDisabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
            attributes
          };
        }
        
        // Extract forms (critical for automation)
        const forms = Array.from(document.querySelectorAll('form'))
          .filter(isVisible)
          .slice(0, 50)
          .map(form => ({
            action: form.action || undefined,
            method: form.method || undefined,
            selector: getSelector(form),
            fields: Array.from(form.elements)
              .filter(el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
              .filter(isVisible)
              .slice(0, 50)
              .map(extractInteractiveElement)
          }));
        
        // Extract ALL interactive elements (NO DUPLICATES - single source of truth)
        // This includes buttons, inputs, links, selects, and any clickable elements
        const seenSelectors = new Set();
        const allInteractive = [];
        
        // Query all potentially interactive elements
        const interactiveSelectors = [
          'button',
          'a[href]',
          'input',
          'textarea',
          'select',
          '[role="button"]',
          '[role="link"]',
          '[role="tab"]',
          '[role="menuitem"]',
          '[onclick]',
          '[tabindex]'
        ];
        
        for (const selector of interactiveSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            if (!isVisible(el)) continue;
            
            const elSelector = getSelector(el);
            if (seenSelectors.has(elSelector)) continue;
            
            seenSelectors.add(elSelector);
            allInteractive.push(extractInteractiveElement(el));
            
            if (allInteractive.length >= maxElements) break;
          }
          if (allInteractive.length >= maxElements) break;
        }
        
        // Statistics
        const stats = {
          totalElements: document.querySelectorAll('*').length,
          interactiveElements: allInteractive.length,
          forms: forms.length
        };
        
        return {
          forms,
          allInteractiveElements: allInteractive,
          stats
        };
      })();
    `;
  }


  /**
   * Ensure debugger is attached
   */
  private async ensureDebuggerAttached(): Promise<boolean> {
    if (!this.debugger) {
      throw new Error('Debugger not initialized');
    }

    const wasAttached = this.debugger.isAttached();
    
    if (!wasAttached) {
      try {
        this.debugger.attach('1.3');
        this.isAttached = true;
        
        // Enable required domains
        await Promise.all([
          this.debugger.sendCommand('DOM.enable'),
          this.debugger.sendCommand('Runtime.enable'),
          this.debugger.sendCommand('Page.enable')
        ]);
        
        console.log('✅ Debugger attached for context extraction');
      } catch (error) {
        console.error('Failed to attach debugger:', error);
        throw error;
      }
    } else {
      this.isAttached = true;
    }

    return wasAttached;
  }

  /**
   * Detach debugger
   */
  private async detachDebugger(): Promise<void> {
    if (this.debugger && this.isAttached) {
      try {
        this.debugger.detach();
        this.isAttached = false;
        console.log('✅ Debugger detached after context extraction');
      } catch (error) {
        console.error('Failed to detach debugger:', error);
      }
    }
  }
}
