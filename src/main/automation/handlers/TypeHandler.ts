/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseHandler } from '../core/BaseHandler';
import { ElementFinder } from '../core/ElementFinder';
import { EffectTracker } from '../core/EffectTracker';
import type { HandlerContext, InputPrepResult, TypingResult } from '../core/types';
import type { TypeParams, ToolExecutionResult, FoundElement } from '@/shared/types';

/**
 * TypeHandler - Handles text input/typing automation
 * 
 * Provides robust typing with:
 * - React/Vue framework support (proper event triggering)
 * - Input preparation (scroll, focus, clear)
 * - CDP-based key events for realistic typing
 * - Comprehensive event simulation (beforeinput, input, change)
 * 
 * This handler ensures typing works reliably across different frameworks
 * and properly triggers validation and state updates.
 */
export class TypeHandler extends BaseHandler {
  private elementFinder: ElementFinder;
  private effectTracker: EffectTracker;

  constructor(context: HandlerContext) {
    super(context);
    this.elementFinder = new ElementFinder(context);
    this.effectTracker = new EffectTracker(context);
  }

  /**
   * Execute type operation
   */
  async execute(params: TypeParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      console.log(`[TypeHandler] ⌨️  Typing into: ${params.selector}`);

      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) await this.sleep(waitTime);

      // Find input element
      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const elementResult = await this.elementFinder.advancedFind(selectors, {} as any);

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

      console.log(`[TypeHandler] ✅ Found input: ${elementResult.usedSelector}`);

      // Prepare input (scroll, focus, clear)
      const clearFirst = params.clearFirst ?? true;
      const prepResult = await this.prepareInput(elementResult.usedSelector, clearFirst);

      if (!prepResult.success) {
        return this.createErrorResult('type', startTime, {
          code: 'EXECUTION_ERROR',
          message: prepResult.error || 'Failed to prepare input',
          details: {
            suggestions: [
              'Input may be disabled or read-only',
              'Check if input is visible and interactable',
              'Try with clearFirst: false if clearing is causing issues'
            ]
          }
        });
      }

      console.log(`[TypeHandler] ✅ Input prepared`);

      // Capture pre-action state
      await this.effectTracker.capturePreActionState();

      // Perform typing
      const pressEnter = params.pressEnter ?? false;
      const typingResult = await this.performRobustTyping(
        elementResult.usedSelector,
        params.text,
        pressEnter
      );

      if (!typingResult.success) {
        return this.createErrorResult('type', startTime, {
          code: 'EXECUTION_ERROR',
          message: typingResult.error || 'Typing failed',
          details: {
            lastError: typingResult.details,
            suggestions: [
              'Input may have changed during typing',
              'Check if page has JavaScript errors',
              'Try with shorter text or slower typing'
            ]
          }
        });
      }

      console.log(`[TypeHandler] ✅ Typed: "${params.text}"`);

      // Wait for effects
      await this.sleep(500);
      const effects = await this.effectTracker.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'type',
        executionTime,
        element: {
          selector: elementResult.usedSelector,
          selectorType: elementResult.selectorType,
          tagName: elementResult.element.tagName,
          text: params.text,
          attributes: elementResult.element.attributes || {},
          boundingBox: elementResult.element.boundingBox,
          isVisible: true,
          isEnabled: true
        } as FoundElement,
        effects,
        value: params.text,
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.getUrl()
      };

    } catch (error) {
      return this.createErrorResult('type', startTime, {
        code: 'EXECUTION_ERROR',
        message: `Type execution failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          lastError: error instanceof Error ? error.message : String(error),
          suggestions: [
            'Check browser console for errors',
            'Verify input is in stable state',
            'Try with longer wait time'
          ]
        }
      });
    }
  }

  /**
   * Prepare input for typing - scroll, focus, clear with proper React/Vue handling
   */
  private async prepareInput(
    selector: string,
    clearFirst: boolean
  ): Promise<InputPrepResult> {
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
   * Perform robust typing using CDP key events + comprehensive event simulation
   * This properly triggers React/Vue state updates and all validation events
   */
  private async performRobustTyping(
    selector: string,
    text: string,
    pressEnter: boolean
  ): Promise<TypingResult> {
    try {
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Send keyDown event
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: char,
          key: char,
          code: this.getKeyCodeString(char),
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0)
        });

        // Send keyUp event
        await this.debugger.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: char,
          code: this.getKeyCodeString(char),
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0)
        });

        // Reset React value tracker if present
        await this.view.webContents.executeJavaScript(`
          (function() {
            const input = document.querySelector(${JSON.stringify(selector)});
            if (input && input._valueTracker) {
              input._valueTracker.setValue('');
            }
          })();
        `);

        // Small delay for realism
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
        details: e instanceof Error ? e.message : String(e)
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
}
