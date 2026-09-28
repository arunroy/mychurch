import { useState } from 'react';

import { ColorPicker } from '@/components/color-picker';
import { Avatar, Body, Button, Card, ErrorText, Heading, Screen, TextField, ToggleRow } from '@/components/ui';
import type { Church } from '@/lib/database.types';
import { useActiveChurch, useChurch } from '@/lib/church';
import { pickAndUploadImage } from '@/lib/images';
import { friendlyError, publicUrl, supabase } from '@/lib/supabase';

type Editable = Partial<
  Pick<Church, 'name' | 'city' | 'contact_email' | 'accent_color' | 'logo_path' | 'requires_approval' | 'directory_enabled'>
>;

// Pastor and church admins only (the database enforces this too).
export default function ChurchSettingsScreen() {
  const { church } = useActiveChurch();
  const { refresh } = useChurch();
  const [name, setName] = useState(church.name);
  const [city, setCity] = useState(church.city);
  const [email, setEmail] = useState(church.contact_email);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(changes: Editable, what: string) {
    setBusy(what);
    setError(null);
    const { error: saveError } = await supabase.from('churches').update(changes).eq('id', church.id);
    if (saveError) setError(friendlyError(saveError));
    else await refresh();
    setBusy(null);
  }

  async function changeLogo() {
    setBusy('logo');
    setError(null);
    try {
      const path = await pickAndUploadImage('church-logos', church.id);
      if (path) await save({ logo_path: path }, 'logo');
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(null);
  }

  const detailsChanged = name.trim() !== church.name || city.trim() !== church.city || email.trim() !== church.contact_email;

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>Logo</Heading>
        <Avatar name={church.name} uri={publicUrl('church-logos', church.logo_path)} color={church.accent_color} size={72} />
        <Button title="Change logo" variant="secondary" onPress={changeLogo} loading={busy === 'logo'} />
      </Card>

      <Card>
        <Heading>Details</Heading>
        <TextField label="Church name" value={name} onChangeText={setName} maxLength={120} />
        <TextField label="City" value={city} onChangeText={setCity} maxLength={120} />
        <TextField
          label="Contact email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button
          title="Save details"
          onPress={() => save({ name: name.trim(), city: city.trim(), contact_email: email.trim() }, 'details')}
          loading={busy === 'details'}
          disabled={!detailsChanged || name.trim().length < 2}
        />
      </Card>

      <Card>
        <Heading>Colour</Heading>
        <Body muted>Used for buttons and highlights throughout the app.</Body>
        <ColorPicker value={church.accent_color} onChange={(color) => save({ accent_color: color }, 'color')} />
      </Card>

      <Card>
        <Heading>Joining</Heading>
        <ToggleRow
          title="Approve new members"
          subtitle={
            church.requires_approval
              ? 'A leader approves everyone who joins.'
              : 'Anyone with the code joins straight away. People who find the church by search still need approval.'
          }
          value={church.requires_approval}
          onValueChange={(value) => save({ requires_approval: value }, 'approval')}
          disabled={busy === 'approval'}
        />
        <ToggleRow
          title="Member directory"
          subtitle="Lets members see who else belongs to the church. Each person can still hide themselves."
          value={church.directory_enabled}
          onValueChange={(value) => save({ directory_enabled: value }, 'directory')}
          disabled={busy === 'directory'}
        />
      </Card>
    </Screen>
  );
}
