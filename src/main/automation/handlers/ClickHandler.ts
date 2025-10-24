/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseHandler } from '../core/BaseHandler';
import { ElementFinder } from '../core/ElementFinder';
import { EffectTracker } from '../core/EffectTracker';
import type { HandlerContext, ClickExecutionResult, ClickabilityResult } from '../core/types';
import type { ClickParams, ToolExecutionResult, FoundElement } from '@/shared/types';

/**
 * ClickHandler - Handles click automation operations
 * 
 * Provides robust clicking with:
 * - Multi-strategy element finding
 * - Visibility and clickability verification
 * - Multiple click fallback strategies
 * - Effect tracking (navigation, DOM changes, etc.)
 * 
 * This handler ensures clicks work reliably across different web frameworks
 * and UI patterns (React, Vue, Angular, vanilla JS).
 */
export class ClickHandler extends BaseHandler {
  private elementFinder: ElementFinder;
  private effectTracker: EffectTracker;

  constructor(context: HandlerContext) {
    super(context);
    this.elementFinder = new ElementFinder(context);
    this.effectTracker = new EffectTracker(context);
  }

  /**
   * Execute click operation
   */
  async execute(params: ClickParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }

      // Step 1: Find element with multi-strategy approach
      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const elementResult = await this.elementFinder.advancedFind(selectors, params);

      if (!elementResult.success) {
        return this.createErrorResult('click', startTime, {
          code: 'ELEMENT_NOT_FOUND',
          message: elementResult.error || 'Could not find element with any selector',
          details: {
            attemptedSelectors: selectors,
            lastError: elementResult.details,
            suggestions: [
              'Verify selectors match elements in current page state',
              'Check if element is inside iframe or shadow DOM',
              'Ensure page has finished loading dynamic content',
              'Try using more specific backup selectors (id, data-testid, aria-label)'
            ]
          }
        });
      }

      console.log(`[ClickHandler] ✅ Found element with: ${elementResult.usedSelector}`);

      // Step 2: Ensure element is in viewport and unobstructed
      const visibilityResult = await this.ensureElementClickable(
        elementResult.usedSelector,
        elementResult.element
      );

      if (!visibilityResult.success) {
        return this.createErrorResult('click', startTime, {
          code: visibilityResult.covered ? 'ELEMENT_COVERED' : 'ELEMENT_NOT_VISIBLE',
          message: visibilityResult.error || 'Element not clickable',
          details: {
            attemptedSelectors: [elementResult.usedSelector],
            elementState: visibilityResult.state,
            suggestions: visibilityResult.suggestions || [
              'Element may be covered by modal/overlay',
              'Try closing modals or popups first',
              'Element may need more time to become interactive'
            ]
          }
        });
      }

      console.log(`[ClickHandler] ✅ Element is clickable`);

      // Step 3: Capture pre-click state for effect detection
      await this.effectTracker.capturePreActionState();

      // Step 4: Perform click with multiple fallback strategies
      const clickResult = await this.performAdvancedClick(
        elementResult.usedSelector,
        elementResult.element
      );

      if (!clickResult.success) {
        return this.createErrorResult('click', startTime, {
          code: 'EXECUTION_ERROR',
          message: clickResult.error || 'Click failed',
          details: {
            attemptedSelectors: clickResult.attemptedMethods,
            lastError: clickResult.lastError,
            suggestions: [
              'Element may have been removed/changed during click',
              'Try increasing waitForElement time',
              'Check if page has JavaScript errors'
            ]
          }
        });
      }

      console.log(`[ClickHandler] ✅ Click executed using: ${clickResult.method}`);

