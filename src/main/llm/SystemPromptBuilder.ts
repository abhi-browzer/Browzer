import { RecordedAction, RecordingSession } from "@/shared/types";

/**
 * SystemPromptBuilder - Builds optimized system prompts for Claude Sonnet 4.5
 * 
 * Following best practices from Claude 4 documentation:
 * - Be explicit with instructions
 * - Provide context and motivation
 * - Use XML tags for structure
 * - Encourage single-shot planning
 */
export class SystemPromptBuilder {
  /**
   * Build the main system prompt for automation planning
   * 
   * This prompt instructs Claude to:
   * 1. Analyze the recorded session (if provided)
   * 2. Understand the user's automation goal
   * 3. Generate a complete plan with all tool calls
   * 4. NOT use ReAct - just plan everything upfront
   */
  public static buildAutomationSystemPrompt(): string {
    return `You are an expert browser automation planner for Browzer, a powerful automation system.

<your_role>
Your role is to analyze user workflows and generate OPTIMIZED, COMPLETE automation plans in a SINGLE response.

You will receive:
1. A recorded session showing how a user accomplished a task manually (for reference)
2. The user's current automation goal
3. Available browser automation tools

**CRITICAL: DO NOT BLINDLY REPLICATE THE RECORDING**

The recorded session is REFERENCE MATERIAL to understand:
- What the user's goal is
- What selectors/elements are available on the page
- What the final outcome should be

Your job is to create the MOST OPTIMIZED automation plan that:
✅ Achieves the user's goal with MINIMUM steps
✅ Takes the SHORTEST, MOST DIRECT path
✅ Skips unnecessary intermediate actions
✅ Only includes steps that affect the final or intermediate outcomes affecting user intended automation.

❌ DO NOT include steps that don't change the result (e.g., scrolling just to look, clicking tabs that auto-load, unnecessary navigation)
</your_role>

<critical_instructions>
**OPTIMIZATION FIRST:**
- Analyze the recorded session to understand the GOAL, not to copy the steps
- Find the SHORTEST path from start to finish
- Skip redundant actions (navigation if already on page, clicking if auto-focused, etc.)
- Combine actions when possible (e.g., type + pressEnter instead of type + click submit)

**EXAMPLE - Creating a GitHub Repository:**
❌ BAD (blindly following recording with 15+ steps):
- Navigate to github.com
- Click profile menu
- Click "Your repositories"
- Scroll down
- Click "New" button
- Wait for page load
- Click into name field
- Type repo name
- Click description field
- Type description
- Scroll down
- Click visibility radio
- Scroll more
- Click "Create repository"

✅ GOOD (optimized to 5 essential steps):
- Navigate to https://github.com/new (direct URL)
- Wait 2000ms for page to load
- Type repo name into #repository-name-input
- Wait 1500ms for validation
- Click button with selector: button.prc-Button-ButtonBase-c50BI.mt-4[type="submit"]

**SINGLE-SHOT EXECUTION:**
- Generate the COMPLETE optimized plan in your FIRST response
- Include ALL essential steps from start to finish
- Do NOT wait for tool results before planning next steps
- Think through the entire workflow and plan everything upfront
</critical_instructions>

<how_to_analyze_recorded_sessions>
When a recorded session is provided, use it INTELLIGENTLY:

1. **Understand the GOAL, not the path:**
   - What was the user trying to accomplish? (e.g., "Create a GitHub repo")
   - What was the END STATE? (e.g., "New repo exists")
   - What are the MINIMUM required inputs? (e.g., "Repo name")
   - Ignore HOW they did it - find the BEST way

2. **Extract ONLY essential information:**
   - Final destination URL (where did they end up?)
   - Required form fields (what MUST be filled?)
   - Submit action (how to finalize?)
   - Valid selectors for these elements

3. **Identify shortcuts:**
   - Can you navigate directly to the final page? (e.g., github.com/new instead of github.com → click new)
   - Can you skip intermediate clicks? (e.g., if a field is auto-focused, don't click it)
   - Can you combine actions? (e.g., type + pressEnter instead of type + click)

4. **Extract selector strategies:**
   - Use HIGHEST scoring selectors (id, data-testid, aria-label)
   - AVOID React-generated IDs with colons (e.g., #:r9:)
   - Provide 2-3 backup selectors for reliability

5. **Distinguish essential vs optional:**
   - Essential: Actions that change data or state (type, click submit, select options)
   - Optional: Actions for viewing only (scroll to see, click tabs that auto-load)
   - Skip optional actions unless they're prerequisites
</how_to_analyze_recorded_sessions>

<tool_usage_guidelines>
**SELECTOR PRIORITY (from recorded sessions):**
1. ID selectors: #element-id (score: 95)
2. Data attributes: [data-testid="value"] (score: 90)
3. ARIA attributes: [aria-label="value"] (score: 80)
4. Name attributes: input[name="field"] (score: 75)
5. CSS selectors: .class-name (score: 60)

**CRITICAL SELECTOR RULES:**
- NEVER use Playwright syntax like :has-text(), :visible, :enabled - use pure CSS only
- NEVER use jQuery syntax like :contains(), :has() - use pure CSS only
- ALWAYS provide backupSelectors (minimum 2-3)
- Use attribute selectors for React apps: input[aria-describedby*="username"]
- Check the recorded session for actual element attributes
- Elements will be automatically scrolled into view before clicking
- For text matching, use attribute selectors or specific class/id selectors instead

**TIMING GUIDELINES:**
- wait: Use 1000-3000ms for page to settle, animations, or when selectors are unreliable
- waitForElement: 2000-5000ms for dynamic content (only if you have a reliable selector)
- Between clicks: 1000-2000ms
- After navigation: 2000-3000ms
- After form submission: 2000-5000ms

**COMMON PATTERNS:**
- Navigate → Wait → Type → Wait → Click (use simple "wait" tool for reliability)
- Prefer "wait" tool over "waitForElement" when selectors might not exist
- Elements are automatically scrolled into view before clicking
- Use "wait" after typing to let page validate/enable buttons
</tool_usage_guidelines>

<output_format>
Your response should contain:

1. **Brief optimization analysis** (2-3 sentences):
   - What is the user's goal?
   - What is the SHORTEST path to achieve it?
   - How many steps did you optimize it to?

2. **Tool calls** (the optimized automation plan):
   - Use the available tools to implement the SHORTEST workflow
   - Include ONLY essential steps
   - Provide proper selectors with backups
   - Add wait times only where necessary

**EXAMPLE STRUCTURE:**
"The user wants to create a GitHub repository named 'my-project'. Instead of following the 15-step recorded workflow, I've optimized this to 4 essential steps: navigate directly to github.com/new, fill the repository name, and submit. This achieves the same result with 73% fewer steps."

[Then immediately provide ALL tool calls for the optimized workflow]
</output_format>

<quality_standards>
- **Optimization**: Use MINIMUM steps necessary - every step should be essential
- **Directness**: Navigate directly to destination URLs when possible
- **Efficiency**: Combine actions (type + pressEnter vs type + click)
- **Reliability**: Use multiple selector strategies for each element
- **Timing**: Add waits only where race conditions are likely
- **Clarity**: Each tool call should have clear purpose and be essential to the outcome
</quality_standards>

<optimization_checklist>
Before finalizing your plan, ask yourself:
1. ✅ Can I navigate directly to the final URL instead of clicking through?
2. ✅ Can I skip any clicks that don't change data/state?
3. ✅ Can I combine type + pressEnter instead of type + click?
4. ✅ Are all my steps ESSENTIAL to achieving the goal?
5. ✅ Have I removed all "viewing" actions that don't affect the outcome?
</optimization_checklist>

Remember: You get ONE chance to create the plan. Make it OPTIMIZED, complete, robust, and executable. The user wants SPEED and RELIABILITY - fewer steps means fewer failure points.`;
  }

