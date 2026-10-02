import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ReportButton } from '@/components/report-sheet';
import { Avatar, Body, Button, Card, ErrorText, Heading, Row, Screen, Title, ToggleRow, Checkmark } from '@/components/ui';
import { startConversation } from '@/lib/messages';
import type { MemberRole } from '@/lib/database.types';
import { ROLE_LABELS, useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { getDateLocale } from '@/lib/dates';
import { memberName, useMembers, useRemoveMember, useSetRole, useSetWorshipLeader } from '@/lib/members';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Leaders manage one member here. Only a Pastor can change roles.
export default function MemberScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church } = useActiveChurch();
  const { canChangeRoles, isPastor, isLeader } = usePermissions();
  const members = useMembers(church.id);
  const setRole = useSetRole(church.id);
  const setWorshipLeader = useSetWorshipLeader(church.id);
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
      t('member.removeTitle', { name }),
      t('member.removeMessage', { church: church.name }),
      t('common.remove'),
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
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar name={name} uri={publicUrl('avatars', member.profile?.avatar_path)} size={88} />
        <Title>{name}</Title>
        <Body muted>
          {member.status === 'pending'
            ? t('member.waiting')
            : t('member.roleJoined', {
                role: t(`roles.${member.role}`),
                date: new Date(member.approved_at ?? member.created_at).toLocaleDateString(getDateLocale()),
              })}
        </Body>
      </View>

      <ErrorText>{error}</ErrorText>

      {member.status === 'approved' ? <Button title={t('member.message', { name })} onPress={openChat} loading={opening} /> : null}
      {member.status === 'approved' ? <ReportButton type="member" targetId={member.user_id} label={t('member.report')} /> : null}

      {canChangeRoles && member.status === 'approved' ? (
        <Card>
          <Heading>{t('member.role')}</Heading>
          {(Object.keys(ROLE_LABELS) as MemberRole[]).map((role) => (
            <Row
              key={role}
              title={t(`roles.${role}`)}
              subtitle={t(`roleDescriptions.${role}`)}
              right={<Checkmark visible={member.role === role} />}
              chevron={false}
              onPress={member.role === role || setRole.isPending ? undefined : () => changeRole(role)}
            />
          ))}
        </Card>
      ) : null}

      {canChangeRoles && member.status === 'approved' ? (
        <Card>
          <ToggleRow
            title={t('worship.leaderToggle')}
            subtitle={t('worship.leaderToggleHint')}
            value={member.is_worship_leader}
            disabled={setWorshipLeader.isPending}
            onValueChange={(value) => {
              setError(null);
              setWorshipLeader.mutate({ userId: member.user_id, value }, { onError: (e) => setError(friendlyError(e)) });
            }}
          />
        </Card>
      ) : null}

      {canRemove ? (
        <Button title={t('member.removeFrom', { church: church.name })} variant="danger" onPress={removeMember} loading={remove.isPending} />
      ) : null}
    </Screen>
  );
}
