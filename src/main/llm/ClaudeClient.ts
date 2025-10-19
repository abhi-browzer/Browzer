/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk';

/**
 * ClaudeClient - Wrapper for Anthropic Claude API
 * 
 * Configured for Claude Sonnet 4.5 with best practices:
 * - Prompt caching for recorded sessions and conversation history
 * - Tool use for browser automation
 * - Multi-turn conversations for error recovery (Smart ReAct)
 * - Context management for long-running sessions
 */
export class ClaudeClient {
  private client: Anthropic;
  private readonly model = 'claude-sonnet-4-5-20250929';
  private readonly maxTokens = 8192; // Enough for comprehensive plans

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey!
    });
  }

  /**
   * Create a single-shot automation plan
   * 
   * This method uses Claude Sonnet 4.5 to generate a complete automation plan
   * in a single response. The plan includes all tool calls needed to accomplish
   * the user's goal.
   * 
   * @param systemPrompt - System instructions for automation planning
   * @param userPrompt - User's automation request
   * @param tools - Available browser automation tools
   * @param cachedContext - Optional cached context (recorded session)
   * @returns Claude's response with the automation plan
   */
  public async createAutomationPlan(params: {
    systemPrompt: string;
    userPrompt: string;
    tools: Anthropic.Tool[];
    cachedContext?: string; // Recorded session JSON
  }): Promise<Anthropic.Message> {
    const { systemPrompt, userPrompt, tools, cachedContext } = params;

    // Build system prompt with optional cached context
    // system can be: string | Array<TextBlockParam>
    const systemBlocks: Array<Anthropic.Messages.TextBlockParam> = [];

    // Add main system instructions
    systemBlocks.push({
      type: 'text',
      text: systemPrompt
    });

    // Add cached recorded session if provided (for prompt caching)
    if (cachedContext) {
      systemBlocks.push({
        type: 'text',
        text: `\n\n${cachedContext}`, // Already formatted with XML tags
        cache_control: { type: 'ephemeral' } // Cache the recorded session (5 min default)
      });
    }

    console.log('🤖 [ClaudeClient] Creating automation plan with Sonnet 4.5...');
    console.log(`   Tools: ${tools.length}`);
    console.log(`   Cached context: ${cachedContext ? 'Yes' : 'No'}`);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemBlocks, // Array<TextBlockParam> for prompt caching
        tools: tools,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
        // Note: We're not using disable_parallel_tool_use because we want
        // the model to decide the best execution order
      });

      console.log('✅ [ClaudeClient] Plan created successfully');
      console.log(`   Stop reason: ${response.stop_reason}`);
      console.log(`   Content blocks: ${response.content.length}`);
      console.log(`   Usage: ${JSON.stringify(response.usage)}`);

      return response;

    } catch (error) {
      console.error('❌ [ClaudeClient] Failed to create automation plan:', error);
      throw error;
    }
  }

  /**
   * Continue an existing conversation with error recovery
   * 
   * This method is used for Smart ReAct-based iterative automation.
   * It maintains conversation history with prompt caching for efficiency.
   * 
   * @param params - Conversation continuation parameters
   * @returns Claude's response with updated plan or next steps
   */
  public async continueConversation(params: {
    systemPrompt: string;
    messages: Anthropic.MessageParam[]; // Full conversation history
    tools: Anthropic.Tool[];
    cachedContext?: string; // Recorded session (cached)
  }): Promise<Anthropic.Message> {
    const { systemPrompt, messages, tools, cachedContext } = params;

    // Build system prompt with caching
    const systemBlocks: Array<Anthropic.Messages.TextBlockParam> = [];

    // Add main system instructions
    systemBlocks.push({
      type: 'text',
      text: systemPrompt
    });

    // Add cached recorded session if provided (for prompt caching)
    if (cachedContext) {
      systemBlocks.push({
        type: 'text',
        text: `\n\n${cachedContext}`,
        cache_control: { type: 'ephemeral' } // Cache the recorded session
      });
    }

    console.log('🔄 [ClaudeClient] Continuing conversation with Sonnet 4.5...');
    console.log(`   Messages in history: ${messages.length}`);
    console.log(`   Tools: ${tools.length}`);
    console.log(`   Cached context: ${cachedContext ? 'Yes' : 'No'}`);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemBlocks,
        tools: tools,
        messages: messages
      });

      console.log('✅ [ClaudeClient] Conversation continued successfully');
      console.log(`   Stop reason: ${response.stop_reason}`);
      console.log(`   Content blocks: ${response.content.length}`);
      console.log(`   Usage: ${JSON.stringify(response.usage)}`);

      return response;

    } catch (error) {
      console.error('❌ [ClaudeClient] Failed to continue conversation:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics from a response
   */
  public getUsageStats(response: Anthropic.Message): {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number; // Approximate cost in USD
  } {
    const usage = response.usage as any; // SDK types may not include all cache fields
    
    // Sonnet 4.5 pricing: $3/MTok input, $15/MTok output
    // Cache write: $3.75/MTok (1.25x), Cache read: $0.30/MTok (0.1x)
    const inputCost = (usage.input_tokens / 1_000_000) * 3;
    const outputCost = (usage.output_tokens / 1_000_000) * 15;
    const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * 3.75;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * 0.30;

    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationTokens: usage.cache_creation_input_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      totalCost: inputCost + outputCost + cacheWriteCost + cacheReadCost
    };
  }
}
