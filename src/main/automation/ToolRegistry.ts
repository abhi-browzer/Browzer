import Anthropic from '@anthropic-ai/sdk';

/**
 * UPDATED Tool Registry with Enhanced Click & Type Guidance
 * 
 * Key improvements:
 * 1. Clear selector priority and strategies
 * 2. Explicit warnings about invalid syntax
 * 3. Better parameter descriptions with examples
 * 4. Guidance on when to use each tool
 */

export const BROWSER_AUTOMATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'navigate',
    description: 'Navigate to a specific URL. Waits for page to finish loading. Always use complete URLs with https://.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Complete URL including protocol. Examples: "https://github.com/new", "https://example.com/login"'
        },
        waitUntil: {
          type: 'string',
          description: 'When to consider navigation complete. Default: "load"',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          default: 'load'
        },
        timeout: {
          type: 'number',
          description: 'Max wait time in milliseconds. Default: 30000',
          default: 30000
        }
      },
      required: ['url']
    }
  },
  {
    name: 'click',
    description: `Click on an element. CRITICAL SELECTOR RULES:

✅ VALID CSS SELECTORS (Use these):
- ID: #submit-button, #repository-name-input
- Attribute: button[type="submit"], input[name="username"], a[href="/login"]
- Data attrs: [data-testid="submit"], [data-component="button"]
- ARIA: [aria-label="Submit"], button[aria-label="Close"]
- Class: button.btn-primary, .submit-btn (use with tag for specificity)
- Type + Class: button.btn.btn-primary, input.form-control

❌ INVALID SELECTORS (NEVER use these):
- :has-text() - NOT CSS, use text parameter instead
- :visible - NOT CSS, element visibility is handled automatically  
- :enabled - NOT CSS, handled automatically
- :contains() - jQuery syntax, not supported
- :has() - Limited browser support, avoid

🎯 SELECTOR STRATEGY:
1. BEST: Stable IDs or data-testid → [data-testid="submit-btn"]
2. GOOD: Attribute selectors → button[type="submit"]
3. OK: ARIA labels → [aria-label="Submit form"]
4. LAST RESORT: Class selectors → button.btn-primary

⚠️ COMMON MISTAKES TO AVOID:
- Don't use React-generated IDs with colons (#:r9:, #:ra:)
- Don't combine Playwright or jQuery syntax with CSS at all. We are using CDP & executeJavaScript. Soo, NO Playwright or jQuery syntax.
- Don't rely on text in selector, use text parameter instead

📍 ELEMENT VISIBILITY:
- Elements are AUTOMATICALLY scrolled into view
- Elements below viewport will be found and clicked
- Overlays/modals are detected and reported
- No need to scroll manually before clicking

🔄 BACKUP SELECTORS:
- ALWAYS provide 2-3 backup selectors
- Use different strategies for each backup
- Example: [#submit, button[type="submit"], [aria-label="Submit"]]`,
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: `Primary CSS selector. MUST be valid CSS. Examples:
- #submit-button (ID)
- button[type="submit"] (Attribute)
- [data-testid="login-btn"] (Data attribute)
- button[aria-label="Submit"] (ARIA)
- button.btn-primary.btn (Classes with tag)

DO NOT use: :has-text(), :visible, :contains(), or any Playwright/jQuery syntax`
        },
        backupSelectors: {
          type: 'array',
          description: `REQUIRED: at least 2-3 backup selectors using different strategies. Examples:
["button[type='submit']", "[aria-label='Submit']", "form button.primary"]
["#login-btn", "button[name='login']", "[data-testid='login-button']"]`,
          items: { type: 'string' }
        },
        text: {
          type: 'string',
          description: 'Expected button/link text for verification. Used to find element by text if selectors fail. Example: "Send invitation", "Create repository"'
        },
        boundingBox: {
          type: 'object',
          description: 'Element position from browser context. Used as fallback if selectors fail.',
          properties: {
            x: { type: 'number', description: 'Left position in pixels' },
            y: { type: 'number', description: 'Top position in pixels' },
            width: { type: 'number', description: 'Width in pixels' },
            height: { type: 'number', description: 'Height in pixels' }
          }
        },
        waitForElement: {
          type: 'number',
          description: 'Wait time before clicking (milliseconds). Use 1500-2000 for dynamic content that loads after page. Default: 1000',
          default: 1000
        },
        verifyVisible: {
          type: 'boolean',
          description: 'Verify element is visible. Keep true (default) for normal clicks. Only set false for special cases.',
          default: true
        }
      },
      required: ['selector', 'backupSelectors']
    }
  },
  {
    name: 'type',
    description: `Type text into input fields with NATIVE-LIKE INPUT SIMULATION. Uses Chrome DevTools Protocol for authentic typing that triggers ALL validation and state updates in modern web apps (React, Vue, Angular, etc.).

✅ VALID INPUT SELECTORS:
- ID: #username, #email-input, #repository-name-input
- Name: input[name="username"], input[name="email"]
- Type: input[type="text"], input[type="email"], input[type="password"]
- Placeholder: input[placeholder="Enter username"]
- Data attrs: input[data-testid="username"], [data-component="text-input"]
- ARIA: input[aria-label="Username"], [aria-describedby*="username"]

❌ COMMON MISTAKES:
- Don't assume "name" attribute exists (many modern sites don't use it)
- Don't use React IDs with colons (#:r9:)
- Always check browser context for actual attributes

🎯 INPUT FINDING STRATEGY:
1. Check browser context for actual attributes
2. Use ID if available (#repository-name-input)
3. Use data-testid or data-component
4. Use placeholder text as selector
5. Use type + aria-label combination

⚙️ ADVANCED TYPING IMPLEMENTATION:
- Uses CDP Input.insertText for native browser input handling
- Triggers proper keyboard events (keydown, keyup) with correct key codes
- Dispatches InputEvent with proper inputType ('insertText')
- Updates React's _valueTracker for proper state synchronization
- Automatically scrolls input into view
- Simulates mouse click for realistic focus
- Clears existing content with proper event triggering (clearFirst: true)
- Types character-by-character with realistic timing (15ms delay)
- Can press Enter after typing (pressEnter: true)

📝 BEST PRACTICES:
- For search boxes: set pressEnter: true
- For form fields: set pressEnter: false, use submit or click submit button
- For single-field forms: pressEnter: true
- Always provide 2-3 backup selectors
- Use waitForElement: 2000-2500 for dynamically loaded forms`,
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: `Primary CSS selector for input. Check browser context for actual attributes. Examples:
- #username (ID - best if available)
- input[name="email"] (Name attribute - check if exists)
- input[placeholder="Enter username"] (Placeholder)
- [data-testid="username-input"] (Data attribute)
- input[aria-label="Username"] (ARIA label)

IMPORTANT: Don't assume name attribute exists. Modern sites often use id, data-*, or aria-* instead.`
        },
        backupSelectors: {
          type: 'array',
          description: `REQUIRED: 2-3 backup selectors. Use different attribute types. Examples:
["input[placeholder='Username']", "input[type='text']", "[aria-label='Username']"]
["#email", "input[name='email']", "input[type='email']"]`,
          items: { type: 'string' }
        },
        text: {
          type: 'string',
          description: 'Text to type into the input. Will be typed character-by-character to trigger proper input events.'
        },
        clearFirst: {
          type: 'boolean',
          description: 'Clear existing content before typing. Default: true. Set false to append text.',
          default: true
        },
        pressEnter: {
          type: 'boolean',
          description: `Press Enter key after typing. Use cases:
- true: Search boxes, single-field forms, chat inputs, command inputs
- false: Multi-field forms (use submit button instead), text areas
Default: false`,
          default: false
        },
        waitForElement: {
          type: 'number',
          description: 'Wait time before typing (ms). Use 1500-2000 for dynamically loaded forms. Default: 1000',
          default: 1000
        }
      },
      required: ['selector', 'backupSelectors', 'text']
    }
  },
  {
    name: 'select',
    description: 'Select an option from a <select> dropdown. BEST PRACTICE: Use label (visible text) as it is most reliable.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for <select> element. Examples: select[name="country"], #country-dropdown, select[aria-label="Choose country"]'
        },
        backupSelectors: {
          type: 'array',
          description: 'Backup selectors for the select element',
          items: { type: 'string' }
        },
        value: {
          type: 'string',
          description: 'Option value attribute (e.g., "us" for <option value="us">). Use when you know the exact value.'
        },
        label: {
          type: 'string',
          description: 'RECOMMENDED: Visible text of option (e.g., "United States", "Blue"). This is what users see in the dropdown.'
        },
        index: {
          type: 'number',
          description: 'Zero-based index (0=first, 1=second). Use only when value/label are unknown.'
        },
        waitForElement: {
          type: 'number',
          description: 'Wait time before selecting (ms). Default: 1000',
          default: 1000
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'checkbox',
    description: 'Check or uncheck a checkbox/radio button. Modern sites often use custom attributes instead of name.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: `CSS selector for checkbox. Check browser context for actual attributes. Examples:
- input[type="checkbox"][data-component="checkbox"] (Data attribute)
- input[type="checkbox"][aria-label="Accept terms"] (ARIA)
- #agree-checkbox (ID if available)
- input[name="agree"] (Name - check if exists)

Don't assume name attribute exists.`
        },
        backupSelectors: {
          type: 'array',
          description: 'Backup selectors. Example: ["input[type=checkbox]", "[aria-describedby*=checkbox]"]',
          items: { type: 'string' }
        },
        checked: {
          type: 'boolean',
          description: 'true to check, false to uncheck. Use true for: agree to terms, enable feature, select option.'
        },
        waitForElement: {
          type: 'number',
          description: 'Wait time before toggling (ms). Default: 1000',
          default: 1000
        }
      },
      required: ['selector', 'checked']
    }
  },
  {
    name: 'wait',
    description: `Simple wait/sleep. Use when you need to wait for:
- Page to settle after action
- Animations to complete
- Dynamic content to load (when no reliable selector exists)
- Network requests to complete

This tool NEVER fails - it just waits. Prefer this over waitForElement when selectors are unreliable or you just need time for page to stabilize.`,
    input_schema: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Duration in milliseconds. Common values: 1000 (1 sec), 2000 (2 sec), 3000 (3 sec). Use 1000-2000ms for most cases.',
          default: 1000
        }
      },
      required: ['duration']
    }
  },
  {
    name: 'waitForElement',
    description: 'Wait for an element to appear/disappear. Use before interacting with dynamically loaded content.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of element to wait for. Must be valid CSS.'
        },
        state: {
          type: 'string',
          description: 'Target state. visible: wait for element to appear, hidden: wait to disappear, attached: wait for element in DOM',
          enum: ['visible', 'hidden', 'attached'],
          default: 'visible'
        },
        timeout: {
          type: 'number',
          description: 'Max wait time (ms). Default: 10000 (10 seconds)',
          default: 10000
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'keyPress',
    description: 'Press keyboard keys. Use for: keyboard shortcuts (Ctrl+S), navigation (Tab, Enter, Escape), dropdown navigation (Arrow keys).',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: `Key to press. Special keys: Enter, Escape, Tab, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown, Space
Letters: a, b, c (lowercase) or with Shift modifier for uppercase`
        },
        modifiers: {
          type: 'array',
          description: 'Modifier keys. Examples: ["Control", "S"] for Ctrl+S, ["Meta", "C"] for Cmd+C, ["Shift"] for Shift+Tab',
          items: {
            type: 'string',
            enum: ['Control', 'Shift', 'Alt', 'Meta']
          }
        },
        selector: {
          type: 'string',
          description: 'Optional: Focus this element before pressing key. Example: input[name="search"] then press Enter'
        }
      },
      required: ['key']
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page. NOTE: Elements are automatically scrolled into view before clicking/typing, so manual scrolling is rarely needed.',
    input_schema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          description: 'Scroll direction. Use with amount parameter.',
          enum: ['up', 'down', 'left', 'right']
        },
        amount: {
          type: 'number',
          description: 'Pixels to scroll. Default: 500. Use 300-500 for gentle scroll, 1000+ for large jumps.',
          default: 500
        },
        toElement: {
          type: 'string',
          description: 'CSS selector of element to scroll to. Element will be centered in viewport. Use instead of direction/amount when you need specific element visible.'
        }
      },
      required: []
    }
  },
  {
    name: 'submit',
    description: 'Submit a form. BEST PRACTICE: Use click tool on submit button instead for better compatibility. This tool is for edge cases.',
    input_schema: {
      type: 'object',
      properties: {
        formSelector: {
          type: 'string',
          description: 'CSS selector for form element. Example: form[name="login"], #checkout-form. Defaults to first form if omitted.'
        },
        submitButtonSelector: {
          type: 'string',
          description: 'RECOMMENDED: CSS selector for submit button. This clicks the button instead of direct submit, triggering validation. Example: button[type="submit"], #submit-btn'
        }
      },
      required: []
    }
  },
  {
    name: 'extract_browser_context',
    description: `Extract current browser and DOM context for analysis and decision-making.

**CRITICAL: This is NOT an automation tool - it's an ANALYSIS tool.**

Use this tool when you need to:
- Understand the current page state after an error
- Analyze what elements are available on the current page
- Determine the next best action based on current browser state
- Verify if expected elements/changes appeared after an action

**DO NOT include this in your automation plan steps.** This tool should only be called:
- When you encounter an error and need to understand the current state
- When you need to verify the page state before deciding next steps
- During error recovery to analyze what went wrong

The tool returns:
- All interactive elements (buttons, inputs, links, etc.) with their selectors and attributes
- Form structures with fields
- Current page URL and title
- Element positions and visibility
- Statistics about page elements

This information helps you make informed decisions about:
- Which selectors to use for automation
- Whether expected elements are present
- What actions are possible in the current state
- How to recover from errors`,
    input_schema: {
      type: 'object',
      properties: {
        maxElements: {
          type: 'number',
          description: 'Maximum number of interactive elements to extract. Default: 200. Use lower values (50-100) for faster extraction.',
          default: 200
        }
      },
      required: []
    }
  }
];

