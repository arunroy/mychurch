import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Body, Button, Card, ErrorText, Heading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { ChurchStatus } from '@/lib/database.types';
import { friendlyError, supabase } from '@/lib/supabase';

// Platform admins confirm new churches are real before anyone can join them.
export default function ReviewChurchesScreen() {
  const queryClient = useQueryClient();
  const { refresh } = useChurch();
  const [error, setError] = useState<string | null>(null);

  const churches = useQuery({
    queryKey: ['churches-for-review'],
    queryFn: async () => {
      const { data, error: listError } = await supabase.rpc('list_churches_for_review', { p_status: 'pending' });
      if (listError) throw listError;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ChurchStatus }) => {
      const { error: statusError } = await supabase.rpc('set_church_status', { p_church: id, p_status: status });
      if (statusError) throw statusError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['churches-for-review'] });
      // The admin may have just verified their own church.
      await refresh();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  return (
    <Screen edges={['bottom']}>
      <Body muted>Check each church is real (a website, a phone call, or a reply from its email) before verifying it.</Body>
      <ErrorText>{error ?? (churches.error ? friendlyError(churches.error) : null)}</ErrorText>
      {churches.isPending ? <ActivityIndicator /> : null}
      {churches.data?.length === 0 ? <Body>No churches are waiting.</Body> : null}

      {churches.data?.map((church) => (
        <Card key={church.id}>
          <Heading>{church.name}</Heading>
          <Body>{church.city}</Body>
          <Body muted>
            {church.contact_email} · registered by {church.created_by_name || 'unknown'} on{' '}
            {new Date(church.created_at).toLocaleDateString()}
          </Body>
          <View style={styles.actions}>
            <Button
              title="Verify"
              style={styles.action}
              loading={setStatus.isPending && setStatus.variables?.id === church.id}
              onPress={() => setStatus.mutate({ id: church.id, status: 'active' })}
            />
            <Button
              title="Suspend"
              variant="danger"
              style={styles.action}
              onPress={() =>
                confirm(
                  `Suspend ${church.name}?`,
                  'Its members will see that the church is paused.',
                  'Suspend',
                  () => setStatus.mutate({ id: church.id, status: 'suspended' }),
                )
              }
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
