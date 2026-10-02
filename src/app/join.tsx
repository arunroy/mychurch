import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Avatar, Body, Button, Card, ErrorText, Heading, Row, Screen, TextField } from '@/components/ui';
import { useChurch } from '@/lib/church';
import { clearPendingInviteCode, getPendingInviteCode } from '@/lib/invite';
import { goToChurch } from '@/lib/navigation';
import { friendlyError, publicUrl, supabase } from '@/lib/supabase';

export default function JoinScreen() {
  const { t } = useTranslation();
  // Invite links open this screen with ?code=...
  const params = useLocalSearchParams<{ code?: string }>();
  const { refresh, setActiveChurch, memberships } = useChurch();
  const [code, setCode] = useState(params.code?.toUpperCase() ?? '');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fill in a code from an invite link opened before signing in.
  useEffect(() => {
    if (params.code) return;
    getPendingInviteCode().then((saved) => saved && setCode((current) => current || saved));
  }, [params.code]);

  const results = useQuery({
    queryKey: ['church-search', search.trim()],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error: searchError } = await supabase.rpc('search_churches', { p_query: search.trim() });
      if (searchError) throw searchError;
      return data;
    },
  });

  async function finish(churchId: string) {
    await clearPendingInviteCode();
    await setActiveChurch(churchId);
    goToChurch(await refresh(), churchId);
  }

  async function joinWithCode() {
    setBusy('code');
    setError(null);
    const { data: churchId, error: joinError } = await supabase.rpc('join_church_by_code', { p_code: code });
    if (joinError || !churchId) {
      await clearPendingInviteCode();
      setError(friendlyError(joinError));
      setBusy(null);
      return;
    }
    await finish(churchId);
  }

  async function requestToJoin(churchId: string) {
    setBusy(churchId);
    setError(null);
    const { error: requestError } = await supabase.rpc('request_to_join', { p_church: churchId });
    if (requestError) {
      setError(friendlyError(requestError));
      setBusy(null);
      return;
    }
    await finish(churchId);
  }

  const alreadyIn = new Set(memberships.map((m) => m.church_id));

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>{t('join.haveCode')}</Heading>
        <TextField
          label={t('join.churchCode')}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          placeholder="ABCD2345"
          hint={t('join.codeHint')}
        />
        <Button title={t('join.join')} onPress={joinWithCode} loading={busy === 'code'} disabled={code.length !== 8 || !!busy} />
      </Card>

      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{t('join.orFind')}</Heading>
        <TextField
          label={t('join.nameOrCity')}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          placeholder={t('join.searchPlaceholder')}
          returnKeyType="search"
        />
        {results.isFetching ? <ActivityIndicator /> : null}
        {results.data?.length === 0 ? <Body muted>{t('join.noMatch')}</Body> : null}
        {results.data?.map((church) => (
          <Row
            key={church.id}
            title={church.name}
            subtitle={church.city}
            left={<Avatar name={church.name} uri={publicUrl('church-logos', church.logo_path)} color={church.accent_color} />}
            right={
              alreadyIn.has(church.id) ? (
                <Body muted>{t('common.joined')}</Body>
              ) : (
                <Button
                  title={t('join.askToJoin')}
                  variant="secondary"
                  onPress={() => requestToJoin(church.id)}
                  loading={busy === church.id}
                  disabled={!!busy}
                />
              )
            }
          />
        ))}
        <Body muted>{t('join.askNote')}</Body>
      </Card>
    </Screen>
  );
}
