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
    <section className="p-3 flex-shrink-0">
       <InputGroup>
          <InputGroupTextarea
            placeholder={selectedRecordingId ? "Continue the conversation..." : "Describe what you want to automate..."}
            value={userPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled || isSubmitting}
            rows={3}
            className="resize-none"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="default"
              className="rounded-full"
              size="icon-xs"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
    </section>
  );
}
