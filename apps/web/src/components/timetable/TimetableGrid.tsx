import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Entry {
  id: string;
  subject: string;
  day: number;
  start: string;
  end: string;
  color: string;
}

interface TimetableGridProps {
  entries: Entry[];
  onRemove: (id: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 13 }, (_, i) => `${i + 8}:00`); // 8AM to 8PM

function timeToRow(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h - 8) * 60 + m;
}

function durationToSpan(start: string, end: string): number {
  return timeToRow(end) - timeToRow(start);
}

export function TimetableGrid({ entries, onRemove }: TimetableGridProps) {
  const hourHeight = 60; // px per hour

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-auto">
      {/* Header */}
      <div className="grid grid-cols-8 border-b border-slate-700/50">
        <div className="p-2 text-xs text-slate-500 text-center border-r border-slate-700/50">
          Time
        </div>
        {DAYS.map((day) => (
          <div key={day} className="p-2 text-xs font-semibold text-slate-400 text-center border-r border-slate-700/50 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8" style={{ minHeight: `${HOURS.length * hourHeight}px` }}>
        {/* Time labels */}
        <div className="border-r border-slate-700/50">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-[10px] text-slate-600 px-2 py-1 border-b border-slate-700/20"
              style={{ height: hourHeight }}
            >
              {hour}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((_, dayIndex) => {
          const dayEntries = entries.filter((e) => e.day === dayIndex);

          return (
            <div
              key={dayIndex}
              className="relative border-r border-slate-700/50 last:border-r-0"
            >
              {/* Hour grid lines */}
              {HOURS.map((_, i) => (
                <div
                  key={i}
                  className="border-b border-slate-700/20"
                  style={{ height: hourHeight }}
                />
              ))}

              {/* Entries */}
              {dayEntries.map((entry) => {
                const top = timeToRow(entry.start);
                const height = durationToSpan(entry.start, entry.end);

                return (
                  <div
                    key={entry.id}
                    className="absolute left-1 right-1 rounded-lg px-2 py-1 text-xs group overflow-hidden"
                    style={{
                      top,
                      height: Math.max(height, 30),
                      backgroundColor: `${entry.color}30`,
                      border: `1px solid ${entry.color}40`,
                    }}
                  >
                    <button
                      onClick={() => onRemove(entry.id)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white/70" />
                    </button>
                    <p className="text-white font-medium text-[10px] truncate">{entry.subject}</p>
                    <p className="text-white/60 text-[9px]">
                      {entry.start} - {entry.end}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
