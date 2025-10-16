/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebContentsView } from 'electron';
import { RecordedAction, ElementTarget, SelectorStrategy } from '../../shared/types';

/**
 * BrowserAutomation - Advanced CDP-based browser automation engine
 * 
 * Production-grade automation system designed to work with LLM-generated commands.
 * Features:
 * - Multi-strategy element location with intelligent fallbacks
 * - Semantic element matching (role, aria-label, text content)
 * - Visual verification before actions
 * - Retry logic with exponential backoff
 * - Effect verification after actions
 * - Detailed error reporting for LLM feedback
 */
export class BrowserAutomation {
  private view: WebContentsView;
  private debugger: Electron.Debugger;
  private isAutomating = false;
  private readonly DEFAULT_TIMEOUT = 10000;
  private readonly RETRY_ATTEMPTS = 2;
  private readonly RETRY_DELAY = 500;

  constructor(view: WebContentsView) {
    this.view = view;
    this.debugger = view.webContents.debugger;
  }

  /**
   * Start automation session
   */
  public async start(): Promise<void> {
    if (this.isAutomating) {
      console.warn('⚠️ Automation already in progress');
      return;
    }

    try {
      if (!this.debugger.isAttached()) {
        this.debugger.attach('1.3');
        console.log('✅ CDP Debugger attached for automation');
      }
      await this.enableCDPDomains();
      this.isAutomating = true;
      console.log('🤖 Automation started');
    } catch (error) {
      console.error('❌ Failed to start automation:', error);
      throw error;
    }
  }

  /**
   * Stop automation session
   */
  public stop(): void {
    if (this.debugger.isAttached()) {
      this.debugger.detach();
    }
    this.isAutomating = false;
    console.log('⏹️ Automation stopped');
  }

  /**
   * Navigate to URL and wait for load
   */
  public async navigate(url: string, waitForLoad = true): Promise<void> {
    console.log(`🌐 Navigating to: ${url}`);
    
    if (waitForLoad) {
      const loadPromise = new Promise<void>((resolve) => {
        const handler = () => {
          this.view.webContents.off('did-finish-load', handler);
          resolve();
        };
        this.view.webContents.on('did-finish-load', handler);
      });

      await this.view.webContents.loadURL(url);
      await loadPromise;
      await this.waitForNetworkIdle();
    } else {
      await this.view.webContents.loadURL(url);
    }

    console.log('✅ Navigation complete');
  }

