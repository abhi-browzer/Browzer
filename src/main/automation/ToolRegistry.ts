import { ToolRegistry } from '@/shared/types';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Tool Registry for Browser Automation
 * 
 * Defines all available browser automation tools in Anthropic Claude's format.
 * These tools are designed for Claude Sonnet 3.5/4 with detailed descriptions
 * and parameter schemas following best practices.
 * 
 * CRITICAL SELECTOR GUIDELINES FOR LLMs:
 * ========================================
 * 
 * 1. ALWAYS CHECK BROWSER CONTEXT FIRST
 *    - Modern web apps often DON'T use "name" attributes
 *    - Look for: id, data-*, aria-*, placeholder, type
 *    - Example: GitHub uses id="repository-name-input" NOT name="repository[name]"
 * 
 * 2. AVOID REACT-GENERATED IDs WITH COLONS
 *    - ❌ BAD: #:r9:, #:ra:, #:rb: (breaks in CDP)
 *    - ✅ GOOD: Use attribute selectors instead
 *    - Example: input[aria-describedby*="RepoNameInput"] instead of #:r9:
 * 
 * 3. SELECTOR PRIORITY (Most to Least Reliable)
 *    1. Stable IDs: #username, #submit-button
 *    2. Attribute selectors: input[name=email], button[type=submit]
 *    3. Data attributes: [data-testid=login], [data-component=input]
 *    4. ARIA attributes: [aria-label=Submit], [aria-describedby*=username]
 *    5. Class combinations: button.btn.btn-primary (least reliable)
 * 
 * 4. ALWAYS PROVIDE BACKUP SELECTORS
 *    - Minimum 2-3 backup selectors for each action
 *    - Use different selector strategies for each backup
 *    - Example: [input[aria-label=Username], input[placeholder=Enter username], input[type=text]]
 * 
 * 5. COMMON PATTERNS BY SITE TYPE
 *    - GitHub: Uses id attributes (e.g., #repository-name-input)
 *    - Modern SPAs: Use data-* attributes (e.g., [data-testid=submit])
 *    - Legacy sites: Use name attributes (e.g., input[name=username])
 *    - React apps: Avoid :r9: IDs, use aria-* or data-* instead
 * 
 * 6. WHEN TO USE EACH TOOL
 *    - click: Buttons, links, tabs, dropdowns, any clickable element
 *    - type: Text inputs, textareas, search boxes, contenteditable
 *    - select: <select> dropdowns only (use label for best results)
 *    - checkbox: Checkboxes and radio buttons
 *    - waitForElement: Before interacting with dynamic content
 *    - scroll: To bring elements into view or navigate long pages
 *    - keyPress: Keyboard shortcuts, navigation, form submission
 *    - submit: Form submission (prefer click on submit button instead)
 */

export const BROWSER_AUTOMATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'navigate',
    description: 'Navigate to a specific URL in the browser. Use this to load a new page or website. Waits for the page to finish loading before returning. Always use complete URLs with protocol (https://).',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The complete URL to navigate to, including protocol. Examples: "https://github.com/new", "https://example.com/login"'
        },
        waitUntil: {
          type: 'string',
          description: 'When to consider navigation complete. Use "load" for most cases, "networkidle" for SPAs with async content',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          default: 'load'
        },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait for navigation in milliseconds. Default is 30000 (30 seconds)',
          default: 30000
        }
      },
      required: ['url']
    }
  },
  {
    name: 'click',
    description: 'Click on an element in the browser. CRITICAL: Always provide multiple backup selectors for reliability. SELECTOR PRIORITY: 1) ID selectors (#element-id) 2) Attribute selectors (input[name="field"]) 3) Data attributes ([data-testid="btn"]) 4) Class combinations. AVOID: React-generated IDs with colons (e.g., #:r9:), they break in CDP. Use attribute selectors instead.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Primary CSS selector. BEST PRACTICES: Use stable attributes like id, name, data-*, aria-label. Example: #submit-button or button[type=submit] or input[name=username]. NEVER use React IDs with colons like #:r9: - use attribute selectors instead.'
        },
        backupSelectors: {
          type: 'array',
          description: 'CRITICAL: Always provide 2-3 backup selectors. Examples: button[aria-label=Submit], button.primary-btn, form button[type=submit]',
          items: { type: 'string' }
        },
        text: {
          type: 'string',
          description: 'Expected button/link text for verification. Helps confirm you\'re clicking the right element.'
        },
        boundingBox: {
          type: 'object',
          description: 'Element position from browser context. Use if provided to verify correct element.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' }
          }
        },
        waitForElement: {
          type: 'number',
          description: 'Wait time in ms before clicking. Use 1000-2000ms for dynamic content. Default: 1000',
          default: 1000
        },
        verifyVisible: {
          type: 'boolean',
          description: 'Verify element is visible before clicking. Keep true unless clicking hidden elements.',
          default: true
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'type',
    description: 'Type text into input fields, textareas, or contenteditable elements. IMPORTANT: Modern web apps often don\'t use "name" attributes. Check browser context for actual attributes. Look for: id, aria-describedby, data-component, placeholder. Example: GitHub uses id="repository-name-input" NOT name="repository[name]".',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for input. BEST: ID (#username), attribute (input[name=email]), data attribute (input[data-testid=search]). Check browser context for actual attributes - many modern sites do not use name attributes.'
        },
        backupSelectors: {
          type: 'array',
          description: 'CRITICAL: Provide 2-3 backups. Example: input[aria-label=Username], input[placeholder=Enter username], input[type=text]',
          items: { type: 'string' }
        },
        text: {
          type: 'string',
          description: 'Text to type. Will be typed character by character to trigger proper events.'
        },
        clearFirst: {
          type: 'boolean',
          description: 'Clear existing content before typing. Usually true. Set false to append text.',
          default: true
        },
        pressEnter: {
          type: 'boolean',
          description: 'Press Enter after typing. Use true for: search boxes, single-field forms, chat inputs.',
          default: false
        },
        waitForElement: {
          type: 'number',
          description: 'Wait before typing (ms). Use 1000-2000 for dynamic forms. Default: 1000',
          default: 1000
        }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'select',
    description: 'Select an option from a dropdown/select element. Provide ONE of: value, label, or index. BEST: Use label (visible text) as it is most reliable. Example: label=United States works better than value=US.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the select element. Example: select[name=country], #country-dropdown, select[aria-label=Choose country]'
        },
        backupSelectors: {
          type: 'array',
          description: 'Backup selectors for the dropdown',
          items: { type: 'string' }
        },
        value: {
          type: 'string',
          description: 'The value attribute of the option (e.g., value=us for <option value=us>). Use when you know the exact value.'
        },
        label: {
          type: 'string',
          description: 'The visible text of the option (RECOMMENDED). Example: United States, Blue, Large. This is what users see.'
        },
        index: {
          type: 'number',
          description: 'Zero-based index (0=first option, 1=second, etc.). Use only when value/label unknown.'
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
    description: 'Check or uncheck a checkbox or radio button. IMPORTANT: Modern sites often use input[type=checkbox] without name attributes. Look for: data-component=checkbox, aria-describedby, or aria-label in browser context.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for checkbox. Examples: input[type=checkbox][data-component=checkbox], input[aria-label=Accept terms], #agree-checkbox. Check browser context for actual attributes.'
        },
        backupSelectors: {
          type: 'array',
          description: 'Backup selectors. Example: input[type=checkbox], input[aria-describedby*=checkbox]',
          items: { type: 'string' }
        },
        checked: {
          type: 'boolean',
          description: 'true to check the box, false to uncheck it. Use true for: agree to terms, enable feature, select option.'
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
    name: 'waitForElement',
    description: 'Wait for an element to appear, disappear, or be attached to DOM. Use BEFORE interacting with dynamic content. Common scenarios: wait for loading spinner to disappear (state=hidden), wait for success message (state=visible), wait for form to load (state=visible). Timeout: 10 seconds default.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for element. Examples: #loading-spinner, .success-message, input[name=username]'
        },
        state: {
          type: 'string',
          description: 'State to wait for. visible=element appears and is visible, hidden=element disappears, attached=element exists in DOM. Use visible for most cases.',
          enum: ['visible', 'hidden', 'attached'],
          default: 'visible'
        },
        timeout: {
          type: 'number',
          description: 'Max wait time (ms). Default: 10000 (10 seconds). Increase for slow-loading content.',
          default: 10000
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'keyPress',
    description: 'Press keyboard keys with optional modifiers. Use for: keyboard shortcuts (Ctrl+S), navigation (Tab, Enter, Escape), dropdown navigation (ArrowDown), form submission (Enter). Can focus element first if selector provided.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key to press. Special keys: Enter, Escape, Tab, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown, Space. Letters: a, b, c (lowercase) or A, B, C (uppercase with Shift).'
        },
        modifiers: {
          type: 'array',
          description: 'Modifier keys to hold. Examples: [Control, S] for Ctrl+S, [Meta, C] for Cmd+C (Mac), [Shift] for Shift+Tab',
          items: {
            type: 'string',
            enum: ['Control', 'Shift', 'Alt', 'Meta']
          }
        },
        selector: {
          type: 'string',
          description: 'Optional: Focus this element before pressing key. Example: input[name=search] then press Enter to submit.'
        }
      },
      required: ['key']
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page or scroll to specific element. TWO MODES: 1) Directional scroll (direction + amount) for general scrolling, 2) Scroll to element (toElement) to bring element into view. Use toElement when you need to see/interact with element below fold.',
    input_schema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          description: 'Scroll direction. Use with amount parameter. Common: down to see more content, up to go back.',
          enum: ['up', 'down', 'left', 'right']
        },
        amount: {
          type: 'number',
          description: 'Pixels to scroll. Default: 500. Use 300-500 for gentle scroll, 1000+ for large jumps.',
          default: 500
        },
        toElement: {
          type: 'string',
          description: 'CSS selector of element to scroll to. Element will be centered in viewport. Example: #submit-button, .terms-section. Use instead of direction/amount.'
        }
      },
      required: []
    }
  },
  {
    name: 'submit',
    description: 'Submit a form. TWO MODES: 1) Click submit button (RECOMMENDED - use submitButtonSelector), 2) Direct form submit (use formSelector). BEST PRACTICE: Use submitButtonSelector with click tool instead for better compatibility. This tool is for edge cases.',
    input_schema: {
      type: 'object',
      properties: {
        formSelector: {
          type: 'string',
          description: 'CSS selector for form element. Example: form[name=login], #checkout-form. Defaults to first form if omitted. Direct submit may skip validation.'
        },
        submitButtonSelector: {
          type: 'string',
          description: 'RECOMMENDED: CSS selector for submit button. Example: button[type=submit], #submit-btn. This clicks the button instead of direct submit, triggering validation.'
        }
      },
      required: []
    }
  }
];

/**
 * Get the complete tool registry
 */
export function getBrowserAutomationToolRegistry(): ToolRegistry {
  return {
    tools: BROWSER_AUTOMATION_TOOLS,
    version: '1.0.0'
  };
}

/**
 * Get a specific tool definition by name
 */
export function getToolDefinition(toolName: string): Anthropic.Tool | undefined {
  return BROWSER_AUTOMATION_TOOLS.find(tool => tool.name === toolName);
}

/**
 * Validate tool parameters against schema
 */
export function validateToolParams(toolName: string, params: any): { valid: boolean; errors?: string[] } {
  const tool = getToolDefinition(toolName);
  if (!tool) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  const errors: string[] = [];
  const schema = tool.input_schema;

  // Check required parameters
  for (const required of schema.required) {
    if (!(required in params)) {
      errors.push(`Missing required parameter: ${required}`);
    }
  }

  // // Basic type checking
  // for (const [key, value] of Object.entries(params)) {
  //   if (!(key in schema.properties)) {
  //     errors.push(`Unknown parameter: ${key}`);
  //   }
  // }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
