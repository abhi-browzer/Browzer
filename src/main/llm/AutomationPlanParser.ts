/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk';

/**
 * Parsed automation step from Claude's response
 */
export interface ParsedAutomationStep {
  toolName: string;
  toolUseId: string;
  input: any;
  order: number; // Sequence number in the plan
}

/**
 * Result of parsing Claude's automation plan
 */
export interface ParsedAutomationPlan {
  steps: ParsedAutomationStep[];
  analysis?: string; // Claude's initial analysis/explanation
  totalSteps: number;
  hasToolCalls: boolean;
}

/**
 * AutomationPlanParser - Extracts tool calls from Claude's response
 * 
 * Claude Sonnet 4.5 returns a Message with content blocks.
 * We need to extract:
 * 1. Text blocks (analysis/explanation)
 * 2. Tool use blocks (the actual automation steps)
 */
export class AutomationPlanParser {
  /**
   * Parse Claude's response into an executable automation plan
   * 
   * @param response - Claude's Message response
   * @returns Parsed automation plan with ordered steps
   */
  public static parsePlan(response: Anthropic.Message): ParsedAutomationPlan {
    const steps: ParsedAutomationStep[] = [];
    let analysis = '';
    let stepOrder = 0;

    console.log('📋 [AutomationPlanParser] Parsing automation plan...');
    console.log(`   Content blocks: ${response.content.length}`);
    console.log(`   Stop reason: ${response.stop_reason}`);

    // Iterate through content blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        // Text blocks contain Claude's analysis/explanation
        analysis += block.text + '\n';
        console.log(`   [Text] ${block.text.substring(0, 100)}...`);
      } else if (block.type === 'tool_use') {
        // Tool use blocks are the actual automation steps
        steps.push({
          toolName: block.name,
          toolUseId: block.id,
          input: block.input,
          order: stepOrder++
        });
        console.log(`   [Tool ${stepOrder}] ${block.name}`);
      }
    }

    console.log(`✅ [AutomationPlanParser] Parsed ${steps.length} automation steps`);

    return {
      steps,
      analysis: analysis.trim(),
      totalSteps: steps.length,
      hasToolCalls: steps.length > 0
    };
  }

  /**
   * Validate that the plan is executable
   * 
   * Checks:
   * - Plan has at least one step
   * - All tool names are recognized
   * - All required parameters are present
   */
  public static validatePlan(
    plan: ParsedAutomationPlan,
    availableTools: string[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if plan has steps
    if (plan.totalSteps === 0) {
      errors.push('Plan has no automation steps');
    }

    // Check if all tools are recognized
    for (const step of plan.steps) {
      if (!availableTools.includes(step.toolName)) {
        errors.push(`Unknown tool: ${step.toolName} at step ${step.order + 1}`);
      }
    }

    // Additional validation can be added here
    // - Check required parameters
    // - Check parameter types
    // - Check logical flow

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get a human-readable summary of the plan
   */
  public static getSummary(plan: ParsedAutomationPlan): string {
    if (!plan.hasToolCalls) {
      return 'No automation steps generated';
    }

    let summary = `Automation Plan (${plan.totalSteps} steps):\n\n`;
    
    if (plan.analysis) {
      summary += `Analysis:\n${plan.analysis}\n\n`;
    }

    summary += 'Steps:\n';
    plan.steps.forEach((step, index) => {
      summary += `${index + 1}. ${step.toolName}\n`;
      summary += `   Input: ${JSON.stringify(step.input, null, 2)}\n`;
    });

    return summary;
  }
}
