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
 * Based on Anthropic best practices:
 * - LONG_CONTEXT_TIPS.md: Only latest context is relevant
 * - TOKEN_EFFICIENT_TOOL_USE.md: Minimize tool result sizes
 * - CONTEXT_WINDOW.md: Manage token budget efficiently
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

    // CRITICAL FIX: Compress ALL analysis results except the very last one
    // Even if there's only 1 result, we should keep it for now but be ready to compress it
    // when the next analysis tool is called
    
    if (analysisResultIndices.length === 0) {
      // No analysis results at all
      return {
        compressedMessages: messages,
        compressedCount: 0,
        estimatedTokensSaved: 0
      };
    }

    // If we have 1 or more analysis results, compress all except the last one
    // For length=1, this means we keep the 1 result (nothing to compress yet)
    // For length=2+, we compress all older ones
    // const toCompress = analysisResultIndices.slice(0, -1);
    
    // if (toCompress.length === 0) {
    //   // Only 1 analysis result exists, nothing to compress yet
    //   console.log(`✅ [AnalysisToolCompression] Found 1 analysis result, keeping it as latest`);
    //   return {
    //     compressedMessages: messages,
    //     compressedCount: 0,
    //     estimatedTokensSaved: 0
    //   };
    // }

    // We have 2+ analysis results, compress the older ones
    console.log(`🗜️  [AnalysisToolCompression] Found ${analysisResultIndices.length} analysis results, compressing ${analysisResultIndices.length} older ones`);
    
    // Create a deep copy of messages
    const compressedMessages = JSON.parse(JSON.stringify(messages)) as Anthropic.MessageParam[];

    // Compress the identified results
    analysisResultIndices.forEach(({ messageIndex, contentIndex, originalSize }) => {
      const message = compressedMessages[messageIndex];
      if (Array.isArray(message.content)) {
        const block = message.content[contentIndex];
        if (block.type === 'tool_result') {
          // Replace with compressed result
          block.content = JSON.stringify(this.COMPRESSED_RESULT);
          
          // Calculate token savings (rough estimate: 1 token ≈ 4 chars)
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

  /**
   * Check if a tool_result content is from an analysis tool
   * Analysis tools return large JSON objects with specific structures
   */
  private static isAnalysisToolResult(content: string | any): boolean {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      
      // extract_context returns: { extractedAt, tabId, url, title, dom: {...} }
      // take_snapshot returns: { success, data: { screenshot: "base64...", ... } }
      
      // Check for extract_context signature
      if (parsed.extractedAt && parsed.dom && parsed.url) {
        return true;
      }
      
      // Check for take_snapshot signature
      if (parsed.data && (parsed.data.screenshot || parsed.data.snapshot)) {
        return true;
      }
      
      // Check if it's already compressed
      if (parsed.note && parsed.note.includes('compressed')) {
        return false; // Already compressed, don't compress again
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get statistics about analysis tool usage in messages
   * Useful for debugging and monitoring
   */
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
              
              // Check if compressed
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

  /**
   * Log compression statistics for debugging
   */
  public static logCompressionStats(
    messages: Anthropic.MessageParam[],
    prefix = '📊 [AnalysisToolCompression]'
  ): void {
    const stats = this.getAnalysisToolStats(messages);
    
    if (stats.totalAnalysisResults > 0) {
      console.log(`${prefix} Analysis tool results in context:`);
      console.log(`  - Total: ${stats.totalAnalysisResults}`);
      console.log(`  - Full: ${stats.fullResults}`);
      console.log(`  - Compressed: ${stats.compressedResults}`);
      console.log(`  - Estimated tokens: ${stats.estimatedTotalTokens.toLocaleString()}`);
      
      if (stats.fullResults > 1) {
        console.warn(`⚠️  ${stats.fullResults} full analysis results detected - compression recommended!`);
      }
    }
  }
}
