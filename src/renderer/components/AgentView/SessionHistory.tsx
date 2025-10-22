/**
 * SessionHistory Component
 * 
 * Displays list of recent automation sessions
 * Shows in "new_session" view mode
 */

import React from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, MessageSquare } from 'lucide-react';
import { Card } from '@/renderer/ui/card';
import { Badge } from '@/renderer/ui/badge';
import { ScrollArea } from '@/renderer/ui/scroll-area';
import { SessionHistoryProps } from './types';
import { cn } from '@/renderer/lib/utils';

export function SessionHistory({
  sessions,
  isLoading,
  onSessionSelect,
}: SessionHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <MessageSquare className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Select a recorded session above and describe what you want to automate to get started.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">
          Recent Sessions
        </h3>
        
        {sessions.map((session) => (
          <Card
            key={session.sessionId}
            className={cn(
              "p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
              "group"
            )}
            onClick={() => onSessionSelect(session.sessionId)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {session.userGoal}
                </p>
                
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{session.messageCount} messages</span>
                  <span>•</span>
                  <span>{session.stepCount} steps</span>
                </div>
              </div>

              <Badge
                variant={
                  session.status === 'running' ? 'default' :
                  session.status === 'completed' ? 'success' :
                  session.status === 'paused' ? 'secondary' :
                  'destructive'
                }
                className="gap-1 flex-shrink-0"
              >
                {session.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                {session.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                {session.status === 'error' && <XCircle className="w-3 h-3" />}
                {session.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
