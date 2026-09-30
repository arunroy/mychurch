import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Avatar, Body, Button, Card, ErrorText, Heading, Row, Screen, Title } from '@/components/ui';
import { startConversation } from '@/lib/messages';
import type { MemberRole } from '@/lib/database.types';
import { ROLE_LABELS, useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { memberName, useMembers, useRemoveMember, useSetRole } from '@/lib/members';
import { friendlyError, publicUrl } from '@/lib/supabase';

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  pastor: 'Runs the church in the app, including settings, roles and the private Pastor inbox.',
  elder: 'Approves members, can remove any event from the calendar, and will run polls and answer questions.',
  admin: 'Church office or tech help: settings, members and the calendar. Can’t read private messages.',
  member: 'Takes part in everything shared with the church.',
};

// Leaders manage one member here. Only a Pastor can change roles.
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church } = useActiveChurch();
  const { canChangeRoles, isPastor, isLeader } = usePermissions();
  const members = useMembers(church.id);
  const setRole = useSetRole(church.id);
  const remove = useRemoveMember(church.id);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const member = members.data?.find((m) => m.user_id === id);
  if (!member) return null;
  const name = memberName(member);
  const canRemove = isLeader && (member.role === 'member' || isPastor);

  function changeRole(role: MemberRole) {
    setError(null);
    setRole.mutate({ userId: member!.user_id, role }, { onError: (e) => setError(friendlyError(e)) });
  }

  async function openChat() {
    setOpening(true);
    setError(null);
    try {
      const conversationId = await startConversation(church.id, member!.user_id);
      router.replace({ pathname: '/chat/[id]', params: { id: conversationId, name } });
    } catch (e) {
      setError(friendlyError(e));
      setOpening(false);
    }
  }

  function removeMember() {
    confirm(
      `Remove ${name}?`,
      `They'll lose access to ${church.name} and would need to ask to join again.`,
      'Remove',
      () =>
        remove.mutate(member!.user_id, {
          onSuccess: () => router.back(),
          onError: (e) => setError(friendlyError(e)),
        }),
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: name }} />
      <Avatar name={name} uri={publicUrl('avatars', member.profile?.avatar_path)} size={72} />
      <Title>{name}</Title>
      <Body muted>
        {member.status === 'pending'
          ? 'Waiting for approval'
          : `${ROLE_LABELS[member.role]} · joined ${new Date(member.approved_at ?? member.created_at).toLocaleDateString()}`}
      </Body>

      <ErrorText>{error}</ErrorText>

      {member.status === 'approved' ? <Button title={`Message ${name}`} onPress={openChat} loading={opening} /> : null}

      {canChangeRoles && member.status === 'approved' ? (
        <Card>
          <Heading>Role</Heading>
          {(Object.keys(ROLE_LABELS) as MemberRole[]).map((role) => (
            <Row
              key={role}
              title={ROLE_LABELS[role]}
              subtitle={ROLE_DESCRIPTIONS[role]}
              right={member.role === role ? <Body>✓</Body> : undefined}
              onPress={member.role === role || setRole.isPending ? undefined : () => changeRole(role)}
            />
          ))}
        </Card>
      ) : null}

      {canRemove ? (
        <Button title={`Remove from ${church.name}`} variant="danger" onPress={removeMember} loading={remove.isPending} />
      ) : null}
    </Screen>
  );
}
