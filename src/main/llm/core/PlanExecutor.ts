/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserAutomationExecutor } from '@/main/automation/BrowserAutomationExecutor';
import { AutomationStateManager } from './AutomationStateManager';
import { PlanExecutionResult, ExecutedStep } from './types';
import { ParsedAutomationPlan, ParsedAutomationStep } from '../parsers/AutomationPlanParser';

/**
 * PlanExecutor - Executes automation plans step-by-step
 * 
 * Responsibilities:
 * - Execute plan steps sequentially
 * - Track execution progress
 * - Handle step failures
 * - Detect special tools (extract_context, take_snapshot)
 * - Return execution results
 * 
 * This module centralizes plan execution logic for:
 * - Consistent execution flow
 * - Easy debugging of execution issues
 * - Proper error handling
 * - Step tracking
 */
export class PlanExecutor {
  private executor: BrowserAutomationExecutor;
  private stateManager: AutomationStateManager;

  constructor(
    executor: BrowserAutomationExecutor,
    stateManager: AutomationStateManager
  ) {
    this.executor = executor;
    this.stateManager = stateManager;
  }

  /**
   * Execute a single step from the plan
   * Returns execution result and whether to continue
   */
  public async executeStep(
    step: ParsedAutomationStep,
    stepNumber: number
  ): Promise<{
    success: boolean;
    shouldContinue: boolean;
    isAnalysisTool: boolean;
    result?: any;
    error?: string;
  }> {
    console.log(`🔧 [Step ${stepNumber}] Executing ${step.toolName}...`);

    try {
      // Execute the tool
      const result = await this.executor.executeTool(step.toolName, step.input);

      // Analysis tools (extract_context, take_snapshot) are ONLY special if they're the last step
      // If there are more steps after them, they execute normally
      const isAnalysisTool = step.toolName === 'extract_context' || step.toolName === 'take_snapshot';

      // Record execution
      const executedStep: ExecutedStep = {
        stepNumber,
        toolName: step.toolName,
        success: result.success,
        result,
        error: result.success ? undefined : (result.error?.message || 'Unknown error')
      };

      this.stateManager.addExecutedStep(executedStep);

      // Check if execution failed
      if (!result.success) {
        console.error(`   ❌ Step ${stepNumber} failed: ${result.error?.message || 'Unknown error'}`);
        return {
          success: false,
          shouldContinue: false,
          isAnalysisTool: false,
          result,
          error: result.error?.message || 'Tool execution failed'
        };
      }

      // Success
      console.log(`   ✅ Step ${stepNumber} completed`);
      return {
        success: true,
        shouldContinue: true,
        isAnalysisTool,
        result
      };

    } catch (error: any) {
      console.error(`   ❌ Step ${stepNumber} failed:`, error.message);

      // Record failed step
      const executedStep: ExecutedStep = {
        stepNumber,
        toolName: step.toolName,
        success: false,
        error: error.message
      };

      this.stateManager.addExecutedStep(executedStep);

      return {
        success: false,
        shouldContinue: false,
        isAnalysisTool: false,
        error: error.message
      };
    }
  }

  /**
   * Execute all steps in a plan
   * Returns when:
   * - All steps complete successfully
   * - A step fails (triggers error recovery)
   * - An analysis tool is encountered AS THE LAST STEP (triggers continuation)
   */
  public async executePlan(plan: ParsedAutomationPlan): Promise<PlanExecutionResult> {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepNumber = this.stateManager.getExecutedSteps().length + 1;
      const isLastStep = i === plan.steps.length - 1;

      const stepResult = await this.executeStep(step, stepNumber);

      // Handle step failure
      if (!stepResult.success) {
        return {
          success: false,
          isComplete: false,
          error: stepResult.error
        };
      }

      // Handle analysis tools (extract_context) ONLY if it's the last step
      // If there are more steps after it, continue executing them
      if (stepResult.isAnalysisTool && isLastStep) {
        console.log(`✅ [PlanExecutor] Analysis tool executed as last step - returning to Claude`);
        return {
          success: true,
          isComplete: false // Not complete, need to continue conversation
        };
      }

      // If analysis tool is NOT the last step, continue executing remaining steps
      if (stepResult.isAnalysisTool && !isLastStep) {
        console.log(`   ℹ️  Analysis tool executed (${step.toolName}) - continuing with remaining steps`);
      }
    }

    // All steps completed successfully
    return {
      success: true,
      isComplete: true
    };
  }

  /**
   * Check if plan ends with analysis tool
   */
  public static endsWithAnalysisTool(plan: ParsedAutomationPlan): boolean {
    if (plan.steps.length === 0) return false;
    const lastStep = plan.steps[plan.steps.length - 1];
    return lastStep.toolName === 'extract_context' || lastStep.toolName === 'take_snapshot';
  }
}
