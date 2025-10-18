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

  // Effect tracking
  private preActionState: any = null;

  constructor(view: WebContentsView, tabId: string) {
    this.view = view;
    this.debugger = view.webContents.debugger;
    this.tabId = tabId;
  }

  // ============================================================================
  // Public Tool Methods - See implementation in separate file chunks
  // ============================================================================

  /**
   * Navigate to a URL
   */
  public async navigate(params: NavigateParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Navigating to: ${params.url}`);

      await this.view.webContents.loadURL(params.url);
      const waitUntil = params.waitUntil || 'load';
      const timeout = params.timeout || 30000;
      await this.waitForNavigation(waitUntil, timeout);

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

  /**
   * Click an element - MOST IMPORTANT TOOL
   */
  public async click(params: ClickParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Attempting click on selector: ${params.selector}`);

      // Wait for element
      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }

      // Find element with fallback selectors
      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const queryResult = await this.findElement(selectors, params.verifyVisible ?? true);

      if (!queryResult.found || !queryResult.nodeId || !queryResult.element) {
        return this.createErrorResult('click', startTime, {
          code: 'ELEMENT_NOT_FOUND',
          message: `Could not find element with provided selectors`,
          details: {
            attemptedSelectors: selectors,
            lastError: queryResult.error,
            suggestions: [
              'Verify the selector matches an element in the current page',
              'Check if the element is dynamically loaded and needs more wait time',
              'Try using a backup selector from the element attributes'
            ]
          }
        });
      }

      // Verify element state
      if (!queryResult.element.isVisible) {
        return this.createErrorResult('click', startTime, {
          code: 'ELEMENT_NOT_VISIBLE',
          message: `Element found but not visible`,
          details: {
            attemptedSelectors: [queryResult.selector],
            elementState: {
              found: true,
              visible: false,
              enabled: queryResult.element.isEnabled,
              boundingBox: queryResult.element.boundingBox
            },
            suggestions: ['Wait for the element to become visible', 'Scroll to the element first']
          }
        });
      }

      if (!queryResult.element.isEnabled) {
        return this.createErrorResult('click', startTime, {
          code: 'ELEMENT_NOT_ENABLED',
          message: `Element found but disabled`,
          details: {
            attemptedSelectors: [queryResult.selector],
            elementState: {
              found: true,
              visible: true,
              enabled: false,
              boundingBox: queryResult.element.boundingBox
            },
            suggestions: ['Wait for the element to become enabled', 'Check if a prerequisite action is required']
          }
        });
      }

      // Capture pre-click state
      await this.capturePreActionState();

      // Perform click using CDP
      const bbox = queryResult.element.boundingBox;
      const clickX = bbox.x + bbox.width / 2;
      const clickY = bbox.y + bbox.height / 2;

      await this.debugger.sendCommand('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: clickX,
        y: clickY,
        button: 'left',
        clickCount: 1
      });

      await this.debugger.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: clickX,
        y: clickY,
        button: 'left',
        clickCount: 1
      });

      console.log(`[Automation] ✅ Click executed at (${Math.round(clickX)}, ${Math.round(clickY)})`);

      // Wait for effects
      await this.sleep(500);
      const effects = await this.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'click',
        executionTime,
        element: this.createFoundElement(queryResult),
        effects,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('click', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Click execution failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error),
          suggestions: ['Retry with a longer wait time', 'Check if the page structure has changed']
        }
      });
    }
  }

  /**
   * Type text into an input field
   */
  public async type(params: TypeParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureDebuggerAttached();
      console.log(`[Automation] Typing into selector: ${params.selector}`);

      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) await this.sleep(waitTime);

      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const queryResult = await this.findElement(selectors, true);

      if (!queryResult.found || !queryResult.nodeId || !queryResult.element) {
        return this.createErrorResult('type', startTime, {
          code: 'ELEMENT_NOT_FOUND',
          message: `Could not find input element`,
          details: { attemptedSelectors: selectors }
        });
      }

      // Focus the element
      await this.debugger.sendCommand('DOM.focus', { nodeId: queryResult.nodeId });

      // Clear existing value if requested
      if (params.clearFirst ?? true) {
        await this.view.webContents.executeJavaScript(`
          (function() {
            const el = document.querySelector(${JSON.stringify(queryResult.selector)});
            if (el) {
              el.value = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          })();
        `);
      }

      // Type the text
      for (const char of params.text) {
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: char
        });
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyUp',
          text: char
        });
        await this.sleep(10);
      }

      // Press Enter if requested
      if (params.pressEnter) {
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter'
        });
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'Enter',
          code: 'Enter'
        });
      }

      console.log(`[Automation] ✅ Typed "${params.text}"`);

      await this.sleep(300);
      const effects = await this.capturePostActionEffects();

      return {
        success: true,
        toolName: 'type',
        executionTime: Date.now() - startTime,
        element: this.createFoundElement(queryResult),
        effects,
        value: params.text,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.view.webContents.getURL()
      };

    } catch (error) {
      return this.createErrorResult('type', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Type execution failed`,
        details: { lastError: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  // Additional tool methods will be added in next file...
  // For brevity, I'll include stubs for other tools

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
      const timer = setTimeout(() => reject(new Error('Navigation timeout')), timeout);
      
      if (waitUntil === 'load') {
        this.view.webContents.once('did-finish-load', () => {
          clearTimeout(timer);
          resolve();
        });
      } else {
        // Simplified - just wait a bit
        setTimeout(() => {
          clearTimeout(timer);
          resolve();
        }, 1000);
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
}
