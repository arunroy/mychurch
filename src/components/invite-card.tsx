import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Heading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { inviteMessage, useJoinCode } from '@/lib/members';
import { friendlyError, supabase } from '@/lib/supabase';

/** The church's join code with ways to share it. Leaders only. */
export function InviteCard() {
  const theme = useTheme();
  const { church } = useActiveChurch();
  const { isLeader, canEditChurch } = usePermissions();
  const code = useJoinCode(church.id, isLeader);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLeader || !code.data) return null;
  const joinCode = code.data;

  async function copy() {
    await Clipboard.setStringAsync(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function newCode() {
    confirm(
      'Make a new code?',
      'The old code and invite links will stop working. People already in the church are not affected.',
      'Make new code',
      async () => {
        const { error: codeError } = await supabase.rpc('regenerate_join_code', { p_church: church.id });
        if (codeError) setError(friendlyError(codeError));
        else queryClient.invalidateQueries({ queryKey: ['join-code', church.id] });
      },
    );
  }

  return (
    <Card>
      <Heading>Invite members</Heading>
      <Body muted>
        {church.requires_approval
          ? 'People who use this code still need approval from you or an elder.'
          : 'Anyone with this code joins straight away.'}
      </Body>
      <View style={[styles.codeBox, { backgroundColor: theme.background }]}>
        <Text selectable style={[styles.code, { color: theme.text }]} accessibilityLabel={`Join code ${joinCode.split('').join(' ')}`}>
          {joinCode}
        </Text>
      </View>
      <Button title="Share invite" onPress={() => Share.share({ message: inviteMessage(church.name, joinCode) })} />
      <Button title={copied ? 'Copied' : 'Copy code'} variant="secondary" onPress={copy} />
      {canEditChurch ? <Button title="Make a new code" variant="secondary" onPress={newCode} /> : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

const styles = StyleSheet.create({
  codeBox: { borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' },
  code: { fontSize: 32, fontWeight: 700, letterSpacing: 6, fontVariant: ['tabular-nums'] },
});
