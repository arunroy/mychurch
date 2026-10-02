import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Body, CountBadge, IconSquare, ListSection, Row, Screen, Title } from '@/components/ui';
import { useMyChatGroups } from '@/lib/chat-groups';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { GENERAL, useChatUnreadCounts } from '@/lib/church-chat';

// The Chat tab: General, the church-wide room everyone is in, then each committee or fellowship group the person
// belongs to. Tapping one opens it. The Pastor and elders also get a way to manage the groups.
export default function ChatTab() {
  const { t } = useTranslation();
  const { church_id, church } = useActiveChurch();
  const { canManageChatGroups } = usePermissions();
  const groups = useMyChatGroups(church_id);
  const unread = useChatUnreadCounts(church_id);

  return (
    <Screen edges={['top']}>
      <Title>{t('chatTab.title')}</Title>

      <ListSection inset={44}>
        <Row
          title={t('chatTab.general')}
          subtitle={t('chatTab.subtitle', { church: church.name })}
          left={<IconSquare icon="chatbubbles-outline" color="blue" />}
          right={<CountBadge count={unread[GENERAL] ?? 0} />}
          onPress={() => router.push('/chat-room')}
        />
      </ListSection>

      <ListSection title={t('chatTab.groupsSection')} footer={t('chatTab.groupsFooter')} inset={44}>
        {(groups.data ?? []).map((g) => (
          <Row
            key={g.id}
            title={g.name}
            subtitle={g.description || t('chatTab.groupMembers', { count: g.member_count })}
            left={<IconSquare icon="people-outline" color="teal" />}
            right={<CountBadge count={unread[g.id] ?? 0} />}
            onPress={() => router.push({ pathname: '/chat-room', params: { group: g.id } })}
          />
        ))}
        {canManageChatGroups ? (
          <Row title={t('chatTab.manageGroups')} left={<IconSquare icon="settings-outline" color="gray" />} onPress={() => router.push('/chat-groups')} />
        ) : null}
      </ListSection>

      {groups.data && groups.data.length === 0 && !canManageChatGroups ? <Body muted>{t('chatTab.noGroups')}</Body> : null}
    </Screen>
  );
}
