/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseHandler } from '../core/BaseHandler';
import { ElementFinder } from '../core/ElementFinder';
import { EffectTracker } from '../core/EffectTracker';
import type { HandlerContext } from '../core/types';
import type { ToolExecutionResult, FoundElement, ElementQueryResult } from '@/shared/types';
import { existsSync } from 'fs';
import { resolve, basename } from 'path';

/**
 * Parameters for file upload operation
 */
export interface FileUploadParams {
  selector: string;
  backupSelectors?: string[];
  filePaths: string | string[]; // Absolute file path(s) to upload
  waitForElement?: number;
}

/**
 * FileUploadHandler - Handles file upload automation operations
 * 
 * Provides operations for:
 * - Single file uploads
 * - Multiple file uploads
 * - File validation and path resolution
 * 
 * This handler uses CDP's Input.setFileInputFiles command to programmatically
 * set files on file input elements, bypassing the native file chooser dialog.
 */
export class FileUploadHandler extends BaseHandler {
  private elementFinder: ElementFinder;
  private effectTracker: EffectTracker;

  constructor(context: HandlerContext) {
    super(context);
    this.elementFinder = new ElementFinder(context);
    this.effectTracker = new EffectTracker(context);
  }

  /**
   * Execute file upload operation
   */
  async execute(params: FileUploadParams): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      console.log(`[FileUploadHandler] Uploading files to: ${params.selector}`);

      // Normalize file paths to array
      const filePaths = Array.isArray(params.filePaths) ? params.filePaths : [params.filePaths];
      
      // Validate and resolve file paths
      const validatedPaths: string[] = [];
      for (const filePath of filePaths) {
        const resolvedPath = resolve(filePath);
        
        if (!existsSync(resolvedPath)) {
          return this.createErrorResult('fileUpload', startTime, {
            code: 'FILE_NOT_FOUND',
            message: `File not found: ${filePath}`,
            details: {
              attemptedPath: resolvedPath,
              suggestions: [
                'Verify the file path is correct',
                'Ensure the file exists on the system',
                'Check file permissions'
              ]
            }
          });
        }
        
        validatedPaths.push(resolvedPath);
      }

      console.log(`[FileUploadHandler] Validated ${validatedPaths.length} file(s):`, validatedPaths.map(p => basename(p)));

      const waitTime = params.waitForElement ?? 1000;
      if (waitTime > 0) await this.sleep(waitTime);

      const selectors = [params.selector, ...(params.backupSelectors || [])];
      const queryResult = await this.elementFinder.findWithCDP(selectors, true);

      if (!queryResult.found || !queryResult.nodeId || !queryResult.element) {
        return this.createErrorResult('fileUpload', startTime, {
          code: 'ELEMENT_NOT_FOUND',
          message: `Could not find file input element`,
          details: { 
            attemptedSelectors: selectors,
            suggestions: [
              'Verify the file input selector',
              'Check if the file input is visible',
              'Ensure the element has type="file"'
            ]
          }
        });
      }

      // Verify element is a file input
      if (queryResult.element.tagName !== 'INPUT' || 
          queryResult.element.attributes.type !== 'file') {
        return this.createErrorResult('fileUpload', startTime, {
          code: 'INVALID_ELEMENT',
          message: `Element is not a file input`,
          details: {
            foundElement: {
              tagName: queryResult.element.tagName,
              type: queryResult.element.attributes.type
            },
            suggestions: [
              'Ensure the selector targets an <input type="file"> element',
              'Check if the file input is rendered correctly'
            ]
          }
        });
      }

      // Check if element accepts multiple files
      const acceptsMultiple = queryResult.element.attributes.multiple !== undefined;
      if (validatedPaths.length > 1 && !acceptsMultiple) {
        console.warn('[FileUploadHandler] ⚠️ Multiple files provided but input does not have "multiple" attribute');
      }

      // Use CDP to set files on the input element
      try {
        // Get the backend node ID for the file input
        const { backendNodeId } = await this.debugger.sendCommand('DOM.describeNode', {
          nodeId: queryResult.nodeId
        });

        // Set the files using CDP Input domain
        await this.debugger.sendCommand('DOM.setFileInputFiles', {
          files: validatedPaths,
          backendNodeId: backendNodeId
        });

        console.log(`[FileUploadHandler] ✅ Files set successfully via CDP`);

        // Trigger change and input events to notify the page
        await this.view.webContents.executeJavaScript(`
          (function() {
            const input = document.querySelector(${JSON.stringify(queryResult.selector)});
            if (input) {
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          })();
        `);

      } catch (error) {
        return this.createErrorResult('fileUpload', startTime, {
          code: 'UPLOAD_FAILED',
          message: `Failed to set files on input element`,
          details: {
            error: error instanceof Error ? error.message : String(error),
            suggestions: [
              'Ensure the file input is not disabled',
              'Check if the page has restrictions on file uploads',
              'Verify CDP access is available'
            ]
          }
        });
      }

      await this.sleep(300);
      const effects = await this.effectTracker.capturePostActionEffects();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'fileUpload',
        executionTime,
        element: this.createFoundElement(queryResult),
        effects,
        value: validatedPaths.map(p => basename(p)).join(', '),
        metadata: {
          uploadedFiles: validatedPaths.map(p => ({
            path: p,
            name: basename(p)
          })),
          fileCount: validatedPaths.length,
          multiple: acceptsMultiple
        },
        timestamp: Date.now(),
        tabId: this.tabId,
        url: this.getUrl()
      };

    } catch (error) {
      return this.createErrorResult('fileUpload', startTime, {
        code: 'EXECUTION_ERROR',
        message: `File upload execution failed`,
        details: {
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Helper to create FoundElement from ElementQueryResult
   */
  private createFoundElement(queryResult: ElementQueryResult): FoundElement {
    return {
      selector: queryResult.selector,
      selectorType: queryResult.selectorType,
      tagName: queryResult.element.tagName,
      text: queryResult.element.text,
      attributes: queryResult.element.attributes,
      boundingBox: queryResult.element.boundingBox,
      isVisible: queryResult.element.isVisible,
      isEnabled: queryResult.element.isEnabled
    };
  }
}
