import { useState, useCallback } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Eye, Pause, Play, Wand2, Loader2, Save, MapPin } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { HomeScanCapture } from './HomeScanCapture';
import { PalaceRenderer } from './PalaceRenderer';
import { Palace3DTour } from './Palace3DTour';
import { VizErrorBoundary } from './VizErrorBoundary';

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  notable_features?: string[];
  floor_type?: string;
}

interface PlacedLocus {
  concept: string;
  description: string;
  mnemonic: string;
  image_url?: string;
  room_id: string;
  x: number;
  y: number;
  z: number;
  auto_placed: boolean;
}

interface FloorPlanResult {
  jobId: string;
  rooms: RoomData[];
  status: string;
}

/** Client-side auto-placement: round-robin rooms, spread along walls */
function autoPlaceLociClient(rooms: RoomData[], loci: any[]): PlacedLocus[] {
  if (!rooms.length || !loci.length) return [];
  const MAX_PER_ROOM = 5;
  const load = new Map<string, number>();

  return loci.map((locus, i) => {
    const roomIdx = i % rooms.length;
    const room = rooms[roomIdx];
    const count = (load.get(room.name) ?? 0) % MAX_PER_ROOM;
    load.set(room.name, (load.get(room.name) ?? 0) + 1);

    const side = count % 4;
    const spacing = 1 / Math.max(MAX_PER_ROOM, count + 1);
    const pos = 0.15 + spacing * (count + 0.5);

    let x: number, z: number;
    if (side === 0)      { x = pos; z = 0.15; }
    else if (side === 1) { x = 0.85; z = pos; }
    else if (side === 2) { x = 1 - pos; z = 0.85; }
    else                 { x = 0.15; z = 1 - pos; }

    return {
      concept: locus.concept,
      description: locus.description,
      mnemonic: locus.mnemonic,
      image_url: locus.image_url,
      room_id: room.name,
      x: Math.max(0.05, Math.min(0.95, x)),
      y: 0.8 + Math.random() * 1.2,
      z: Math.max(0.05, Math.min(0.95, z)),
      auto_placed: true,
    };
  });
}

export default function Palace3DViewContent() {
  const [step, setStep] = useState<'scan' | 'view'>('scan');
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | undefined>();
  const [mode, setMode] = useState<'orbit' | 'walk' | 'tour'>('orbit');
  const [fullscreen, setFullscreen] = useState(false);

  // ── Loci generation state ────────────────────────────────────
  const [studyText, setStudyText] = useState('');
  const [loci, setLoci] = useState<PlacedLocus[]>([]);
  const [isGeneratingLoci, setIsGeneratingLoci] = useState(false);
  const [lociProgress, setLociProgress] = useState({ done: 0, total: 0 });

  const { getToken } = useAuth();

  const handleScanComplete = useCallback((result: FloorPlanResult) => {
    setRooms(result.rooms);
    setStep('view');
  }, []);

  const handleSavePalace = async () => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    try {
      const token = await getToken();
      if (!token) return;
      const resp = await fetch(`${API_BASE}/palaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: 'My Home Palace',
          subject: 'General',
          lociCount: loci.length,
          loci: loci.map(l => ({ concept: l.concept, description: l.description, mnemonic: l.mnemonic })),
          spatialMap: rooms.map((r: any, i: number) => ({ id: `room-${i}`, name: r.name, x: r.x || 0, y: r.z || 0, width: r.width_m * 100, height: r.height_m * 100, connections: r.connections })),
        }),
      });
      if (resp.ok) {
        import('react-hot-toast').then(t => t.default.success('Palace saved!'));
      }
    } catch { /* save best-effort */ }
  };

  const handleTourComplete = (events: any[]) => {
    console.log('[tour] Complete:', events.length, 'loci visited');
    setMode('orbit');
  };

  const handleGenerateLoci = async () => {
    if (!studyText.trim() || !rooms.length) return;
    setIsGeneratingLoci(true);
    setLoci([]);
    const API_BASE = import.meta.env.VITE_API_URL || '/api';

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Submit study material to loci-jobs pipeline
      const resp = await fetch(`${API_BASE}/loci-jobs?topic=Study`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: studyText }),
      });
      if (!resp.ok) throw new Error('Loci generation failed');

      const { jobId, totalChunks } = await resp.json();
      setLociProgress({ done: 0, total: totalChunks });

      // Poll for completion
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollResp = await fetch(`${API_BASE}/loci-jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!pollResp.ok) continue;
        const job = await pollResp.json();
        setLociProgress({ done: job.completedChunks || 0, total: job.totalChunks || 0 });

        if (job.status === 'completed') {
          const rawLoci = (job.loci || []).map((l: any) => ({
            concept: l.name || l.concept || '',
            description: l.vivid_description || l.anchor || '',
            mnemonic: l.anchor || l.mnemonic || '',
            suggested_room: l.suggested_room,
          }));

          // Auto-place into rooms
          const autoPlaced = autoPlaceLociClient(rooms, rawLoci);
          setLoci(autoPlaced);
          return;
        }
        if (job.status === 'failed') throw new Error(job.error || 'Generation failed');
      }
      throw new Error('Generation timed out');
    } catch (e: any) {
      console.error('[loci-gen]', e);
    } finally {
      setIsGeneratingLoci(false);
    }
  };

  return (
    <VizErrorBoundary>
      <div className={fullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'max-w-6xl mx-auto p-4 space-y-4'}>
        {/* Study Material Input (shown in view mode) */}
        {step === 'view' && (
          <div className="flex gap-3 items-end p-4 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Paste study material to generate memory loci</label>
              <Textarea
                value={studyText}
                onChange={(e) => setStudyText(e.target.value)}
                placeholder="Paste your notes, textbook excerpt, or study guide here..."
                rows={3}
                className="resize-none"
                disabled={isGeneratingLoci}
              />
            </div>
            <Button
              onClick={handleGenerateLoci}
              disabled={!studyText.trim() || isGeneratingLoci}
              className="shrink-0"
            >
              {isGeneratingLoci ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Wand2 size={14} className="mr-2" /> Generate Loci</>
              )}
            </Button>
          </div>
        )}

        {/* Loci progress */}
        {isGeneratingLoci && lociProgress.total > 0 && (
          <Progress value={(lociProgress.done / lociProgress.total) * 100} className="h-1.5" />
        )}
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
              {mode !== 'tour' && loci.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleSavePalace}>
                    <Save size={14} className="mr-1" /> Save Palace
                  </Button>
                  <Button variant="default" size="sm" onClick={() => setMode('tour')}>
                    <MapPin size={14} className="mr-1" /> Start Tour
                  </Button>
                </>
              )}
              {mode !== 'tour' && (
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
              )}
              <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)}>
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
          <>
            {mode === 'tour' ? (
              <Palace3DTour
                rooms={rooms.map((r, i) => ({ ...r, x: 0, z: i * 5 }))}
                loci={loci}
                onComplete={handleTourComplete}
                onExit={() => setMode('orbit')}
              />
            ) : (
              <div className="space-y-3">
                <PalaceRenderer
                  rooms={rooms}
                  loci={loci}
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
          </>
        )}
      </div>
    </VizErrorBoundary>
  );
}
