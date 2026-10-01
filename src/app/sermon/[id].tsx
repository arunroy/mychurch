import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { Body, Button, Card, ErrorText, Heading, Loading, Screen, Title } from '@/components/ui';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { formatDay } from '@/lib/dates';
import { linkSite, useDeleteSermon, useSermon } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// One sermon, with buttons that open its links. The app keeps no sermon text; the text lives on the site it links to.
export default function SermonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const sermon = useSermon(church_id, id);
  const remove = useDeleteSermon(church_id);
  const [error, setError] = useState<string | null>(null);

  if (sermon.isPending) return <Loading />;

  if (!sermon.data) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>This sermon is no longer in the list.</Body>
        <Button title="Back to sermons" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = sermon.data;

  async function open(url: string) {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError('Could not open that link.');
    }
  }

  function onDelete() {
    confirm('Delete this sermon?', `“${item.title}” will be removed from the list for everyone.`, 'Delete', async () => {
      try {
        await remove.mutateAsync(item.id);
        router.back();
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  return (
    <Screen edges={['bottom']}>
      <Title>{item.title}</Title>
      <ErrorText>{error}</ErrorText>

      {!item.published ? (
        <Card>
          <Body>This is a draft. Only church leaders can see it until it is published.</Body>
        </Card>
      ) : null}

      <Card>
        {item.speaker ? <Heading>{item.speaker}</Heading> : null}
        <Body muted>{formatDay(item.sermon_date)}</Body>
        {item.reference ? <Body>{item.reference}</Body> : null}
      </Card>

      {item.read_url ? (
        <>
          <Button title="Read the sermon" onPress={() => open(item.read_url!)} />
          <Body muted>{`Opens ${linkSite(item.read_url)}`}</Body>
        </>
      ) : null}
      {item.media_url ? (
        <>
          <Button title="Watch or listen" variant={item.read_url ? 'secondary' : 'primary'} onPress={() => open(item.media_url!)} />
          <Body muted>{`Opens ${linkSite(item.media_url)}`}</Body>
        </>
      ) : null}

      {isLeader ? (
        <>
          <Button title="Edit" variant="secondary" onPress={() => router.push({ pathname: '/sermon-edit', params: { id: item.id } })} />
          <Button title="Delete this sermon" variant="danger" onPress={onDelete} loading={remove.isPending} />
        </>
      ) : null}
    </Screen>
  );
}
