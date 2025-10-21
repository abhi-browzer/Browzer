import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AutomationProgressEvent } from '@/shared/types';

/**
 * Automation Event Item for Chat Display
 */
export interface AutomationEventItem {
  id: string;
  sessionId: string;
  type: string;
  data: any;
  timestamp: number;
}

/**
 * Automation Session State
 */
export interface AutomationSession {
  sessionId: string;
  userGoal: string;
  recordingId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  events: AutomationEventItem[];
  result?: any;
  error?: string;
  startTime: number;
  endTime?: number;
}

/**
 * Automation Store State
 */
interface AutomationStore {
  // Current session
  currentSession: AutomationSession | null;
  
  // Selected recording for new automation
  selectedRecordingId: string | null;
  
  // User input
  userPrompt: string;
  
  // Actions
  setSelectedRecording: (recordingId: string | null) => void;
  setUserPrompt: (prompt: string) => void;
  
  startAutomation: (userGoal: string, recordingId: string, sessionId: string) => void;
  addEvent: (sessionId: string, event: AutomationProgressEvent) => void;
  completeAutomation: (sessionId: string, result: any) => void;
  errorAutomation: (sessionId: string, error: string) => void;
  
  clearSession: () => void;
  resetPrompt: () => void;
}

/**
 * Automation Store with Persistence
 * 
 * This store persists the automation session state so it survives:
 * - Tab switches
 * - Sidebar toggles
 * - Component unmounts
 * 
 * The state is stored in localStorage and automatically rehydrated.
 */
export const useAutomationStore = create<AutomationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      selectedRecordingId: null,
      userPrompt: '',
      
      // Set selected recording
      setSelectedRecording: (recordingId) => {
        set({ selectedRecordingId: recordingId });
      },
      
      // Set user prompt
      setUserPrompt: (prompt) => {
        set({ userPrompt: prompt });
      },
      
      // Start new automation session
      startAutomation: (userGoal, recordingId, sessionId) => {
        const newSession: AutomationSession = {
          sessionId,
          userGoal,
          recordingId,
          status: 'running',
          events: [],
          startTime: Date.now()
        };
        
        set({ 
          currentSession: newSession,
          userPrompt: '' // Clear prompt after submission
        });
      },
      
      // Add progress event to current session
      addEvent: (sessionId, event) => {
        const { currentSession } = get();
        
        if (!currentSession || currentSession.sessionId !== sessionId) {
          return; // Ignore events from old sessions
        }
        
        // For step_complete and step_error, update the existing step_start event
        if (event.type === 'step_complete' || event.type === 'step_error') {
          const toolUseId = event.data.toolUseId;
          const existingEventIndex = currentSession.events.findIndex(
            e => e.type === 'step_start' && e.data.toolUseId === toolUseId
          );
          
          if (existingEventIndex !== -1) {
            // Update the existing event
            const updatedEvents = [...currentSession.events];
            updatedEvents[existingEventIndex] = {
              ...updatedEvents[existingEventIndex],
              type: event.type,
              data: {
                ...updatedEvents[existingEventIndex].data,
                ...event.data,
                status: event.type === 'step_complete' ? 'success' : 'error'
              },
              timestamp: event.timestamp
            };
            
            set({
              currentSession: {
                ...currentSession,
                events: updatedEvents
              }
            });
            return;
          }
        }
        
        // For other events, add as new
        const eventItem: AutomationEventItem = {
          id: `${event.data.toolUseId || sessionId}-${Date.now()}-${Math.random()}`,
          sessionId,
          type: event.type,
          data: event.data,
          timestamp: event.timestamp
        };
        
        set({
          currentSession: {
            ...currentSession,
            events: [...currentSession.events, eventItem]
          }
        });
      },
      
      // Mark automation as completed
      completeAutomation: (sessionId, result) => {
        const { currentSession } = get();
        
        if (!currentSession || currentSession.sessionId !== sessionId) {
          return;
        }
        
        set({
          currentSession: {
            ...currentSession,
            status: 'completed',
            result,
            endTime: Date.now()
          }
        });
      },
      
      // Mark automation as errored
      errorAutomation: (sessionId, error) => {
        const { currentSession } = get();
        
        if (!currentSession || currentSession.sessionId !== sessionId) {
          return;
        }
        
        set({
          currentSession: {
            ...currentSession,
            status: 'error',
            error,
            endTime: Date.now()
          }
        });
      },
      
      // Clear current session
      clearSession: () => {
        set({ currentSession: null });
      },
      
      // Reset prompt only
      resetPrompt: () => {
        set({ userPrompt: '' });
      }
    }),
    {
      name: 'automation-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        currentSession: state.currentSession,
        selectedRecordingId: state.selectedRecordingId
        // Don't persist userPrompt - it should be cleared
      })
    }
  )
);
