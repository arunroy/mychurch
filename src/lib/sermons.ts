import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Sermon, SermonDetail, SermonItem, SermonSource } from './database.types';
import { supabase } from './supabase';

/** The three kinds of sermon, as filters and as the tag shown on each one. */
export const SOURCES: { value: SermonSource; filter: string; tag: string }[] = [
  { value: 'pastor', filter: 'Pastor', tag: 'Pastor' },
  { value: 'member', filter: 'Members', tag: 'Member' },
  { value: 'external', filter: 'External', tag: 'External' },
];

export function sourceTag(source: SermonSource) {
  return SOURCES.find((s) => s.value === source)?.tag ?? '';
}

/**
 * Every sermon this person may see, newest first: the approved ones for everyone, plus their own
 * submissions, and for the Pastor everything including entries waiting for review.
 */
export function useSermons(churchId: string) {
  return useQuery({
    queryKey: ['sermons', churchId],
    queryFn: async (): Promise<SermonItem[]> => {
      const { data, error } = await supabase.rpc('sermon_feed', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** One sermon in full, including a member's article text. */
export function useSermon(churchId: string, id: string | undefined) {
  return useQuery({
    queryKey: ['sermon', churchId, id],
    enabled: !!id,
    queryFn: async (): Promise<SermonDetail | null> => {
      const { data, error } = await supabase.rpc('sermon_detail', { p_sermon: id! });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

/** How many entries wait for the Pastor's review, for the Home tile badge. */
export function usePendingSermonCount(churchId: string, isPastor: boolean) {
  const sermons = useSermons(churchId);
  return isPastor ? (sermons.data?.filter((s) => s.status === 'pending').length ?? 0) : 0;
}

/** Whether a sermon matches the search box. Search looks at every kind of sermon, whichever filter is on. */
export function matchesSearch(sermon: SermonItem, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [sermon.title, sermon.speaker, sermon.author_name ?? '', sermon.reference].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

/** A link the app is willing to open: http or https, nothing else. */
export function isWebLink(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim()) && value.trim().length <= 500;
}

/** "sermoncentral.com" from a full address, for labelling where a link goes. */
export function linkSite(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function useInvalidateSermons(churchId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sermons', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['sermon', churchId] }),
    ]);
}

// ---------------------------------------------------------------------------
// The Pastor's own sermons: added and edited directly, published at once.
// ---------------------------------------------------------------------------

export type SermonInput = Pick<
  Sermon,
  | 'title'
  | 'speaker'
  | 'sermon_date'
  | 'reference'
  | 'book'
  | 'chapter'
  | 'verse_start'
  | 'verse_end'
  | 'read_url'
  | 'media_url'
  | 'body'
  | 'published'
>;

/** Adds one of the Pastor's own sermons, or with an `id` changes it. Only the Pastor can; the database enforces it. */
export function useSaveSermon(churchId: string, userId: string) {
  const invalidate = useInvalidateSermons(churchId);
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SermonInput }) => {
      if (id) {
        const { error } = await supabase
          .from('sermons')
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('church_id', churchId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sermons').insert({ ...input, church_id: churchId, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Members' articles and external links: they go to the Pastor for review.
// ---------------------------------------------------------------------------

export type SubmissionInput = {
  title: string;
  /** The author's name for an external sermon (who preached it); left empty for an article. */
  speaker: string;
  reference: string;
  book: string | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  /** An article's text, or the short note on why an external sermon is worth sharing. */
  body: string | null;
  /** The link, for an external sermon. */
  url: string | null;
};

export function useSubmitSermon(churchId: string) {
  const invalidate = useInvalidateSermons(churchId);
  return useMutation({
    mutationFn: async ({ source, input }: { source: 'member' | 'external'; input: SubmissionInput }) => {
      const { error } = await supabase.rpc('submit_sermon', {
        p_church: churchId,
        p_source: source,
        p_title: input.title,
        p_speaker: input.speaker,
        p_reference: input.reference,
        p_book: input.book,
        p_chapter: input.chapter,
        p_verse_start: input.verse_start,
        p_verse_end: input.verse_end,
        p_body: input.body,
        p_url: input.url,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** The author changes a submission. It goes back to waiting for the Pastor's review. */
export function useEditSubmission(churchId: string) {
  const invalidate = useInvalidateSermons(churchId);
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SubmissionInput }) => {
      const { error } = await supabase.rpc('edit_submission', {
        p_sermon: id,
        p_title: input.title,
        p_speaker: input.speaker,
        p_reference: input.reference,
        p_book: input.book,
        p_chapter: input.chapter,
        p_verse_start: input.verse_start,
        p_verse_end: input.verse_end,
        p_body: input.body,
        p_url: input.url,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** The Pastor approves or declines a submission, with an optional note the author sees. */
export function useReviewSermon(churchId: string) {
  const invalidate = useInvalidateSermons(churchId);
  return useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc('review_sermon', { p_sermon: id, p_approve: approve, p_note: note ?? null });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** The Pastor can remove any sermon; an author can remove their own submission. */
export function useDeleteSermon(churchId: string) {
  const invalidate = useInvalidateSermons(churchId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sermons').delete().eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
