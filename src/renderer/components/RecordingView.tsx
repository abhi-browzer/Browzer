import { useState, useEffect } from 'react';
import { Circle, Clock, SparkleIcon } from 'lucide-react';
import { RecordedAction, RecordingSession } from '@/shared/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/renderer/ui/tabs';
import { LiveRecordingView, SessionsListView } from './recording';
import { toast } from 'sonner';
import { cn } from '@/renderer/lib/utils';
import AgentView from './AgentView';
import { Button } from '../ui/button';

export function RecordingView() {
  const [recordingTab, setRecordingTab] = useState('live');
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [recordingData, setRecordingData] = useState<{ 
    actions: RecordedAction[]; 
    duration: number; 
    startUrl: string 
  } | null>(null);

  useEffect(() => {
    // Initialize state
    window.browserAPI.isRecording().then(setIsRecording);
    loadSessions();

    // Setup event listeners
    const unsubStart = window.browserAPI.onRecordingStarted(() => {
      setIsRecording(true);
      setActions([]);
      setShowSaveForm(false);
      setRecordingTab('live');
    });

    const unsubStop = window.browserAPI.onRecordingStopped((data) => {
      setIsRecording(false);
      setRecordingData(data);
      if (data.actions && data.actions.length > 0) {
        setShowSaveForm(true);
      }
    });

    const unsubAction = window.browserAPI.onRecordingAction((action: RecordedAction) => {
      setActions(prev => {
        // Check for duplicates based on timestamp and type
        const isDuplicate = prev.some(a => 
          a.timestamp === action.timestamp && 
          a.type === action.type &&
          JSON.stringify(a.target) === JSON.stringify(action.target)
        );
        
        if (isDuplicate) {
          console.warn('Duplicate action detected, skipping:', action);
          return prev;
        }
        
        // Add new action and sort by timestamp (newest first)
        const updated = [...prev, action];
        return updated.sort((a, b) => b.timestamp - a.timestamp);
      });
    });

    const unsubSaved = window.browserAPI.onRecordingSaved(() => {
      setActions([]);
      loadSessions();
    });

    const unsubDeleted = window.browserAPI.onRecordingDeleted(() => {
      setActions([]);
      loadSessions();
    });
    
    return () => {
      unsubStart();
      unsubStop();
      unsubAction();
      unsubSaved();
      unsubDeleted();
    };
  }, []);

  const loadSessions = async () => {
    const allSessions = await window.browserAPI.getAllRecordings();
    setSessions(allSessions);
  };

  const handleSaveRecording = async (name: string, description: string) => {
    if (recordingData) {
      await window.browserAPI.saveRecording(name, description, recordingData.actions);
      setShowSaveForm(false);
      setRecordingData(null);
      setActions([]);
      setRecordingTab('sessions');
    }
  };

  const handleDiscardRecording = () => {
    setShowSaveForm(false);
    setRecordingData(null);
    setActions([]);
  };

  const handleDeleteSession = async (id: string) => {
    const confirmed = confirm('Are you sure you want to delete this recording? This action cannot be undone.');
    if (confirmed) {
      await window.browserAPI.deleteRecording(id);
      toast.success('Recording deleted successfully');
    }
  };

  return (
    <Tabs value={recordingTab} onValueChange={setRecordingTab} className='h-full'>
      <TabsList className="w-full rounded-none border-b p-0 h-auto">
        <TabsTrigger 
          value="live" 
        >
          <Circle className={cn('size-3 rounded-full bg-red-300', isRecording && 'bg-red-600 animate-pulse')} />
          Live
        </TabsTrigger>
         <TabsTrigger 
          value="automation" 
        >
          <SparkleIcon className='size-3 text-primary' />
          Automation
        </TabsTrigger>
        <TabsTrigger 
          value="sessions"
        >
          <Clock className="w-3 h-3 mr-1.5" />
          Sessions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="live">
        <LiveRecordingView 
          actions={actions} 
          isRecording={isRecording}
          showSaveForm={showSaveForm}
          recordingData={recordingData}
          onSave={handleSaveRecording}
          onDiscard={handleDiscardRecording}
        />
      </TabsContent>

      <TabsContent value="automation" className="p-4 space-y-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">🧪 Viewport Context Extraction Tester</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Test the new viewport-based context extraction. Results save to Desktop.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={async () => {
                toast.info('Extracting current viewport...');
                const result = await window.browserAPI.extractViewportContextAndDownload('current', 200);
                if (result.success) {
                  toast.success(`✅ Extracted ${result.elementCount} elements\nSaved to: ${result.filePath}`);
                } else {
                  toast.error(`❌ Failed: ${result.error}`);
                }
              }}
              className="px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              📍 Current Viewport
            </Button>

            <Button
              onClick={async () => {
                toast.info('Scrolling to top...');
                const result = await window.browserAPI.extractViewportContextAndDownload('top', 200);
                if (result.success) {
                  toast.success(`✅ Extracted ${result.elementCount} elements\nSaved to: ${result.filePath}`);
                } else {
                  toast.error(`❌ Failed: ${result.error}`);
                }
              }}
              className="px-3 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
            >
              ⬆️ Top of Page
            </Button>

            <Button
              onClick={async () => {
                toast.info('Scrolling to bottom...');
                const result = await window.browserAPI.extractViewportContextAndDownload('bottom', 200);
                if (result.success) {
                  toast.success(`✅ Extracted ${result.elementCount} elements\nSaved to: ${result.filePath}`);
                } else {
                  toast.error(`❌ Failed: ${result.error}`);
                }
              }}
              className="px-3 py-2 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded"
            >
              ⬇️ Bottom of Page
            </Button>

            <Button
              onClick={async () => {
                toast.info('Scrolling to position 500px...');
                const result = await window.browserAPI.extractViewportContextAndDownload(500, 200);
                if (result.success) {
                  toast.success(`✅ Extracted ${result.elementCount} elements\nSaved to: ${result.filePath}`);
                } else {
                  toast.error(`❌ Failed: ${result.error}`);
                }
              }}
              className="px-3 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded"
            >
              📏 Position 500px
            </Button>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              💾 Files saved to: <code className="text-xs bg-muted px-1 py-0.5 rounded">~/Desktop/viewport-context-*.json</code>
            </p>
          </div>

          <div className="pt-2 border-t">
            <h4 className="text-xs font-semibold mb-2">Full Context (All Elements)</h4>
            <Button
              onClick={async () => {
                toast.info('Extracting full page context...');
                const result = await window.browserAPI.extractAndDownloadContext({ maxInteractiveElements: 200 });
                if (result.success) {
                  toast.success(`✅ Full context extracted\nSaved to: ${result.filePath}`);
                } else {
                  toast.error(`❌ Failed: ${result.error}`);
                }
              }}
              className="px-3 py-2 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded w-full"
            >
              📄 Extract Full Page (Compare)
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="sessions" className="flex-1 m-0 p-0">
        <SessionsListView
          sessions={sessions} 
          onRefresh={loadSessions}
          onDelete={handleDeleteSession}
        />
      </TabsContent>
    </Tabs>
  );
}
