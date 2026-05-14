import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Sparkles, Star, Bookmark, BookmarkPlus, Search, Filter,
  ChevronRight, Calendar, User, Clock, TrendingUp, Upload, FileText,
  Loader2, X, Eye, EyeOff, Grid, List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

type Genre = 'classical' | 'modern' | 'poetry';

interface Passage {
  id: string;
  title: string;
  author: string;
  era: string;
  genre: Genre;
  content: string;
  savedSentences: string[];
}

interface SavedSentence {
  id: string;
  text: string;
  passageTitle: string;
  passageId: string;
  author: string;
  savedAt: string;
}

interface AIData {
  grammar: string;
  allusions: string[];
  rhetorical: string[];
}

// ─── Mock Data ───────────────────────────────────────────

const MOCK_PASSAGES: Passage[] = [
  {
    id: '1',
    title: '岳陽樓記',
    author: '范仲淹',
    era: '宋',
    genre: 'classical',
    content: '慶曆四年春，滕子京謫守巴陵郡。越明年，政通人和，百廢具興，乃重修岳陽樓，增其舊制，刻唐賢今人詩賦於其上，屬予作文以記之。\n\n予觀夫巴陵勝狀，在洞庭一湖。銜遠山，吞長江，浩浩湯湯，橫無際涯，朝暉夕陰，氣象萬千。此則岳陽樓之大觀也，前人之述備矣。然則北通巫峽，南極瀟湘，遷客騷人，多會於此，覽物之情，得無異乎？',
    savedSentences: [],
  },
  {
    id: '2',
    title: '背影',
    author: '朱自清',
    era: '現代',
    genre: 'modern',
    content: '我與父親不相見已有二年餘了，我最不能忘記的是他的背影。那年冬天，祖母死了，父親的差使也交卸了，正是禍不單行的日子。我從北京到徐州，打算跟著父親奔喪回家。到徐州見著父親，看見滿院狼藉的東西，又想起祖母，不禁簌簌地流下眼淚。',
    savedSentences: [],
  },
  {
    id: '3',
    title: '靜夜思',
    author: '李白',
    era: '唐',
    genre: 'poetry',
    content: '床前明月光，\n疑是地上霜。\n舉頭望明月，\n低頭思故鄉。',
    savedSentences: [],
  },
  {
    id: '4',
    title: '師說',
    author: '韓愈',
    era: '唐',
    genre: 'classical',
    content: '古之學者必有師。師者，所以傳道、受業、解惑也。人非生而知之者，孰能無惑？惑而不從師，其為惑也，終不解矣。\n\n生乎吾前，其聞道也，固先乎吾，吾從而師之；生乎吾後，其聞道也，亦先乎吾，吾從而師之。吾師道也，夫庸知其年之先後生於吾乎？是故無貴無賤，無長無少，道之所存，師之所存也。',
    savedSentences: [],
  },
  {
    id: '5',
    title: '匆匆',
    author: '朱自清',
    era: '現代',
    genre: 'modern',
    content: '燕子去了，有再來的時候；楊柳枯了，有再青的時候；桃花謝了，有再開的時候。但是，聰明的，你告訴我，我們的日子為什麼一去不復返呢？——是有人偷了他們罷：那是誰？又藏在何處呢？是他們自己逃走了罷：現在又到了哪裡呢？',
    savedSentences: [],
  },
];

const MOCK_AI_ANALYSIS: AIData = {
  grammar: '「銜遠山，吞長江」使用擬人手法，「銜」和「吞」賦予洞庭湖生命感。句式中「浩浩湯湯」使用疊字，增強氣勢。「北通巫峽，南極瀟湘」使用對偶句式。',
  allusions: [
    '「遷客騷人」——被貶謫的官員和文人，暗指歷代不得志的文人墨客',
    '「唐賢今人」——指唐代和當代的賢人，暗示文化傳承',
  ],
  rhetorical: [
    '對偶：北通巫峽，南極瀟湘',
    '誇張：橫無際涯',
    '擬人：銜遠山，吞長江',
    '疊字：浩浩湯湯',
  ],
};

