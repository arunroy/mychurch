import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const polls = usePolls(church_id);

  return (
    <Screen edges={['bottom']}>
      <Button title="Start a poll" onPress={() => router.push('/poll-new')} />
      <ErrorText>{polls.error ? friendlyError(polls.error) : null}</ErrorText>
      {polls.isPending ? <Loading /> : null}
      {polls.data?.length === 0 ? <Body muted>No polls yet. Ask the church something.</Body> : null}
      {userId ? polls.data?.map((poll) => <PollCard key={poll.id} poll={poll} userId={userId} />) : null}
      <Gap />
    </Screen>
  );
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

function PollCard({ poll, userId }: { poll: PollSummary; userId: string }) {
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
    ? 'Closed'
    : poll.closes_at
      ? `Closes ${shortDate(poll.closes_at)}`
      : 'Open until closed';

  return (
    <Card>
      <Heading>{poll.question}</Heading>
      <Body muted>
        {`${poll.creator_name || 'A church member'} · ${footer}${poll.multiple ? ' · choose any' : ''}`}
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
            style={[styles.option, { borderColor: chosen ? accentText : theme.backgroundSelected }]}>
            <View style={[styles.bar, { width: `${share * 100}%`, backgroundColor: theme.backgroundSelected }]} />
            <Text style={[styles.mark, { color: accentText }]}>{chosen ? '✓' : ''}</Text>
            <Text style={[styles.label, { color: theme.text }]}>{option.label}</Text>
            {showResults && option.votes !== null ? (
              <Text style={[styles.count, { color: theme.textSecondary }]}>{option.votes}</Text>
            ) : null}
          </Pressable>
        );
      })}

      {showResults && poll.total_voters !== null ? (
        <Body muted>{poll.total_voters === 1 ? '1 person voted' : `${poll.total_voters} people voted`}</Body>
      ) : (
        <Body muted>Vote to see the results.</Body>
      )}

      <ErrorText>{error}</ErrorText>

      {!poll.is_closed ? (
        <Button
          title={hasVoted ? 'Change my vote' : 'Vote'}
          onPress={() => run(() => vote.mutateAsync({ pollId: poll.id, optionIds: selected }))}
          loading={vote.isPending}
          disabled={selected.length === 0 || sameSet(selected, poll.my_option_ids)}
        />
      ) : null}

      {canManage ? (
        <View style={styles.manage}>
          {!poll.is_closed ? (
            <Button
              title="Close poll"
              variant="secondary"
              style={styles.manageButton}
              loading={close.isPending}
              onPress={() =>
                confirm('Close this poll?', 'Nobody will be able to vote any more, and everyone will see the results.', 'Close', () =>
                  run(() => close.mutateAsync(poll.id)),
                )
              }
            />
          ) : null}
          <Button
            title="Remove"
            variant="danger"
            style={styles.manageButton}
            loading={remove.isPending}
            onPress={() =>
              confirm('Remove this poll?', 'The poll and all its votes will be deleted.', 'Remove', () =>
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
  option: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  // Fills the row in proportion to the votes, behind the text.
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  mark: { width: 16, fontSize: 16, fontWeight: 700 },
  label: { flex: 1, fontSize: 16, lineHeight: 22, paddingVertical: Spacing.two },
  count: { fontSize: 15, fontWeight: 600 },
  manage: { flexDirection: 'row', gap: Spacing.two },
  manageButton: { flex: 1 },
});
