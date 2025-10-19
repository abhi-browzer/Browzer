/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClaudeClient } from './ClaudeClient';
import { SystemPromptBuilder } from './SystemPromptBuilder';
import { AutomationPlanParser, ParsedAutomationPlan } from './AutomationPlanParser';
import { ToolRegistry } from '../automation/ToolRegistry';
import { BrowserAutomationExecutor } from '../automation/BrowserAutomationExecutor';
import { RecordingSession } from '@/shared/types/recording';
import { RecordingStore } from '../recording';

/**
 * Result of LLM automation execution
 */
export interface LLMAutomationResult {
  success: boolean;
  plan?: ParsedAutomationPlan;
  executionResults?: any[];
  error?: string;
  analysis?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number;
  };
}

/**
 * LLMAutomationService - Main service for LLM-powered browser automation
 * 
 * This service orchestrates the entire automation workflow:
 * 1. Takes user's automation goal
 * 2. Optionally takes a recorded session as reference
 * 3. Uses Claude Sonnet 4.5 to generate a complete automation plan
 * 4. Executes the plan using BrowserAutomationExecutor
 * 
 * Key features:
 * - Single-shot planning (not ReAct)
 * - Prompt caching for recorded sessions
 * - Comprehensive error handling
 * - Usage tracking and cost estimation
 */
export class LLMAutomationService {
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
   * Execute an automation task using LLM planning
   * 
   * @param userGoal - What the user wants to automate
   * @param recordedSessionId - Optional recorded session as reference
   * @returns Automation result with plan and execution details
   */
  public async executeAutomation(
    userGoal: string,
    recordedSessionId: string
  ): Promise<LLMAutomationResult> {
    console.log('🚀 [LLMAutomationService] Starting LLM automation...');
    console.log(`   Goal: ${userGoal}`);
    console.log(`   Has recording: ${!!recordedSessionId}`);

    try {
      const recordedSession = this.recordingStore.getRecording(recordedSessionId);

      // Step 2: Build system prompt
      const systemPrompt = SystemPromptBuilder.buildAutomationSystemPrompt();

      // Step 3: Build user prompt
      const userPrompt = SystemPromptBuilder.buildUserPrompt(
        userGoal,
        !!recordedSession
      );

      // Step 4: Format recorded session for caching (if provided)
      const cachedContext = SystemPromptBuilder.formatRecordedSession(recordedSession);

      // Step 5: Get available tools
      const tools = this.toolRegistry.getToolDefinitions();

      // Step 6: Generate automation plan with Claude
      const response = await this.claudeClient.createAutomationPlan({
        systemPrompt,
        userPrompt,
        tools,
        cachedContext
      });

      console.log("response: ", response);
      // Step 7: Parse the plan
      const plan = AutomationPlanParser.parsePlan(response);
      console.log(AutomationPlanParser.getSummary(plan));

      // Step 8: Validate the plan
      const validation = AutomationPlanParser.validatePlan(
        plan,
        this.toolRegistry.getToolNames()
      );

      if (!validation.valid) {
        return {
          success: false,
          plan,
          error: `Invalid automation plan: ${validation.errors.join(', ')}`,
          analysis: plan.analysis,
          usage: this.claudeClient.getUsageStats(response)
        };
      }

      // Step 9: Execute the plan
      console.log('⚙️ [LLMAutomationService] Executing automation plan...');
      const executionResults = await this.executePlan(plan);

      // Step 10: Return results
      const usage = this.claudeClient.getUsageStats(response);

      return {
        success: true,
        plan,
        executionResults,
        analysis: plan.analysis,
        usage
      };

    } catch (error: any) {
      console.error('❌ [LLMAutomationService] Automation failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute the parsed automation plan
   * 
   * This method takes the plan from Claude and executes each step
   * sequentially using the BrowserAutomationExecutor.
   */
  private async executePlan(plan: ParsedAutomationPlan): Promise<any[]> {
    const results: any[] = [];

    for (const step of plan.steps) {
      console.log(`🔧 [Step ${step.order + 1}/${plan.totalSteps}] Executing ${step.toolName}...`);

      try {
        // Execute the tool using BrowserAutomationExecutor
        const result = await this.executor.executeTool(
          step.toolName,
          step.input
        );

        // Check if the tool execution actually succeeded
        if (!result.success) {
          console.error(`   ❌ Step ${step.order + 1} failed: ${result.error?.message || 'Unknown error'}`);
          
          results.push({
            step: step.order + 1,
            toolName: step.toolName,
            success: false,
            error: result.error?.message || 'Tool execution failed',
            result
          });

          // Stop on first error
          throw new Error(`Step ${step.order + 1} (${step.toolName}) failed: ${result.error?.message || 'Unknown error'}`);
        }

        results.push({
          step: step.order + 1,
          toolName: step.toolName,
          success: true,
          result
        });

        console.log(`   ✅ Step ${step.order + 1} completed`);

      } catch (error: any) {
        console.error(`   ❌ Step ${step.order + 1} failed:`, error.message);

        results.push({
          step: step.order + 1,
          toolName: step.toolName,
          success: false,
          error: error.message
        });

        // Stop on first error
        throw new Error(`Step ${step.order + 1} (${step.toolName}) failed: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Test the LLM service without executing automation
   * 
   * This is useful for:
   * - Testing prompt engineering
   * - Debugging plan generation
   * - Estimating costs
   */
  public async testPlanGeneration(
    userGoal: string,
    recordedSession?: RecordingSession
  ): Promise<{
    success: boolean;
    plan?: ParsedAutomationPlan;
    analysis?: string;
    usage?: any;
    error?: string;
  }> {
    console.log('🧪 [LLMAutomationService] Testing plan generation (no execution)...');

    try {
      const systemPrompt = SystemPromptBuilder.buildAutomationSystemPrompt();
      const userPrompt = SystemPromptBuilder.buildUserPrompt(userGoal, !!recordedSession);
      const cachedContext = recordedSession
        ? SystemPromptBuilder.formatRecordedSession(recordedSession)
        : undefined;
      const tools = this.toolRegistry.getToolDefinitions();

      const response = await this.claudeClient.createAutomationPlan({
        systemPrompt,
        userPrompt,
        tools,
        cachedContext
      });

      const plan = AutomationPlanParser.parsePlan(response);
      const usage = this.claudeClient.getUsageStats(response);

      console.log('📋 Plan Summary:');
      console.log(AutomationPlanParser.getSummary(plan));

      return {
        success: true,
        plan,
        analysis: plan.analysis,
        usage
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
