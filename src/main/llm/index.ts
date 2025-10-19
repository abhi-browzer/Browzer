/**
 * LLM Module - Claude Sonnet 4.5 powered browser automation
 * 
 * This module provides LLM-based automation planning and execution using
 * Anthropic's Claude Sonnet 4.5 model with best practices:
 * 
 * - Single-shot planning (not ReAct)
 * - Prompt caching for recorded sessions
 * - Comprehensive tool use
 * - Cost tracking and optimization
 */

export { ClaudeClient } from './ClaudeClient';
export { SystemPromptBuilder } from './SystemPromptBuilder';
export { AutomationPlanParser, ParsedAutomationPlan, ParsedAutomationStep } from './AutomationPlanParser';
export { LLMAutomationService, LLMAutomationResult } from './LLMAutomationService';
