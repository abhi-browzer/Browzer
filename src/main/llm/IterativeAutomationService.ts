/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeClient } from './ClaudeClient';
import { SystemPromptBuilder } from './SystemPromptBuilder';
import { AutomationPlanParser, ParsedAutomationPlan } from './AutomationPlanParser';
import { ToolRegistry } from '../automation/ToolRegistry';
import { BrowserAutomationExecutor } from '../automation/BrowserAutomationExecutor';
import { RecordingSession } from '@/shared/types/recording';
import { RecordingStore } from '../recording';
import { ToolExecutionResult } from '@/shared/types';

/**
 * Iterative Automation State
 * Tracks the state of an ongoing automation session
 */
interface IterativeAutomationState {
  userGoal: string;
  recordedSession?: RecordingSession;
  cachedContext?: string; // Formatted recorded session for caching
  
  // Conversation history
  messages: Anthropic.MessageParam[];
  
  // Execution tracking
  currentPlan?: ParsedAutomationPlan;
  executedSteps: Array<{
    stepNumber: number;
    toolName: string;
    success: boolean;
    result?: ToolExecutionResult;
    error?: string;
  }>;
  
  // Multi-phase tracking
  phaseNumber: number; // Track which phase we're in (1, 2, 3, ...)
  completedPlans: Array<{
    phaseNumber: number;
    plan: ParsedAutomationPlan;
    stepsExecuted: number;
  }>;
  isInRecovery: boolean; // Track if we're in error recovery mode
  
  // Recovery tracking
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  
  // Status
  isComplete: boolean;
  finalSuccess: boolean;
  finalError?: string;
}

/**
 * Result of iterative automation execution
 */
export interface IterativeAutomationResult {
  success: boolean;
  plan?: ParsedAutomationPlan;
  executionResults: any[];
  error?: string;
  analysis?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number;
  };
  recoveryAttempts: number;
  totalStepsExecuted: number;
}

/**
 * IterativeAutomationService - Smart ReAct-based browser automation
 * 
 * This service implements error-driven iterative automation:
 * 1. Generate initial hypothetical plan
 * 2. Execute steps one by one
 * 3. On error: pause, submit error + context to Claude
 * 4. Claude analyzes, extracts browser context, generates new plan
 * 5. Resume execution with updated plan
 * 6. Repeat until success or max recovery attempts
 */
export class IterativeAutomationService {
  private claudeClient: ClaudeClient;
  private toolRegistry: ToolRegistry;
  private executor: BrowserAutomationExecutor;
  private recordingStore: RecordingStore;

  constructor(
    executor: BrowserAutomationExecutor,
    recordingStore: RecordingStore,
    apiKey?: string
  ) {
    this.claudeClient = new ClaudeClient(apiKey);
    this.toolRegistry = new ToolRegistry();
    this.executor = executor;
    this.recordingStore = recordingStore;
  }

  /**
   * Execute automation with Smart ReAct error recovery
   * 
   * @param userGoal - What the user wants to automate
   * @param recordedSessionId - Optional recorded session as reference
   * @param maxRecoveryAttempts - Maximum number of error recovery attempts (default: 3)
   * @returns Automation result with recovery information
   */
  public async executeAutomation(
    userGoal: string,
    recordedSessionId: string,
    maxRecoveryAttempts = 7
  ): Promise<IterativeAutomationResult> {

    // Initialize state
    const state: IterativeAutomationState = {
      userGoal,
      messages: [],
      executedSteps: [],
      phaseNumber: 1,
      completedPlans: [],
      isInRecovery: false,
      recoveryAttempts: 0,
      maxRecoveryAttempts,
      isComplete: false,
      finalSuccess: false
    };

    // Load recorded session if provided
    state.recordedSession = this.recordingStore.getRecording(recordedSessionId);
    state.cachedContext = SystemPromptBuilder.formatRecordedSession(state.recordedSession);

    // Accumulated usage stats
    let totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalCost: 0
    };

