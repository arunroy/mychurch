import { useState } from 'react';

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
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const inbox = useAnonymousInbox(church_id, isPastor);

  if (!isPastor) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only the Pastor can read anonymous messages.</Body>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Body muted>Nobody can see who wrote these. You can reply only where the sender asked for one.</Body>
      <ErrorText>{inbox.error ? friendlyError(inbox.error) : null}</ErrorText>
      {inbox.isPending ? <Loading /> : null}
      {inbox.data?.length === 0 ? <Body muted>No anonymous messages.</Body> : null}
      {inbox.data?.map((message) => <MessageCard key={message.id} message={message} />)}
      <Gap />
    </Screen>
  );
}

function MessageCard({ message }: { message: AnonymousInboxItem }) {
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
      <Body muted>{`${shortDate(`${message.sent_on}T12:00:00`)}${message.is_read ? '' : ' · New'}`}</Body>
      <Body>{message.body}</Body>
      <ErrorText>{error}</ErrorText>

      {message.reply ? (
        <>
          <Body muted>{`Your reply${message.replied_on ? ` on ${shortDate(`${message.replied_on}T12:00:00`)}` : ''}:`}</Body>
          <Body>{message.reply}</Body>
        </>
      ) : message.can_reply ? (
        <>
          <TextField
            label="Reply"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }}
            hint="The sender sees this when they enter their code."
          />
          <Button
            title="Send reply"
            loading={reply.isPending}
            disabled={!text.trim()}
            onPress={() => run(async () => {
              await reply.mutateAsync({ messageId: message.id, reply: text.trim() });
              setText('');
            })}
          />
        </>
      ) : (
        <Body muted>The sender did not ask for a reply, so there is no way to answer.</Body>
      )}

      {!message.is_read ? (
        <Button title="Mark as read" variant="secondary" loading={markRead.isPending} onPress={() => run(() => markRead.mutateAsync(message.id))} />
      ) : null}
      <Button
        title="Delete"
        variant="danger"
        loading={remove.isPending}
        onPress={() =>
          confirm('Delete this message?', 'It will be removed for good.', 'Delete', () => run(() => remove.mutateAsync(message.id)))
        }
      />
    </Card>
  );
}
