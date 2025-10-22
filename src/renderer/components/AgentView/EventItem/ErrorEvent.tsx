/**
 * ErrorEvent Component
 * 
 * Displays automation errors and recovery failures
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card } from '@/renderer/ui/card';
import { cn } from '@/renderer/lib/utils';
import { EventItemProps } from '../types';

export function ErrorEvent({ event, isLatest }: EventItemProps) {
  return (
    <Card className={cn(
      "p-4 border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
      isLatest && "animate-in fade-in slide-in-from-bottom-2 duration-300"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
            {event.type === 'recovery_failed' ? 'Recovery Failed' : 'Automation Error'}
          </p>
          
          <div className="text-sm text-red-700 dark:text-red-300">
            {event.data.error || event.data.message || 'An unknown error occurred'}
          </div>

          {event.data.recoveryAttempts !== undefined && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Recovery attempts: {event.data.recoveryAttempts}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