    try {
      // Step 1: Generate initial plan
      const initialPlan = await this.generateInitialPlan(state);
      state.currentPlan = initialPlan.plan;
      
      // Update usage
      if (initialPlan.usage) {
        totalUsage = this.accumulateUsage(totalUsage, initialPlan.usage);
      }

      // Add initial assistant message to conversation history
      if (initialPlan.response) {
        state.messages.push({
          role: 'assistant',
          content: initialPlan.response.content
        });
      }

      // Step 2: Execute plan with error recovery loop
      while (!state.isComplete && state.recoveryAttempts <= state.maxRecoveryAttempts) {
        const executionResult = await this.executePlanWithRecovery(state);
        
        // Update usage
        if (executionResult.usage) {
          totalUsage = this.accumulateUsage(totalUsage, executionResult.usage);
        }

        // Check if we're done
        if (executionResult.isComplete) {
          state.isComplete = true;
          state.finalSuccess = executionResult.success;
          if (!executionResult.success) {
            state.finalError = executionResult.error;
          }
          break;
        }
      }

      // Return final result
      return {
        success: state.finalSuccess,
        plan: state.currentPlan,
        executionResults: state.executedSteps,
        error: state.finalError,
        usage: totalUsage,
        recoveryAttempts: state.recoveryAttempts,
        totalStepsExecuted: state.executedSteps.length
      };

    } catch (error: any) {
      console.error('❌ [IterativeAutomation] Fatal error:', error);
      return {
        success: false,
        executionResults: state.executedSteps,
        error: error.message || 'Unknown error occurred',
        usage: totalUsage,
        recoveryAttempts: state.recoveryAttempts,
        totalStepsExecuted: state.executedSteps.length
      };
    }
  }

  /**
   * Generate initial automation plan
   */
  private async generateInitialPlan(state: IterativeAutomationState): Promise<{
    plan: ParsedAutomationPlan;
    response: Anthropic.Message;
    usage: any;
  }> {
    const systemPrompt = SystemPromptBuilder.buildAutomationSystemPrompt();
    const userPrompt = SystemPromptBuilder.buildUserPrompt(
      state.userGoal,
      !!state.recordedSession
    );
    const tools = this.toolRegistry.getToolDefinitions();

    // Add user message to conversation
    state.messages.push({
      role: 'user',
      content: userPrompt
    });

    // Generate plan
    const response = await this.claudeClient.createAutomationPlan({
      systemPrompt,
      userPrompt,
      tools,
      cachedContext: state.cachedContext
    });

    // Parse plan
    const plan = AutomationPlanParser.parsePlan(response);
    // console.log(AutomationPlanParser.getSummary(plan));

    // Validate plan
    const validation = AutomationPlanParser.validatePlan(
      plan,
      this.toolRegistry.getToolNames()
    );

    if (!validation.valid) {
      throw new Error(`Invalid automation plan: ${validation.errors.join(', ')}`);
    }

    const usage = this.claudeClient.getUsageStats(response);

    return { plan, response, usage };
  }

  /**
   * Execute plan with error recovery
   * Returns execution result and whether we're complete
   */
  private async executePlanWithRecovery(state: IterativeAutomationState): Promise<{
    success: boolean;
    isComplete: boolean;
    error?: string;
    usage?: any;
  }> {
    if (!state.currentPlan) {
      return { success: false, isComplete: true, error: 'No plan to execute' };
    }

    // Execute steps one by one
    for (let i = 0; i < state.currentPlan.steps.length; i++) {
      const step = state.currentPlan.steps[i];
      const stepNumber = state.executedSteps.length + 1;

      console.log(`🔧 [Step ${stepNumber}] Executing ${step.toolName}...`);

      try {
        // Special handling for extract_browser_context - execute immediately and return to Claude
        if (step.toolName === 'extract_context') {
          const result = await this.executor.executeTool(step.toolName, step.input);
          
          // CRITICAL: extract_browser_context returns context in result.context, not result.value
          const contextData = result.context || result.value;
          
          if (!contextData) {
            console.error('❌ [IterativeAutomation] extract_context returned no data');
            console.error('   Result:', JSON.stringify(result, null, 2));
          }
          
          // Record this step
          state.executedSteps.push({
            stepNumber,
            toolName: step.toolName,
            success: true,
            result
          });
          
          // CRITICAL: We need to provide tool_results for ALL tool_use blocks from the current plan
          // Not just extract_browser_context, but all steps executed so far
          if (!state.currentPlan) {
            return { success: false, isComplete: true, error: 'No plan available' };
          }
          
          const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = [];
          
          // Build tool_result for ALL steps executed so far (including extract_browser_context)
          for (let j = 0; j < state.currentPlan.steps.length; j++) {
            const planStep = state.currentPlan.steps[j];
            const executedStep = state.executedSteps.find(
              es => es.toolName === planStep.toolName && es.result
            );
            
            if (!executedStep || !executedStep.result) {
              // This step hasn't been executed yet - stop here
              break;
            }
            
            const stepResult = executedStep.result;
            
            // For extract_context, include full context
            if (planStep.toolName === 'extract_context') {
              const ctx = stepResult.context || stepResult.value;
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: planStep.toolUseId,
                content: JSON.stringify(ctx, null, 2)
              });
            } else {
              // For other tools, simple success message
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: planStep.toolUseId,
                content: JSON.stringify({
                  success: true,
                  message: `${planStep.toolName} executed successfully`,
                  summary: stepResult.effects?.summary || `Completed ${planStep.toolName}`
                })
              });
            }
          }
          
          console.log(`✅ [IterativeAutomation] Submitting ${toolResultBlocks} tool_result blocks (including browser context)`);
          
          // Add ALL tool results to conversation
          state.messages.push({
            role: 'user',
            content: toolResultBlocks
          });

          // Continue conversation to get next steps
          const recoveryResult = await this.continueAfterContextExtraction(state);
          return recoveryResult;
        }

        // Execute regular automation tool
        const result = await this.executor.executeTool(step.toolName, step.input);

        // Check if execution succeeded
        if (!result.success) {
          console.error(`   ❌ Step ${stepNumber} failed: ${result.error?.message || 'Unknown error'}`);

          // Record failed step
          state.executedSteps.push({
            stepNumber,
            toolName: step.toolName,
            success: false,
            result,
            error: result.error?.message || 'Tool execution failed'
          });

          // Trigger error recovery
          const recoveryResult = await this.recoverFromError(state, step, result);
          return recoveryResult;
        }

        // Record successful step
        state.executedSteps.push({
          stepNumber,
          toolName: step.toolName,
          success: true,
          result
        });

      } catch (error: any) {
        console.error(`   ❌ Step ${stepNumber} failed:`, error.message);

        // Record failed step
        state.executedSteps.push({
          stepNumber,
          toolName: step.toolName,
          success: false,
          error: error.message
        });

        // Trigger error recovery
        const mockResult: ToolExecutionResult = {
          success: false,
          toolName: step.toolName,
          executionTime: 0,
          error: {
            code: 'EXECUTION_ERROR',
            message: error.message
          },
          timestamp: Date.now(),
          tabId: '',
          url: ''
        };

        const recoveryResult = await this.recoverFromError(state, step, mockResult);
        return recoveryResult;
      }
    }

    // CRITICAL: Check if we're in recovery mode
    if (state.isInRecovery) {
      console.log('✅ [IterativeAutomation] Recovery plan completed - generating new plan from context');
      state.isInRecovery = false;
      
      // Recovery plans often end with extract_context
      // We need to provide tool_result blocks for ALL steps in the recovery plan
      if (!state.currentPlan) {
        return { success: false, isComplete: true, error: 'No plan available' };
      }
      
      // Build tool_result blocks for ALL steps in the recovery plan
      const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = [];
      
      for (let i = 0; i < state.currentPlan.steps.length; i++) {
        const step = state.currentPlan.steps[i];
        const executedStep = state.executedSteps.find(
          es => es.toolName === step.toolName && es.result
        );
        
        if (!executedStep || !executedStep.result) {
          console.error(`❌ Missing execution result for recovery step: ${step.toolName}`);
          continue;
        }
        
        const result = executedStep.result;
        
        // For extract_context, include full context data
        if (step.toolName === 'extract_context' || step.toolName === 'extract_browser_context') {
          const contextData = result.context || result.value;
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: step.toolUseId,
            content: JSON.stringify(contextData, null, 2)
          });
        } else {
          // For other tools, simple success message
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: step.toolUseId,
            content: JSON.stringify({
              success: true,
              message: `${step.toolName} executed successfully`
            })
          });
        }
      }
      
      console.log(`Submitting tool_result blocks for recovery plan`);
      toolResultBlocks.forEach(block => {
        console.log(`   ${block.tool_use_id}: ${block.type}`);
        console.log(block.content);
      });
      
      // Add tool results to conversation
      state.messages.push({
        role: 'user',
        content: toolResultBlocks
      });
      
      // Continue conversation to get new plan
      const systemPrompt = SystemPromptBuilder.buildErrorRecoverySystemPrompt();
      const tools = this.toolRegistry.getToolDefinitions();
      
      const response = await this.claudeClient.continueConversation({
        systemPrompt,
        messages: state.messages,
        tools,
        cachedContext: state.cachedContext
      });
      
      // Add assistant response
      state.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      // Parse new plan
      const newPlan = AutomationPlanParser.parsePlan(response);
      // console.log(AutomationPlanParser.getSummary(newPlan));
      
      state.currentPlan = newPlan;
      const usage = this.claudeClient.getUsageStats(response);
      
      return { success: false, isComplete: false, usage };
    }
    
    // Check if this was an intermediate or final plan
    const planType = state.currentPlan.planType || 'final';
    
    if (planType === 'intermediate') {
      state.completedPlans.push({
        phaseNumber: state.phaseNumber,
        plan: state.currentPlan,
        stepsExecuted: state.currentPlan.totalSteps
      });
      state.phaseNumber++;
      
      return await this.continueAfterIntermediatePlan(state);
    }
    
    return { success: true, isComplete: true };
  }

  /**
   * Recover from error by asking Claude for help
   */
  private async recoverFromError(
    state: IterativeAutomationState,
    failedStep: any,
    result: ToolExecutionResult
  ): Promise<{
    success: boolean;
    isComplete: boolean;
    error?: string;
    usage?: any;
  }> {
    console.log('🔄 [IterativeAutomation] Initiating error recovery...');
    
    if (!state.currentPlan) {
      return { success: false, isComplete: true, error: 'No plan available for recovery' };
    }

    const toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    let executedCount = 0;

    for (let i = 0; i < state.currentPlan.steps.length; i++) {
      const step = state.currentPlan.steps[i];
      
      // Check if this step was executed (steps are executed in order)
      if (executedCount < state.executedSteps.length) {
        const executedStep = state.executedSteps[executedCount];
        
        // Verify this is the right step (match by tool name as a sanity check)
        if (executedStep.toolName === step.toolName) {
          // Add tool result for this executed step
          toolResults.push({
            type: 'tool_result',
            tool_use_id: step.toolUseId,
            content: executedStep.success 
              ? JSON.stringify({ 
                  success: true, 
                  message: 'Step completed successfully',
                  toolName: step.toolName
                })
              : JSON.stringify({ 
                  success: false, 
                  error: executedStep.error || executedStep.result?.error?.message || 'Unknown error',
                  toolName: step.toolName
                }),
            is_error: !executedStep.success
          });
          executedCount++;
        } else {
          // Mismatch - this step wasn't executed
          toolResults.push({
            type: 'tool_result',
            tool_use_id: step.toolUseId,
            content: JSON.stringify({ 
              success: false, 
              error: 'Step not executed - automation stopped before reaching this step',
              toolName: step.toolName
            }),
            is_error: true
          });
        }
      } else {
        // This step wasn't executed yet
        toolResults.push({
          type: 'tool_result',
          tool_use_id: step.toolUseId,
          content: JSON.stringify({ 
            success: false, 
            error: 'Step not executed - automation stopped before reaching this step',
            toolName: step.toolName
          }),
          is_error: true
        });
      }
    }

    // Build error recovery prompt
    const errorPrompt = SystemPromptBuilder.buildErrorRecoveryPrompt({
      errorInfo: {
        message: result.error?.message || 'Unknown error',
        code: result.error?.code,
        details: result.error?.details,
        suggestions: result.error?.details?.suggestions
      },
      userGoal: state.userGoal,
      failedStep: {
        stepNumber: state.executedSteps.length,
        toolName: failedStep.toolName,
        params: failedStep.input
      },
      executedSteps: state.executedSteps,
      currentUrl: result.url
    });

    // Add user message with tool results AND error prompt
    state.messages.push({
      role: 'user',
      content: [
        ...toolResults,
        {
          type: 'text',
          text: errorPrompt
        }
      ]
    });

    // Get recovery plan from Claude
    const systemPrompt = SystemPromptBuilder.buildErrorRecoverySystemPrompt();
    const tools = this.toolRegistry.getToolDefinitions();
    state.messages.forEach(message => {
      console.log("role: ", message.role);
      console.log("content: ", message.content);
    });

    const response = await this.claudeClient.continueConversation({
      systemPrompt,
      messages: state.messages,
      tools,
      cachedContext: state.cachedContext
    });

    // Add assistant response to conversation
    state.messages.push({
      role: 'assistant',
      content: response.content
    });

    // Parse new plan
    const newPlan = AutomationPlanParser.parsePlan(response);
    console.log('📋 [IterativeAutomation] Recovery plan generated:');
    // console.log(AutomationPlanParser.getSummary(newPlan));

    // Update current plan and mark as recovery mode
    state.currentPlan = newPlan;
    state.isInRecovery = true; // CRITICAL: Mark that we're executing a recovery plan

    const usage = this.claudeClient.getUsageStats(response);

    // Return to continue execution with new plan
    return { success: false, isComplete: false, usage };
  }

  /**
   * Continue conversation after context extraction
   * This is called when extract_browser_context is used mid-execution
   * Note: The tool_result for extract_browser_context is already added to messages
   * before this function is called (see executePlanWithRecovery)
   */
  private async continueAfterContextExtraction(state: IterativeAutomationState): Promise<{
    success: boolean;
    isComplete: boolean;
    error?: string;
    usage?: any;
  }> {
    console.log('🔄 [IterativeAutomation] Continuing after context extraction...');

    // Continue conversation with same system prompt
    const systemPrompt = state.recoveryAttempts > 0
      ? SystemPromptBuilder.buildErrorRecoverySystemPrompt()
      : SystemPromptBuilder.buildAutomationSystemPrompt();
    
    const tools = this.toolRegistry.getToolDefinitions();

    const response = await this.claudeClient.continueConversation({
      systemPrompt,
      messages: state.messages,
      tools,
      cachedContext: state.cachedContext
    });

    // Add assistant response to conversation
    state.messages.push({
      role: 'assistant',
      content: response.content
    });

    // Parse new plan
    const newPlan = AutomationPlanParser.parsePlan(response);
    console.log('📋 [IterativeAutomation] Plan after context extraction:');
    // console.log(AutomationPlanParser.getSummary(newPlan));

    // Update current plan
    state.currentPlan = newPlan;

    const usage = this.claudeClient.getUsageStats(response);

    // Return to continue execution
    return { success: false, isComplete: false, usage };
  }

  private async continueAfterIntermediatePlan(state: IterativeAutomationState): Promise<{
    success: boolean;
    isComplete: boolean;
    error?: string;
    usage?: any;
  }> {
    console.log('🔄 [IterativeAutomation] Continuing after intermediate plan completion...');

    if (!state.currentPlan) {
      return { success: false, isComplete: true, error: 'No plan available' };
    }

    const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = [];
    
    // Process ALL steps in the plan and create tool_result blocks
    for (let i = 0; i < state.currentPlan.steps.length; i++) {
      const step = state.currentPlan.steps[i];
      const executedStep = state.executedSteps.find(
        es => es.toolName === step.toolName && es.result
      );
      
      if (!executedStep || !executedStep.result) {
        console.error(`   ❌ Missing execution result for step: ${step.toolName}`);
        continue;
      }
      
      const result = executedStep.result;
      
      // For analysis tools, include the full context/snapshot data
      if (step.toolName === 'extract_context' || step.toolName === 'extract_browser_context') {
        const contextData = result.context || result.value;
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: step.toolUseId,
          content: JSON.stringify(contextData, null, 2)
        });
      } else {
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: step.toolUseId,
          content: JSON.stringify({
            success: true,
            message: `${step.toolName} executed successfully`,
            summary: result.effects?.summary || `Completed ${step.toolName}`
          })
        });
      }
    }

    console.log(`Submitting ${toolResultBlocks} tool_result blocks (${state.currentPlan.steps.length} steps in plan)`);

    // Build continuation prompt
    const lastCompletedPlan = state.completedPlans[state.completedPlans.length - 1];
    const continuationPrompt = SystemPromptBuilder.buildIntermediatePlanContinuationPrompt({
      userGoal: state.userGoal,
      completedPlan: {
        analysis: lastCompletedPlan.plan.analysis || '',
        stepsExecuted: lastCompletedPlan.stepsExecuted
      },
      executedSteps: state.executedSteps.map(es => ({
        stepNumber: es.stepNumber,
        toolName: es.toolName,
        success: es.success,
        summary: es.result?.effects?.summary
      })),
      extractedContext: state.executedSteps.length > 0 && state.executedSteps[state.executedSteps.length - 1].result ? {
        url: state.executedSteps[state.executedSteps.length - 1].result.url,
        interactiveElements: state.executedSteps[state.executedSteps.length - 1].result.context?.dom?.stats?.interactiveElements || 0,
        forms: state.executedSteps[state.executedSteps.length - 1].result.context?.dom?.forms?.length || 0
      } : undefined,
      currentUrl: state.executedSteps[state.executedSteps.length - 1]?.result?.url || ''
    });

    // Add user message with tool results AND continuation prompt
    state.messages.push({
      role: 'user',
      content: [
        ...toolResultBlocks,
        {
          type: 'text',
          text: continuationPrompt
        }
      ]
    });

    // Continue conversation with automation system prompt
    const systemPrompt = SystemPromptBuilder.buildAutomationSystemPrompt();
    const tools = this.toolRegistry.getToolDefinitions();

    const response = await this.claudeClient.continueConversation({
      systemPrompt,
      messages: state.messages,
      tools,
      cachedContext: state.cachedContext
    });

    // Add assistant response to conversation
    state.messages.push({
      role: 'assistant',
      content: response.content
    });

    // Parse new plan
    const newPlan = AutomationPlanParser.parsePlan(response);

    // Update current plan
    state.currentPlan = newPlan;

    const usage = this.claudeClient.getUsageStats(response);

    // Return to continue execution with new plan
    return { success: false, isComplete: false, usage };
  }

  /**
   * Accumulate usage statistics
   */
  private accumulateUsage(current: any, additional: any): any {
    return {
      inputTokens: current.inputTokens + additional.inputTokens,
      outputTokens: current.outputTokens + additional.outputTokens,
      cacheCreationTokens: current.cacheCreationTokens + additional.cacheCreationTokens,
      cacheReadTokens: current.cacheReadTokens + additional.cacheReadTokens,
      totalCost: current.totalCost + additional.totalCost
    };
  }
}
