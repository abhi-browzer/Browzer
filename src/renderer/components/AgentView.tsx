import React, { useEffect, useRef, useState } from 'react';
import { useAutomationStore } from '../stores/automationStore';
import { RecordingSession } from '@/shared/types';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton } from '../ui/input-group';
import { Loader2, CheckCircle2, XCircle, Brain, Zap, ArrowUp } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

/**
 * AgentView - Agentic Automation Interface
 * 
 * Features:
 * - Persistent state across tab switches and sidebar toggles
 * - Real-time progress updates via IPC events
 * - Professional minimalist UI with shadcn components
 * - Auto-scrolling chat area
 * - Session-based automation tracking
 */
 export default function AgentView() {
  // Zustand store - persisted state
  const {
    currentSession,
    selectedRecordingId,
    userPrompt,
    setSelectedRecording,
    setUserPrompt,
    startAutomation,
    addEvent,
    completeAutomation,
    errorAutomation,
  } = useAutomationStore();
  
  // Local state
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.events]);
  
  // Load recordings on mount
  useEffect(() => {
    loadRecordings();
  }, []);
  
  // Subscribe to automation events
  useEffect(() => {
    // Progress events
    const unsubProgress = window.browserAPI.onAutomationProgress((data) => {
      console.log('[AgentView] Progress:', data);
      addEvent(data.sessionId, data.event);
    });
    
    // Completion events
    const unsubComplete = window.browserAPI.onAutomationComplete((data) => {
      console.log('[AgentView] Complete:', data);
      completeAutomation(data.sessionId, data.result);
      setIsSubmitting(false);
    });
    
    // Error events
    const unsubError = window.browserAPI.onAutomationError((data) => {
      console.log('[AgentView] Error:', data);
      errorAutomation(data.sessionId, data.error);
      setIsSubmitting(false);
    });
    
    // Cleanup subscriptions on unmount
    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [addEvent, completeAutomation, errorAutomation]);
  
  // Load recordings
  const loadRecordings = async () => {
    try {
      const allRecordings = await window.browserAPI.getAllRecordings();
      setRecordings(allRecordings);
    } catch (error) {
      console.error('[AgentView] Failed to load recordings:', error);
    }
  };
  
  // Handle submit
  const handleSubmit = async () => {
    if (!userPrompt.trim() || !selectedRecordingId || isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await window.browserAPI.executeLLMAutomation(
        userPrompt,
        selectedRecordingId
      );
      
      if (result.success) {
        // Start session in store
        startAutomation(userPrompt, selectedRecordingId, result.sessionId);
      } else {
        console.error('[AgentView] Failed to start automation');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('[AgentView] Error starting automation:', error);
      setIsSubmitting(false);
    }
  };
  
  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Agentic Automation</h2>
              <p className="text-sm text-muted-foreground">
                AI-powered browser automation
              </p>
            </div>
          </div>
          
          {currentSession && (
            <Badge variant={
              currentSession.status === 'running' ? 'default' :
              currentSession.status === 'completed' ? 'success' :
              'destructive'
            }>
              {currentSession.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {currentSession.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {currentSession.status === 'error' && <XCircle className="w-3 h-3 mr-1" />}
              {currentSession.status}
            </Badge>
          )}
        </div>
        
        {/* Recording Selector */}
        <div className="mt-4">
          <label className="text-sm font-medium mb-2 block">
            Select Recording Session
          </label>
          <Select
            value={selectedRecordingId || undefined}
            onValueChange={setSelectedRecording}
            disabled={currentSession?.status === 'running'}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a recorded session..." />
            </SelectTrigger>
            <SelectContent>
              {recordings.map((recording) => (
                <SelectItem key={recording.id} value={recording.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{recording.name || 'Untitled Session'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(recording.createdAt).toLocaleString()} • {recording.actionCount} actions
                    </span>
                  </div>
                </SelectItem>
              ))}
              {recordings.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No recordings found. Record a session first.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Chat Area - Scrollable */}
      <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
        {!currentSession ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {/* User Goal */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">You</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Goal</p>
                  <p className="text-sm">{currentSession.userGoal}</p>
                </div>
              </div>
            </Card>
            
            {/* Events */}
            {currentSession.events.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
            
            {/* Final Result */}
            {currentSession.status === 'completed' && currentSession.result && (
              <Card className="p-4 bg-green-500/5 border-green-500/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">Automation Completed</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Steps: {currentSession.result.totalStepsExecuted}</p>
                      <p>Recovery Attempts: {currentSession.result.recoveryAttempts}</p>
                      {currentSession.result.usage && (
                        <p>Cost: ${currentSession.result.usage.totalCost.toFixed(4)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}
            
            {/* Error */}
            {currentSession.status === 'error' && currentSession.error && (
              <Card className="p-4 bg-red-500/5 border-red-500/20">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">Automation Failed</p>
                    <p className="text-xs text-muted-foreground">{currentSession.error}</p>
                  </div>
                </div>
              </Card>
            )}
            
            <div ref={chatEndRef} />
          </div>
        )}
      </ScrollArea>
      
      {/* Footer - Fixed */}
      <div className="flex-shrink-0 border-t bg-card px-6 py-4">
        <InputGroup>
          <InputGroupTextarea
            placeholder="Describe what you want to automate..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!selectedRecordingId || isSubmitting || currentSession?.status === 'running'}
            rows={2}
          />
          <InputGroupAddon align="block-end">
            <InputGroupButton
              variant="default"
              className="rounded-full"
              size="icon-xs"
              onClick={handleSubmit}
              disabled={!userPrompt.trim() || !selectedRecordingId || isSubmitting || currentSession?.status === 'running'}
            >
              {isSubmitting || currentSession?.status === 'running' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )}
              <span className="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to submit • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Zap className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Ready to Automate</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Select a recorded session and describe what you want to automate.
        The AI agent will analyze the recording and execute the automation for you.
      </p>
    </div>
  );
}

/**
 * Event Item Component
 */
function EventItem({ event }: { event: any }) {
  const getEventIcon = () => {
    switch (event.type) {
      case 'claude_thinking':
        return <Brain className="w-4 h-4 text-purple-500 animate-pulse" />;
      case 'plan_generated':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'step_start':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'step_complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'step_error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };
  
  const getEventTitle = () => {
    switch (event.type) {
      case 'claude_thinking':
        return 'Claude is thinking...';
      case 'plan_generated':
        return 'Plan Generated';
      case 'step_start':
        return `Executing: ${event.data.toolName || 'Step'}`;
      case 'step_complete':
        return `Completed: ${event.data.toolName || 'Step'}`;
      case 'step_error':
        return `Error: ${event.data.toolName || 'Step'}`;
      case 'error_recovery':
        return 'Recovering from error...';
      case 'intermediate_continue':
        return 'Continuing automation...';
      default:
        return event.type;
    }
  };
  
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getEventIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-1">{getEventTitle()}</p>
          {event.data.message && (
            <p className="text-xs text-muted-foreground">{event.data.message}</p>
          )}
          {event.data.reasoning && (
            <p className="text-xs text-muted-foreground mt-1">{event.data.reasoning}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(event.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </Card>
  );
}
