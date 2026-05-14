import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { User, Bell, CreditCard, Globe, AlertTriangle, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';
import i18n from '@/i18n';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { fullName, email, avatarUrl } = useAuth();
  const [displayName, setDisplayName] = useState(fullName || '');
  const [locale, setLocale] = useState(i18n.language || 'en');
  const [studyReminders, setStudyReminders] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);

  const handleSaveProfile = () => {
    toast.success(t('settings.saved'));
  };

  const handleLocaleChange = (value: string) => {
    setLocale(value);
    i18n.changeLanguage(value);
    toast.success(t('settings.saved'));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User size={18} className="text-indigo-400" />
            {t('settings.profile')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-2xl">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-lg">{getInitials(fullName || 'U')}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">{t('settings.displayName')}</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">{t('settings.email')}</label>
                <Input value={email || ''} disabled className="opacity-50" />
              </div>
            </div>
          </div>
          <Button onClick={handleSaveProfile}>
            <Save size={14} className="mr-2" />
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe size={18} className="text-indigo-400" />
            {t('settings.locale')}
          </CardTitle>
          <CardDescription>{t('settings.localeDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('settings.en')}</SelectItem>
              <SelectItem value="zh-HK">{t('settings.zhHK')}</SelectItem>
              <SelectItem value="zh-CN">{t('settings.zhCN')}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={18} className="text-indigo-400" />
            {t('settings.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">{t('settings.studyReminders')}</p>
              <p className="text-xs text-slate-500">{t('settings.studyRemindersDesc')}</p>
            </div>
            <Switch checked={studyReminders} onCheckedChange={setStudyReminders} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">{t('settings.streakAlerts')}</p>
              <p className="text-xs text-slate-500">{t('settings.streakAlertsDesc')}</p>
            </div>
            <Switch checked={streakAlerts} onCheckedChange={setStreakAlerts} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">{t('settings.productUpdates')}</p>
              <p className="text-xs text-slate-500">{t('settings.productUpdatesDesc')}</p>
            </div>
            <Switch checked={productUpdates} onCheckedChange={setProductUpdates} />
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard size={18} className="text-indigo-400" />
            {t('settings.subscription')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{t('settings.currentPlan')}: <span className="font-semibold">Free</span></p>
            </div>
            <Button variant="accent" size="sm">
              {t('settings.upgradePlan')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-rose-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-400">
            <AlertTriangle size={18} />
            {t('settings.dangerZone')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">{t('settings.deleteWarning')}</p>
          <Button variant="destructive" size="sm">
            {t('settings.deleteAccount')}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
