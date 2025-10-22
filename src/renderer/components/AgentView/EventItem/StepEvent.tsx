/**
 * StepEvent Component
 * 
 * Displays automation step execution (start, complete, error)
 */

import { Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card } from '@/renderer/ui/card';
import { Badge } from '@/renderer/ui/badge';
import { cn } from '@/renderer/lib/utils';
import { EventItemProps } from '../types';

export function StepEvent({ event, isLatest }: EventItemProps) {
  const isRunning = event.type === 'step_start';
  const isSuccess = event.type === 'step_complete';
  const isError = event.type === 'step_error';

  const getStatusColor = () => {
    if (isRunning) return 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20';
    if (isSuccess) return 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20';
    if (isError) return 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
    return '';
  };

  const getIcon = () => {
    if (isRunning) return <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />;
    if (isSuccess) return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (isError) return <XCircle className="w-5 h-5 text-red-600" />;
    return <Play className="w-5 h-5" />;
  };

  const getTextColor = () => {
    if (isRunning) return 'text-yellow-900 dark:text-yellow-100';
    if (isSuccess) return 'text-green-900 dark:text-green-100';
    if (isError) return 'text-red-900 dark:text-red-100';
    return '';
  };

  return (
    <Card className={cn(
      "p-4 border-l-4",
      getStatusColor(),
      isLatest && "animate-in fade-in slide-in-from-bottom-2 duration-300"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={cn("text-sm font-medium", getTextColor())}>
              Step {event.data?.stepNumber}: {event.data?.toolName}
            </p>
            {event.data && event.data.status && (
              <Badge
                variant={
                  event.data.status === 'success' ? 'success' :
                  event.data.status === 'error' ? 'destructive' :
                  'default'
                }
                className="text-xs"
              >
                {event.data.status}
              </Badge>
            )}
          </div>

          {event.data && event.data?.reasoning && (
            <p className="text-sm text-muted-foreground mb-2">
              {event.data.reasoning}
            </p>
          )}

          {event.data && event.data?.error && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm text-red-700 dark:text-red-300">
              <p className="font-medium mb-1">Error:</p>
              <p className="text-xs">
                {typeof event.data.error === 'string' 
                  ? event.data.error 
                  : event.data.error?.message || JSON.stringify(event.data.error)}
              </p>
              {typeof event.data.error === 'object' && event.data.error?.code && (
                <p className="text-xs mt-1 opacity-75">Code: {event.data.error.code}</p>
              )}
            </div>
          )}

          {event.data && event.data?.result && (
            <div className="mt-2 text-xs text-muted-foreground">
              <details className="cursor-pointer">
                <summary className="font-medium">Result Details</summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(event.data.result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
