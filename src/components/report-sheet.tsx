import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Chip, ErrorText, Heading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch } from '@/lib/church';
import type { ReportReason, ReportTargetType } from '@/lib/database.types';
import { REPORT_REASONS, useReportContent } from '@/lib/reports';
import { useThemePreference } from '@/lib/theme-preference';
import { friendlyError } from '@/lib/supabase';

/**
 * A bottom sheet for reporting something. Reporters pick a reason and can add a note. Where the person is also
 * allowed to remove the thing (a leader looking at a chat message), `onRemove` adds that choice to the same sheet.
 */
export function ReportSheet({
  visible,
  onClose,
  type,
  targetId,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  type: ReportTargetType;
  targetId: string;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  const { scheme } = useThemePreference();
  const { church_id } = useActiveChurch();
  const report = useReportContent(church_id);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function close() {
    setReason(null);
    setDetails('');
    setError(null);
    setSent(false);
    onClose();
  }

  async function send() {
    if (!reason) return;
    setError(null);
    try {
      await report.mutateAsync({ type, targetId, reason, details: details.trim() });
      setSent(true);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: scheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {sent ? (
            <>
              <Heading>Thank you</Heading>
              <Body>Your report was sent to the people who look after this. They will take a look.</Body>
              <Button title="Done" onPress={close} />
            </>
          ) : (
            <>
              <Heading>Report this</Heading>
              <Body muted>Tell us what is wrong. Your name is not shown to the person you report.</Body>
              <View style={styles.chips}>
                {REPORT_REASONS.map((r) => (
                  <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />
                ))}
              </View>
              <TextField
                label="Anything to add? (optional)"
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={500}
                style={{ minHeight: 70, paddingTop: 12, textAlignVertical: 'top' }}
              />
              <ErrorText>{error}</ErrorText>
              <Button title="Send report" onPress={send} loading={report.isPending} disabled={!reason} />
              {onRemove ? (
                <Button
                  title="Remove this instead"
                  variant="danger"
                  onPress={() => {
                    close();
                    onRemove();
                  }}
                />
              ) : null}
              <Pressable onPress={close} accessibilityRole="button" style={styles.cancel}>
                <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A small "Report" link that opens the sheet for one thing. */
export function ReportButton({ type, targetId, label = 'Report' }: { type: ReportTargetType; targetId: string; label?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={{ color: theme.textSecondary, fontSize: 14, textDecorationLine: 'underline' }}>{label}</Text>
      </Pressable>
      <ReportSheet visible={open} onClose={() => setOpen(false)} type={type} targetId={targetId} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  content: { padding: Spacing.four, gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
