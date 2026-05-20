import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, Film, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { SceneData } from './SceneSelector';

interface VideoUploaderProps {
  onScenesExtracted: (scenes: SceneData[]) => void;
  onUploadStart?: () => void;
  onUploadComplete?: (videoId: string) => void;
  onError?: (error: string) => void;
}

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const SCENE_INTERVAL_SECONDS = 8; // Extract scene every 8 seconds

export function VideoUploader({
  onScenesExtracted,
  onUploadStart,
  onUploadComplete,
  onError,
}: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractScenesClientSide = useCallback(async (file: File): Promise<SceneData[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));

      video.preload = 'metadata';
      video.muted = true;

      const scenes: SceneData[] = [];

      video.onloadedmetadata = async () => {
        const duration = video.duration;
        const timestamps: number[] = [];
        for (let t = 1; t < duration; t += SCENE_INTERVAL_SECONDS) {
          timestamps.push(t);
        }
        // Always include last frame
        if (timestamps[timestamps.length - 1] !== Math.floor(duration)) {
          timestamps.push(Math.floor(duration) - 1);
        }

        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;

        for (const ts of timestamps) {
          await new Promise<void>((seekResolve) => {
            video.currentTime = ts;
            video.onseeked = () => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              scenes.push({
                id: `scene-${ts}`,
                timestampSeconds: ts,
                thumbnailDataUrl: dataUrl,
                label: '',
                selected: true,
                confidence: 0.5,
              });
              seekResolve();
            };
          });
        }

        resolve(scenes);
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi)$/i)) {
      toast.error('Unsupported video format. Please use MP4, WebM, MOV, or AVI.');
      onError?.('unsupported_format');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 200MB.`);
      onError?.('file_too_large');
      return;
    }

    setFileName(file.name);
    onUploadStart?.();

    try {
      // Step 1: Upload to R2
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^.]+$/, ''));
      formData.append('fileSize', String(file.size));

      const result = await api.upload<{ id: string; key: string; publicUrl: string }>('/uploads/video', formData);
      setVideoId(result.id);
      setUploadProgress(100);
      setUploading(false);
      onUploadComplete?.(result.id);

      // Step 2: Extract scenes client-side
      setExtracting(true);
      toast.loading('Extracting scenes from video...', { id: 'extract-scenes' });

      const scenes = await extractScenesClientSide(file);
      toast.success(`Extracted ${scenes.length} scenes`, { id: 'extract-scenes' });
      setExtracting(false);

      // Step 3: Send scene metadata to server
      try {
        await api.post(`/uploads/videos/${result.id}/scenes`, {
          scenes: scenes.map(s => ({
            timestampSeconds: s.timestampSeconds,
            label: s.label,
          })),
        });
      } catch (err) {
        console.warn('Failed to save scene metadata:', err);
        // Non-critical — scenes exist client-side
      }

      onScenesExtracted(scenes);
    } catch (err: any) {
      setUploading(false);
      setExtracting(false);
      const msg = err.message || 'Upload failed';
      toast.error(msg);
      onError?.(msg);
    }
  }, [onScenesExtracted, onUploadStart, onUploadComplete, onError, extractScenesClientSide]);

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!videoId ? (
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
          style={{
            borderColor: 'var(--xb-border)',
            backgroundColor: 'var(--xb-surface)',
          }}
        >
          {uploading ? (
            <div className="space-y-3">
              <Loader2 size={32} className="animate-spin mx-auto" style={{ color: 'var(--xb-accent)' }} />
              <p className="text-sm text-slate-300">Uploading {fileName}...</p>
              <div className="w-full max-w-xs mx-auto h-2 rounded-full bg-slate-700 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: 'var(--xb-accent)' }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ type: 'spring', stiffness: 100 }}
                />
              </div>
              <p className="text-xs text-slate-500">{uploadProgress}%</p>
            </div>
          ) : extracting ? (
            <div className="space-y-3">
              <Film size={32} className="animate-pulse mx-auto" style={{ color: 'var(--xb-accent)' }} />
              <p className="text-sm text-slate-300">Extracting scenes...</p>
              <p className="text-xs text-slate-500">Capturing frames every {SCENE_INTERVAL_SECONDS}s</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload size={32} className="mx-auto text-slate-500" />
              <div>
                <p className="text-sm text-slate-300 font-medium">Upload Lecture Video</p>
                <p className="text-xs text-slate-500 mt-1">MP4, WebM, MOV, or AVI — up to 200MB</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--xb-surface-hover)', color: 'var(--xb-text-secondary)' }}>
                  MP4
                </span>
                <span className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--xb-surface-hover)', color: 'var(--xb-text-secondary)' }}>
                  WebM
                </span>
                <span className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--xb-surface-hover)', color: 'var(--xb-text-secondary)' }}>
                  MOV
                </span>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ backgroundColor: 'var(--xb-surface)', border: '1px solid var(--xb-border)' }}
        >
          <Film size={20} className="text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{fileName}</p>
            <p className="text-xs text-slate-500">Upload complete • Extracting scenes...</p>
          </div>
          <button
            onClick={() => {
              setVideoId(null);
              setFileName('');
              setUploadProgress(0);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="text-xs px-2 py-1 rounded text-slate-400 hover:text-white transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
