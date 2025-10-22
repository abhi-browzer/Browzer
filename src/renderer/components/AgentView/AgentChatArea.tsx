/**
 * AgentChatArea Component
 * 
 * Main content area that displays:
 * - Session history (in new_session mode)
 * - Event stream (in existing_session mode)
 */

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/renderer/ui/scroll-area';
import { SessionHistory } from './SessionHistory';
import { EventItem } from './EventItem';
import { AgentChatAreaProps } from './types';

export function AgentChatArea({
  viewMode,
  currentSession,
  sessionHistory,
  isLoadingSession,
  isLoadingHistory,
  onSessionSelect,
}: AgentChatAreaProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (viewMode === 'existing_session' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.events, viewMode]);

  // Show session history in new_session mode
  if (viewMode === 'new_session') {
    return (
      <SessionHistory
        sessions={sessionHistory}
        isLoading={isLoadingHistory}
        onSessionSelect={onSessionSelect}
      />
    );
  }

  // Show event stream in existing_session mode
  if (viewMode === 'existing_session' && currentSession) {
    return (
      <ScrollArea className="flex-1 h-full">
        <div className="p-6 space-y-4">
          {/* User Goal */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm font-medium text-primary mb-1">Goal</p>
            <p className="text-sm">{currentSession.userGoal}</p>
          </div>

          {/* Event Stream */}
          {currentSession.events.map((event, index) => (
            <EventItem
              key={event.id}
              event={event}
              isLatest={index === currentSession.events.length - 1}
            />
          ))}

          {/* Auto-scroll anchor */}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>
    );
  }

  // Loading state
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    </div>
  );
}
