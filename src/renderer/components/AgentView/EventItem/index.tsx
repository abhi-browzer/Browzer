/**
 * EventItem Component
 * 
 * Router component that renders the appropriate event component
 * based on the event type
 */

import React from 'react';
import { ClaudeThinkingEvent } from './ClaudeThinkingEvent';
import { PlanGeneratedEvent } from './PlanGeneratedEvent';
import { StepEvent } from './StepEvent';
import { ErrorEvent } from './ErrorEvent';
import { ClaudeResponseEvent } from './ClaudeResponseEvent';
import { EventItemProps } from '../types';

export function EventItem({ event, isLatest }: EventItemProps) {
  switch (event.type) {
    case 'claude_thinking':
      return <ClaudeThinkingEvent event={event} isLatest={isLatest} />;
    
    case 'claude_response':
      return <ClaudeResponseEvent event={event} isLatest={isLatest} />;
    
    case 'plan_generated':
      return <PlanGeneratedEvent event={event} isLatest={isLatest} />;
    
    case 'step_start':
    case 'step_complete':
    case 'step_error':
      return <StepEvent event={event} isLatest={isLatest} />;
    
    case 'automation_error':
    case 'recovery_failed':
      return <ErrorEvent event={event} isLatest={isLatest} />;
    
    default:
      // Generic event display for unknown types
      return (
        <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
          {event.type}: {JSON.stringify(event.data)}
        </div>
      );
  }
}
