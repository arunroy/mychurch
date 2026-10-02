import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Row, Screen, TextField, Checkmark } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useChatGroupMembers, useCreateChatGroup, useDeleteChatGroup, useManageableChatGroups, useUpdateChatGroup } from '@/lib/chat-groups';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { ManageableChatGroup } from '@/lib/database.types';
import { useMembers } from '@/lib/members';
import { friendlyError } from '@/lib/supabase';

const SHOWN = 200;

// Creates a chat group, or with ?id= changes one: its name, what it is for, and who is in it. Only the Pastor and
// elders. Changing who is in a group never shows them its messages.
export default function ChatGroupEditScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { church_id } = useActiveChurch();
  const { canManageChatGroups } = usePermissions();
  const groups = useManageableChatGroups(church_id, canManageChatGroups);
  const current = useChatGroupMembers(id && canManageChatGroups ? id : null);

  if (!canManageChatGroups) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('chatGroups.onlyLeaders')}</Body>
      </Screen>
    );
  }
  if (id && (groups.isPending || current.isPending)) return <Loading />;

  const existing = id ? groups.data?.find((g) => g.id === id) : undefined;
  if (id && !existing) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('chatGroups.gone')}</Body>
      </Screen>
    );
  }
  return <GroupForm existing={existing ?? null} currentMembers={current.data?.map((m) => m.user_id) ?? null} />;
}

function GroupForm({ existing, currentMembers }: { existing: ManageableChatGroup | null; currentMembers: string[] | null }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId()!;
  const members = useMembers(church_id);
  const create = useCreateChatGroup(church_id);
  const update = useUpdateChatGroup(church_id);
  const remove = useDeleteChatGroup(church_id);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  // The person creating a group starts in it, since a group can only be read by the people in it.
  const [chosen, setChosen] = useState<string[]>(currentMembers ?? [userId]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const approved = (members.data ?? []).filter((m) => m.status === 'approved' && m.profile?.full_name);
  const q = search.trim().toLowerCase();
  const shown = approved.filter((m) => !q || m.profile!.full_name.toLowerCase().includes(q));
  const busy = create.isPending || update.isPending || remove.isPending;

  function toggle(id: string) {
    setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  async function onSave() {
    setError(null);
    const input = { name: name.trim(), description: description.trim(), members: chosen };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, ...input });
      else await create.mutateAsync(input);
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onDelete() {
    if (!existing) return;
    confirm(t('chatGroups.deleteTitle'), t('chatGroups.deleteMessage', { name: existing.name }), t('common.delete'), async () => {
      try {
        await remove.mutateAsync(existing.id);
        router.back();
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{existing ? t('chatGroups.editTitle') : t('chatGroups.newTitle')}</Heading>
        <TextField
          label={t('chatGroups.name')}
          value={name}
          onChangeText={setName}
          maxLength={60}
          placeholder={t('chatGroups.namePlaceholder')}
        />
        <TextField label={t('chatGroups.description')} value={description} onChangeText={setDescription} maxLength={200} />
      </Card>

      <Card>
        <Heading>{t('chatGroups.membersHeading')}</Heading>
        <Body muted>{t('chatGroups.membersNote')}</Body>
        <TextField label={t('chatGroups.search')} value={search} onChangeText={setSearch} autoCorrect={false} placeholder={t('common.name')} />
        <Body>{t('chatGroups.selected', { count: chosen.length })}</Body>
        {!chosen.includes(userId) ? <Body muted>{t('chatGroups.notInNote')}</Body> : null}
        {members.isPending ? <Loading /> : null}
        {shown.slice(0, SHOWN).map((m) => {
          const on = chosen.includes(m.user_id);
          return (
            <Row
              key={m.user_id}
              title={m.profile!.full_name}
              right={<Checkmark visible={on} />}
              onPress={() => toggle(m.user_id)}
            />
          );
        })}
        {shown.length === 0 ? <Body muted>{t('newMessage.noMatch')}</Body> : null}
        {shown.length > SHOWN ? <Body muted>{t('funds.partyMore')}</Body> : null}
      </Card>

      <Button title={existing ? t('chatGroups.save') : t('chatGroups.create')} onPress={onSave} loading={create.isPending || update.isPending} disabled={!name.trim() || busy} />
      {existing ? <Button title={t('chatGroups.delete')} variant="danger" onPress={onDelete} loading={remove.isPending} disabled={busy} /> : null}
      <Gap />
    </Screen>
  );
}
