import { useCallback, useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocusItem {
  id: string;
  concept: string;
  position: { x: number; y: number };
}

interface DraggableLocusProps {
  locus: LocusItem;
  moveLocus: (id: string, x: number, y: number) => void;
}

function DraggableLocus({ locus, moveLocus }: DraggableLocusProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'locus',
    item: { id: locus.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [locus.id]);

  return (
    <div
      ref={drag}
      className={cn(
        'absolute px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-xs text-white flex items-center gap-1.5 cursor-move select-none transition-opacity',
        isDragging && 'opacity-50'
      )}
      style={{ left: locus.position.x, top: locus.position.y }}
    >
      <GripVertical size={12} className="text-slate-500" />
      <span className="truncate max-w-[120px]">{locus.concept}</span>
    </div>
  );
}

interface PalaceCanvasProps {
  loci: LocusItem[];
  onLociChange: (loci: LocusItem[]) => void;
}

export function PalaceCanvas({ loci, onLociChange }: PalaceCanvasProps) {
  const [, drop] = useDrop(() => ({
    accept: 'locus',
    drop: (item: { id: string }, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta) {
        const locus = loci.find((l) => l.id === item.id);
        if (locus) {
          const newLoci = loci.map((l) =>
            l.id === item.id
              ? { ...l, position: { x: l.position.x + delta.x, y: l.position.y + delta.y } }
              : l
          );
          onLociChange(newLoci);
        }
      }
    },
  }), [loci]);

  return (
    <div
      ref={drop}
      className="relative w-full aspect-video rounded-xl bg-slate-800 border border-slate-700/30 overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {loci.map((locus) => (
        <DraggableLocus
          key={locus.id}
          locus={locus}
          moveLocus={(id, x, y) => {
            const newLoci = loci.map((l) =>
              l.id === id ? { ...l, position: { x, y } } : l
            );
            onLociChange(newLoci);
          }}
        />
      ))}
    </div>
  );
}
