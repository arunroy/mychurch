import { useState } from 'react';

import { ColorPicker } from '@/components/color-picker';
import { Body, Button, ErrorText, Screen, TextField } from '@/components/ui';
import { DEFAULT_ACCENT } from '@/constants/theme';
import { useChurch } from '@/lib/church';
import { goToChurch } from '@/lib/navigation';
import { friendlyError, supabase } from '@/lib/supabase';

export default function RegisterChurchScreen() {
  const { refresh, setActiveChurch } = useChurch();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState(DEFAULT_ACCENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && city.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim());

  async function register() {
    setBusy(true);
    setError(null);
    const { data: churchId, error: registerError } = await supabase.rpc('register_church', {
      p_name: name.trim(),
      p_city: city.trim(),
      p_contact_email: email.trim(),
      p_accent_color: color,
    });
    if (registerError || !churchId) {
      setError(friendlyError(registerError));
      setBusy(false);
      return;
    }
    await setActiveChurch(churchId);
    goToChurch(await refresh(), churchId);
  }

  return (
    <Screen edges={['bottom']}>
      <Body muted>
        You&apos;ll be the church&apos;s Pastor in the app. You can add other Pastors, elders and staff once it&apos;s set
        up.
      </Body>
      <TextField label="Church name" value={name} onChangeText={setName} placeholder="Grace Chapel" maxLength={120} />
      <TextField label="City" value={city} onChangeText={setCity} placeholder="Springfield" maxLength={120} />
      <TextField
        label="Church contact email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="office@gracechapel.org"
        hint="We use this to confirm the church is real."
      />
      <Body>Church colour</Body>
      <ColorPicker value={color} onChange={setColor} />
      <ErrorText>{error}</ErrorText>
      <Button title="Register church" onPress={register} loading={busy} disabled={!valid} />
      <Body muted>You can add your logo and invite members once your church is verified.</Body>
    </Screen>
  );
}
