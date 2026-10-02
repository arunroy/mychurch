import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Gap, Loading, Screen, TextField } from '@/components/ui';
import {
  useAnonymousInbox,
  useDeleteAnonymous,
  useMarkAnonymousRead,
  useReplyToAnonymous,
} from '@/lib/anonymous';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { AnonymousInboxItem } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { friendlyError } from '@/lib/supabase';

// The Pastor's anonymous messages. Nobody, the Pastor included, can see who wrote them.
export default function AnonymousInboxScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const inbox = useAnonymousInbox(church_id, isPastor);

  if (!isPastor) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('anonymous.onlyPastor')}</Body>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('anonymous.inboxIntro')}</Body>
      <ErrorText>{inbox.error ? friendlyError(inbox.error) : null}</ErrorText>
      {inbox.isPending ? <Loading /> : null}
      {inbox.data?.length === 0 ? <Body muted>{t('anonymous.none')}</Body> : null}
      {inbox.data?.map((message) => <MessageCard key={message.id} message={message} />)}
      <Gap />
    </Screen>
  );
}

function MessageCard({ message }: { message: AnonymousInboxItem }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const markRead = useMarkAnonymousRead(church_id);
  const reply = useReplyToAnonymous(church_id);
  const remove = useDeleteAnonymous(church_id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Card>
      <Body muted>{message.is_read ? shortDate(`${message.sent_on}T12:00:00`) : t('anonymous.newOn', { date: shortDate(`${message.sent_on}T12:00:00`) })}</Body>
      <Body>{message.body}</Body>
      <ErrorText>{error}</ErrorText>

      {message.reply ? (
        <>
          <Body muted>{message.replied_on ? t('anonymous.yourReplyOn', { date: shortDate(`${message.replied_on}T12:00:00`) }) : t('anonymous.yourReply')}</Body>
          <Body>{message.reply}</Body>
        </>
      ) : message.can_reply ? (
        <>
          <TextField
            label={t('elders.reply')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }}
            hint={t('anonymous.replyHint')}
          />
          <Button
            title={t('anonymous.sendReply')}
            loading={reply.isPending}
            disabled={!text.trim()}
            onPress={() => run(async () => {
              await reply.mutateAsync({ messageId: message.id, reply: text.trim() });
              setText('');
            })}
          />
        </>
      ) : (
        <Body muted>{t('anonymous.noWay')}</Body>
      )}

      {!message.is_read ? (
        <Button title={t('anonymous.markRead')} variant="secondary" loading={markRead.isPending} onPress={() => run(() => markRead.mutateAsync(message.id))} />
      ) : null}
      <Button
        title={t('common.delete')}
        variant="danger"
        loading={remove.isPending}
        onPress={() =>
          confirm(t('anonymous.deleteTitle'), t('anonymous.deleteMessage'), t('common.delete'), () => run(() => remove.mutateAsync(message.id)))
        }
      />
    </Card>
  );
}
