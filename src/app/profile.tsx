import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Avatar, Body, Button, Card, ErrorText, Screen, TextField, ToggleRow } from '@/components/ui';
import { useProfile, useUserId } from '@/lib/auth';
import { useActiveChurch, useChurch } from '@/lib/church';
import { pickAndUploadImage } from '@/lib/images';
import { friendlyError, publicUrl, supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const userId = useUserId()!;
  const profile = useProfile();
  const active = useActiveChurch();
  const { refresh } = useChurch();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [busy, setBusy] = useState<'name' | 'photo' | 'directory' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function saveName() {
    setBusy('name');
    setError(null);
    const { error: saveError } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', userId);
    if (saveError) setError(friendlyError(saveError));
    else {
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      setSaved(true);
    }
    setBusy(null);
  }

  async function changePhoto() {
    setBusy('photo');
    setError(null);
    try {
      const path = await pickAndUploadImage('avatars', userId);
      if (path) {
        const { error: saveError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
        if (saveError) throw saveError;
        await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(null);
  }

  async function setDirectoryVisible(visible: boolean) {
    setBusy('directory');
    setError(null);
    const { error: saveError } = await supabase
      .from('memberships')
      .update({ directory_visible: visible })
      .eq('church_id', active.church_id)
      .eq('user_id', userId);
    if (saveError) setError(friendlyError(saveError));
    else await refresh();
    setBusy(null);
  }

  return (
    <Screen edges={['bottom']}>
      <Avatar name={profile.data?.full_name ?? ''} uri={publicUrl('avatars', profile.data?.avatar_path)} size={96} />
      <Button title="Change photo" variant="secondary" onPress={changePhoto} loading={busy === 'photo'} />

      <TextField
        label="Your name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setSaved(false);
        }}
        autoCapitalize="words"
        maxLength={100}
      />
      <Button
        title={saved ? 'Saved' : 'Save name'}
        onPress={saveName}
        loading={busy === 'name'}
        disabled={name.trim().length < 2 || name.trim() === profile.data?.full_name}
      />

      <Card>
        <ToggleRow
          title={`Show me in the ${active.church.name} directory`}
          subtitle="Leaders can always see you."
          value={active.directory_visible}
          onValueChange={setDirectoryVisible}
          disabled={busy === 'directory'}
        />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Body muted>Your email is never shown to other members.</Body>
    </Screen>
  );
}
