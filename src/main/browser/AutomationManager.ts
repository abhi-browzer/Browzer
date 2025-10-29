import { WebContentsView } from 'electron';
import { AutomationService } from '@/main/llm';
import { RecordingStore } from '@/main/recording';
import { Tab } from './types';
import { SessionManager } from '@/main/llm/session/SessionManager';

/**
 * AutomationManager - Manages LLM automation sessions
 * 
 * Responsibilities:
 * - Execute LLM-powered automation
 * - Manage automation sessions
 * - Forward progress events to renderer
 * - Load/delete automation sessions
 */
export class AutomationManager {
  private automationSessions: Map<string, AutomationService> = new Map();

  constructor(
    private recordingStore: RecordingStore,
    private sessionManager: SessionManager,
    private browserUIView?: WebContentsView
  ) {}

  /**
   * Execute LLM-powered automation on active tab
   */
  public async executeAutomation(
    activeTab: Tab,
    userGoal: string,
    recordedSessionId: string
  ): Promise<{
    success: boolean;
    sessionId: string;
    message: string;
  }> {
    if (!activeTab || !activeTab.automationExecutor) {
      throw new Error('No active tab or automation executor');
    }

    // Create AutomationService with shared SessionManager
    const llmService = new AutomationService(
      activeTab.automationExecutor,
      this.recordingStore,
      this.sessionManager,
      process.env.ANTHROPIC_API_KEY,
    );

    // Start automation execution (non-blocking)
    const automationPromise = llmService.executeAutomation(userGoal, recordedSessionId, 20);

    // Wait for session to be created
    await new Promise(resolve => setTimeout(resolve, 100));
    const sessionId = llmService.getSessionId();

    // Store service with persistent session ID
    this.automationSessions.set(sessionId, llmService);

    // Set up progress event forwarding
    llmService.on('progress', (event) => {
      if (this.browserUIView && !this.browserUIView.webContents.isDestroyed()) {
        this.browserUIView.webContents.send('automation:progress', {
          sessionId,
          event
        });
      }
    });

    // Handle automation completion/error (non-blocking)
    automationPromise
      .then(result => {
        if (this.browserUIView && !this.browserUIView.webContents.isDestroyed()) {
          this.browserUIView.webContents.send('automation:complete', {
            sessionId,
            result
          });
        }

        this.automationSessions.delete(sessionId);
      })
      .catch(error => {
        console.error('[AutomationManager] LLM automation failed:', error);
        
        if (this.browserUIView && !this.browserUIView.webContents.isDestroyed()) {
          this.browserUIView.webContents.send('automation:error', {
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        this.automationSessions.delete(sessionId);
      });

    return {
      success: true,
      sessionId,
      message: 'Automation started successfully 🎉'
    };
  }

  /**
   * Load automation session from database
   */
  public async loadAutomationSession(sessionId: string): Promise<any> {
    try {
      const sessionData = this.sessionManager.loadSession(sessionId);
      
      if (!sessionData) {
        return null;
      }
      
      // Parse messages into individual events
      const events: any[] = [];
      
      for (const msg of sessionData.messages) {
        const content = Array.isArray(msg.content) ? msg.content : [msg.content];
        
        if (msg.role === 'assistant') {
          // Assistant messages contain text blocks and tool_use blocks
          for (const block of content) {
            if (typeof block === 'object' && block !== null) {
              if (block.type === 'text') {
                // Claude's thinking/response
                events.push({
                  id: `msg_${msg.id}_text`,
                  sessionId: sessionData.session.id,
                  type: 'claude_response',
                  data: { message: block.text },
                  timestamp: msg.createdAt
                });
              } else if (block.type === 'tool_use') {
                // Tool call (step start)
                events.push({
                  id: `msg_${msg.id}_tool_${block.id}`,
                  sessionId: sessionData.session.id,
                  type: 'step_start',
                  data: {
                    toolName: block.name,
                    toolUseId: block.id,
                    input: block.input,
                    stepNumber: events.filter(e => e.type.startsWith('step_')).length + 1
                  },
                  timestamp: msg.createdAt
                });
              }
            }
          }
        } else if (msg.role === 'user') {
          // User messages contain tool_result blocks
          for (const block of content) {
            if (typeof block === 'object' && block !== null && block.type === 'tool_result') {
              // Tool result (step complete or error)
              const isError = block.is_error || false;
              const resultContent = Array.isArray(block.content) ? block.content[0] : block.content;
              const resultText = typeof resultContent === 'object' && resultContent.type === 'text' 
                ? resultContent.text 
                : typeof resultContent === 'string' ? resultContent : JSON.stringify(resultContent);
              
              // Try to parse result as JSON to extract structured data
              let parsedResult: any = null;
              try {
                parsedResult = JSON.parse(resultText);
              } catch {
                parsedResult = { message: resultText };
              }
              
              events.push({
                id: `msg_${msg.id}_result_${block.tool_use_id}`,
                sessionId: sessionData.session.id,
                type: isError ? 'step_error' : 'step_complete',
                data: {
                  toolUseId: block.tool_use_id,
                  result: parsedResult,
                  success: !isError,
                  error: isError ? parsedResult : undefined,
                  stepNumber: events.filter(e => e.type.startsWith('step_')).length
                },
                timestamp: msg.createdAt
              });
            }
          }
        }
      }
      
      // Convert to format expected by renderer
      return {
        sessionId: sessionData.session.id,
        userGoal: sessionData.session.userGoal,
        recordingId: sessionData.session.recordingId,
        status: sessionData.session.status,
        events,
        result: sessionData.session.metadata.finalSuccess,
        error: sessionData.session.metadata.finalError,
        startTime: sessionData.session.createdAt,
        endTime: sessionData.session.completedAt
      };
    } catch (error) {
      console.error('[AutomationManager] Failed to load session:', error);
      return null;
    }
  }

  /**
   * Get automation session history (limited list for sidebar)
   */
  public async getAutomationSessionHistory(limit = 5): Promise<any[]> {
    try {
      const sessions = this.sessionManager.listSessions(limit, 0);
      
      return sessions.map(session => ({
        sessionId: session.id,
        userGoal: session.userGoal,
        recordingId: session.recordingId,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messageCount,
        stepCount: session.stepCount
      }));
    } catch (error) {
      console.error('[AutomationManager] Failed to load session history:', error);
      return [];
    }
  }

  /**
   * Get all automation sessions (for automation screen)
   */
  public async getAutomationSessions(): Promise<any[]> {
    try {
      // Get all sessions (no limit)
      const sessions = this.sessionManager.listSessions(1000, 0);
      
      return sessions.map(session => ({
        sessionId: session.id,
        userGoal: session.userGoal,
        recordingId: session.recordingId,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messageCount,
        stepCount: session.stepCount
      }));
    } catch (error) {
      console.error('[AutomationManager] Failed to load sessions:', error);
      return [];
    }
  }

  /**
   * Get detailed session information
   */
  public async getAutomationSessionDetails(sessionId: string): Promise<any> {
    try {
      const session = this.sessionManager.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Return session with all available details
      return session;
    } catch (error) {
      console.error('[AutomationManager] Failed to load session details:', error);
      throw error;
    }
  }

  /**
   * Resume a paused or failed automation session
   */
  public async resumeAutomationSession(sessionId: string): Promise<any> {
    try {
      // Load the session
      const session = this.sessionManager.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // TODO: Implement resume logic
      // For now, just return the session info
      console.log('[AutomationManager] Resume session:', sessionId);
      
      return {
        success: true,
        sessionId,
        message: 'Session resume not yet implemented'
      };
    } catch (error) {
      console.error('[AutomationManager] Failed to resume session:', error);
      throw error;
    }
  }

  /**
   * Delete automation session
   */
  public async deleteAutomationSession(sessionId: string): Promise<boolean> {
    try {
      this.sessionManager.deleteSession(sessionId);
      return true;
    } catch (error) {
      console.error('[AutomationManager] Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.automationSessions.clear();
  }
}
