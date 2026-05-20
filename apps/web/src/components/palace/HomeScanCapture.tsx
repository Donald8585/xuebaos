import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Video, Camera, Upload, Check, Loader2, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import toast from 'react-hot-toast';
import { sampleFrames } from '@/lib/frame-sampler';

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
  error?: string;
}

interface Props {
  palaceId?: string;
  onComplete: (result: FloorPlanResult) => void;
  onCancel: () => void;
}

const TARGET_FRAMES = 16;
const MAX_VIDEO_SECONDS = 90;

export function HomeScanCapture({ palaceId, onComplete, onCancel }: Props) {
  const { getToken } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<'idle' | 'capturing' | 'extracting' | 'done'>('idle');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: TARGET_FRAMES });
  const [result, setResult] = useState<FloorPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || '/api';

  const handleFileSelected = useCallback((file: File) => {
    if (file.size > 200 * 1024 * 1024) {
      toast.error('Video too large — max 200MB');
      return;
    }
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setStage('capturing');
    setError(null);
  }, []);

  const captureFrames = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return [];

    setStage('extracting');
    setProgress({ current: 0, total: TARGET_FRAMES });

    try {
      const result = await sampleFrames({
        canvas,
        video,
        targetFrames: TARGET_FRAMES,
        minQuality: 0.12,
        sceneChangeThreshold: 0.10,
      });

      const dataUrls = result.map(f => f.dataUrl);
      setFrames(dataUrls);
      setProgress({ current: dataUrls.length, total: TARGET_FRAMES });
      console.log(`[HomeScanCapture] Sampled ${dataUrls.length} frames (${result.filter(f => f.isSceneChange).length} scene changes)`);
      return dataUrls;
    } catch (e) {
      console.error('[HomeScanCapture] Frame sampling failed:', e);
      return [];
    }
  }, []);

  const submitForExtraction = useCallback(async (capturedFrames: string[]) => {
    setStage('extracting');
    setError(null);
    const startedAt = Date.now();

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Submit frames — server processes inline and returns result directly
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

      try {
        const resp = await fetch(`${API_BASE}/floor-plan-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ frames: capturedFrames, palaceId }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await resp.json();

        if (resp.ok && data.rooms) {
          // Success — direct response with rooms
          const finalResult: FloorPlanResult = {
            jobId: data.jobId || '',
            rooms: data.rooms || [],
            status: 'ready',
          };
          setResult(finalResult);
          setStage('done');
          console.log(`[HomeScanCapture] Got ${finalResult.rooms.length} rooms in ${Date.now() - startedAt}ms`);
          onComplete(finalResult);
          return;
        }

        // Error from server
        const code = data.code || 'EXTRACTION_FAILED';
        throw new Error(`[${code}] ${data.detail || data.error || 'Floor plan extraction failed'}`);

      } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') {
          throw new Error('API_TIMEOUT: Floor plan extraction timed out after 90s');
        }
        throw fetchErr;
      }

    } catch (e: any) {
      const msg = e.message || 'Floor plan extraction failed';
      setError(msg);
      setStage('idle');
      toast.error(msg);
      console.error('[HomeScanCapture]', msg);
    }
  }, [getToken, API_BASE, palaceId, onComplete]);

  const handleStart = async () => {
    if (!videoRef.current) return;
    const captured = await captureFrames();
    if (captured?.length) {
      await submitForExtraction(captured);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video size={20} />
          Scan Your Home
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Privacy consent ──────────────────────────────────── */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Shield size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-medium text-amber-400 mb-1">Privacy Notice</p>
            <p>Your home video is processed on US-based GPU servers (Replicate/OpenAI).</p>
            <p>Video frames are deleted immediately after floor plan extraction.</p>
            <p>The resulting floor plan (room names + dimensions) contains no PII.</p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 accent-indigo-500"
              />
              <span>I consent to AI processing my home video; data deleted after 7 days</span>
            </label>
          </div>
        </div>

        {/* ── Video input ─────────────────────────────────────── */}
        {!videoUrl && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
            />
            <Button
              variant="outline"
              className="w-full h-32 border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload size={32} />
                <span>Upload home walkthrough video</span>
                <span className="text-xs">MP4, WebM, or MOV • 15-90 seconds • Max 200MB</span>
              </div>
            </Button>
          </div>
        )}

        {/* ── Video preview ───────────────────────────────────── */}
        {videoUrl && (
          <div className="space-y-3">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full rounded-lg max-h-64 bg-black"
              controls
              preload="metadata"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Frame capture progress */}
            {progress.current > 0 && (
              <div className="space-y-1">
                <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                <p className="text-xs text-slate-400 text-center">
                  Captured frame {progress.current} of {progress.total}
                </p>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {/* Result display */}
            {result && stage === 'done' && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-400 flex items-center gap-1">
                  <Check size={16} /> Floor plan extracted — {result.rooms.length} rooms detected
                </p>
                <ul className="mt-2 space-y-1">
                  {result.rooms.map((room, i) => (
                    <li key={i} className="text-xs text-slate-400 flex justify-between">
                      <span>{room.name}</span>
                      <span>{room.width_m}m × {room.height_m}m</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {stage === 'capturing' && (
                <Button
                  onClick={handleStart}
                  disabled={!consented}
                  className="flex-1"
                >
                  {consented ? (
                    <><Camera size={16} className="mr-2" /> Scan & Extract Floor Plan</>
                  ) : (
                    <><Shield size={16} className="mr-2" /> Consent Required to Continue</>
                  )}
                </Button>
              )}
              {stage === 'extracting' && (
                <Button disabled className="flex-1">
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Analyzing rooms with AI...
                </Button>
              )}
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
