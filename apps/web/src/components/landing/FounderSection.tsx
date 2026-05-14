import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Award, GraduationCap, BookOpen, Brain } from 'lucide-react';

export function FounderSection() {
  const { t } = useTranslation();
  const credentials = t('landing.founder.credentials', { returnObjects: true }) as string[];

  return (
    <section id="founder" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.founder.title')}
          </h2>
          <p className="text-lg text-slate-400">{t('landing.founder.subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass p-8 md:p-12"
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar */}
            <div className="shrink-0">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-indigo-500/20">
                AS
              </div>
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.isArray(credentials) &&
                  credentials.map((cred: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/30"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        {i === 0 ? (
                          <Award size={16} className="text-amber-400" />
                        ) : i === 1 ? (
                          <GraduationCap size={16} className="text-indigo-400" />
                        ) : i === 2 ? (
                          <Brain size={16} className="text-violet-400" />
                        ) : (
                          <BookOpen size={16} className="text-emerald-400" />
                        )}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{cred}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
