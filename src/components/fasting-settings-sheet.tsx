import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/fund-sheets';
import { Body, Button, Card, ErrorText, Heading, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch } from '@/lib/church';
import { FASTING_DEFAULTS, isTime, onHalfHour, toMinutes, useSaveFastingSettings, type FastingConfig } from '@/lib/fasting';
import { friendlyError } from '@/lib/supabase';

type BreakDraft = { key: number; start: string; end: string };

/** For the Pastor: which Friday of the month, when the day starts and ends, and the breaks for church meetings. */
export function FastingSettingsSheet({ config, saved, onClose }: { config: FastingConfig; saved: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const save = useSaveFastingSettings(church_id);
  const [nth, setNth] = useState(String(config.nthFriday));
  const [start, setStart] = useState(config.start);
  const [end, setEnd] = useState(config.end);
  const [breaks, setBreaks] = useState<BreakDraft[]>(config.breaks.map((b, i) => ({ key: i, ...b })));
  const [nextKey, setNextKey] = useState(config.breaks.length);
  const [error, setError] = useState<string | null>(null);

  const timeOk = (v: string) => isTime(v) && onHalfHour(v);
  const dayOk = timeOk(start) && timeOk(end) && toMinutes(end) > toMinutes(start);
  const breaksOk = breaks.every((b) => isTime(b.start) && isTime(b.end) && toMinutes(b.end) > toMinutes(b.start));
  const valid = dayOk && breaksOk;

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        saved,
        config: {
          nthFriday: Number(nth),
          start: start.trim(),
          end: end.trim(),
          breaks: breaks.map((b) => ({ start: b.start.trim(), end: b.end.trim() })),
        },
      });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function reset() {
    setNth(String(FASTING_DEFAULTS.nthFriday));
    setStart(FASTING_DEFAULTS.start);
    setEnd(FASTING_DEFAULTS.end);
    setBreaks(FASTING_DEFAULTS.breaks.map((b, i) => ({ key: nextKey + i, ...b })));
    setNextKey(nextKey + FASTING_DEFAULTS.breaks.length);
  }

  return (
    <Sheet onClose={onClose}>
      <Heading>{t('fasting.settingsTitle')}</Heading>

      <Body muted>{t('fasting.whichFriday')}</Body>
      <Segmented
        value={nth}
        onChange={setNth}
        options={['1', '2', '3', '4'].map((n) => ({ value: n, label: t(`fasting.friday${n}`) }))}
      />

      <View style={styles.pair}>
        <View style={styles.half}>
          <TextField label={t('fasting.starts')} value={start} onChangeText={setStart} placeholder="06:00" keyboardType="numbers-and-punctuation" maxLength={5} />
        </View>
        <View style={styles.half}>
          <TextField label={t('fasting.ends')} value={end} onChangeText={setEnd} placeholder="24:00" keyboardType="numbers-and-punctuation" maxLength={5} />
        </View>
      </View>
      <Body muted>{dayOk ? t('fasting.timeHint') : t('fasting.timeBad')}</Body>

      <Heading>{t('fasting.breaks')}</Heading>
      {breaks.map((b) => (
        <Card key={b.key}>
          <View style={styles.pair}>
            <View style={styles.half}>
              <TextField
                label={t('fasting.from')}
                value={b.start}
                onChangeText={(v) => setBreaks((list) => list.map((x) => (x.key === b.key ? { ...x, start: v } : x)))}
                placeholder="10:30"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.half}>
              <TextField
                label={t('fasting.to')}
                value={b.end}
                onChangeText={(v) => setBreaks((list) => list.map((x) => (x.key === b.key ? { ...x, end: v } : x)))}
                placeholder="11:30"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>
          <Button title={t('common.remove')} variant="secondary" onPress={() => setBreaks((list) => list.filter((x) => x.key !== b.key))} />
        </Card>
      ))}
      {breaks.length < 6 ? (
        <Button
          title={t('fasting.addBreak')}
          variant="tonal"
          onPress={() => {
            setBreaks((list) => [...list, { key: nextKey, start: '', end: '' }]);
            setNextKey(nextKey + 1);
          }}
        />
      ) : null}
      <Body muted>{t('fasting.breaksHint')}</Body>

      <ErrorText>{error}</ErrorText>
      <Button title={t('fasting.save')} onPress={onSave} loading={save.isPending} disabled={!valid} />
      <Button title={t('fasting.useDefaults')} variant="secondary" onPress={reset} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: Spacing.two },
  half: { flex: 1 },
});
