import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Question } from '@/hooks/useApi';

const difficultyColors = {
  easy: 'success' as const,
  medium: 'warning' as const,
  hard: 'destructive' as const,
};

interface QuestionCardProps {
  question: Question;
}

export function QuestionCard({ question }: QuestionCardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge variant={difficultyColors[question.difficulty]}>
            {question.difficulty}
          </Badge>
          <span className="text-xs text-slate-500">{question.topic}</span>
        </div>

        <p className="text-sm text-white font-medium mb-4">{question.question_text}</p>

        <AnimatePresence>
          {!revealed ? (
            <motion.div
              key="hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setRevealed(true)}
              >
                <Eye size={14} className="mr-1" /> Reveal Answer
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-xs text-emerald-300 font-medium mb-1">Answer</p>
                <p className="text-sm text-slate-300">{question.answer_text}</p>
                {question.explanation && (
                  <p className="text-xs text-slate-500 mt-2 italic">{question.explanation}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                  <X size={14} className="mr-1" /> I Didn't Know
                </Button>
                <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                  <Check size={14} className="mr-1" /> I Got It!
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
