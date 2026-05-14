import { create } from 'zustand';

interface StudyState {
  activeSessionId: string | null;
  walkthroughMode: boolean;
  currentLocusIndex: number;
  totalLoci: number;
  quizMode: boolean;
  sessionCardsReviewed: number;
  sessionCardsCorrect: number;
  setActiveSession: (id: string | null) => void;
  setWalkthroughMode: (walking: boolean) => void;
  nextLocus: () => void;
  prevLocus: () => void;
  setCurrentLocusIndex: (index: number) => void;
  setTotalLoci: (total: number) => void;
  toggleQuizMode: () => void;
  recordAnswer: (correct: boolean) => void;
  resetSession: () => void;
}

export const useStudyStore = create<StudyState>()((set) => ({
  activeSessionId: null,
  walkthroughMode: false,
  currentLocusIndex: 0,
  totalLoci: 0,
  quizMode: false,
  sessionCardsReviewed: 0,
  sessionCardsCorrect: 0,
  setActiveSession: (id) => set({ activeSessionId: id }),
  setWalkthroughMode: (walking) => set({ walkthroughMode: walking }),
  nextLocus: () =>
    set((s) => ({
      currentLocusIndex: Math.min(s.currentLocusIndex + 1, s.totalLoci - 1),
    })),
  prevLocus: () =>
    set((s) => ({
      currentLocusIndex: Math.max(s.currentLocusIndex - 1, 0),
    })),
  setCurrentLocusIndex: (index) => set({ currentLocusIndex: index }),
  setTotalLoci: (total) => set({ totalLoci: total }),
  toggleQuizMode: () => set((s) => ({ quizMode: !s.quizMode })),
  recordAnswer: (correct) =>
    set((s) => ({
      sessionCardsReviewed: s.sessionCardsReviewed + 1,
      sessionCardsCorrect: s.sessionCardsCorrect + (correct ? 1 : 0),
    })),
  resetSession: () =>
    set({
      activeSessionId: null,
      walkthroughMode: false,
      currentLocusIndex: 0,
      totalLoci: 0,
      quizMode: false,
      sessionCardsReviewed: 0,
      sessionCardsCorrect: 0,
    }),
}));