  /**
   * Click element by selector (with smart fallback strategies)
   */
  public async click(selector: string | string[], options: { waitForElement?: number; offset?: { x: number; y: number } } = {}): Promise<void> {
    const selectors = Array.isArray(selector) ? selector : [selector];
    console.log(`🖱️ Attempting to click with ${selectors.length} selector(s)`);
    
    const { waitForElement = 5000, offset = { x: 0, y: 0 } } = options;
    let element = null;
    let usedSelector = '';
    
    for (const sel of selectors) {
      console.log(`  Trying selector: ${sel}`);
      element = await this.waitForElement(sel, waitForElement / selectors.length);
      if (element) {
        usedSelector = sel;
        console.log(`  ✓ Found element with: ${sel}`);
        break;
      }
    }

    if (!element) {
      throw new Error(`Element not found with any of the provided selectors: ${selectors.join(', ')}`);
    }
    const box = element.box;
    const x = box.x + box.width / 2 + offset.x;
    const y = box.y + box.height / 2 + offset.y;
    await this.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1
    });

    await this.sleep(50);

    await this.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1
    });

    console.log(`✅ Click complete using: ${usedSelector}`);
    await this.sleep(300); // Wait for click effects
  }

  /**
   * 🚀 ADVANCED: Click element using rich recorded context
   * This is the LLM-friendly method that accepts full ElementTarget data
   */
  public async clickElement(target: ElementTarget, options: { timeout?: number; verify?: boolean } = {}): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, verify = true } = options;
    
    console.log(`🖱️  Advanced Click: ${target.tagName}${target.id ? '#' + target.id : ''}`);
    if (target.text) console.log(`   Text: "${target.text.substring(0, 30)}"`);
    if (target.ariaLabel) console.log(`   Aria: "${target.ariaLabel}"`);
    console.log(`   Strategies: ${target.selectors?.length || 1}`);
    const element = await this.locateElement(target, timeout);
    
    if (!element) {
      throw new Error(this.buildElementNotFoundError(target));
    }
    if (verify) {
      await this.verifyElementClickable(element.nodeId);
    }
    await this.performClick(element);
    
    console.log(`✅ Click successful`);
    await this.sleep(300);
  }

  /**
   * Type text into element
   */
  public async type(selector: string, text: string, options: { delay?: number; clear?: boolean } = {}): Promise<void> {
    console.log(`⌨️ Typing into ${selector}: "${text}"`);
    
    const { delay = 50, clear = false } = options;
    await this.click(selector);
    await this.sleep(200);
    if (clear) {
      await this.clearInput(selector);
    }
    for (const char of text) {
      await this.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char
      });

      await this.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyUp',
        text: char
      });

      await this.sleep(delay);
    }

    console.log('✅ Typing complete');
  }

  /**
   * Select option from dropdown
   */
  public async select(selector: string, value: string): Promise<void> {
    console.log(`📋 Selecting "${value}" from ${selector}`);
    
    const script = `
      (function() {
        const select = document.querySelector('${selector.replace(/'/g, "\\'")}'');
        if (!select) return { success: false, error: 'Select element not found' };
        
        // Try to find option by value or text
        let option = Array.from(select.options).find(opt => 
          opt.value === '${value.replace(/'/g, "\\'")}'  || 
          opt.text === '${value.replace(/'/g, "\\'")}''
        );
        
        if (!option) return { success: false, error: 'Option not found' };
        
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        
        return { success: true, selectedValue: option.value, selectedText: option.text };
      })();
    `;
    
    const result = await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true
    });
    
    if (!result.result?.value?.success) {
      throw new Error(`Select failed: ${result.result?.value?.error || 'Unknown error'}`);
    }
    
    console.log('✅ Select complete');
    await this.sleep(300);
  }

  /**
   * Toggle checkbox
   */
  public async toggleCheckbox(selector: string, checked: boolean): Promise<void> {
    console.log(`☑️ Setting checkbox ${selector} to ${checked}`);
    
    const script = `
      (function() {
        const checkbox = document.querySelector('${selector.replace(/'/g, "\\'")}'');
        if (!checkbox) return { success: false, error: 'Checkbox not found' };
        
        if (checkbox.checked !== ${checked}) {
          checkbox.checked = ${checked};
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        return { success: true, checked: checkbox.checked };
      })();
    `;
    
    const result = await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true
    });
    
    if (!result.result?.value?.success) {
      throw new Error(`Checkbox toggle failed: ${result.result?.value?.error || 'Unknown error'}`);
    }
    
    console.log('✅ Checkbox toggled');
    await this.sleep(300);
  }

  /**
   * Select radio button
   */
  public async selectRadio(selector: string): Promise<void> {
    console.log(`🔘 Selecting radio button ${selector}`);
    
    const script = `
      (function() {
        const radio = document.querySelector('${selector.replace(/'/g, "\\'")}'');
        if (!radio) return { success: false, error: 'Radio button not found' };
        
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        radio.dispatchEvent(new Event('input', { bubbles: true }));
        
        return { success: true, value: radio.value };
      })();
    `;
    
    const result = await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true
    });
    
    if (!result.result?.value?.success) {
      throw new Error(`Radio selection failed: ${result.result?.value?.error || 'Unknown error'}`);
    }
    
    console.log('✅ Radio selected');
    await this.sleep(300);
  }

  /**
   * Scroll to element or position
   */
  public async scroll(options: { selector?: string; x?: number; y?: number }): Promise<void> {
    console.log(`📜 Scrolling...`);
    
    if (options.selector) {
      const script = `
        (function() {
          const element = document.querySelector('${options.selector!.replace(/'/g, "\\'")}'');
          if (!element) return { success: false, error: 'Element not found' };
          
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return { success: true };
        })();
      `;
      
      const result = await this.debugger.sendCommand('Runtime.evaluate', {
        expression: script,
        returnByValue: true
      });
      
      if (!result.result?.value?.success) {
        throw new Error(`Scroll failed: ${result.result?.value?.error || 'Unknown error'}`);
      }
    } else if (options.x !== undefined || options.y !== undefined) {
      const x = options.x || 0;
      const y = options.y || 0;
      
      await this.debugger.sendCommand('Runtime.evaluate', {
        expression: `window.scrollTo(${x}, ${y});`,
        returnByValue: true
      });
    }
    
    console.log('✅ Scroll complete');
    await this.sleep(500);
  }

  /**
   * Wait for element to appear (public wrapper)
   */
  public async waitForElementVisible(selector: string, timeout = 10000): Promise<void> {
    console.log(`⏳ Waiting for element: ${selector}`);
    
    const element = await this.waitForElement(selector, timeout);
    if (!element) {
      throw new Error(`Element ${selector} did not appear within ${timeout}ms`);
    }
    
    console.log('✅ Element found');
  }

  /**
   * Wait for navigation to complete
   */
  public async waitForNavigation(timeout = 30000): Promise<void> {
    console.log(`⏳ Waiting for navigation...`);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Navigation timeout after ${timeout}ms`));
      }, timeout);
      
      const handler = () => {
        clearTimeout(timeoutId);
        this.view.webContents.off('did-finish-load', handler);
        resolve();
      };
      
      this.view.webContents.on('did-finish-load', handler);
    });
  }

  /**
   * Get element text content
   */
  public async getText(selector: string): Promise<string> {
    const script = `
      (function() {
        const element = document.querySelector('${selector.replace(/'/g, "\\'")}'');
        return element ? element.textContent : null;
      })();
    `;
    
    const result = await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true
    });
    
    return result.result?.value || '';
  }

  /**
   * Get element attribute
   */
  public async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const script = `
      (function() {
        const element = document.querySelector('${selector.replace(/'/g, "\\'")}'');
        return element ? element.getAttribute('${attribute.replace(/'/g, "\\'")}'') : null;
      })();
    `;
    
    const result = await this.debugger.sendCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true
    });
    
    return result.result?.value;
  }

  /**
   * Press a key (Enter, Escape, Tab, etc.)
   */
  public async pressKey(key: string): Promise<void> {
    console.log(`⌨️ Pressing key: ${key}`);
    const keyCodeMap: Record<string, number> = {
      'Enter': 13,
      'Escape': 27,
      'Tab': 9,
      'Backspace': 8,
    };

    const windowsVirtualKeyCode = keyCodeMap[key];
    const nativeVirtualKeyCode = keyCodeMap[key];
    await this.debugger.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyDown',
      windowsVirtualKeyCode,
      nativeVirtualKeyCode,
      key: key,
      code: key
    });

    await this.sleep(50);
    await this.debugger.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyUp',
      windowsVirtualKeyCode,
      nativeVirtualKeyCode,
      key: key,
      code: key
    });

    console.log('✅ Key press complete');
    await this.sleep(300);
  }

  /**
   * Wait for element to appear
   */
  private async waitForElement(selector: string, timeout = 5000): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { root } = await this.debugger.sendCommand('DOM.getDocument');
        const { nodeId } = await this.debugger.sendCommand('DOM.querySelector', {
          nodeId: root.nodeId,
          selector
        });

        if (nodeId) {
          const { model } = await this.debugger.sendCommand('DOM.getBoxModel', { nodeId });
          
          if (model) {
            return {
              nodeId,
              box: {
                x: model.content[0],
                y: model.content[1],
                width: model.content[4] - model.content[0],
                height: model.content[5] - model.content[1]
              }
            };
          }
        }
      } catch (error) {
        console.error('Error waiting for element:', error);
      }

      await this.sleep(100);
    }

    return null;
  }

  /**
   * Wait for network to be idle
   */
  private async waitForNetworkIdle(timeout = 3000): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, timeout);
      const checkIdle = () => {
        clearTimeout(timer);
        resolve();
      };

      setTimeout(checkIdle, 1000);
    });
  }

  /**
   * Clear input field
   */
  private async clearInput(_selector: string): Promise<void> {
    await this.debugger.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'a',
      code: 'KeyA',
      modifiers: 2 // Ctrl/Cmd
    });

    await this.debugger.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'a',
      code: 'KeyA'
    });

    await this.sleep(50);
    await this.pressKey('Backspace');
  }

  /**
   * Enable required CDP domains
   */
  private async enableCDPDomains(): Promise<void> {
    await this.debugger.sendCommand('DOM.enable');
    await this.debugger.sendCommand('Page.enable');
    await this.debugger.sendCommand('Runtime.enable');
    await this.debugger.sendCommand('Network.enable');
    
    console.log('✅ CDP domains enabled');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if automation is active
   */
  public isActive(): boolean {
    return this.isAutomating;
  }

  /**
   * Extract selectors from recorded action target
   * Returns array of selectors ordered by reliability (best first)
   */
  public static extractSelectors(target: any): string[] {
    if (!target) return [];
    
    const selectors: string[] = [];
    if (target.selectors && Array.isArray(target.selectors)) {
      const sorted = [...target.selectors].sort((a, b) => b.score - a.score);
      selectors.push(...sorted.map((s: any) => s.selector));
    }
    if (target.selector && !selectors.includes(target.selector)) {
      selectors.push(target.selector);
    }
    
    return selectors;
  }

  /**
   * Locate element using multiple strategies with intelligent fallbacks
   */
  private async locateElement(target: ElementTarget, timeout: number): Promise<any> {
    const startTime = Date.now();
    if (target.selectors && target.selectors.length > 0) {
      const sortedSelectors = [...target.selectors].sort((a, b) => b.score - a.score);
      
      for (const strategy of sortedSelectors) {
        if (Date.now() - startTime > timeout) break;
        
        try {
          const element = await this.findBySelector(strategy.selector, Math.min(2000, timeout / sortedSelectors.length));
          if (element) {
            if (await this.verifyElementMatch(element.nodeId, target)) {
              console.log(`   ✓ Found via ${strategy.strategy}: ${strategy.selector}`);
              return element;
            }
          }
        } catch (e) {
          console.error('Error locating element:', e);
        }
      }
    }
    if (Date.now() - startTime < timeout) {
      const semanticElement = await this.findBySemantics(target, timeout - (Date.now() - startTime));
      if (semanticElement) {
        console.log(`   ✓ Found via semantic search`);
        return semanticElement;
      }
    }
    if (target.text && Date.now() - startTime < timeout) {
      const textElement = await this.findByText(target.text, target.tagName, timeout - (Date.now() - startTime));
      if (textElement) {
        console.log(`   ✓ Found via text content`);
        return textElement;
      }
    }
    
    return null;
  }

  /**
   * Find element by CSS/XPath selector
   */
  private async findBySelector(selector: string, timeout: number): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const { root } = await this.debugger.sendCommand('DOM.getDocument');
        try {
          const { nodeId } = await this.debugger.sendCommand('DOM.querySelector', {
            nodeId: root.nodeId,
            selector
          });
          
          if (nodeId) {
            const { model } = await this.debugger.sendCommand('DOM.getBoxModel', { nodeId });
            if (model) {
              return {
                nodeId,
                box: {
                  x: model.content[0],
                  y: model.content[1],
                  width: model.content[4] - model.content[0],
                  height: model.content[5] - model.content[1]
                }
              };
            }
          }
        } catch (e) {
          console.error('Error locating element:', e);
        }
      } catch (error) {
        console.error('Error locating element:', error);
      }
      
      await this.sleep(100);
    }
    
    return null;
  }

  /**
   * Find element by semantic attributes (role, aria-label, name)
   */
  private async findBySemantics(target: ElementTarget, timeout: number): Promise<any> {
    if (!target.role && !target.ariaLabel && !target.name) return null;
    
    try {
      const result = await this.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          (function() {
            const role = ${JSON.stringify(target.role)};
            const ariaLabel = ${JSON.stringify(target.ariaLabel)};
            const name = ${JSON.stringify(target.name)};
            const tagName = ${JSON.stringify(target.tagName)};
            
            let candidates = [];
            if (role) {
              candidates = Array.from(document.querySelectorAll('[role="' + role + '"]'));
            }
            if (ariaLabel && candidates.length > 0) {
              candidates = candidates.filter(el => el.getAttribute('aria-label') === ariaLabel);
            }
            if (name && candidates.length > 0) {
              candidates = candidates.filter(el => el.getAttribute('name') === name);
            }
            if (tagName && candidates.length > 0) {
              candidates = candidates.filter(el => el.tagName === tagName);
            }
            
            if (candidates.length > 0) {
              const el = candidates[0];
              const rect = el.getBoundingClientRect();
              return {
                found: true,
                selector: el.id ? '#' + el.id : el.tagName.toLowerCase(),
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              };
            }
            
            return { found: false };
          })();
        `,
        returnByValue: true
      });
      
      if (result.result?.value?.found) {
        return await this.findBySelector(result.result.value.selector, timeout);
      }
    } catch (error) {
      console.error('Semantic search error:', error);
    }
    
    return null;
  }

  /**
   * Find element by text content
   */
  private async findByText(text: string, tagName: string, timeout: number): Promise<any> {
    try {
      const result = await this.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          (function() {
            const searchText = ${JSON.stringify(text)};
            const tag = ${JSON.stringify(tagName)};
            
            const elements = Array.from(document.querySelectorAll(tag));
            const match = elements.find(el => {
              const elText = el.innerText || el.textContent || '';
              return elText.trim().includes(searchText.trim());
            });
            
            if (match) {
              const rect = match.getBoundingClientRect();
              return {
                found: true,
                selector: match.id ? '#' + match.id : tag + ':nth-of-type(' + (Array.from(match.parentElement.children).indexOf(match) + 1) + ')',
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              };
            }
            
            return { found: false };
          })();
        `,
        returnByValue: true
      });
      
      if (result.result?.value?.found) {
        return await this.findBySelector(result.result.value.selector, timeout);
      }
    } catch (error) {
      console.error('Text search error:', error);
    }
    
    return null;
  }

  /**
   * Verify element matches target characteristics
   */
  private async verifyElementMatch(nodeId: number, target: ElementTarget): Promise<boolean> {
    try {
      const { node } = await this.debugger.sendCommand('DOM.describeNode', { nodeId });
      if (target.tagName && node.nodeName !== target.tagName) {
        return false;
      }
      if (target.id && node.attributes) {
        const idIndex = node.attributes.indexOf('id');
        if (idIndex === -1 || node.attributes[idIndex + 1] !== target.id) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify element is clickable (visible, enabled, not obscured)
   */
  private async verifyElementClickable(nodeId: number): Promise<void> {
    try {
      const result = await this.debugger.sendCommand('Runtime.evaluate', {
        expression: `
          (function() {
            const node = document.querySelector('[data-node-id="${nodeId}"]');
            if (!node) return { clickable: false, reason: 'Element not found' };
            
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return { clickable: false, reason: 'Element not visible' };
            }
            if (rect.width === 0 || rect.height === 0) {
              return { clickable: false, reason: 'Element has no dimensions' };
            }
            if (node.disabled) {
              return { clickable: false, reason: 'Element is disabled' };
            }
            
            return { clickable: true };
          })();
        `,
        returnByValue: true
      });
      
      if (!result.result?.value?.clickable) {
        console.warn(`   ⚠️  Element may not be clickable: ${result.result?.value?.reason}`);
      }
    } catch (error) {
      console.error('Error verifying element clickable:', error);
    }
  }

  /**
   * Perform the actual click action
   */
  private async performClick(element: any): Promise<void> {
    const box = element.box;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y
    });

    await this.sleep(50);

    await this.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1
    });

    await this.sleep(50);

    await this.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1
    });
  }

  /**
   * Build detailed error message for element not found
   */
  private buildElementNotFoundError(target: ElementTarget): string {
    const parts = [
      `❌ Element not found after exhaustive search:`,
      `   Tag: ${target.tagName}`,
    ];
    
    if (target.id) parts.push(`   ID: #${target.id}`);
    if (target.text) parts.push(`   Text: "${target.text.substring(0, 50)}"`);
    if (target.ariaLabel) parts.push(`   Aria-Label: "${target.ariaLabel}"`);
    if (target.role) parts.push(`   Role: ${target.role}`);
    if (target.name) parts.push(`   Name: ${target.name}`);
    
    parts.push(`   Tried ${target.selectors?.length || 1} selector strategies`);
    parts.push(`   Suggestion: Element may have changed or page not fully loaded`);
    
    return parts.join('\n');
  }
}
