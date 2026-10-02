import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Screen, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useAllAnnouncements, usePostAnnouncement, useRemoveAnnouncement } from '@/lib/announcements';
import { confirm } from '@/lib/confirm';
import type { Announcement } from '@/lib/database.types';
import { endsAfter, SHORT_DURATIONS, shortDate, type Duration } from '@/lib/durations';
import { friendlyError } from '@/lib/supabase';

const DURATIONS: Duration[] = [...SHORT_DURATIONS, { label: 'until-i-remove', days: null }];

// Leaders (Pastor, elders, admins) post notices that appear on everyone's Home screen.
export default function AnnouncementsScreen() {
  const { t } = useTranslation();
  const { isLeader } = usePermissions();
  if (!isLeader) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('announce.onlyLeaders')}</Body>
      </Screen>
    );
  }
  return <Manager />;
}

function statusOf(item: Announcement, t: TFunction) {
  if (!item.expires_at) return t('announce.showingUntilRemove');
  return new Date(item.expires_at) > new Date() ? t('announce.showingUntil', { date: shortDate(item.expires_at) }) : t('announce.expired');
}

function Manager() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const all = useAllAnnouncements(church_id, true);
  const post = usePostAnnouncement(church_id);
  const remove = useRemoveAnnouncement(church_id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [days, setDays] = useState<number | null>(7);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function onPost() {
    setError(null);
    setResult(null);
    try {
      const reached = await post.mutateAsync({ title: title.trim(), body: body.trim(), expiresAt: endsAfter(days), notify });
      setTitle('');
      setBody('');
      setResult(
        !notify
          ? t('announce.postedHome')
          : reached === 0
            ? t('announce.postedNoPhones')
            : t('announce.postedNotified', { count: reached }),
      );
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onRemove(item: Announcement) {
    confirm(t('announce.removeTitle'), t('announce.removeMessage', { title: item.title }), t('common.remove'), async () => {
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
      {result ? <Body>{result}</Body> : null}

      <Card>
        <Heading>{t('announce.newTitle')}</Heading>
        <TextField label={t('announce.title')} value={title} onChangeText={setTitle} maxLength={100} placeholder={t('announce.titlePlaceholder')} />
        <TextField
          label={t('announce.details')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
          style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <Body>{t('announce.showFor')}</Body>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip key={d.label} label={d.days === null ? t('durations.untilIRemove') : t(`durations.d${d.days}`)} selected={d.days === days} onPress={() => setDays(d.days)} />
          ))}
        </View>
        <ToggleRow
          title={t('announce.notify')}
          subtitle={t('announce.notifyHint')}
          value={notify}
          onValueChange={setNotify}
        />
        <Button title={t('announce.post')} onPress={onPost} loading={post.isPending} disabled={!title.trim()} />
      </Card>

      {all.isPending ? <Loading /> : null}
      {all.data?.map((item) => (
        <Card key={item.id}>
          <Heading>{item.title}</Heading>
          {item.body ? <Body>{item.body}</Body> : null}
          <Body muted>{t('announce.posted', { status: statusOf(item, t), date: shortDate(item.created_at) })}</Body>
          <Button title={t('common.remove')} variant="danger" onPress={() => onRemove(item)} />
        </Card>
      ))}
      {all.data?.length === 0 ? <Body muted>{t('announce.none')}</Body> : null}
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
