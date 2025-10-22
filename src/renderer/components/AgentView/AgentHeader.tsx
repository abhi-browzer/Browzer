/**
 * AgentHeader Component
 * 
 * Header section with:
 * - Recording session selector (disabled in existing session)
 * - New session button (visible in existing session)
 * - Status badge
 */

import React from 'react';
import { Plus, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/renderer/ui/select';
import { Button } from '@/renderer/ui/button';
import { Badge } from '@/renderer/ui/badge';
import { AgentHeaderProps } from './types';

export function AgentHeader({
  viewMode,
  selectedRecordingId,
  recordings,
  currentSession,
  onRecordingSelect,
  onNewSession,
  isDisabled,
}: AgentHeaderProps) {
  const isExistingSession = viewMode === 'existing_session';

  return (
    <div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm px-4 py-2 z-16 sticky top-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Agent</h2>
          
          {currentSession && (
            <Badge
              variant={
                currentSession.status === 'running' ? 'default' :
                currentSession.status === 'completed' ? 'success' :
                'destructive'
              }
              className="gap-1.5"
            >
              {currentSession.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {currentSession.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
              {currentSession.status === 'error' && <XCircle className="w-3 h-3" />}
              {currentSession.status}
            </Badge>
          )}
        </div>
        <Button
            variant="ghost"
            size="sm"
            onClick={onNewSession}
            className="gap-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            New Session
        </Button>
      </div>

      <Select
        value={selectedRecordingId || undefined}
        onValueChange={onRecordingSelect}
        disabled={isDisabled || isExistingSession}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a recorded session..." />
        </SelectTrigger>
        <SelectContent>
          {recordings.map((recording) => (
            <SelectItem key={recording.id} value={recording.id}>
              <div className="flex flex-col items-start">
                <span className="font-medium">{recording.name}</span>
                {recording.description && (
                  <span className="text-xs text-muted-foreground">
                    {recording.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
