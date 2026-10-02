import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { QuizLevel, QuizQuestion } from './database.types';
import { supabase } from './supabase';

/** The church's questions that members can see: the general pool and every week that has started. */
export function useQuizQuestions(churchId: string) {
  return useQuery({
    queryKey: ['quiz-questions', churchId],
    queryFn: async (): Promise<QuizQuestion[]> => {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

export type QuizQuestionInput = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  reference: string;
  level: QuizLevel;
  /** The Monday it features, or null for the general pool. */
  weekOf: string | null;
};

export function useAddQuizQuestion(churchId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuizQuestionInput) => {
      const { error } = await supabase.from('quiz_questions').insert({
        church_id: churchId,
        created_by: userId,
        question: input.question,
        options: input.options,
        correct_index: input.correctIndex,
        explanation: input.explanation,
        reference: input.reference,
        level: input.level,
        week_of: input.weekOf,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-questions', churchId] }),
  });
}

export function useRemoveQuizQuestion(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-questions', churchId] }),
  });
}
