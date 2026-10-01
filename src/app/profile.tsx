import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { router } from 'expo-router';
import { Avatar, Body, Button, Card, Chip, ErrorText, Heading, Screen, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useProfile, useUserId } from '@/lib/auth';
import { useActiveChurch, useChurch } from '@/lib/church';
import { pickAndUploadImage } from '@/lib/images';
import { daysInMonth, MONTHS } from '@/lib/special-days';
import { friendlyError, publicUrl, supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const userId = useUserId()!;
  const profile = useProfile();
  const active = useActiveChurch();
  const { refresh } = useChurch();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [busy, setBusy] = useState<'name' | 'photo' | 'directory' | 'birthday' | null>(null);
  const [birthMonth, setBirthMonth] = useState<number | null>(profile.data?.birth_month ?? null);
  const [birthDay, setBirthDay] = useState(profile.data?.birth_day ? String(profile.data.birth_day) : '');
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

  const dayNumber = Number(birthDay);
  const birthdayValid =
    birthMonth !== null && Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= daysInMonth(birthMonth);
  const birthdayChanged = birthMonth !== (profile.data?.birth_month ?? null) || dayNumber !== (profile.data?.birth_day ?? 0);

  async function saveBirthday(clear: boolean) {
    setBusy('birthday');
    setError(null);
    const { error: saveError } = await supabase
      .from('profiles')
      .update(clear ? { birth_month: null, birth_day: null } : { birth_month: birthMonth, birth_day: dayNumber })
      .eq('id', userId);
    if (saveError) setError(friendlyError(saveError));
    else {
      if (clear) {
        setBirthMonth(null);
        setBirthDay('');
      }
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await queryClient.invalidateQueries({ queryKey: ['special-days'] });
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
        <Heading>Your birthday</Heading>
        <Body muted>Your church sees it on Home so they can wish and pray for you. The year is never saved.</Body>
        <View style={styles.chips}>
          {MONTHS.map((label, i) => (
            <Chip key={label} label={label.slice(0, 3)} selected={birthMonth === i + 1} onPress={() => setBirthMonth(i + 1)} />
          ))}
        </View>
        <TextField label="Day" value={birthDay} onChangeText={setBirthDay} keyboardType="number-pad" maxLength={2} placeholder="14" />
        <Button
          title="Save birthday"
          onPress={() => saveBirthday(false)}
          loading={busy === 'birthday'}
          disabled={!birthdayValid || !birthdayChanged}
        />
        {profile.data?.birth_month ? (
          <Button title="Remove my birthday" variant="secondary" onPress={() => saveBirthday(true)} disabled={busy === 'birthday'} />
        ) : null}
      </Card>

      <Card>
        <ToggleRow
          title={`Show me in the ${active.church.name} directory`}
          subtitle="Leaders can always see you. Your birthday is hidden from the church too if you turn this off."
          value={active.directory_visible}
          onValueChange={setDirectoryVisible}
          disabled={busy === 'directory'}
        />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Body muted>Your email is never shown to other members.</Body>

      <Button title="Delete my account" variant="danger" onPress={() => router.push('/delete-account')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
