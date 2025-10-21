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
   * Perform click with multiple fallback strategies
   */
  private async performAdvancedClick(
    selector: string,
    element: any
  ): Promise<ClickExecutionResult> {
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

        // Strategy 1: Native click
        try {
          attemptedMethods.push('native_click');
          element.click();
          element.style.outline = originalOutline;
          return { success: true, method: 'native_click', attemptedMethods };
        } catch (e) {
          lastError = 'Native click failed: ' + e.message;
          console.warn('[Click] Native click failed:', e);
        }

        // Strategy 2: Dispatch MouseEvent sequence
        try {
          attemptedMethods.push('mouse_events');
          
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          // Full mouse event sequence
          element.dispatchEvent(new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: centerX,
            clientY: centerY
          }));
          
          element.dispatchEvent(new MouseEvent('mouseenter', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: centerX,
            clientY: centerY
          }));

          element.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            clientX: centerX,
            clientY: centerY
          }));

          await new Promise(resolve => setTimeout(resolve, 50));

          element.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            clientX: centerX,
            clientY: centerY
          }));

          element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            clientX: centerX,
            clientY: centerY
          }));

          element.style.outline = originalOutline;
          return { success: true, method: 'mouse_events', attemptedMethods };
        } catch (e) {
          lastError = 'Mouse events failed: ' + e.message;
          console.warn('[Click] Mouse events failed:', e);
        }

        // Strategy 3: Focus and trigger
        try {
          attemptedMethods.push('focus_trigger');
          
          if (typeof element.focus === 'function') {
            element.focus();
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Dispatch events on focused element
          element.dispatchEvent(new Event('focus', { bubbles: true }));
          element.dispatchEvent(new Event('click', { bubbles: true }));
          element.dispatchEvent(new Event('mouseup', { bubbles: true }));

          element.style.outline = originalOutline;
          return { success: true, method: 'focus_trigger', attemptedMethods };
        } catch (e) {
          lastError = 'Focus trigger failed: ' + e.message;
          console.warn('[Click] Focus trigger failed:', e);
        }

        // Strategy 4: For specific element types, use type-specific actions
        try {
          attemptedMethods.push('type_specific');
          
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase();

          if (tagName === 'a' && element.href) {
            // For links, trigger navigation
            window.location.href = element.href;
            element.style.outline = originalOutline;
            return { success: true, method: 'type_specific_link', attemptedMethods };
          } else if (tagName === 'button' || (tagName === 'input' && type === 'submit')) {
            // For buttons/submit, try form submission
            const form = element.closest('form');
            if (form) {
              form.requestSubmit(element);
              element.style.outline = originalOutline;
              return { success: true, method: 'type_specific_submit', attemptedMethods };
            }
          } else if (tagName === 'input' && (type === 'checkbox' || type === 'radio')) {
            // For checkboxes/radios, toggle checked
            element.checked = !element.checked;
            element.dispatchEvent(new Event('change', { bubbles: true }));
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
          error: 'All click strategies failed',
          attemptedMethods,
          lastError
        };
      })();
    `;

    return await this.view.webContents.executeJavaScript(script);
  }
}
