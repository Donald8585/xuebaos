import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Wand2, Loader2, Image, Volume2, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { StoryViewer } from '@/components/mnemonic/StoryViewer';

export default function StoryGenerator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [story, setStory] = useState<{ title: string; content: string } | null>(null);
  const [storyTitle, setStoryTitle] = useState('');

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setStory({
        title: 'The Cellular Kingdom: A Tale of Microscopic Civilization',
        content: `Deep within the vast empire of the human body lies a magnificent kingdom — the Cell. This walled city, protected by its Phospholipid Gate, carefully controls who enters and exits. Only authorized molecules with the proper identification may pass through the membrane checkpoint.

At the heart of the kingdom sits the Nucleus Castle, where the royal archives contain every blueprint for every structure and citizen protein in the realm. The DNA scribes work tirelessly, transcribing instructions into messenger RNA scrolls.

The Mitochondria Power Plants hum with activity along the city's energy grid. Here, glucose fuel is burned in the presence of oxygen, producing ATP — the universal energy currency that powers everything from protein construction to molecular transport.

The Endoplasmic Reticulum Highway System weaves through the city like a complex network of roads. The rough ER, dotted with Ribosome Factories, manufactures proteins destined for far-off locations. The smooth ER handles special deliveries of lipids and detoxification services.

At the Golgi Distribution Center, proteins arrive in transport vesicles — like packages on delivery trucks. Here they're sorted, labeled, and addressed for their final destinations. Some are shipped to the cell membrane, others are destined for secretion into the bloodstream.

The Lysosome Recycling Plants serve as the city's waste management. These acidic chambers break down old, worn-out organelles and foreign invaders, recycling their components for new construction projects.

And in plant cells, the grand Chloroplast Solar Farms capture sunlight with their green chlorophyll panels, converting solar energy into sweet glucose through the magical process of photosynthesis. A feat of engineering unmatched in the animal kingdom.`,
      });
      setStoryTitle('The Cellular Kingdom');
      setIsGenerating(false);
    }, 3000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/stories')}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold text-white">{t('story.generator.title')}</h1>
      </div>

      {!story ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('story.generator.pasteContent')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('story.generator.pastePlaceholder') || ''}
              className="min-h-[200px]"
            />
            <Button
              onClick={handleGenerate}
              disabled={content.trim().length < 20 || isGenerating}
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> {t('story.generator.generating')}</>
              ) : (
                <><Wand2 size={16} className="mr-2" /> {t('story.generator.generate')}</>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('story.generator.storyPreview')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                placeholder={t('story.generator.storyTitle') || ''}
              />
              <StoryViewer story={story} />
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCw size={14} className="mr-1" /> {t('story.generator.regenerate')}
                </Button>
                <Button variant="outline" size="sm">
                  <Image size={14} className="mr-1" /> {t('story.generator.generateCover')}
                </Button>
                <Button variant="outline" size="sm">
                  <Volume2 size={14} className="mr-1" /> {t('story.generator.generateAudio')}
                </Button>
                <Button size="sm" onClick={() => navigate('/stories')}>
                  <Save size={14} className="mr-1" /> {t('story.generator.saveStory')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
