/**
 * AgentChatArea Component
 * 
 * Main content area that displays:
 * - Session history (in new_session mode)
 * - Event stream (in existing_session mode)
 */

import React, { useRef, useEffect } from 'react';
import { SessionHistory } from './SessionHistory';
import { EventItem } from './EventItem';
import { AgentChatAreaProps } from './types';

export function AgentChatArea({
  viewMode,
  currentSession,
  sessionHistory,
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
      <div className="flex-1 overflow-y-auto w-full">
        <div className="px-6 py-4 space-y-3 max-w-4xl mx-auto">
          {/* User Goal */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 sticky top-0 z-10">
            <p className="text-sm font-medium text-primary mb-1">Goal</p>
            <p className="text-sm">{currentSession.userGoal}</p>
          </div>

          {/* Event Stream */}
          <div className="space-y-2">
            {currentSession.events.map((event, index) => (
              <EventItem
                key={event.id}
                event={event}
                isLatest={index === currentSession.events.length - 1}
              />
            ))}
          </div>

          {/* Auto-scroll anchor */}
          <div ref={chatEndRef} className="h-1" />
        </div>
      </div>
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
