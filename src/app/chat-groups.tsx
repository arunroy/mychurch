import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Gap, Loading, Row, Screen } from '@/components/ui';
import { useManageableChatGroups } from '@/lib/chat-groups';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { friendlyError } from '@/lib/supabase';

// The Pastor and elders keep the church's chat groups here: committees and fellowships with their own chat.
// This list shows names and sizes only. A group's messages are readable only by the people in it.
export default function ChatGroupsScreen() {
  const { t } = useTranslation();
  const { canManageChatGroups } = usePermissions();

  if (!canManageChatGroups) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('chatGroups.onlyLeaders')}</Body>
      </Screen>
    );
  }
  return <Groups />;
}

function Groups() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const groups = useManageableChatGroups(church_id, true);

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('chatGroups.intro')}</Body>
      <Button title={t('chatGroups.new')} onPress={() => router.push('/chat-group-edit')} />

      {groups.isPending ? <Loading /> : null}
      <ErrorText>{groups.error ? friendlyError(groups.error) : null}</ErrorText>
      {groups.data?.length === 0 ? <Body muted>{t('chatGroups.none')}</Body> : null}

      {groups.data && groups.data.length > 0 ? (
        <Card>
          {groups.data.map((group) => (
            <Row
              key={group.id}
              title={group.name}
              subtitle={[
                t('chatTab.groupMembers', { count: group.member_count }),
                group.i_am_member ? t('chatGroups.youAreIn') : t('chatGroups.youAreNotIn'),
                group.description || null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push({ pathname: '/chat-group-edit', params: { id: group.id } })}
            />
          ))}
        </Card>
      ) : null}
      <Gap />
    </Screen>
  );
}
