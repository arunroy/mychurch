import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Body, Button, ErrorText, Heading, Loading, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useChatGroupMembers } from '@/lib/chat-groups';
import { friendlyError, publicUrl } from '@/lib/supabase';
import { useThemePreference } from '@/lib/theme-preference';

/** Who is in a chat group, as a bottom sheet. */
export function GroupMembersSheet({ groupId, name, onClose }: { groupId: string; name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { scheme } = useThemePreference();
  const members = useChatGroupMembers(groupId);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { backgroundColor: scheme === 'dark' ? '#000000' : '#F2F2F7' }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Heading>{t('chatTab.membersTitle', { name })}</Heading>
            {members.isPending ? <Loading /> : null}
            <ErrorText>{members.error ? friendlyError(members.error) : null}</ErrorText>
            {members.data?.map((member) => (
              <Row
                key={member.user_id}
                title={member.full_name || t('newMessage.churchMember')}
                left={<Avatar name={member.full_name} uri={publicUrl('avatars', member.avatar_path)} />}
              />
            ))}
            {members.data?.length === 0 ? <Body muted>{t('chatGroups.noMembers')}</Body> : null}
            <Button title={t('common.close')} variant="secondary" onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  content: { padding: Spacing.four, gap: Spacing.three },
});
