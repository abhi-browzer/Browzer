/**
 * AgentFooter Component
 * 
 * Input area for user prompts with:
 * - Textarea for multi-line input
 * - Submit button
 * - Keyboard shortcuts (Enter to submit, Shift+Enter for new line)
 */

import React from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton } from '@/renderer/ui/input-group';
import { AgentFooterProps } from './types';

export function AgentFooter({
  userPrompt,
  selectedRecordingId,
  isSubmitting,
  isDisabled,
  onPromptChange,
  onSubmit,
}: AgentFooterProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const canSubmit = userPrompt.trim() && selectedRecordingId && !isSubmitting && !isDisabled;

  return (
    <div className="flex-shrink-0 border-t bg-card/30 backdrop-blur-sm p-1">
      <InputGroup>
        <InputGroupTextarea
          value={userPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to automate..."
          disabled={isDisabled || isSubmitting}
          rows={3}
          className="resize-none"
        />
        <InputGroupAddon align='inline-end'>
          <InputGroupButton
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-full w-10 h-10 p-0"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowUp className="w-5 h-5" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
