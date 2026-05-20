import { useState, useCallback } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Eye, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HomeScanCapture } from './HomeScanCapture';
import { PalaceRenderer } from './PalaceRenderer';
import { VizErrorBoundary } from './VizErrorBoundary';

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  notable_features?: string[];
  floor_type?: string;
}

interface FloorPlanResult {
  jobId: string;
  rooms: RoomData[];
  status: string;
}

export default function Palace3DViewContent() {
  const [step, setStep] = useState<'scan' | 'view'>('scan');
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | undefined>();
  const [mode, setMode] = useState<'orbit' | 'walk'>('orbit');
  const [fullscreen, setFullscreen] = useState(false);

  const handleScanComplete = useCallback((result: FloorPlanResult) => {
    setRooms(result.rooms);
    setStep('view');
  }, []);

  return (
    <VizErrorBoundary>
      <div className={fullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'max-w-6xl mx-auto p-4 space-y-4'}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'view' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('scan')}>
                <ArrowLeft size={16} className="mr-1" /> New Scan
              </Button>
            )}
            <h2 className="text-xl font-bold text-white">
              {step === 'scan' ? 'Scan Your Home' : 'Your Memory Palace'}
            </h2>
          </div>

          {step === 'view' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode(mode === 'orbit' ? 'walk' : 'orbit')}
              >
                {mode === 'orbit' ? (
                  <><Eye size={14} className="mr-1" /> Walk Mode</>
                ) : (
                  <><Pause size={14} className="mr-1" /> Orbit Mode</>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullscreen(!fullscreen)}
              >
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {step === 'scan' && (
          <HomeScanCapture
            onComplete={handleScanComplete}
            onCancel={() => window.history.back()}
          />
        )}

        {step === 'view' && rooms.length > 0 && (
          <div className="space-y-3">
            <PalaceRenderer
              rooms={rooms}
              mode={mode}
              selectedRoom={selectedRoom}
              onRoomClick={setSelectedRoom}
            />

            {/* Room legend */}
            <div className="flex flex-wrap gap-2">
              {rooms.map((room, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedRoom(room.name === selectedRoom ? undefined : room.name)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    room.name === selectedRoom
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-800/50 border-slate-700/30 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {room.name}
                  <span className="ml-1 text-slate-500">
                    ({room.width_m}m × {room.height_m}m)
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </VizErrorBoundary>
  );
}
