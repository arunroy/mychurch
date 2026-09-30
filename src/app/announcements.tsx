import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useAllAnnouncements, usePostAnnouncement, useRemoveAnnouncement } from '@/lib/announcements';
import { confirm } from '@/lib/confirm';
import type { Announcement } from '@/lib/database.types';
import { endsAfter, SHORT_DURATIONS, shortDate, type Duration } from '@/lib/durations';
import { friendlyError } from '@/lib/supabase';

const DURATIONS: Duration[] = [...SHORT_DURATIONS, { label: 'Until I remove it', days: null }];

// Leaders (Pastor, elders, admins) post notices that appear on everyone's Home screen.
export default function AnnouncementsScreen() {
  const { isLeader } = usePermissions();
  const userId = useUserId();
  if (!userId) return <Loading />;
  if (!isLeader) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only the Pastor, elders and church admins can post announcements.</Body>
      </Screen>
    );
  }
  return <Manager userId={userId} />;
}

function statusOf(item: Announcement) {
  if (!item.expires_at) return 'Showing until you remove it';
  return new Date(item.expires_at) > new Date() ? `Showing until ${shortDate(item.expires_at)}` : 'Expired';
}

function Manager({ userId }: { userId: string }) {
  const { church_id } = useActiveChurch();
  const all = useAllAnnouncements(church_id, true);
  const post = usePostAnnouncement(church_id, userId);
  const remove = useRemoveAnnouncement(church_id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [days, setDays] = useState<number | null>(7);
  const [error, setError] = useState<string | null>(null);

  async function onPost() {
    setError(null);
    try {
      await post.mutateAsync({ title: title.trim(), body: body.trim(), expiresAt: endsAfter(days) });
      setTitle('');
      setBody('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onRemove(item: Announcement) {
    confirm('Remove this announcement?', `"${item.title}" will disappear from everyone's Home screen.`, 'Remove', async () => {
      try {
        await remove.mutateAsync(item.id);
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error ?? (all.error ? friendlyError(all.error) : null)}</ErrorText>

      <Card>
        <Heading>New announcement</Heading>
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={100} placeholder="Service moved to 10am" />
        <TextField
          label="Details (optional)"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
          style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <Body>Show it for</Body>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip key={d.label} label={d.label} selected={d.days === days} onPress={() => setDays(d.days)} />
          ))}
        </View>
        <Button title="Post to everyone" onPress={onPost} loading={post.isPending} disabled={!title.trim()} />
      </Card>

      {all.isPending ? <Loading /> : null}
      {all.data?.map((item) => (
        <Card key={item.id}>
          <Heading>{item.title}</Heading>
          {item.body ? <Body>{item.body}</Body> : null}
          <Body muted>{`${statusOf(item)} · posted ${shortDate(item.created_at)}`}</Body>
          <Button title="Remove" variant="danger" onPress={() => onRemove(item)} />
        </Card>
      ))}
      {all.data?.length === 0 ? <Body muted>Nothing posted yet.</Body> : null}
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
