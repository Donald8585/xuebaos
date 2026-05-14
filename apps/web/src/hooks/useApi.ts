import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────

export interface Palace {
  id: string;
  title: string;
  description: string;
  template: string;
  loci_count: number;
  thumbnail_url?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  last_studied_at?: string;
}

export interface Locus {
  id: string;
  palace_id: string;
  order_index: number;
  concept: string;
  description: string;
  mnemonic: string;
  image_url?: string;
  position_x: number;
  position_y: number;
}

export interface Story {
  id: string;
  title: string;
  content: string;
  source_material: string;
  cover_url?: string;
  audio_url?: string;
  created_at: string;
}

export interface Symbol {
  id: string;
  concept: string;
  metaphor: string;
  explanation: string;
  image_url?: string;
  created_at: string;
}

export interface StudySession {
  id: string;
  palace_id?: string;
  story_id?: string;
  duration_seconds: number;
  cards_reviewed: number;
  cards_correct: number;
  started_at: string;
  completed_at?: string;
}

export interface TimetableEntry {
  id: string;
  subject: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
  is_sleep_block: boolean;
}

export interface Question {
  id: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  answer_text: string;
  explanation?: string;
  tags: string[];
  attempts: number;
  correct_count: number;
  last_attempted?: string;
}

export interface StudyStats {
  total_sessions: number;
  total_duration_seconds: number;
  total_cards_reviewed: number;
  average_accuracy: number;
  streak_days: number;
  longest_streak: number;
  saturation_level: number;
  weekly_activity: { date: string; minutes: number }[];
  topic_mastery: { topic: string; mastery: number }[];
}

// ─── Palace Hooks ────────────────────────────────────────

export function usePalaces() {
  return useQuery<Palace[]>({
    queryKey: ['palaces'],
    queryFn: () => api.get('/palaces'),
  });
}

export function usePalace(id: string | undefined) {
  return useQuery<Palace>({
    queryKey: ['palaces', id],
    queryFn: () => api.get(`/palaces/${id}`),
    enabled: !!id,
  });
}

export function usePalaceLoci(palaceId: string | undefined) {
  return useQuery<Locus[]>({
    queryKey: ['palaces', palaceId, 'loci'],
    queryFn: () => api.get(`/palaces/${palaceId}/loci`),
    enabled: !!palaceId,
  });
}

export function useCreatePalace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Palace>) => api.post<Palace>('/palaces', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['palaces'] });
      toast.success('Palace created!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePalace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/palaces/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['palaces'] });
      toast.success('Palace deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateLoci() {
  return useMutation({
    mutationFn: ({ palaceId, content }: { palaceId: string; content: string }) =>
      api.post<Locus[]>(`/palaces/${palaceId}/generate-loci`, { content }),
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Story Hooks ─────────────────────────────────────────

export function useStories() {
  return useQuery<Story[]>({
    queryKey: ['stories'],
    queryFn: () => api.get('/stories'),
  });
}

export function useStory(id: string | undefined) {
  return useQuery<Story>({
    queryKey: ['stories', id],
    queryFn: () => api.get(`/stories/${id}`),
    enabled: !!id,
  });
}

export function useGenerateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { source_material: string; title?: string }) =>
      api.post<Story>('/stories/generate', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
      toast.success('Story generated!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/stories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
      toast.success('Story deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Symbol Hooks ────────────────────────────────────────

export function useSymbols() {
  return useQuery<Symbol[]>({
    queryKey: ['symbols'],
    queryFn: () => api.get('/symbols'),
  });
}

export function useForgeSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (concept: string) =>
      api.post<{ proposals: Symbol[] }>('/symbols/forge', { concept }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['symbols'] });
      toast.success('Symbol forged!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSaveSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: Partial<Symbol>) => api.post<Symbol>('/symbols', symbol),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['symbols'] });
      toast.success('Symbol saved to dictionary!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Study Session Hooks ─────────────────────────────────

export function useStudySessions() {
  return useQuery<StudySession[]>({
    queryKey: ['study-sessions'],
    queryFn: () => api.get('/study-sessions'),
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { palace_id?: string; story_id?: string }) =>
      api.post<StudySession>('/study-sessions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-sessions'] }),
  });
}

export function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; cards_reviewed: number; cards_correct: number }) =>
      api.patch(`/study-sessions/${data.sessionId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-sessions'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

// ─── Stats Hooks ─────────────────────────────────────────

export function useStudyStats() {
  return useQuery<StudyStats>({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats'),
  });
}

// ─── Timetable Hooks ─────────────────────────────────────

export function useTimetable() {
  return useQuery<TimetableEntry[]>({
    queryKey: ['timetable'],
    queryFn: () => api.get('/timetable'),
  });
}

export function useSaveTimetable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Partial<TimetableEntry>[]) =>
      api.put('/timetable', { entries }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Timetable saved!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Question Bank Hooks ─────────────────────────────────

export function useQuestions(params?: { topic?: string; difficulty?: string }) {
  return useQuery<Question[]>({
    queryKey: ['questions', params],
    queryFn: () => api.get('/questions', params as Record<string, string>),
  });
}

export function useGenerateQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { topic: string; difficulty?: string; count?: number }) =>
      api.post<Question[]>('/questions/generate', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRecordAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, correct }: { questionId: string; correct: boolean }) =>
      api.post(`/questions/${questionId}/attempt`, { correct }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });
}
