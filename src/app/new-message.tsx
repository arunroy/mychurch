import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Avatar, Body, Card, ErrorText, Row, Screen, TextField } from '@/components/ui';
import { useActiveChurch } from '@/lib/church';
import { startConversation, useMessageable } from '@/lib/messages';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Pick someone in the church to write to. Leaders can always be reached; everyone else appears
// if they are in the member directory.
export default function NewMessageScreen() {
  const { t } = useTranslation();
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
      <TextField label={t('common.search')} value={filter} onChangeText={setFilter} placeholder={t('common.name')} autoCorrect={false} />

      {people.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{error ?? (people.error ? friendlyError(people.error) : null)}</ErrorText>

      {people.data && shown.length === 0 ? (
        <Body muted>{filter ? t('newMessage.noMatch') : t('newMessage.nobody')}</Body>
      ) : null}

      {shown.length > 0 ? (
        <Card>
          {shown.map((person) => (
            <Row
              key={person.user_id}
              title={person.full_name || t('newMessage.churchMember')}
              subtitle={person.role === 'member' ? undefined : t(`roles.${person.role}`)}
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