/**
 * Get a specific tool definition by name
 */
export function getToolDefinition(toolName: string): Anthropic.Tool | undefined {
  return BROWSER_AUTOMATION_TOOLS.find(tool => tool.name === toolName);
}

/**
 * Validate tool parameters against schema
 */
export function validateToolParams(toolName: string, params: Record<string, unknown>): { valid: boolean; errors?: string[] } {
  const tool = getToolDefinition(toolName);
  if (!tool) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  const errors: string[] = [];
  const schema = tool.input_schema as { required?: string[]; properties: Record<string, any> };

  // Check required parameters
  for (const required of schema.required || []) {
    if (!(required in params)) {
      errors.push(`Missing required parameter: ${required}`);
    }
  }

  // Validate selector syntax for click/type tools
  if ((toolName === 'click' || toolName === 'type') && params.selector) {
    const selector = params.selector as string;
    const invalidPatterns = [':has-text(', ':visible', ':enabled', ':contains(', ':has(', ':text('];
    const hasInvalid = invalidPatterns.some(pattern => selector.includes(pattern));
    
    if (hasInvalid) {
      errors.push(`Invalid selector syntax: "${selector}". Do not use Playwright/jQuery syntax like :has-text(), :visible, :contains(). Use pure CSS selectors and the 'text' parameter for text matching.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * ToolRegistry class
 */
export class ToolRegistry {
  public getToolDefinitions(): Anthropic.Tool[] {
    return BROWSER_AUTOMATION_TOOLS;
  }

  public getToolNames(): string[] {
    return BROWSER_AUTOMATION_TOOLS.map(tool => tool.name);
  }

  public getTool(name: string): Anthropic.Tool | undefined {
    return BROWSER_AUTOMATION_TOOLS.find(tool => tool.name === name);
  }

  public validateToolParams(toolName: string, params: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return validateToolParams(toolName, params);
  }
}