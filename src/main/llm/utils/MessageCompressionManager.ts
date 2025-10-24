/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk';

/**
 * MessageCompressionManager - Smart context window optimization for conversation messages
 * 
 * Compression Types:
 * 1. **Analysis Results** (extract_context, take_snapshot)
 *    - Compress ALL occurrences to minimal strings
 * 
 * 2. **Error Messages** (AUTOMATION ERROR ENCOUNTERED)
 *    - Keep ONLY the most recent error with full context
 */
export class MessageCompressionManager {
  private static readonly ANALYSIS_TOOLS = ['extract_context', 'take_snapshot'];
  private static readonly ERROR_MARKER = 'AUTOMATION ERROR ENCOUNTERED';
  
  private static readonly COMPRESSED_ANALYSIS = 
    '✅ Analysis completed successfully, full result was provided to model and has been compressed to save context';
  
  private static readonly COMPRESSED_ERROR = 
    '⚠️ Previous error compressed';

  /**
   * Check if a tool is an analysis tool
   */
  public static isAnalysisTool(toolName: string): boolean {
    return this.ANALYSIS_TOOLS.includes(toolName);
  }

  /**
   * Master compression method - applies all compression strategies
   * 
   * This is the main entry point that orchestrates all compression types.
   * Call this after the model receives new content to clean up context window.
   */
  public static compressMessages(
    messages: Anthropic.MessageParam[]
  ): {
    compressedMessages: Anthropic.MessageParam[];
    compressedCount: number;
    estimatedTokensSaved: number;
  } {
    let workingMessages = messages;
    let totalCompressed = 0;
    let totalTokensSaved = 0;

    // Apply analysis result compression
    const analysisResult = this.compressAnalysisResults(workingMessages);
    workingMessages = analysisResult.compressedMessages;
    totalCompressed += analysisResult.compressedCount;
    totalTokensSaved += analysisResult.estimatedTokensSaved;

    // Apply error message compression
    const errorResult = this.compressErrorMessages(workingMessages);
    workingMessages = errorResult.compressedMessages;
    totalCompressed += errorResult.compressedCount;
    totalTokensSaved += errorResult.estimatedTokensSaved;

    return {
      compressedMessages: workingMessages,
      compressedCount: totalCompressed,
      estimatedTokensSaved: totalTokensSaved
    };
  }

  /**
   * Compress analysis tool results in messages array
   * 
   * Strategy:
   * - Find all tool_result blocks for analysis tools
   * - Compress ALL of them to minimal strings
   * - Analysis results don't need to be retained after model processes them
   */
  private static compressAnalysisResults(
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
          block.content = this.COMPRESSED_ANALYSIS;
          
          const newSize = this.COMPRESSED_ANALYSIS.length;
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

  private static compressErrorMessages(
    messages: Anthropic.MessageParam[]
  ): {
    compressedMessages: Anthropic.MessageParam[];
    compressedCount: number;
    estimatedTokensSaved: number;
  } {
    let compressedCount = 0;
    let estimatedTokensSaved = 0;

    // Track indices of error messages
    const errorIndices: Array<{
      messageIndex: number;
      contentIndex: number;
      originalSize: number;
    }> = [];

    // Find all error messages
    messages.forEach((message, messageIndex) => {
      if (Array.isArray(message.content)) {
        message.content.forEach((block, contentIndex) => {
          if (block.type === 'text' && this.isErrorMessage(block.text)) {
            const originalSize = block.text.length;
            errorIndices.push({
              messageIndex,
              contentIndex,
              originalSize
            });
          }
        });
      } else if (typeof message.content === 'string' && this.isErrorMessage(message.content)) {
        const originalSize = message.content.length;
        errorIndices.push({
          messageIndex,
          contentIndex: -1, // Indicates string content
          originalSize
        });
      }
    });

    if (errorIndices.length <= 1) {
      // 0 or 1 error - no compression needed
      return {
        compressedMessages: messages,
        compressedCount: 0,
        estimatedTokensSaved: 0
      };
    }

    // Compress all errors EXCEPT the last one
    const compressedMessages = JSON.parse(JSON.stringify(messages)) as Anthropic.MessageParam[];
    const errorsToCompress = errorIndices.slice(0, -1); // All except last

    errorsToCompress.forEach(({ messageIndex, contentIndex, originalSize }) => {
      const message = compressedMessages[messageIndex];
      
      if (contentIndex === -1) {
        // String content
        message.content = this.COMPRESSED_ERROR;
      } else if (Array.isArray(message.content)) {
        // Array content
        const block = message.content[contentIndex];
        if (block.type === 'text') {
          block.text = this.COMPRESSED_ERROR;
        }
      }

      const newSize = this.COMPRESSED_ERROR.length;
      estimatedTokensSaved += Math.ceil((originalSize - newSize) / 4);
      compressedCount++;
    });

    return {
      compressedMessages,
      compressedCount,
      estimatedTokensSaved
    };
  }

  private static isErrorMessage(text: string): boolean {
    return text.includes(this.ERROR_MARKER);
  }
}
