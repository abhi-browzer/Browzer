/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebContentsView } from 'electron';
import type {
  NavigateParams,
  ClickParams,
  TypeParams,
  SelectParams,
  CheckboxParams,
  WaitForElementParams,
  KeyPressParams,
  ScrollParams,
  SubmitParams,
  ToolExecutionResult,
  ElementQueryResult,
  AutomationError,
  ExecutionEffects,
  FoundElement
} from '@/shared/types';
import { BrowserContextExtractor } from '@/main/context/BrowserContextExtractor';

/**
 * BrowserAutomationExecutor
 * 
 * CDP-based browser automation system designed for LLM tool execution.
 * Provides robust, reliable automation with detailed error reporting and effect tracking.
 */
export class BrowserAutomationExecutor {
  private view: WebContentsView;
  private debugger: Electron.Debugger;
  private tabId: string;
  private isAttached = false;
  private contextExtractor: BrowserContextExtractor;

  // Effect tracking
  private preActionState: any = null;

  constructor(view: WebContentsView, tabId: string) {
    this.view = view;
    this.debugger = view.webContents.debugger;
    this.tabId = tabId;
    this.contextExtractor = new BrowserContextExtractor(view);
  }

  // ============================================================================
  // Public Tool Methods - See implementation in separate file chunks
  // ============================================================================

