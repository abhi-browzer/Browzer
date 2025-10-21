/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseHandler } from './BaseHandler';
import type { HandlerContext, AdvancedFindResult, FindStrategyResult, ElementQueryResult } from './types';
import type { ClickParams } from '@/shared/types';

/**
 * ElementFinder - Advanced element finding with multiple strategies
 * 
 * Provides robust element location using:
 * - CSS selectors with fallbacks
 * - Text content matching
 * - Bounding box coordinates
 * - CDP-based querying
 * 
 * This module centralizes all element finding logic for consistent behavior
 * across all automation handlers.
 */
export class ElementFinder extends BaseHandler {
  constructor(context: HandlerContext) {
    super(context);
  }

  /**
   * Advanced element finding with multiple strategies
   * Tries primary selector, backup selectors, text matching, and bounding box
   */
  async advancedFind(
    selectors: string[],
    params: ClickParams
  ): Promise<AdvancedFindResult> {
    const sanitizedSelectors = this.sanitizeSelectors(selectors);
    
    console.log(`[ElementFinder] 🔍 Trying ${sanitizedSelectors.length} selectors...`);

    for (let i = 0; i < sanitizedSelectors.length; i++) {
      const selector = sanitizedSelectors[i];
      const selectorType = i === 0 ? 'primary' : 'backup';

      try {
        // Strategy 1: Try standard querySelector
        const result = await this.findWithQuerySelector(selector);
        
        if (result.found && result.element) {
          console.log(`[ElementFinder] ✅ Found with querySelector: ${selector}`);
          return {
            success: true,
            usedSelector: selector,
            selectorType,
            element: result.element
          };
        }

        // Strategy 2: Try with text content matching (if text provided)
        if (params.text && !result.found) {
          const textResult = await this.findByText(selector, params.text);
          if (textResult.found && textResult.element) {
            console.log(`[ElementFinder] ✅ Found with text matching: ${selector}`);
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
          const boxResult = await this.findByBoundingBox(params.boundingBox);
          if (boxResult.found && boxResult.element) {
            console.log(`[ElementFinder] ✅ Found with bounding box`);
            return {
              success: true,
              usedSelector: boxResult.computedSelector || selector,
              selectorType,
              element: boxResult.element
            };
          }
        }

      } catch (error) {
        console.log(`[ElementFinder] ⚠️ Selector failed: ${selector} - ${error}`);
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
   * Find element using standard CSS querySelector
   */
  async findWithQuerySelector(selector: string): Promise<FindStrategyResult> {
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
   * Find element by text content matching
   */
  async findByText(baseSelector: string, text: string): Promise<FindStrategyResult> {
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
  async findByBoundingBox(box: { x: number; y: number; width: number; height: number }): Promise<FindStrategyResult> {
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
   * CDP-based element finding (for operations requiring node IDs)
   * Used by operations that need direct CDP access
   */
  async findWithCDP(selectors: string[], verifyVisible: boolean): Promise<ElementQueryResult> {
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const selectorType = i === 0 ? 'primary' : 'backup';

      // Validate selector - reject Playwright/jQuery syntax
      const invalidPatterns = [':has-text(', ':visible', ':enabled', ':contains(', ':has('];
      const hasInvalidSyntax = invalidPatterns.some(pattern => selector.includes(pattern));
      
      if (hasInvalidSyntax) {
        console.log(`[ElementFinder] ⚠️ Selector "${selector}" contains invalid syntax - skipping`);
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
        console.log(`[ElementFinder] Selector "${selector}" failed`);
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
}
