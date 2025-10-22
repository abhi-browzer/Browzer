import { WebContentsView } from 'electron';
import { AutomationService } from '@/main/llm';
import { RecordingStore } from '@/main/recording';
import { Tab } from './types';

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
    private agentUIView?: WebContentsView
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

    // Create AutomationService
    const llmService = new AutomationService(
      activeTab.automationExecutor,
      this.recordingStore,
      process.env.ANTHROPIC_API_KEY
    );

    // Start automation execution (non-blocking)
    const automationPromise = llmService.executeAutomation(userGoal, recordedSessionId, 20);

    // Wait for session to be created
    await new Promise(resolve => setTimeout(resolve, 100));
    const sessionId = llmService.getSessionId();

    if (!sessionId) {
      throw new Error('Failed to create automation session');
    }

    // Store service with persistent session ID
    this.automationSessions.set(sessionId, llmService);

    // Set up progress event forwarding
    llmService.on('progress', (event) => {
      if (this.agentUIView && !this.agentUIView.webContents.isDestroyed()) {
        this.agentUIView.webContents.send('automation:progress', {
          sessionId,
          event
        });
      }
    });

    // Handle automation completion/error (non-blocking)
    automationPromise
      .then(result => {
        if (this.agentUIView && !this.agentUIView.webContents.isDestroyed()) {
          this.agentUIView.webContents.send('automation:complete', {
            sessionId,
            result
          });
        }

        this.automationSessions.delete(sessionId);
      })
      .catch(error => {
        console.error('[AutomationManager] LLM automation failed:', error);
        
        if (this.agentUIView && !this.agentUIView.webContents.isDestroyed()) {
          this.agentUIView.webContents.send('automation:error', {
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        this.automationSessions.delete(sessionId);
      });

    return {
      success: true,
      sessionId,
      message: 'Automation started successfully'
    };
  }

  /**
   * Load automation session from database
   */
  public async loadAutomationSession(sessionId: string): Promise<any> {
    try {
      const { SessionManager } = await import('@/main/llm/session/SessionManager');
      const sessionManager = new SessionManager();
      
      const sessionData = sessionManager.loadSession(sessionId);
      
      if (!sessionData) {
        return null;
      }
      
      // Convert to format expected by renderer
      return {
        sessionId: sessionData.session.id,
        userGoal: sessionData.session.userGoal,
        recordingId: sessionData.session.recordingId,
        status: sessionData.session.status,
        events: sessionData.messages.map(msg => ({
          id: `msg_${msg.id}`,
          sessionId: sessionData.session.id,
          type: msg.role === 'assistant' ? 'claude_response' : 'user_message',
          data: { message: JSON.stringify(msg.content) },
          timestamp: msg.createdAt
        })),
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
   * Get automation session history
   */
  public async getAutomationSessionHistory(limit = 5): Promise<any[]> {
    try {
      const { SessionManager } = await import('@/main/llm/session/SessionManager');
      const sessionManager = new SessionManager();
      
      const sessions = sessionManager.listSessions(limit, 0);
      
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
   * Delete automation session
   */
  public async deleteAutomationSession(sessionId: string): Promise<boolean> {
    try {
      const { SessionManager } = await import('@/main/llm/session/SessionManager');
      const sessionManager = new SessionManager();
      
      sessionManager.deleteSession(sessionId);
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