  /**
   * Execute a tool by name - Main entry point for LLM automation
   * 
   * This method routes tool calls from the LLM to the appropriate handler method.
   * 
   * @param toolName - Name of the tool to execute
   * @param params - Tool parameters
   * @returns Tool execution result
   */
  public async executeTool(toolName: string, params: any): Promise<ToolExecutionResult> {
    console.log(`[BrowserAutomationExecutor] Executing tool: ${toolName}`);

    switch (toolName) {
      case 'navigate':
        return this.navigate(params as NavigateParams);
      case 'click':
        return this.click(params as ClickParams);
      case 'type':
        return this.type(params as TypeParams);
      case 'select':
        return this.select(params as SelectParams);
      case 'checkbox':
        return this.checkbox(params as CheckboxParams);
      case 'waitForElement':
        return this.waitForElement(params as WaitForElementParams);
      case 'wait':
        return this.wait(params as { duration: number });
      case 'keyPress':
        return this.keyPress(params as KeyPressParams);
      case 'scroll':
        return this.scroll(params as ScrollParams);
      case 'submit':
        return this.submit(params as SubmitParams);
      case 'extract_browser_context':
        return this.extractBrowserContext(params as { maxElements?: number });
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Navigate to a URL
   */
  public async navigate(params: NavigateParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      const waitUntil = params.waitUntil || 'load';
      const timeout = params.timeout || 30000;
      
      // Set up navigation promise BEFORE calling loadURL to avoid race condition
      const navigationPromise = this.waitForNavigation(waitUntil, timeout);
      
      // Start navigation
      await this.view.webContents.loadURL(params.url);
      
      // Wait for navigation to complete
      await navigationPromise;

      const executionTime = Date.now() - startTime;
      const currentUrl = this.view.webContents.getURL();

      return {
        success: true,
        toolName: 'navigate',
        executionTime,
        effects: {
          navigationOccurred: true,
          newUrl: currentUrl,
          navigationTiming: executionTime,
          summary: `Successfully navigated to ${currentUrl}`
        },
        timestamp: Date.now(),
        tabId: this.tabId,
        url: currentUrl
      };

    } catch (error) {
      return this.createErrorResult('navigate', startTime, {
        code: 'NAVIGATION_FAILED',
        message: `Failed to navigate to ${params.url}`,
        details: {
          lastError: error instanceof Error ? error.message : String(error),
          suggestions: ['Check if the URL is valid', 'Verify network connectivity']
        }
      });
    }
  }

  public async click(params: ClickParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] 🎯 Advanced click on selector: ${params.selector}`);

      // Wait for element if specified
      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }

      // Step 1: Find element with multi-strategy approach
      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const elementResult = await this.advancedFindElement(selectors, params);

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

      console.log(`[Automation] ✅ Found element with: ${elementResult.usedSelector}`);

      // Step 2: Ensure element is in viewport and unobstructed
      const visibilityResult = await this.ensureElementClickable(
        elementResult.usedSelector,
        elementResult.element!
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

      console.log(`[Automation] ✅ Element is clickable`);

      // Step 3: Capture pre-click state for effect detection
      await this.capturePreActionState();

      // Step 4: Perform click with multiple fallback strategies
      const clickResult = await this.performAdvancedClick(
        elementResult.usedSelector,
        elementResult.element!
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

      console.log(`[Automation] ✅ Click executed using: ${clickResult.method}`);

      // Step 5: Wait for effects and detect changes
      await this.sleep(800); // Increased wait for effects
      const effects = await this.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'click',
        executionTime,
        element: {
          selector: elementResult.usedSelector,
          selectorType: elementResult.selectorType,
          tagName: elementResult.element!.tagName,
          text: elementResult.element!.text,
          attributes: elementResult.element!.attributes || {},
          boundingBox: elementResult.element!.boundingBox,
          isVisible: true,
          isEnabled: true
        },
        effects,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
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
   * Advanced element finding with multiple strategies
   */
  private async advancedFindElement(
    selectors: string[],
    params: ClickParams
  ): Promise<{
    success: boolean;
    usedSelector?: string;
    selectorType?: 'primary' | 'backup';
    element?: any;
    error?: string;
    details?: string;
  }> {
    const sanitizedSelectors = this.sanitizeSelectors(selectors);
    
    console.log(`[Automation] 🔍 Trying ${sanitizedSelectors.length} selectors...`);

    for (let i = 0; i < sanitizedSelectors.length; i++) {
      const selector = sanitizedSelectors[i];
      const selectorType = i === 0 ? 'primary' : 'backup';

      try {
        // Strategy 1: Try standard querySelector
        const result = await this.findElementWithQuerySelector(selector);
        
        if (result.found && result.element) {
          console.log(`[Automation] ✅ Found with querySelector: ${selector}`);
          return {
            success: true,
            usedSelector: selector,
            selectorType,
            element: result.element
          };
        }

        // Strategy 2: Try with text content matching (if text provided)
        if (params.text && !result.found) {
          const textResult = await this.findElementByText(selector, params.text);
          if (textResult.found && textResult.element) {
            console.log(`[Automation] ✅ Found with text matching: ${selector}`);
            return {
              success: true,
              usedSelector: selector,
              selectorType,
              element: textResult.element
            };
          }
        }

        // Strategy 3: Try with bounding box matching (if provided)
        if (params.boundingBox && !result.found) {
          const boxResult = await this.findElementByBoundingBox(params.boundingBox);
          if (boxResult.found && boxResult.element) {
            console.log(`[Automation] ✅ Found with bounding box`);
            return {
              success: true,
              usedSelector: boxResult.computedSelector || selector,
              selectorType,
              element: boxResult.element
            };
          }
        }

      } catch (error) {
        console.log(`[Automation] ⚠️ Selector failed: ${selector} - ${error}`);
        continue;
      }
    }

    return {
      success: false,
      error: `None of ${sanitizedSelectors.length} selectors found a matching element`,
      details: `Attempted selectors: ${sanitizedSelectors.join(', ')}`
    };
  }

  /**
   * Sanitize selectors - remove Playwright/jQuery syntax
   */
  private sanitizeSelectors(selectors: string[]): string[] {
    const invalidPatterns = [
      ':has-text(',
      ':visible',
      ':enabled',
      ':contains(',
      ':has(',
      ':text(',
      ':text-is(',
      ':text-matches('
    ];

    return selectors
      .filter(selector => {
        const hasInvalid = invalidPatterns.some(pattern => 
          selector.includes(pattern)
        );
        if (hasInvalid) {
          console.log(`[Automation] 🚫 Skipping invalid selector: ${selector}`);
        }
        return !hasInvalid;
      })
      .filter(selector => selector && selector.length > 0);
  }

  /**
   * Find element with standard querySelector
   */
  private async findElementWithQuerySelector(selector: string): Promise<{
    found: boolean;
    element?: any;
  }> {
    const script = `
      (function() {
        try {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) return { found: false };

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          return {
            found: true,
            element: {
              tagName: element.tagName,
              text: element.textContent?.trim().substring(0, 100),
              attributes: {
                id: element.id || undefined,
                className: element.className || undefined,
                name: element.name || undefined,
                type: element.type || undefined,
                role: element.getAttribute('role') || undefined,
                'aria-label': element.getAttribute('aria-label') || undefined
              },
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              isVisible: rect.width > 0 && rect.height > 0 && 
                         style.display !== 'none' && 
                         style.visibility !== 'hidden' &&
                         style.opacity !== '0',
              isInViewport: rect.top >= 0 && rect.left >= 0 &&
                           rect.bottom <= window.innerHeight &&
                           rect.right <= window.innerWidth
            }
          };
        } catch (e) {
          return { found: false, error: e.message };
        }
      })();
    `;

    const result = await this.view.webContents.executeJavaScript(script);
    return result;
  }

  /**
   * Find element by text content
   */
  private async findElementByText(baseSelector: string, text: string): Promise<{
    found: boolean;
    element?: any;
  }> {
    const script = `
      (function() {
        try {
          // Try base selector first
          let elements = Array.from(document.querySelectorAll(${JSON.stringify(baseSelector)}));
          
          // If no base selector match, try common clickable elements
          if (elements.length === 0) {
            elements = Array.from(document.querySelectorAll('button, a, [role="button"], [role="link"], input[type="submit"], input[type="button"]'));
          }

          const targetText = ${JSON.stringify(text)}.toLowerCase().trim();
          
          for (const el of elements) {
            const elText = (el.textContent || el.value || '').toLowerCase().trim();
            
            // Exact match or contains
            if (elText === targetText || elText.includes(targetText)) {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              
              return {
                found: true,
                element: {
                  tagName: el.tagName,
                  text: el.textContent?.trim().substring(0, 100),
                  attributes: {
                    id: el.id || undefined,
                    className: el.className || undefined,
                    type: el.type || undefined
                  },
                  boundingBox: {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                  },
                  isVisible: rect.width > 0 && rect.height > 0 &&
                            style.display !== 'none' &&
                            style.visibility !== 'hidden',
                  isInViewport: rect.top >= 0 && rect.bottom <= window.innerHeight
                }
              };
            }
          }
          
          return { found: false };
        } catch (e) {
          return { found: false, error: e.message };
        }
      })();
    `;

    return await this.view.webContents.executeJavaScript(script);
  }

  /**
   * Find element by bounding box coordinates
   */
  private async findElementByBoundingBox(box: { x: number; y: number; width: number; height: number }): Promise<{
    found: boolean;
    element?: any;
    computedSelector?: string;
  }> {
    const script = `
      (function() {
        try {
          const targetBox = ${JSON.stringify(box)};
          const centerX = targetBox.x + targetBox.width / 2;
          const centerY = targetBox.y + targetBox.height / 2;
          
          // Get element at center point
          const element = document.elementFromPoint(centerX, centerY);
          if (!element) return { found: false };

          const rect = element.getBoundingClientRect();
          
          // Verify it's roughly the same position (within 20px tolerance)
          const xMatch = Math.abs(rect.x - targetBox.x) < 20;
          const yMatch = Math.abs(rect.y - targetBox.y) < 20;
          
          if (!xMatch || !yMatch) {
            return { found: false, reason: 'position_mismatch' };
          }

          const style = window.getComputedStyle(element);
          
          // Compute a selector for this element
          let computedSelector = '';
          if (element.id) {
            computedSelector = '#' + CSS.escape(element.id);
          } else if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\\s+/).slice(0, 2);
            computedSelector = element.tagName.toLowerCase() + '.' + classes.map(c => CSS.escape(c)).join('.');
          } else {
            computedSelector = element.tagName.toLowerCase();
          }
          
          return {
            found: true,
            computedSelector,
            element: {
              tagName: element.tagName,
              text: element.textContent?.trim().substring(0, 100),
              attributes: {
                id: element.id || undefined,
                className: element.className || undefined
              },
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              isVisible: rect.width > 0 && rect.height > 0 &&
                        style.display !== 'none' &&
                        style.visibility !== 'hidden',
              isInViewport: rect.top >= 0 && rect.bottom <= window.innerHeight
            }
          };
        } catch (e) {
          return { found: false, error: e.message };
        }
      })();
    `;

    return await this.view.webContents.executeJavaScript(script);
  }

  /**
   * Ensure element is clickable - scroll into view and check for overlays
   */
  private async ensureElementClickable(
    selector: string,
    element: any
  ): Promise<{
    success: boolean;
    error?: string;
    covered?: boolean;
    state?: any;
    suggestions?: string[];
  }> {
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
  ): Promise<{
    success: boolean;
    method?: string;
    error?: string;
    attemptedMethods?: string[];
    lastError?: string;
  }> {
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

  /**
   * Advanced type with robust input handling using CDP + React/Vue event triggering
   */
  public async type(params: TypeParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] ⌨️  Advanced type into: ${params.selector}`);

      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) await this.sleep(waitTime);

      // Find input element
      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const elementResult = await this.advancedFindElement(selectors, {} as ClickParams);

      if (!elementResult.success || !elementResult.element) {
        return this.createErrorResult('type', startTime, {
          code: 'ELEMENT_NOT_FOUND',
          message: `Could not find input element`,
          details: {
            attemptedSelectors: selectors,
            suggestions: [
              'Verify input selector matches current page',
              'Check if input is inside iframe or shadow DOM',
              'Try using attribute selectors: input[name="field"], input[placeholder="text"]',
              'Ensure page has loaded dynamic content'
            ]
          }
        });
      }

      console.log(`[Automation] ✅ Found input with: ${elementResult.usedSelector}`);

      // Prepare input (scroll, focus, clear)
      const prepResult = await this.prepareInputForTyping(
        elementResult.usedSelector,
        params.clearFirst ?? true
      );

      if (!prepResult.success) {
        return this.createErrorResult('type', startTime, {
          code: 'EXECUTION_ERROR',
          message: prepResult.error || 'Failed to prepare input',
          details: {
            suggestions: [
              'Input may be disabled or read-only',
              'Try clicking input first to focus',
              'Check if input requires specific user interaction'
            ]
          }
        });
      }

      // Perform typing using hybrid CDP + event simulation approach
      const typeResult = await this.performRobustTyping(
        elementResult.usedSelector,
        params.text,
        params.pressEnter ?? false
      );

      if (!typeResult.success) {
        return this.createErrorResult('type', startTime, {
          code: 'EXECUTION_ERROR',
          message: typeResult.error || 'Typing failed',
          details: {
            lastError: typeResult.lastError,
            suggestions: [
              'Input may have changed or been removed',
              'Try with longer wait time',
              'Check if input has special validation'
            ]
          }
        });
      }

      console.log(`[Automation] ✅ Typed "${params.text.substring(0, 30)}..."`);

      await this.sleep(300);
      const effects = await this.capturePostActionEffects();

      return {
        success: true,
        toolName: 'type',
        executionTime: Date.now() - startTime,
        element: {
          selector: elementResult.usedSelector,
          selectorType: elementResult.selectorType!,
          tagName: elementResult.element.tagName,
          text: elementResult.element.text,
          attributes: elementResult.element.attributes || {},
          boundingBox: elementResult.element.boundingBox,
          isVisible: true,
          isEnabled: true
        },
        effects,
        value: params.text,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('type', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Type execution failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Prepare input for typing - scroll, focus, clear with proper React/Vue handling
   */
  private async prepareInputForTyping(
    selector: string,
    clearFirst: boolean
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const script = `
      (async function() {
        try {
          const input = document.querySelector(${JSON.stringify(selector)});
          if (!input) return { success: false, error: 'Input disappeared' };

          // Check if input is editable
          const isDisabled = input.disabled || 
                            input.readOnly ||
                            input.getAttribute('disabled') !== null ||
                            input.getAttribute('readonly') !== null;
          
          if (isDisabled) {
            return { success: false, error: 'Input is disabled or read-only' };
          }

          // Scroll into view
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 300));

          // Click to focus (more realistic than .focus())
          const rect = input.getBoundingClientRect();
          const clickEvent = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          });
          input.dispatchEvent(clickEvent);
          
          const clickUpEvent = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          });
          input.dispatchEvent(clickUpEvent);
          
          input.focus();
          await new Promise(resolve => setTimeout(resolve, 100));

          // Clear if requested - with React/Vue support
          if (${clearFirst}) {
            // Get current value for proper event triggering
            const currentValue = input.value;
            
            if (currentValue) {
              // Select all
              input.setSelectionRange(0, currentValue.length);
              
              // Trigger beforeinput event (critical for modern frameworks)
              const beforeInputEvent = new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'deleteContentBackward',
                data: null
              });
              input.dispatchEvent(beforeInputEvent);
              
              // Clear value using native setter to trigger React's property descriptor
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              ).set;
              nativeInputValueSetter.call(input, '');
              
              // Trigger input event (React/Vue listen to this)
              const inputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'deleteContentBackward'
              });
              input.dispatchEvent(inputEvent);
              
              // Trigger change event
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
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
   * Perform robust typing using CDP Input.insertText + comprehensive event simulation
   * This properly triggers React/Vue state updates and all validation events
   */
  private async performRobustTyping(
    selector: string,
    text: string,
    pressEnter: boolean
  ): Promise<{
    success: boolean;
    error?: string;
    lastError?: string;
  }> {
    try {
      // Type character by character using CDP for native-like input
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Use CDP to dispatch keyboard events (more native than JS events)
        // This triggers browser's native input handling
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: char,
          key: char,
          code: this.getKeyCodeString(char),
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0)
        });

        // Insert text using CDP - this properly updates the input value
        await this.debugger.sendCommand('Input.insertText', {
          text: char
        });

        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: char,
          code: this.getKeyCodeString(char),
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0)
        });

        // Trigger React/Vue events after each character
        await this.view.webContents.executeJavaScript(`
          (function() {
            const input = document.querySelector(${JSON.stringify(selector)});
            if (input) {
              // Trigger input event with proper InputEvent constructor
              const inputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: ${JSON.stringify(char)}
              });
              input.dispatchEvent(inputEvent);
              
              // Update React's internal value tracker if present
              if (input._valueTracker) {
                input._valueTracker.setValue('');
              }
            }
          })();
        `);

        // Small delay for realism and to allow event handlers to process
        await this.sleep(15);
      }

      // Trigger final change event after all typing
      await this.view.webContents.executeJavaScript(`
        (function() {
          const input = document.querySelector(${JSON.stringify(selector)});
          if (input) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Blur and refocus to trigger any blur/focus validation
            input.blur();
            setTimeout(() => input.focus(), 10);
          }
        })();
      `);

      await this.sleep(50);

      // Press Enter if requested
      if (pressEnter) {
        await this.sleep(100);
        
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13
        });

        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13
        });
      }

      return { success: true };
    } catch (e) {
      return { 
        success: false, 
        error: 'Typing failed', 
        lastError: e instanceof Error ? e.message : String(e)
      };
    }
  }

  /**
   * Get proper key code string for character (for CDP code property)
   */
  private getKeyCodeString(char: string): string {
    // Letters
    if (/[a-zA-Z]/.test(char)) {
      return 'Key' + char.toUpperCase();
    }
    
    // Numbers
    if (/[0-9]/.test(char)) {
      return 'Digit' + char;
    }
    
    // Special characters
    const specialKeys: Record<string, string> = {
      ' ': 'Space',
      '-': 'Minus',
      '_': 'Underscore',
      '=': 'Equal',
      '+': 'Plus',
      '[': 'BracketLeft',
      ']': 'BracketRight',
      '{': 'BraceLeft',
      '}': 'BraceRight',
      '\\': 'Backslash',
      '|': 'Pipe',
      ';': 'Semicolon',
      ':': 'Colon',
      "'": 'Quote',
      '"': 'DoubleQuote',
      ',': 'Comma',
      '.': 'Period',
      '/': 'Slash',
      '?': 'Question',
      '<': 'Less',
      '>': 'Greater',
      '`': 'Backquote',
      '~': 'Tilde',
      '!': 'Exclamation',
      '@': 'At',
      '#': 'Hash',
      '$': 'Dollar',
      '%': 'Percent',
      '^': 'Caret',
      '&': 'Ampersand',
      '*': 'Asterisk',
      '(': 'ParenLeft',
      ')': 'ParenRight'
    };
    
    return specialKeys[char] || 'Unidentified';
  }

  public async select(params: SelectParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Selecting from dropdown: ${params.selector}`);

      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) await this.sleep(waitTime);

      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const queryResult = await this.findElement(selectors, true);

      if (!queryResult.found || !queryResult.nodeId || !queryResult.element) {
        return this.createErrorResult('select', startTime, {
          code: 'ELEMENT_NOT_FOUND',
          message: `Could not find select element`,
          details: { 
            attemptedSelectors: selectors,
            suggestions: ['Verify the select element selector', 'Check if the dropdown is dynamically loaded']
          }
        });
      }

      // Select the option using JavaScript
      const selectScript = `
        (function() {
          const select = document.querySelector(${JSON.stringify(queryResult.selector)});
          if (!select) return { success: false, error: 'Element not found' };
          
          let optionSelected = false;
          
          ${params.value ? `
            // Select by value
            for (let i = 0; i < select.options.length; i++) {
              if (select.options[i].value === ${JSON.stringify(params.value)}) {
                select.selectedIndex = i;
                optionSelected = true;
                break;
              }
            }
          ` : ''}
          
          ${params.label ? `
            // Select by label
            if (!optionSelected) {
              for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].text === ${JSON.stringify(params.label)}) {
                  select.selectedIndex = i;
                  optionSelected = true;
                  break;
                }
              }
            }
          ` : ''}
          
          ${params.index !== undefined ? `
            // Select by index
            if (!optionSelected && ${params.index} < select.options.length) {
              select.selectedIndex = ${params.index};
              optionSelected = true;
            }
          ` : ''}
          
          if (optionSelected) {
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, selectedValue: select.value, selectedText: select.options[select.selectedIndex].text };
          }
          
          return { success: false, error: 'No matching option found' };
        })();
      `;

      const result = await this.view.webContents.executeJavaScript(selectScript);

      if (!result.success) {
        return this.createErrorResult('select', startTime, {
          code: 'EXECUTION_ERROR',
          message: result.error || 'Failed to select option',
          details: {
            suggestions: [
              'Verify the value/label/index matches an available option',
              'Check if the dropdown has loaded all options',
              'Try using a different selection method (value vs label vs index)'
            ]
          }
        });
      }

      console.log(`[Automation] ✅ Selected option: ${result.selectedText}`);

      await this.sleep(300);
      const effects = await this.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'select',
        executionTime,
        element: this.createFoundElement(queryResult),
        effects,
        value: result.selectedValue,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('select', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Select execution failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  public async checkbox(params: CheckboxParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Setting checkbox ${params.checked ? 'checked' : 'unchecked'}: ${params.selector}`);

      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) await this.sleep(waitTime);

      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const queryResult = await this.findElement(selectors, true);

      if (!queryResult.found || !queryResult.nodeId || !queryResult.element) {
        return this.createErrorResult('checkbox', startTime, {
          code: 'ELEMENT_NOT_FOUND',
          message: `Could not find checkbox element`,
          details: { 
            attemptedSelectors: selectors,
            suggestions: ['Verify the checkbox selector', 'Check if the checkbox is visible']
          }
        });
      }

      // Set checkbox state
      const checkboxScript = `
        (function() {
          const checkbox = document.querySelector(${JSON.stringify(queryResult.selector)});
          if (!checkbox) return { success: false, error: 'Element not found' };
          
          if (checkbox.checked !== ${params.checked}) {
            checkbox.checked = ${params.checked};
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            checkbox.dispatchEvent(new Event('click', { bubbles: true }));
            checkbox.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          return { success: true, checked: checkbox.checked };
        })();
      `;

      const result = await this.view.webContents.executeJavaScript(checkboxScript);

      if (!result.success) {
        return this.createErrorResult('checkbox', startTime, {
          code: 'EXECUTION_ERROR',
          message: result.error || 'Failed to set checkbox state',
          details: {
            suggestions: ['Verify the element is a checkbox or radio button']
          }
        });
      }

      console.log(`[Automation] ✅ Checkbox set to: ${result.checked}`);

      await this.sleep(300);
      const effects = await this.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'checkbox',
        executionTime,
        element: this.createFoundElement(queryResult),
        effects,
        value: result.checked,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('checkbox', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Checkbox execution failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Simple wait/sleep - just waits for a duration without checking anything
   * Use this when you need to wait for page to settle but don't have a reliable selector
   */
  public async wait(params: { duration: number }): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const duration = params.duration || 1000;
      console.log(`[Automation] Waiting for ${duration}ms...`);
      
      await this.sleep(duration);
      
      const executionTime = Date.now() - startTime;
      console.log(`[Automation] ✅ Wait completed after ${executionTime}ms`);

      return {
        success: true,
        toolName: 'wait',
        executionTime,
        effects: {
          navigationOccurred: false,
          summary: `Waited for ${duration}ms`
        },
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('wait', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Wait failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  public async waitForElement(params: WaitForElementParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();

      const timeout = params.timeout || 10000;
      const state = params.state || 'visible';
      const interval = 100;

      console.log(`[Automation] Waiting for element (${state}): ${params.selector}`);

      const endTime = Date.now() + timeout;

      while (Date.now() < endTime) {
        const queryResult = await this.findElement([params.selector], state === 'visible');

        if (state === 'visible' && queryResult.found && queryResult.element?.isVisible) {
          const executionTime = Date.now() - startTime;
          console.log(`[Automation] ✅ Element became visible after ${executionTime}ms`);

          return {
            success: true,
            toolName: 'waitForElement',
            executionTime,
            element: this.createFoundElement(queryResult),
            effects: {
              navigationOccurred: false,
              summary: `Element became ${state} after ${executionTime}ms`
            },
            timestamp: Date.now(),
            tabId: this.tabId,
            url: this.view.webContents.getURL()
          };
        }

        if (state === 'hidden' && !queryResult.found) {
          const executionTime = Date.now() - startTime;
          console.log(`[Automation] ✅ Element became hidden after ${executionTime}ms`);

          return {
            success: true,
            toolName: 'waitForElement',
            executionTime,
            effects: {
              navigationOccurred: false,
              summary: `Element became ${state} after ${executionTime}ms`
            },
            timestamp: Date.now(),
            tabId: this.tabId,
            url: this.view.webContents.getURL()
          };
        }

        if (state === 'attached' && queryResult.found) {
          const executionTime = Date.now() - startTime;
          console.log(`[Automation] ✅ Element attached after ${executionTime}ms`);

          return {
            success: true,
            toolName: 'waitForElement',
            executionTime,
            element: queryResult.element ? this.createFoundElement(queryResult) : undefined,
            effects: {
              navigationOccurred: false,
              summary: `Element became ${state} after ${executionTime}ms`
            },
            timestamp: Date.now(),
            tabId: this.tabId,
            url: this.view.webContents.getURL()
          };
        }

        await this.sleep(interval);
      }

      // Timeout
      return this.createErrorResult('waitForElement', startTime, {
        code: 'TIMEOUT',
        message: `Element did not become ${state} within ${timeout}ms`,
        details: {
          attemptedSelectors: [params.selector],
          suggestions: [
            'Increase the timeout value',
            'Check if the selector is correct',
            'Verify the element actually appears/disappears in the UI',
            'Check if the page needs to load or navigate first'
          ]
        }
      });

    } catch (error) {
      return this.createErrorResult('waitForElement', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Wait for element failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  public async keyPress(params: KeyPressParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Pressing key: ${params.key}`);

      // Focus element if specified
      if (params.selector) {
        const queryResult = await this.findElement([params.selector], true);
        if (queryResult.found && queryResult.nodeId) {
          await this.debugger.sendCommand('DOM.focus', { nodeId: queryResult.nodeId });
          await this.sleep(100); // Small delay after focus
        } else {
          return this.createErrorResult('keyPress', startTime, {
            code: 'ELEMENT_NOT_FOUND',
            message: `Could not find element to focus: ${params.selector}`,
            details: {
              suggestions: ['Verify the selector is correct', 'Try without focusing a specific element']
            }
          });
        }
      }

      // Build modifiers
      const modifiers = this.buildKeyModifiers(params.modifiers || []);

      // Press key down
      await this.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: params.key,
        code: params.key,
        windowsVirtualKeyCode: this.getKeyCode(params.key),
        nativeVirtualKeyCode: this.getKeyCode(params.key),
        ...modifiers
      });

      // Small delay between down and up
      await this.sleep(50);

      // Press key up
      await this.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: params.key,
        code: params.key,
        windowsVirtualKeyCode: this.getKeyCode(params.key),
        nativeVirtualKeyCode: this.getKeyCode(params.key),
        ...modifiers
      });

      console.log(`[Automation] ✅ Key pressed: ${params.key}`);

      await this.sleep(300);
      const effects = await this.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'keyPress',
        executionTime,
        effects,
        value: params.key,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('keyPress', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Key press failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error),
          suggestions: ['Verify the key name is correct (e.g., "Enter", "Escape", "Tab")']
        }
      });
    }
  }

  public async scroll(params: ScrollParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Scrolling: ${JSON.stringify(params)}`);

      if (params.toElement) {
        // Scroll to element
        const scrollScript = `
          (function() {
            const el = document.querySelector(${JSON.stringify(params.toElement)});
            if (!el) return { success: false, error: 'Element not found' };
            
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            return { success: true, scrolledTo: 'element' };
          })();
        `;

        const result = await this.view.webContents.executeJavaScript(scrollScript);

        if (!result.success) {
          return this.createErrorResult('scroll', startTime, {
            code: 'ELEMENT_NOT_FOUND',
            message: `Could not find element to scroll to: ${params.toElement}`,
            details: {
              suggestions: ['Verify the element selector is correct']
            }
          });
        }

        console.log(`[Automation] ✅ Scrolled to element`);
      } else {
        // Scroll by amount
        const amount = params.amount || 500;
        let deltaX = 0;
        let deltaY = 0;

        switch (params.direction) {
          case 'down':
            deltaY = amount;
            break;
          case 'up':
            deltaY = -amount;
            break;
          case 'right':
            deltaX = amount;
            break;
          case 'left':
            deltaX = -amount;
            break;
          default:
            deltaY = amount; // Default to down
        }

        await this.view.webContents.executeJavaScript(`
          window.scrollBy({
            left: ${deltaX},
            top: ${deltaY},
            behavior: 'smooth'
          });
        `);

        console.log(`[Automation] ✅ Scrolled ${params.direction || 'down'} by ${amount}px`);
      }

      await this.sleep(500); // Wait for scroll to complete
      const effects = await this.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'scroll',
        executionTime,
        effects,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('scroll', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Scroll failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  public async submit(params: SubmitParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Submitting form`);

      await this.capturePreActionState();

      if (params.submitButtonSelector) {
        // Click submit button instead
        console.log(`[Automation] Clicking submit button: ${params.submitButtonSelector}`);
        return await this.click({
          selector: params.submitButtonSelector,
          waitForElement: 1000
        });
      } else {
        // Submit form directly
        const submitScript = `
          (function() {
            const form = ${params.formSelector ? `document.querySelector(${JSON.stringify(params.formSelector)})` : 'document.querySelector("form")'};}
            if (!form) return { success: false, error: 'Form not found' };
            
            // Try to submit the form
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit(); // Modern method that triggers validation
            } else {
              form.submit(); // Fallback
            }
            
            return { success: true };
          })();
        `;

        const result = await this.view.webContents.executeJavaScript(submitScript);

        if (!result.success) {
          return this.createErrorResult('submit', startTime, {
            code: 'ELEMENT_NOT_FOUND',
            message: result.error || 'Form not found',
            details: {
              suggestions: [
                'Verify a form element exists on the page',
                'Try specifying a formSelector parameter',
                'Consider using the submitButtonSelector to click the submit button instead'
              ]
            }
          });
        }

        console.log(`[Automation] ✅ Form submitted`);

        await this.sleep(500);
        const effects = await this.capturePostActionEffects();

        const executionTime = Date.now() - startTime;

        return {
          success: true,
          toolName: 'submit',
          executionTime,
          effects,
          timestamp: Date.now(),
          tabId: this.tabId,
          url: this.view.webContents.getURL()
        };
      }

    } catch (error) {
      return this.createErrorResult('submit', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Form submit failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async ensureDebuggerAttached(): Promise<void> {
    if (!this.isAttached) {
      if (!this.debugger.isAttached()) {
        this.debugger.attach('1.3');
      }
      await this.debugger.sendCommand('DOM.enable');
      await this.debugger.sendCommand('Page.enable');
      await this.debugger.sendCommand('Runtime.enable');
      await this.debugger.sendCommand('Network.enable');
      await this.debugger.sendCommand('DOM.getDocument', { depth: -1 });
      this.isAttached = true;
    }
  }

  private async findElement(selectors: string[], verifyVisible: boolean): Promise<ElementQueryResult> {
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const selectorType = i === 0 ? 'primary' : 'backup';

      // Validate selector - reject Playwright/jQuery syntax
      const invalidPatterns = [':has-text(', ':visible', ':enabled', ':contains(', ':has('];
      const hasInvalidSyntax = invalidPatterns.some(pattern => selector.includes(pattern));
      
      if (hasInvalidSyntax) {
        console.log(`[Automation] ⚠️ Selector "${selector}" contains invalid syntax (Playwright/jQuery) - skipping`);
        continue;
      }

      try {
        const { nodeId } = await this.debugger.sendCommand('DOM.querySelector', {
          nodeId: await this.getRootNodeId(),
          selector
        });

        if (!nodeId) continue;

        const { model } = await this.debugger.sendCommand('DOM.getBoxModel', { nodeId });
        const attributes = await this.getNodeAttributes(nodeId);
        const { node } = await this.debugger.sendCommand('DOM.describeNode', { nodeId });

        const isVisible = model.width > 0 && model.height > 0;
        if (verifyVisible && !isVisible) continue;

        const textResult = await this.debugger.sendCommand('Runtime.evaluate', {
          expression: `document.querySelector(${JSON.stringify(selector)})?.innerText || ''`
        });
        const text = textResult.result.value || '';

        const isEnabled = !attributes.disabled && attributes['aria-disabled'] !== 'true';

        return {
          found: true,
          nodeId,
          selector,
          selectorType,
          element: {
            tagName: node.nodeName,
            text,
            attributes,
            boundingBox: {
              x: model.content[0],
              y: model.content[1],
              width: model.width,
              height: model.height
            },
            isVisible,
            isEnabled
          }
        };

      } catch (error) {
        console.log(`[Automation] Selector "${selector}" failed`);
        continue;
      }
    }

    return {
      found: false,
      selector: selectors[0],
      selectorType: 'primary',
      error: `None of the ${selectors.length} selector(s) found a matching element`
    };
  }

  private async getRootNodeId(): Promise<number> {
    const { root } = await this.debugger.sendCommand('DOM.getDocument');
    return root.nodeId;
  }

  private async getNodeAttributes(nodeId: number): Promise<Record<string, string>> {
    try {
      const { attributes } = await this.debugger.sendCommand('DOM.getAttributes', { nodeId });
      const attrs: Record<string, string> = {};
      for (let i = 0; i < attributes.length; i += 2) {
        attrs[attributes[i]] = attributes[i + 1];
      }
      return attrs;
    } catch {
      return {};
    }
  }

  private async capturePreActionState(): Promise<void> {
    this.preActionState = {
      url: this.view.webContents.getURL(),
      timestamp: Date.now()
    };
  }

  private async capturePostActionEffects(): Promise<ExecutionEffects> {
    const currentUrl = this.view.webContents.getURL();
    const navigationOccurred = this.preActionState && currentUrl !== this.preActionState.url;

    return {
      navigationOccurred,
      newUrl: navigationOccurred ? currentUrl : undefined,
      summary: navigationOccurred ? `Navigation occurred to ${currentUrl}` : 'Action completed successfully'
    };
  }

  private createFoundElement(queryResult: ElementQueryResult): FoundElement {
    return {
      selector: queryResult.selector,
      selectorType: queryResult.selectorType,
      tagName: queryResult.element!.tagName,
      text: queryResult.element!.text,
      attributes: queryResult.element!.attributes,
      boundingBox: queryResult.element!.boundingBox,
      isVisible: queryResult.element!.isVisible,
      isEnabled: queryResult.element!.isEnabled
    };
  }

  private createErrorResult(toolName: string, startTime: number, error: AutomationError): ToolExecutionResult {
    return {
      success: false,
      toolName,
      executionTime: Date.now() - startTime,
      error,
      timestamp: Date.now(),
      tabId: this.tabId,
      url: this.view.webContents.getURL()
    };
  }

  private async waitForNavigation(waitUntil: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Navigation timeout'));
        }
      }, timeout);
      
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve();
        }
      };
      
      if (waitUntil === 'load') {
        // Listen for successful load
        this.view.webContents.once('did-finish-load', cleanup);
        
        // Also handle navigation failures
        this.view.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            reject(new Error(`Navigation failed: ${errorDescription} (code: ${errorCode})`));
          }
        });
      } else if (waitUntil === 'domcontentloaded') {
        this.view.webContents.once('dom-ready', cleanup);
      } else {
        // For 'networkidle' or other, just wait a bit
        setTimeout(cleanup, 1000);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildKeyModifiers(modifiers: string[]): any {
    const result: any = {};
    if (modifiers.includes('Control')) result.modifiers = (result.modifiers || 0) | 2;
    if (modifiers.includes('Shift')) result.modifiers = (result.modifiers || 0) | 8;
    if (modifiers.includes('Alt')) result.modifiers = (result.modifiers || 0) | 1;
    if (modifiers.includes('Meta')) result.modifiers = (result.modifiers || 0) | 4;
    return result;
  }

  private getKeyCode(key: string): number {
    // Common key codes for CDP Input.dispatchKeyEvent
    const keyCodes: Record<string, number> = {
      'Enter': 13,
      'Escape': 27,
      'Tab': 9,
      'Backspace': 8,
      'Delete': 46,
      'ArrowUp': 38,
      'ArrowDown': 40,
      'ArrowLeft': 37,
      'ArrowRight': 39,
      'Home': 36,
      'End': 35,
      'PageUp': 33,
      'PageDown': 34,
      'Space': 32,
      ' ': 32
    };

    // If it's a single character, use its char code
    if (key.length === 1) {
      return key.toUpperCase().charCodeAt(0);
    }

    // Return mapped key code or 0
    return keyCodes[key] || 0;
  }

  /**
   * Extract browser context - Analysis tool for error recovery
   * 
   * This tool extracts the current browser state including:
   * - All interactive elements with selectors and attributes
   * - Form structures
   * - Page metadata
   * 
   * This is NOT an automation tool - it's for analysis and decision-making.
   */
  public async extractBrowserContext(params: { maxElements?: number }): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      console.log('[Automation] 🔍 Extracting browser context...');

      const maxElements = params.maxElements || 200;

      // Extract context using BrowserContextExtractor
      const result = await this.contextExtractor.extractContext(this.tabId, {
        includeDOM: true,
        maxInteractiveElements: maxElements,
        timeout: 10000
      });

      if (!result.success || !result.context) {
        return this.createErrorResult('extract_browser_context', startTime, {
          code: 'EXECUTION_ERROR',
          message: result.error || 'Failed to extract browser context',
          details: {
            lastError: result.error,
            suggestions: [
              'Page may still be loading',
              'Try again after waiting for page to stabilize',
              'Check if page has JavaScript errors'
            ]
          }
        });
      }

      const context = result.context;
      const executionTime = Date.now() - startTime;

      console.log(`[Automation] ✅ Context extracted: ${context.dom.stats.interactiveElements} interactive elements`);

      // Return context as tool result
      return {
        success: true,
        toolName: 'extract_browser_context',
        executionTime,
        context,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: context.url
      };

    } catch (error) {
      return this.createErrorResult('extract_browser_context', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Context extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          lastError: error instanceof Error ? error.message : String(error),
          suggestions: [
            'Page may be in an unstable state',
            'Try waiting before extracting context',
            'Check browser console for errors'
          ]
        }
      });
    }
  }
}