      // Step 5: Wait for effects and detect changes
      await this.sleep(800);
      const effects = await this.effectTracker.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'click',
        executionTime,
        element: {
          selector: elementResult.usedSelector,
          selectorType: elementResult.selectorType,
          tagName: elementResult.element.tagName,
          text: elementResult.element.text,
          attributes: elementResult.element.attributes || {},
          boundingBox: elementResult.element.boundingBox,
          isVisible: true,
          isEnabled: true
        } as FoundElement,
        effects,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.getUrl()
      };

    } catch (error) {
      return this.createErrorResult('click', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Click execution failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          lastError: error instanceof Error ? error.message : String(error),
          suggestions: [
            'Check browser console for JavaScript errors',
            'Verify page is in stable state',
            'Try with longer wait time'
          ]
        }
      });
    }
  }

  /**
   * Ensure element is clickable - scroll into view and check for overlays
   */
  private async ensureElementClickable(
    selector: string,
    element: any
  ): Promise<ClickabilityResult> {
    const script = `
      (async function() {
        try {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) return { success: false, error: 'Element disappeared' };

          // Step 1: Scroll into view with smooth behavior
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
          });
          
          // Wait for scroll to complete
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 2: Check visibility after scroll
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          const isVisible = rect.width > 0 && rect.height > 0 &&
                           style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0';
          
          if (!isVisible) {
            return {
              success: false,
              error: 'Element not visible after scrolling',
              state: {
                rect: { width: rect.width, height: rect.height },
                style: {
                  display: style.display,
                  visibility: style.visibility,
                  opacity: style.opacity
                }
              }
            };
          }

          // Step 3: Check if element is covered by overlay
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const topElement = document.elementFromPoint(centerX, centerY);
          
          // Check if top element is the target or a child of target
          const isSameOrChild = topElement === element || element.contains(topElement);
          
          if (!isSameOrChild) {
            // Element is covered by something else
            const coveringElement = topElement;
            const coveringInfo = {
              tagName: coveringElement?.tagName,
              className: coveringElement?.className,
              id: coveringElement?.id,
              role: coveringElement?.getAttribute('role'),
              isModal: coveringElement?.getAttribute('role') === 'dialog' ||
                       coveringElement?.getAttribute('aria-modal') === 'true',
              isOverlay: coveringElement?.classList.contains('overlay') ||
                        coveringElement?.classList.contains('modal-backdrop')
            };

            return {
              success: false,
              covered: true,
              error: 'Element is covered by another element',
              state: {
                coveringElement: coveringInfo,
                targetRect: rect
              },
              suggestions: coveringInfo.isModal ? 
                ['Close the modal/dialog first', 'Try clicking modal close button'] :
                ['Element may be behind a popup or overlay', 'Try waiting longer for page to stabilize']
            };
          }

          // Step 4: Check if element is enabled
          const isDisabled = element.disabled || 
                            element.getAttribute('disabled') !== null ||
                            element.getAttribute('aria-disabled') === 'true';
          
          if (isDisabled) {
            return {
              success: false,
              error: 'Element is disabled',
              state: { disabled: true }
            };
          }

          return { success: true };
          
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;

    return await this.view.webContents.executeJavaScript(script);
  }

  /**
   * ENHANCED: Perform click with HYBRID approach (CDP + executeJavaScript)
   * 
   * Uses CDP Input.dispatchMouseEvent for native-level clicks that trigger
   * ALL browser events exactly like a human click, combined with JavaScript
   * fallbacks for maximum compatibility.
   */
  private async performAdvancedClick(
    selector: string,
    element: any
  ): Promise<ClickExecutionResult> {
    const attemptedMethods: string[] = [];
    let lastError = '';

    try {
      // Strategy 1: CDP Native Mouse Events (MOST REALISTIC)
      // This triggers actual browser-level mouse events, not just JavaScript events
      attemptedMethods.push('cdp_mouse_events');
      
      const cdpResult = await this.performCDPClick(selector, element);
      if (cdpResult.success) {
        console.log('[ClickHandler] ✅ CDP click succeeded');
        return { success: true, method: 'cdp_mouse_events', attemptedMethods };
      }
      lastError = cdpResult.error || 'CDP click failed';
      console.warn('[ClickHandler] CDP click failed, trying JavaScript fallbacks...');
      
    } catch (error) {
      lastError = `CDP click error: ${error instanceof Error ? error.message : String(error)}`;
      console.warn('[ClickHandler] CDP click error:', error);
    }

    // Fallback to JavaScript-based clicks
    try {
      const jsResult = await this.performJavaScriptClick(selector);
      if (jsResult.success) {
        return { 
          success: true, 
          method: jsResult.method, 
          attemptedMethods: [...attemptedMethods, ...jsResult.attemptedMethods] 
        };
      }
      lastError = jsResult.lastError || jsResult.error || 'All JavaScript click strategies failed';
      attemptedMethods.push(...jsResult.attemptedMethods);
      
    } catch (error) {
      lastError = `JavaScript click error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return {
      success: false,
      error: 'All click strategies failed',
      attemptedMethods,
      lastError
    };
  }

  /**
   * NEW: Perform CDP-based native click
   * Uses Chrome DevTools Protocol to dispatch actual mouse events at the OS level
   */
  private async performCDPClick(selector: string, element: any): Promise<{ success: boolean; error?: string }> {
    try {
      // Get element's bounding box for click coordinates
      const box = element.boundingBox;
      if (!box || box.width === 0 || box.height === 0) {
        return { success: false, error: 'Element has no valid bounding box' };
      }

      // Calculate center point for click
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;

      // COMPLETE mouse event sequence (exactly like human click)
      
      // 1. Mouse move to element (hover)
      await this.debugger.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x,
        y,
        button: 'none',
        clickCount: 0
      });

      await this.sleep(50); // Small delay like human

      // 2. Focus the element (important for form elements)
      await this.view.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el && typeof el.focus === 'function') {
            el.focus();
          }
        })();
      `);

      await this.sleep(30);

      // 3. Mouse down (press)
      await this.debugger.sendCommand('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1
      });

      await this.sleep(80); // Realistic press duration

      // 4. Mouse up (release)
      await this.debugger.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1
      });

      // 5. Verify click effect with JavaScript (ensure events fired)
      const verified = await this.view.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          
          // Dispatch additional events for framework compatibility
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
          el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          
          return true;
        })();
      `);

      if (!verified) {
        return { success: false, error: 'Element disappeared during CDP click' };
      }

      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: `CDP click failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * JavaScript-based click with multiple fallback strategies
   */
  private async performJavaScriptClick(selector: string): Promise<ClickExecutionResult> {
    const script = `
      (async function() {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return { success: false, error: 'Element disappeared before click' };

        const attemptedMethods = [];
        let lastError = '';

        // Highlight element briefly for visual feedback
        const originalOutline = element.style.outline;
        element.style.outline = '3px solid #00ff00';
        await new Promise(resolve => setTimeout(resolve, 200));

        // Strategy 1: Complete event sequence (modern browsers)
        try {
          attemptedMethods.push('complete_event_sequence');
          
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          // Focus first (important for form elements)
          if (typeof element.focus === 'function') {
            element.focus();
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Pointer events (modern standard)
          element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, cancelable: true, pointerId: 1, clientX: centerX, clientY: centerY }));
          element.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true, pointerId: 1, clientX: centerX, clientY: centerY }));
          element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: centerX, clientY: centerY }));
          
          // Mouse events (legacy compatibility)
          element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY }));
          element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY }));
          element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, clientX: centerX, clientY: centerY }));

          await new Promise(resolve => setTimeout(resolve, 80)); // Realistic click duration

          element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, clientX: centerX, clientY: centerY }));
          element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: centerX, clientY: centerY }));
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0, clientX: centerX, clientY: centerY }));
          element.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, cancelable: true, pointerId: 1, clientX: centerX, clientY: centerY }));

          element.style.outline = originalOutline;
          return { success: true, method: 'complete_event_sequence', attemptedMethods };
        } catch (e) {
          lastError = 'Complete event sequence failed: ' + e.message;
          console.warn('[Click] Complete event sequence failed:', e);
        }

        // Strategy 2: Native click
        try {
          attemptedMethods.push('native_click');
          element.click();
          element.style.outline = originalOutline;
          return { success: true, method: 'native_click', attemptedMethods };
        } catch (e) {
          lastError = 'Native click failed: ' + e.message;
        }

        // Strategy 3: For specific element types, use type-specific actions
        try {
          attemptedMethods.push('type_specific');
          
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase();

          if (tagName === 'a' && element.href) {
            window.location.href = element.href;
            element.style.outline = originalOutline;
            return { success: true, method: 'type_specific_link', attemptedMethods };
          } else if (tagName === 'button' || (tagName === 'input' && type === 'submit')) {
            const form = element.closest('form');
            if (form) {
              form.requestSubmit(element);
              element.style.outline = originalOutline;
              return { success: true, method: 'type_specific_submit', attemptedMethods };
            }
          } else if (tagName === 'input' && (type === 'checkbox' || type === 'radio')) {
            element.checked = !element.checked;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.style.outline = originalOutline;
            return { success: true, method: 'type_specific_toggle', attemptedMethods };
          }
          
          lastError = 'No type-specific action available';
        } catch (e) {
          lastError = 'Type-specific action failed: ' + e.message;
        }

        element.style.outline = originalOutline;
        return {
          success: false,
          error: 'All JavaScript click strategies failed',
          attemptedMethods,
          lastError
        };
      })();
    `;

    return await this.view.webContents.executeJavaScript(script);
  }
}
