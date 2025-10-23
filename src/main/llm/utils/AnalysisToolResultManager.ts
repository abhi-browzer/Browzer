/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk';

/**
 * AnalysisToolResultManager - Smart context window optimization for analysis tools
 * 
 * Problem:
 * - extract_context and take_snapshot return HUGE JSON payloads (10K-50K+ tokens each)
 * - These results accumulate in message history across intermediate plans
 * - Context window explodes exponentially, hitting 200K limit quickly
 * 
 * Solution:
 * - Only the LATEST analysis tool result contains full data
 * - All previous analysis results are compressed to minimal strings
 * - Compression happens immediately after model receives the full result
 * 
 */
export class AnalysisToolResultManager {
  // Analysis tools that return large payloads
  private static readonly ANALYSIS_TOOLS = ['extract_context', 'take_snapshot'];
  
  // Compressed replacement for old analysis results
  private static readonly COMPRESSED_RESULT = {
    success: true,
    message: 'Analysis completed successfully',
    note: 'Full result was provided to model and has been compressed to save context'
  };

  /**
   * Check if a tool is an analysis tool
   */
  public static isAnalysisTool(toolName: string): boolean {
    return this.ANALYSIS_TOOLS.includes(toolName);
  }

  /**
   * Compress analysis tool results in messages array
   * 
   * Strategy:
   * 1. Find all tool_result blocks for analysis tools
   * 2. Keep the LAST one with full data
   * 3. Replace all others with minimal compressed result
   * 
   * This is called AFTER the model has received the latest result,
   * so we're not losing any information - just cleaning up old noise.
   */
  public static compressAnalysisResults(
    messages: Anthropic.MessageParam[]
  ): {
    compressedMessages: Anthropic.MessageParam[];
    compressedCount: number;
    estimatedTokensSaved: number;
  } {
    let compressedCount = 0;
    let estimatedTokensSaved = 0;

    // Track the indices of analysis tool results
    const analysisResultIndices: Array<{
      messageIndex: number;
      contentIndex: number;
      toolUseId: string;
      originalSize: number;
    }> = [];

    // First pass: Find all analysis tool results
    messages.forEach((message, messageIndex) => {
      if (message.role === 'user' && Array.isArray(message.content)) {
        message.content.forEach((block, contentIndex) => {
          if (block.type === 'tool_result') {
            // Check if this is an analysis tool result by examining content
            const isAnalysisResult = this.isAnalysisToolResult(block.content);
            
            if (isAnalysisResult) {
              const originalSize = JSON.stringify(block.content).length;
              analysisResultIndices.push({
                messageIndex,
                contentIndex,
                toolUseId: block.tool_use_id,
                originalSize
              });
            }
          }
        });
      }
    });

    if (analysisResultIndices.length === 0) {
      return {
        compressedMessages: messages,
        compressedCount: 0,
        estimatedTokensSaved: 0
      };
    }
    
    const compressedMessages = JSON.parse(JSON.stringify(messages)) as Anthropic.MessageParam[];
    analysisResultIndices.forEach(({ messageIndex, contentIndex, originalSize }) => {
      const message = compressedMessages[messageIndex];
      if (Array.isArray(message.content)) {
        const block = message.content[contentIndex];
        if (block.type === 'tool_result') {
          block.content = JSON.stringify(this.COMPRESSED_RESULT);
          
          const newSize = JSON.stringify(this.COMPRESSED_RESULT).length;
          estimatedTokensSaved += Math.ceil((originalSize - newSize) / 4);
          compressedCount++;
        }
      }
    });

    return {
      compressedMessages,
      compressedCount,
      estimatedTokensSaved
    };
  }

  private static isAnalysisToolResult(content: string | any): boolean {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      
      if (parsed.extractedAt && parsed.dom && parsed.url) {
        return true;
      }
      
      if (parsed.data && parsed.data.snapshot) {
        return true;
      }
      
      if (parsed.note && parsed.note.includes('compressed')) {
        return false;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  public static getAnalysisToolStats(messages: Anthropic.MessageParam[]): {
    totalAnalysisResults: number;
    compressedResults: number;
    fullResults: number;
    estimatedTotalTokens: number;
  } {
    let totalAnalysisResults = 0;
    let compressedResults = 0;
    let fullResults = 0;
    let estimatedTotalTokens = 0;

    messages.forEach(message => {
      if (message.role === 'user' && Array.isArray(message.content)) {
        message.content.forEach(block => {
          if (block.type === 'tool_result') {
            const isAnalysis = this.isAnalysisToolResult(block.content);
            
            if (isAnalysis) {
              totalAnalysisResults++;
              const size = JSON.stringify(block.content).length;
              estimatedTotalTokens += Math.ceil(size / 4);
              
              try {
                const parsed = typeof block.content === 'string' 
                  ? JSON.parse(block.content) 
                  : block.content;
                if (parsed.note && parsed.note.includes('compressed')) {
                  compressedResults++;
                } else {
                  fullResults++;
                }
              } catch {
                fullResults++;
              }
            }
          }
        });
      }
    });

    return {
      totalAnalysisResults,
      compressedResults,
      fullResults,
      estimatedTotalTokens
    };
  }
}
