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
import { Loader2, CheckCircle2, XCircle, Brain, Zap, ArrowUp, AlertCircle, Sparkles } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../lib/utils';

/**
 * Enhanced AgentView - Cursor-like Professional UI
 * 
 * Features:
 * - Cursor-style thinking/execution display
 * - Real-time step progress with animations
 * - Professional minimalist design
 * - Smooth transitions and loading states
 * - Rich context and visual feedback
 */
export default function AgentView() {
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
  
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.events]);
  
  // Load recordings
  useEffect(() => {
    loadRecordings();
  }, []);
  
  // Subscribe to automation events
  useEffect(() => {
    const unsubProgress = window.browserAPI.onAutomationProgress((data) => {
      addEvent(data.sessionId, data.event);
    });
    
    const unsubComplete = window.browserAPI.onAutomationComplete((data) => {
      completeAutomation(data.sessionId, data.result);
      setIsSubmitting(false);
    });
    
    const unsubError = window.browserAPI.onAutomationError((data) => {
      errorAutomation(data.sessionId, data.error);
      setIsSubmitting(false);
    });
    
    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [addEvent, completeAutomation, errorAutomation]);
  
  const loadRecordings = async () => {
    try {
      const allRecordings = await window.browserAPI.getAllRecordings();
      setRecordings(allRecordings);
    } catch (error) {
      console.error('[AgentView] Failed to load recordings:', error);
    }
  };
  
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
        startAutomation(userPrompt, selectedRecordingId, result.sessionId);
      } else {
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('[AgentView] Error starting automation:', error);
      setIsSubmitting(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm px-6 py-4 z-10">
        <div className="flex items-center justify-between mb-4">
          
          {currentSession && (
            <Badge variant={
              currentSession.status === 'running' ? 'default' :
              currentSession.status === 'completed' ? 'success' :
              'destructive'
            } className="gap-1.5">
              {currentSession.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {currentSession.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
              {currentSession.status === 'error' && <XCircle className="w-3 h-3" />}
              {currentSession.status}
            </Badge>
          )}
        </div>
        
        <Select
          value={selectedRecordingId || undefined}
          onValueChange={setSelectedRecording}
          disabled={currentSession?.status === 'running'}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a recorded session..." />
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
          </SelectContent>
        </Select>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-6 py-4">
        {!currentSession ? (
          <EmptyState />
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {/* User Goal */}
            <UserGoalCard goal={currentSession.userGoal} />
            
            {/* Events */}
            {currentSession.events.map((event, index) => (
              <EventCard key={event.id} event={event} index={index} />
            ))}
            
            {/* Completion */}
            {currentSession.status === 'completed' && currentSession.result && (
              <CompletionCard result={currentSession.result} />
            )}
            
            {/* Error */}
            {currentSession.status === 'error' && currentSession.error && (
              <ErrorCard error={currentSession.error} />
            )}
            
            <div ref={chatEndRef} />
          </div>
        )}
        </ScrollArea>
      </div>
      
      {/* Footer */}
      <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm px-6 py-4">
        <InputGroup>
          <InputGroupTextarea
            placeholder="Describe what you want to automate..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!selectedRecordingId || isSubmitting || currentSession?.status === 'running'}
            rows={2}
            className="resize-none"
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
 * Empty State
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center mb-4">
        <Zap className="w-8 h-8 text-purple-500" />
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
 * User Goal Card
 */
function UserGoalCard({ goal }: { goal: string }) {
  return (
    <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
          <span className="text-sm font-medium text-purple-500">You</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">Goal</p>
          <p className="text-sm text-foreground/90">{goal}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Event Card - Cursor-style
 */
function EventCard({ event, index }: { event: any; index: number }) {
  const getEventDisplay = () => {
    switch (event.type) {
      case 'claude_thinking':
        return {
          icon: <Brain className="w-4 h-4 text-purple-500 animate-pulse" />,
          title: 'Claude is thinking...',
          content: event.data.message,
          bgClass: 'bg-purple-500/5 border-purple-500/20',
          showLoader: true
        };
        
      case 'claude_response':
        return {
          icon: <Brain className="w-4 h-4 text-purple-500" />,
          title: 'Claude',
          content: event.data.message,
          bgClass: 'bg-purple-500/5 border-purple-500/20',
          metadata: event.data.reasoning
        };
        
      case 'plan_generated':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
          title: `Plan Generated (${event.data.planType})`,
          content: event.data.reasoning,
          bgClass: 'bg-green-500/5 border-green-500/20',
          metadata: `${event.data.totalSteps} steps`
        };
        
      case 'step_start':
        return {
          icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
          title: `Executing: ${event.data.toolName}`,
          content: `Step ${event.data.stepNumber} of ${event.data.totalSteps}`,
          bgClass: 'bg-blue-500/5 border-blue-500/20',
          showLoader: true,
          metadata: event.data.params ? JSON.stringify(event.data.params, null, 2) : undefined
        };
        
      case 'step_complete':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
          title: `Completed: ${event.data.toolName}`,
          content: `Step ${event.data.stepNumber} of ${event.data.totalSteps}`,
          bgClass: 'bg-green-500/5 border-green-500/20',
          metadata: event.data.duration ? `${event.data.duration}ms` : undefined
        };
        
      case 'step_error':
        return {
          icon: <XCircle className="w-4 h-4 text-red-500" />,
          title: `Failed: ${event.data.toolName}`,
          content: event.data.error?.message || 'Unknown error',
          bgClass: 'bg-red-500/5 border-red-500/20',
          metadata: `Step ${event.data.stepNumber} of ${event.data.totalSteps}`
        };
        
      case 'error_recovery_start':
        return {
          icon: <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" />,
          title: 'Recovering from error...',
          content: 'Claude is analyzing the error and generating a recovery plan',
          bgClass: 'bg-orange-500/5 border-orange-500/20',
          showLoader: true
        };
        
      default:
        return {
          icon: <Zap className="w-4 h-4 text-gray-500" />,
          title: event.type,
          content: event.data.message || JSON.stringify(event.data),
          bgClass: 'bg-muted/50 border-border'
        };
    }
  };
  
  const display = getEventDisplay();
  
  return (
    <Card 
      className={cn(
        "p-4 animate-in fade-in slide-in-from-bottom-2",
        display.bgClass
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {display.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium">{display.title}</p>
            {display.showLoader && (
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
          {display.content && (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{display.content}</p>
          )}
          {display.metadata && (
            <p className="text-xs text-muted-foreground mt-2">{display.metadata}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(event.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Completion Card
 */
function CompletionCard({ result }: { result: any }) {
  return (
    <Card className="p-4 bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium mb-2">Automation Completed Successfully</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>✓ Steps Executed: {result.totalStepsExecuted}</p>
            <p>✓ Recovery Attempts: {result.recoveryAttempts}</p>
            {result.usage && (
              <p>✓ Cost: ${result.usage.totalCost.toFixed(4)}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Error Card
 */
function ErrorCard({ error }: { error: string }) {
  return (
    <Card className="p-4 bg-gradient-to-br from-red-500/5 to-rose-500/5 border-red-500/20 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium mb-2">Automation Failed</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    </Card>
  );
}
