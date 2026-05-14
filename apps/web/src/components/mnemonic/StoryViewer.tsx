import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StoryViewerProps {
  story: { title: string; content: string };
}

export function StoryViewer({ story }: StoryViewerProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(story.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paragraphs = story.content.split('\n\n').filter(Boolean);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">📖 Story</Badge>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-slate-300 text-sm leading-relaxed mb-4 last:mb-0">
              {para}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