const AUTHOR_COLORS: Record<string, string> = {
  '范仲淹': '#4F46E5',
  '朱自清': '#EC4899',
  '李白': '#F59E0B',
  '韓愈': '#10B981',
};

// ─── Genre Badge Component ───────────────────────────────

function GenreBadge({ genre }: { genre: Genre }) {
  const { t } = useTranslation();
  const variants: Record<Genre, 'default' | 'success' | 'warning'> = {
    classical: 'default',
    modern: 'success',
    poetry: 'warning',
  };
  const labels: Record<Genre, string> = {
    classical: t('readingVault.genreClassical'),
    modern: t('readingVault.genreModern'),
    poetry: t('readingVault.genrePoetry'),
  };
  return <Badge variant={variants[genre]}>{labels[genre]}</Badge>;
}

// ─── Donut Chart (SVG) ───────────────────────────────────

function AuthorDonut({ passages }: { passages: Passage[] }) {
  const authorCounts: Record<string, number> = {};
  passages.forEach((p) => {
    authorCounts[p.author] = (authorCounts[p.author] || 0) + 1;
  });
  const entries = Object.entries(authorCounts);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#1E293B" strokeWidth="20" />
        {entries.map(([author, count]) => {
          const pct = count / total;
          const dash = circumference * pct;
          const circle = (
            <circle
              key={author}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={AUTHOR_COLORS[author] || '#6B7280'}
              strokeWidth="20"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
              className="transition-all duration-500"
            />
          );
          offset += dash;
          return circle;
        })}
        <circle cx="80" cy="80" r="48" fill="#0F172A" />
        <text x="80" y="76" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
          {total}
        </text>
        <text x="80" y="92" textAnchor="middle" fill="#94A3B8" fontSize="10">
          authors
        </text>
      </svg>
      <div className="flex flex-wrap gap-3">
        {entries.map(([author, count]) => (
          <div key={author} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: AUTHOR_COLORS[author] || '#6B7280' }}
            />
            <span className="text-xs text-slate-400">{author}</span>
            <span className="text-xs text-white font-medium">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Flashcard Component ─────────────────────────────────

function SentenceFlashcard({
  sentence,
  onClose,
}: {
  sentence: SavedSentence;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, rotateY: 0 }}
        animate={{ scale: 1, rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg aspect-[3/2] cursor-pointer"
        onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
      >
        <div
          className="w-full h-full rounded-2xl p-8 flex items-center justify-center border border-slate-700"
          style={{
            background: isFlipped
              ? 'linear-gradient(135deg, #1E293B, #312E81)'
              : 'linear-gradient(135deg, #1E293B, #0F172A)',
          }}
        >
          {isFlipped ? (
            <div className="text-center" style={{ transform: 'rotateY(180deg)' }}>
              <p className="text-sm text-slate-400 mb-2">{sentence.author} · {sentence.passageTitle}</p>
              <p className="text-slate-500 text-xs">{t('readingVault.flashcardPrompt')}</p>
            </div>
          ) : (
            <p className="text-xl text-white text-center leading-relaxed">{sentence.text}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main ReadingVault ───────────────────────────────────

export default function ReadingVault() {
  const { t } = useTranslation();
  const [passages, setPassages] = useState<Passage[]>(MOCK_PASSAGES);
  const [savedSentences, setSavedSentences] = useState<SavedSentence[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState<Genre | 'all'>('all');
  const [selectedPassage, setSelectedPassage] = useState<Passage | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dailyOptIn, setDailyOptIn] = useState(false);
  const [flashcardSentence, setFlashcardSentence] = useState<SavedSentence | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [uploadGenre, setUploadGenre] = useState<Genre>('classical');

  const filtered = passages.filter((p) => {
    if (genreFilter !== 'all' && p.genre !== genreFilter) return false;
    if (searchTerm && !p.title.includes(searchTerm) && !p.author.includes(searchTerm)) return false;
    return true;
  });

  const handleSelectPassage = (passage: Passage) => {
    setSelectedPassage(passage);
    setAiAnalysis(null);
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setAiAnalysis(MOCK_AI_ANALYSIS);
      setIsAnalyzing(false);
    }, 2000);
  };

  const handleSaveSentence = (text: string) => {
    if (!selectedPassage) return;
    const newSentence: SavedSentence = {
      id: Date.now().toString(),
      text,
      passageTitle: selectedPassage.title,
      passageId: selectedPassage.id,
      author: selectedPassage.author,
      savedAt: new Date().toISOString(),
    };
    setSavedSentences([newSentence, ...savedSentences]);
    toast.success(t('readingVault.sentenceSaved'));
  };

  const handleUpload = () => {
    if (!uploadTitle.trim() || !uploadContent.trim()) {
      toast.error('Please fill in title and content');
      return;
    }
    const newPassage: Passage = {
      id: Date.now().toString(),
      title: uploadTitle,
      author: uploadAuthor || 'Unknown',
      era: '自訂',
      genre: uploadGenre,
      content: uploadContent,
      savedSentences: [],
    };
    setPassages([newPassage, ...passages]);
    setShowUpload(false);
    setUploadTitle('');
    setUploadContent('');
    setUploadAuthor('');
    toast.success('Passage uploaded!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('readingVault.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">Build your literary foundation</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
            <Upload size={14} className="mr-1" /> {t('readingVault.uploadPassage')}
          </Button>
        </div>
      </div>

      {/* Daily Passage Card */}
      <Card className="bg-gradient-to-r from-indigo-900/40 to-violet-900/40 border-indigo-500/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" />
              {t('readingVault.dailyPassage')}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{t('readingVault.dailyOptIn')}</span>
              <Switch checked={dailyOptIn} onCheckedChange={setDailyOptIn} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="p-4 rounded-xl bg-slate-800/40 cursor-pointer hover:bg-slate-800/60 transition-colors"
            onClick={() => handleSelectPassage(passages[2])}
          >
            <div className="flex items-center gap-2 mb-2">
              <GenreBadge genre="poetry" />
              <Badge variant="secondary">唐</Badge>
            </div>
            <p className="text-white font-medium">{passages[2].title}</p>
            <p className="text-slate-400 text-sm">{passages[2].author}</p>
            <p className="mt-2 text-slate-300 text-sm whitespace-pre-line line-clamp-2">
              {passages[2].content}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Passage List */}
        <div className={selectedPassage ? 'lg:col-span-1' : 'lg:col-span-3'}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('readingVault.passageList')}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('list')}
                  >
                    <List size={14} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('common.search') || ''}
                  className="flex-1"
                  icon={<Search size={14} />}
                />
                <Select value={genreFilter} onValueChange={(v) => setGenreFilter(v as Genre | 'all')}>
                  <SelectTrigger className="w-[140px]">
                    <Filter size={14} className="mr-1" />
                    <SelectValue placeholder={t('readingVault.genreFilter')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('readingVault.allGenres')}</SelectItem>
                    <SelectItem value="classical">{t('readingVault.genreClassical')}</SelectItem>
                    <SelectItem value="modern">{t('readingVault.genreModern')}</SelectItem>
                    <SelectItem value="poetry">{t('readingVault.genrePoetry')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                  : 'space-y-2'
              )}>
                {filtered.map((passage) => (
                  <motion.div
                    key={passage.id}
                    whileHover={{ scale: 1.01 }}
                    className={cn(
                      'p-3 rounded-xl cursor-pointer transition-all border',
                      selectedPassage?.id === passage.id
                        ? 'bg-indigo-500/10 border-indigo-500/30'
                        : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50'
                    )}
                    onClick={() => handleSelectPassage(passage)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{passage.title}</p>
                        <p className="text-xs text-slate-400">{passage.author} · {passage.era}</p>
                      </div>
                      <GenreBadge genre={passage.genre} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Passage Detail & Analysis */}
        {selectedPassage && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-4"
          >
            {/* Passage Content */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedPassage.title}</CardTitle>
                    <CardDescription>
                      {selectedPassage.author} · {selectedPassage.era} · <GenreBadge genre={selectedPassage.genre} />
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedPassage(null)}>
                    <X size={14} className="mr-1" /> Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-line text-slate-300 text-sm leading-relaxed">
                  {selectedPassage.content.split('\n\n').map((paragraph, i) => (
                    <p
                      key={i}
                      className="mb-3 cursor-pointer hover:bg-slate-800/40 rounded-lg p-2 transition-colors border border-transparent hover:border-slate-700/30"
                      onClick={() => handleSaveSentence(paragraph)}
                      title="Click to save as good sentence"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <><Loader2 size={14} className="mr-1 animate-spin" /> Analyzing...</>
                    ) : (
                      <><Sparkles size={14} className="mr-1" /> {t('readingVault.aiAnalysis')}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Analysis */}
            <AnimatePresence>
              {aiAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BookOpen size={14} className="text-indigo-400" />
                        {t('readingVault.grammar')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-300">{aiAnalysis.grammar}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles size={14} className="text-amber-400" />
                        {t('readingVault.allusions')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiAnalysis.allusions.map((a, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <ChevronRight size={14} className="text-amber-400 mt-0.5 shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" />
                        {t('readingVault.rhetorical')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {aiAnalysis.rhetorical.map((r, i) => (
                          <Badge key={i} variant="success">{r}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Saved Sentences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark size={16} className="text-indigo-400" />
            {t('readingVault.savedSentences')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedSentences.length === 0 ? (
            <div className="text-center py-8">
              <BookmarkPlus size={32} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">{t('readingVault.noSentences')}</p>
              <p className="text-slate-500 text-xs mt-1">{t('readingVault.noSentencesDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedSentences.map((sentence) => (
                <motion.div
                  key={sentence.id}
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-xl bg-slate-700/30 border border-slate-700/50 cursor-pointer hover:border-indigo-500/30 transition-all"
                  onClick={() => setFlashcardSentence(sentence)}
                >
                  <p className="text-sm text-white line-clamp-2 mb-2">{sentence.text}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {sentence.author}
                    </Badge>
                    <span className="text-[10px] text-slate-500">
                      {sentence.passageTitle}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Author Exposure Tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp size={14} className="text-indigo-400" />
            {t('readingVault.exposureTracker')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuthorDonut passages={passages} />
        </CardContent>
      </Card>

      {/* Flashcard Modal */}
      <AnimatePresence>
        {flashcardSentence && (
          <SentenceFlashcard
            sentence={flashcardSentence}
            onClose={() => setFlashcardSentence(null)}
          />
        )}
      </AnimatePresence>

      {/* Upload Dialog */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowUpload(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-lg mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">{t('readingVault.uploadPassage')}</h3>
              <div className="space-y-3">
                <Input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Title"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={uploadAuthor}
                    onChange={(e) => setUploadAuthor(e.target.value)}
                    placeholder={t('readingVault.author') || ''}
                  />
                  <Select value={uploadGenre} onValueChange={(v) => setUploadGenre(v as Genre)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classical">{t('readingVault.genreClassical')}</SelectItem>
                      <SelectItem value="modern">{t('readingVault.genreModern')}</SelectItem>
                      <SelectItem value="poetry">{t('readingVault.genrePoetry')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Paste passage content..."
                  className="min-h-[200px]"
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="ghost" onClick={() => setShowUpload(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleUpload}>{t('common.submit')}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
