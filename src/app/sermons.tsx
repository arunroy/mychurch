import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, ErrorText, Gap, Loading, Row, Screen, TextField } from '@/components/ui';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { formatDay } from '@/lib/dates';
import { matchesSearch, useSermons } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// The church's sermons: a list of titles with links to read or watch them. Leaders add them and see drafts.
export default function SermonsScreen() {
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const sermons = useSermons(church_id);
  const [search, setSearch] = useState('');

  const shown = sermons.data?.filter((s) => matchesSearch(s, search)) ?? [];

  return (
    <Screen edges={['bottom']}>
      {isLeader ? <Button title="Add a sermon" onPress={() => router.push('/sermon-edit')} /> : null}

      <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Title or speaker" autoCorrect={false} />

      <ErrorText>{sermons.error ? friendlyError(sermons.error) : null}</ErrorText>
      {sermons.isPending ? <Loading /> : null}

      {sermons.data && sermons.data.length === 0 ? (
        <Body muted>No sermons yet.{isLeader ? ' Add one with a link to read or watch it.' : ''}</Body>
      ) : null}
      {sermons.data && sermons.data.length > 0 && shown.length === 0 ? <Body muted>No sermon matches that.</Body> : null}

      {shown.length > 0 ? (
        <Card>
          {shown.map((sermon) => (
            <Row
              key={sermon.id}
              title={sermon.title}
              subtitle={[
                sermon.published ? null : 'Draft',
                sermon.speaker || null,
                formatDay(sermon.sermon_date),
                sermon.reference || null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push({ pathname: '/sermon/[id]', params: { id: sermon.id } })}
            />
          ))}
        </Card>
      ) : null}
      <Gap />
    </Screen>
  );
}
