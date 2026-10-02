import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { backgroundColor: scheme === 'dark' ? '#171A1F' : '#FFFFFF' }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {sent ? (
            <>
              <Heading>{t('reportSheet.thanks')}</Heading>
              <Body>{t('reportSheet.sent')}</Body>
              <Button title={t('reportSheet.done')} onPress={close} />
            </>
          ) : (
            <>
              <Heading>{t('reportSheet.title')}</Heading>
              <Body muted>{t('reportSheet.intro')}</Body>
              <View style={styles.chips}>
                {REPORT_REASONS.map((r) => (
                  <Chip key={r.value} label={t(`reports.reason${r.value[0].toUpperCase()}${r.value.slice(1)}`)} selected={reason === r.value} onPress={() => setReason(r.value)} />
                ))}
              </View>
              <TextField
                label={t('reportSheet.details')}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={500}
                style={{ minHeight: 70, paddingTop: 12, textAlignVertical: 'top' }}
              />
              <ErrorText>{error}</ErrorText>
              <Button title={t('reportSheet.send')} onPress={send} loading={report.isPending} disabled={!reason} />
              {onRemove ? (
                <Button
                  title={t('reportSheet.removeInstead')}
                  variant="danger"
                  onPress={() => {
                    close();
                    onRemove();
                  }}
                />
              ) : null}
              <Pressable onPress={close} accessibilityRole="button" style={styles.cancel}>
                <Text style={{ color: theme.textSecondary, fontSize: 16 }}>{t('common.cancel')}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A small "Report" link that opens the sheet for one thing. */
export function ReportButton({ type, targetId, label }: { type: ReportTargetType; targetId: string; label?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const text = label ?? t('reportSheet.report');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={{ color: theme.textSecondary, fontSize: 14, textDecorationLine: 'underline' }}>{text}</Text>
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
