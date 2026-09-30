import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar, Body, Button, Card, ErrorText, Heading, Row, Screen, TextField, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { ROLE_LABELS, useActiveChurch, usePermissions } from '@/lib/church';
import { memberName, useApproveMember, useMembers, useRemoveMember, type Member } from '@/lib/members';
import { friendlyError, publicUrl } from '@/lib/supabase';

export default function MembersScreen() {
  const { church } = useActiveChurch();
  const { isLeader } = usePermissions();
  const userId = useUserId();
  const members = useMembers(church.id);
  const approve = useApproveMember(church.id);
  const decline = useRemoveMember(church.id);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pending = members.data?.filter((m) => m.status === 'pending') ?? [];
  const approved = (members.data?.filter((m) => m.status === 'approved') ?? []).filter((m) =>
    memberName(m).toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const leaders = approved.filter((m) => m.role !== 'member');
  const everyoneElse = approved.filter((m) => m.role === 'member');

  function run(action: typeof approve, memberId: string) {
    setError(null);
    action.mutate(memberId, { onError: (e) => setError(friendlyError(e)) });
  }

  function renderMember(member: Member) {
    const isMe = member.user_id === userId;
    return (
      <Row
        key={member.user_id}
        title={isMe ? `${memberName(member)} (you)` : memberName(member)}
        subtitle={member.role === 'member' ? undefined : ROLE_LABELS[member.role]}
        left={<Avatar name={memberName(member)} uri={publicUrl('avatars', member.profile?.avatar_path)} />}
        onPress={!isMe ? () => router.push(`/member/${member.user_id}`) : undefined}
      />
    );
  }

  return (
    <Screen edges={['top']}>
      <Title>Members</Title>

      {members.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{error ?? (members.error ? friendlyError(members.error) : null)}</ErrorText>

      {isLeader && pending.length > 0 ? (
        <Card>
          <Heading>Asking to join</Heading>
          {pending.map((member) => (
            <View key={member.user_id} style={styles.request}>
              <Row
                title={memberName(member)}
                subtitle={`Asked ${new Date(member.created_at).toLocaleDateString()}`}
                left={<Avatar name={memberName(member)} uri={publicUrl('avatars', member.profile?.avatar_path)} />}
              />
              <View style={styles.actions}>
                <Button
                  title="Approve"
                  style={styles.action}
                  onPress={() => run(approve, member.user_id)}
                  loading={approve.isPending && approve.variables === member.user_id}
                />
                <Button
                  title="Decline"
                  variant="secondary"
                  style={styles.action}
                  onPress={() => run(decline, member.user_id)}
                  loading={decline.isPending && decline.variables === member.user_id}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <TextField label="Search" value={filter} onChangeText={setFilter} placeholder="Name" autoCorrect={false} />

      {leaders.length > 0 ? (
        <Card>
          <Heading>Leaders</Heading>
          {leaders.map(renderMember)}
        </Card>
      ) : null}

      {everyoneElse.length > 0 ? (
        <Card>
          <Heading>Members</Heading>
          {everyoneElse.map(renderMember)}
        </Card>
      ) : null}

      {!church.directory_enabled && !isLeader ? (
        <Body muted>Your church has turned off the member directory.</Body>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  request: { gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
