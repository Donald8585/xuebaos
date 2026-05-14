import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, BookOpen, User, Bot, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: `🐉 **Welcome to XueBa Chat!**

I'm your 學霸 AI coach — powered by the complete XueBaOS study methodology. 

I can help you with:
• **Memory Palaces** — Building and optimizing your loci
• **Active Recall** — How to test yourself effectively
• **FSRS Spacing** — Optimal review schedules
• **3-Pass Annotation** — Processing any study material
• **Exam Strategy** — Pre-exam protocols and in-exam tactics
• **Concept Chains** — Linking ideas for automatic recall
• **Timetable Optimization** — Scheduling like an OS

What are you studying today? What's your biggest challenge right now?`,
};

export default function XuebaChat() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      const history = [...messages, userMsg]
        .filter((m) => m !== WELCOME_MESSAGE)
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!resp.ok) throw new Error(`API error: ${resp.status}`);

      const data = await resp.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Sorry, something went wrong. Please try again.\n\n*Error: ${err instanceof Error ? err.message : 'Unknown'}*`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles size={24} className="text-indigo-400" />
            XueBa Chat
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            AI study coach with the complete 學霸 methodology
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="text-slate-400 hover:text-white"
        >
          <Trash2 size={14} className="mr-1" />
          Clear
        </Button>
      </div>

      {/* Chat Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4"
      >
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i === messages.length - 1 ? 0 : 0 }}
            >
              <Card
                className={
                  msg.role === 'assistant'
                    ? 'bg-slate-800/60 border-slate-700/50'
                    : 'bg-indigo-500/10 border-indigo-500/20'
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        msg.role === 'assistant'
                          ? 'bg-indigo-500/20'
                          : 'bg-slate-700/50'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <Sparkles size={14} className="text-indigo-400" />
                      ) : (
                        <User size={14} className="text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-400 mb-1">
                        {msg.role === 'assistant' ? '🐉 學霸' : 'You'}
                      </p>
                      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="bg-slate-800/60 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Loader2 size={14} className="text-indigo-400 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-400 mb-1">🐉 學霸</p>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <Card className="bg-slate-800/80 border-slate-700/50">
          <CardContent className="p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about study techniques, memory palaces, exam strategy..."
                rows={2}
                className="flex-1 bg-transparent border-0 resize-none text-sm text-white placeholder-slate-500 focus:outline-none"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-500"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
