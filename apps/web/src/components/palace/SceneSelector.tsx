import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Film, Play, Plus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SceneData {
  id: string;
  timestampSeconds: number;
  thumbnailDataUrl: string;
  label: string;           // AI-generated concept label
  selected: boolean;
  confidence?: number;     // AI confidence in the concept
}

interface SceneSelectorProps {
  scenes: SceneData[];
  onSelect: (sceneId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onLabelChange?: (sceneId: string, label: string) => void;
  selectedCount: number;
  totalCount: number;
}

export function SceneSelector({
  scenes,
  onSelect,
  onSelectAll,
  onDeselectAll,
  onLabelChange,
  selectedCount,
  totalCount,
}: SceneSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={16} className="text-indigo-400" />
          <span className="text-sm font-medium text-white">
            {selectedCount} / {totalCount} scenes selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="text-xs px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="text-xs px-2 py-1 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Horizontal scrollable timeline */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <AnimatePresence>
          {scenes.map((scene, idx) => (
            <motion.button
              key={scene.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => onSelect(scene.id)}
              className={cn(
                'flex flex-col shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200',
                'w-[140px] hover:scale-105',
                scene.selected
                  ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : 'border-slate-700/50 hover:border-slate-600'
              )}
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-video bg-slate-800">
                {scene.thumbnailDataUrl ? (
                  <img
                    src={scene.thumbnailDataUrl}
                    alt={`Scene at ${formatTimestamp(scene.timestampSeconds)}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play size={20} className="text-slate-600" />
                  </div>
                )}

                {/* Selected checkmark */}
                {scene.selected && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}

                {/* Timestamp overlay */}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                  {formatTimestamp(scene.timestampSeconds)}
                </div>
              </div>

              {/* Label */}
              <div className="p-2 text-left">
                {onLabelChange ? (
                  <input
                    value={scene.label}
                    onChange={(e) => onLabelChange(scene.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-[11px] bg-transparent border-none text-white placeholder-slate-500 outline-none"
                    placeholder="Scene label..."
                  />
                ) : (
                  <p className="text-[11px] text-slate-300 truncate">{scene.label || `Scene ${idx + 1}`}</p>
                )}
                {scene.confidence !== undefined && (
                  <div className="mt-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.round(scene.confidence * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
