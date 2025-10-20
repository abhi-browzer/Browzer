/**
 * LLM Module - Claude Sonnet 4.5 powered browser automation
 * 
 * This module provides LLM-based automation planning and execution using
 * Anthropic's Claude Sonnet 4.5 model with best practices:
 * 
 * - Smart ReAct-based iterative automation with error recovery
 * - Single-shot planning for simple tasks
 * - Prompt caching for recorded sessions and conversation history
 * - Comprehensive tool use including browser context extraction
 * - Cost tracking and optimization
 */

export { ClaudeClient } from './ClaudeClient';
export { SystemPromptBuilder } from './SystemPromptBuilder';
export { AutomationPlanParser, ParsedAutomationPlan, ParsedAutomationStep } from './AutomationPlanParser';
export { IterativeAutomationService, IterativeAutomationResult } from './IterativeAutomationService';
