import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Avatar, Body, Card, ErrorText, Row, Screen, TextField } from '@/components/ui';
import { ROLE_LABELS, useActiveChurch } from '@/lib/church';
import { startConversation, useMessageable } from '@/lib/messages';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Pick someone in the church to write to. Leaders can always be reached; everyone else appears
// if they are in the member directory.
export default function NewMessageScreen() {
  const { church_id } = useActiveChurch();
  const people = useMessageable(church_id);
  const [filter, setFilter] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = (people.data ?? []).filter((p) => p.full_name.toLowerCase().includes(filter.trim().toLowerCase()));

  async function open(userId: string, name: string) {
    if (starting) return;
    setStarting(userId);
    setError(null);
    try {
      const id = await startConversation(church_id, userId);
      router.replace({ pathname: '/chat/[id]', params: { id, name } });
    } catch (e) {
      setError(friendlyError(e));
      setStarting(null);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <TextField label="Search" value={filter} onChangeText={setFilter} placeholder="Name" autoCorrect={false} />

      {people.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{error ?? (people.error ? friendlyError(people.error) : null)}</ErrorText>

      {people.data && shown.length === 0 ? (
        <Body muted>{filter ? 'Nobody matches that name.' : 'There is nobody to message yet.'}</Body>
      ) : null}

      {shown.length > 0 ? (
        <Card>
          {shown.map((person) => (
            <Row
              key={person.user_id}
              title={person.full_name || 'Church member'}
              subtitle={person.role === 'member' ? undefined : ROLE_LABELS[person.role]}
              left={<Avatar name={person.full_name} uri={publicUrl('avatars', person.avatar_path)} />}
              right={starting === person.user_id ? <ActivityIndicator /> : undefined}
              onPress={() => open(person.user_id, person.full_name)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
