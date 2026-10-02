import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReportButton } from '@/components/report-sheet';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, useAccentText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { PollSummary } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { useClosePoll, useDeletePoll, usePolls, useVote } from '@/lib/polls';
import { friendlyError } from '@/lib/supabase';

// Any member can ask the church a question. Results show once you've voted, or when the poll has closed.
export default function PollsScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const polls = usePolls(church_id);

  return (
    <Screen edges={['bottom']}>
      <Button title={t('polls.start')} onPress={() => router.push('/poll-new')} />
      <ErrorText>{polls.error ? friendlyError(polls.error) : null}</ErrorText>
      {polls.isPending ? <Loading /> : null}
      {polls.data?.length === 0 ? <Body muted>{t('polls.empty')}</Body> : null}
      {userId ? polls.data?.map((poll) => <PollCard key={poll.id} poll={poll} userId={userId} />) : null}
      <Gap />
    </Screen>
  );
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

function PollCard({ poll, userId }: { poll: PollSummary; userId: string }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const theme = useTheme();
  const accentText = useAccentText();
  const vote = useVote(church_id);
  const close = useClosePoll(church_id);
  const remove = useDeletePoll(church_id);
  const [selected, setSelected] = useState<string[]>(poll.my_option_ids);
  const [error, setError] = useState<string | null>(null);

  const canManage = poll.creator_id === userId || isLeader;
  const hasVoted = poll.my_option_ids.length > 0;
  const showResults = poll.is_closed || hasVoted;
  const mostVotes = Math.max(1, ...poll.options.map((o) => o.votes ?? 0));

  function toggle(id: string) {
    if (poll.is_closed) return;
    setSelected((current) => {
      if (!poll.multiple) return [id];
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const footer = poll.is_closed
    ? t('polls.closed')
    : poll.closes_at
      ? t('polls.closes', { date: shortDate(poll.closes_at) })
      : t('polls.openUntilClosed');

  return (
    <Card>
      <Heading>{poll.question}</Heading>
      <Body muted>
        {`${poll.creator_name || t('polls.aMember')} · ${footer}${poll.multiple ? ` · ${t('polls.chooseAny')}` : ''}`}
      </Body>

      {poll.options.map((option) => {
        const chosen = selected.includes(option.id);
        const share = showResults && option.votes !== null ? option.votes / mostVotes : 0;
        return (
          <Pressable
            key={option.id}
            disabled={poll.is_closed}
            onPress={() => toggle(option.id)}
            accessibilityRole={poll.multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: chosen, disabled: poll.is_closed }}
            style={styles.option}>
            <View style={styles.optionLine}>
              <View style={[styles.mark, { borderColor: chosen ? accentText : theme.border, backgroundColor: chosen ? accentText : 'transparent' }]}>
                {chosen ? <Ionicons name="checkmark" size={14} color={theme.backgroundElement} /> : null}
              </View>
              <Text style={[styles.label, { color: theme.text }]}>{option.label}</Text>
              {showResults && option.votes !== null ? (
                <Text style={[styles.count, { color: theme.textSecondary }]}>{option.votes}</Text>
              ) : null}
            </View>
            {showResults ? (
              <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                <View style={[styles.bar, { width: `${share * 100}%`, backgroundColor: chosen ? accentText : theme.textSecondary }]} />
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {showResults && poll.total_voters !== null ? (
        <Body muted>{t('polls.voted', { count: poll.total_voters })}</Body>
      ) : (
        <Body muted>{t('polls.voteToSee')}</Body>
      )}

      <ErrorText>{error}</ErrorText>

      {!poll.is_closed ? (
        <Button
          title={hasVoted ? t('polls.changeVote') : t('polls.vote')}
          onPress={() => run(() => vote.mutateAsync({ pollId: poll.id, optionIds: selected }))}
          loading={vote.isPending}
          disabled={selected.length === 0 || sameSet(selected, poll.my_option_ids)}
        />
      ) : null}

      {poll.creator_id !== userId ? <ReportButton type="poll" targetId={poll.id} /> : null}

      {canManage ? (
        <View style={styles.manage}>
          {!poll.is_closed ? (
            <Button
              title={t('polls.closePoll')}
              variant="secondary"
              style={styles.manageButton}
              loading={close.isPending}
              onPress={() =>
                confirm(t('polls.closeTitle'), t('polls.closeMessage'), t('polls.closeAction'), () =>
                  run(() => close.mutateAsync(poll.id)),
                )
              }
            />
          ) : null}
          <Button
            title={t('common.remove')}
            variant="danger"
            style={styles.manageButton}
            loading={remove.isPending}
            onPress={() =>
              confirm(t('polls.removeTitle'), t('polls.removeMessage'), t('common.remove'), () =>
                run(() => remove.mutateAsync(poll.id)),
              )
            }
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: 46, paddingVertical: 8, gap: 8, justifyContent: 'center' },
  optionLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // The share of the votes, under the choice.
  track: { height: 6, borderRadius: 3, marginLeft: 34, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 17, lineHeight: 22 },
  count: { fontSize: 15, fontWeight: 600 },
  manage: { flexDirection: 'row', gap: Spacing.two },
  manageButton: { flex: 1 },
});
