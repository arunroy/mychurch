import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Question, QuestionVisibility } from './database.types';
import { supabase } from './supabase';

export function useQuestions(churchId: string) {
  return useQuery({
    queryKey: ['questions', churchId],
    queryFn: async (): Promise<Question[]> => {
      const { data, error } = await supabase.rpc('qa_feed', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** How many questions still wait for the Pastor's answer, for the Home tile badge shown to the Pastor. */
export function useUnansweredCount(churchId: string, isPastor: boolean) {
  const questions = useQuestions(churchId);
  return isPastor ? (questions.data?.filter((q) => !q.answer).length ?? 0) : 0;
}

function useRefreshQuestions(churchId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['questions', churchId] });
}

export function useAsk(churchId: string) {
  const refresh = useRefreshQuestions(churchId);
  return useMutation({
    mutationFn: async ({ body, anonymous }: { body: string; anonymous: boolean }) => {
      const { error } = await supabase.rpc('ask_question', { p_church: churchId, p_body: body, p_anonymous: anonymous });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useAnswer(churchId: string) {
  const refresh = useRefreshQuestions(churchId);
  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      const { error } = await supabase.rpc('answer_question', { p_question: questionId, p_answer: answer });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export const VISIBILITY_CHOICES: { value: QuestionVisibility; label: string }[] = [
  { value: 'pastor', label: 'Only me' },
  { value: 'leaders', label: 'Church leaders' },
  { value: 'church', label: 'Whole church' },
];

/** The Pastor chooses who sees a question: only them, the church leaders, or the whole church. */
export function useSetVisibility(churchId: string) {
  const refresh = useRefreshQuestions(churchId);
  return useMutation({
    mutationFn: async ({ questionId, visibility }: { questionId: string; visibility: QuestionVisibility }) => {
      const { error } = await supabase.rpc('set_question_visibility', { p_question: questionId, p_visibility: visibility });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useRemoveQuestion(churchId: string) {
  const refresh = useRefreshQuestions(churchId);
  return useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase.rpc('delete_question', { p_question: questionId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