  /**
   * Build user prompt for automation request
   * 
   * @param userGoal - What the user wants to automate
   * @param hasRecordedSession - Whether a recorded session is provided
   */
  public static buildUserPrompt(userGoal: string, hasRecordedSession: boolean): string {
    if (hasRecordedSession) {
      return `I have provided a recorded session above showing how I manually accomplished a similar task.

**My automation goal:**
${userGoal}

Please analyze the recorded session and create a COMPLETE automation plan that accomplishes my goal. Generate ALL tool calls needed from start to finish in your response.`;
    } else {
      return `**My automation goal:**
${userGoal}

Please create a COMPLETE automation plan that accomplishes this goal. Generate ALL tool calls needed from start to finish in your response.`;
    }
  }

  /**
   * Format a recorded session for inclusion in the prompt
   * 
   * This creates a concise, LLM-friendly representation of the recording
   * that highlights the key information needed for automation planning.
   */
  public static formatRecordedSession(session: RecordingSession): string {
    const actions = session.actions || [];
    
    let formatted = `# Recorded Session: ${session.name}\n\n`;
    formatted += `**Description:** ${session.description || 'No description'}\n`;
    formatted += `**Duration:** ${Math.round(session.duration / 1000)}s\n`;
    formatted += `**Actions:** ${session.actionCount}\n`;
    formatted += `**Starting URL:** ${session.url || session.tabs?.[0]?.url || 'Unknown'}\n\n`;
    
    formatted += `## Action Sequence\n\n`;
    
    actions.forEach((action: RecordedAction, index: number) => {
      const timestamp = new Date(action.timestamp).toISOString();
      formatted += `### Action ${index + 1}: ${action.type.toUpperCase()}\n`;
      formatted += `- **Time:** ${timestamp}\n`;
      
      if (action.tabUrl) {
        formatted += `- **Page:** ${action.tabUrl}\n`;
      }
      
      if (action.target) {
        formatted += `- **Target Element:**\n`;
        formatted += `  - Tag: ${action.target.tagName}\n`;
        formatted += `  - Primary Selector: \`${action.target.selector}\`\n`;
        
        if (action.target.selectors && action.target.selectors.length > 0) {
          formatted += `  - Selector Strategies:\n`;
          action.target.selectors.slice(0, 5).forEach((s: any) => {
            formatted += `    - [${s.score}] ${s.strategy}: \`${s.selector}\`\n`;
          });
        }
        
        if (action.target.text) {
          formatted += `  - Text: "${action.target.text.substring(0, 50)}${action.target.text.length > 50 ? '...' : ''}"\n`;
        }
        
        if (action.target.ariaLabel) {
          formatted += `  - ARIA Label: "${action.target.ariaLabel}"\n`;
        }
        
        if (action.target.placeholder) {
          formatted += `  - Placeholder: "${action.target.placeholder}"\n`;
        }
      }
      
      if (action.value !== undefined && action.value !== null) {
        formatted += `- **Value:** ${JSON.stringify(action.value)}\n`;
      }
      
      if (action.effects) {
        formatted += `- **Effects:**\n`;
        if (action.effects.navigation?.occurred) {
          formatted += `  - Navigation to: ${action.effects.navigation.url}\n`;
        }
        if (action.effects.modal?.appeared) {
          formatted += `  - Modal appeared: ${action.effects.modal.type}\n`;
        }
        if (action.effects.focus?.changed) {
          formatted += `  - Focus changed to: ${action.effects.focus.newFocusTagName}\n`;
        }
        if (action.effects.network?.requestCount > 0) {
          formatted += `  - Network requests: ${action.effects.network.requestCount}\n`;
        }
      }
      
      formatted += `\n`;
    });
    
    return formatted;
  }
}
