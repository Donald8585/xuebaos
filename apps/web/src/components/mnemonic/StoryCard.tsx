import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatRelativeDate } from '@/lib/utils';
import type { Story } from '@/hooks/useApi';

interface StoryCardProps {
  story: Story;
}

export function StoryCard({ story }: StoryCardProps) {
  const navigate = useNavigate();
  const wordCount = story.content?.split(/\s+/).length || 0;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-violet-500/30 transition-all duration-300 group"
      onClick={() => navigate(`/stories/${story.id}`)}
    >
      <div className="aspect-[2/1] bg-gradient-to-br from-violet-900/40 to-purple-900/40 flex items-center justify-center relative">
        <BookOpen size={40} className="text-violet-400/40 group-hover:scale-110 transition-transform" />
        {story.cover_url && (
          <img src={story.cover_url} alt={story.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-white text-sm mb-1 truncate">{story.title}</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{wordCount} words</span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatRelativeDate(story.created_at)}
          </span>
        </div>
      </div>
    </Card>
  );
}
