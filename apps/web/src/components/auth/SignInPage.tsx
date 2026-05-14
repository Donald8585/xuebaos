import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function SignInPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">{t('common.back')}</span>
        </Link>

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">XueBaOS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {t('auth.signInTitle')}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {t('auth.signInSubtitle')}
          </p>
        </div>

        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              card: 'bg-transparent shadow-none border-0',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
            },
          }}
        />
      </motion.div>
    </div>
  );
}
