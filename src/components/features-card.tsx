import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Heading, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { FEATURES, useSaveFeatures, type FeatureKey } from '@/lib/features';
import { friendlyError } from '@/lib/supabase';

/** In church settings, for the Pastor: which features the church uses. Everything is off until switched on here. */
export function FeaturesCard() {
  const { t } = useTranslation();
  const { church } = useActiveChurch();
  const { canChangeRoles } = usePermissions();
  const save = useSaveFeatures();
  const [busy, setBusy] = useState(false);
  // What the switches show while a change is being saved, so a tap responds at once. Dropped if the save fails.
  const [shown, setShown] = useState<FeatureKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canChangeRoles) return null;

  const on = new Set<string>(shown ?? church.enabled_features);

  async function change(next: FeatureKey[]) {
    setBusy(true);
    setError(null);
    setShown(next);
    try {
      await save(next);
    } catch (e) {
      setError(friendlyError(e));
    }
    setShown(null);
    setBusy(false);
  }

  function toggle(key: FeatureKey, value: boolean) {
    const next = FEATURES.map((f) => f.key).filter((k) => (k === key ? value : on.has(k)));
    change(next);
  }

  return (
    <Card>
      <Heading>{t('features.title')}</Heading>
      <Body muted>{t('features.intro')}</Body>
      <ErrorText>{error}</ErrorText>
      <View style={styles.chips}>
        <Chip label={t('features.allOn')} onPress={() => change(FEATURES.map((f) => f.key))} />
        <Chip label={t('features.allOff')} onPress={() => change([])} />
      </View>
      {FEATURES.map((f) => (
        <ToggleRow key={f.key} title={t(f.label)} value={on.has(f.key)} onValueChange={(value) => toggle(f.key, value)} disabled={busy} />
      ))}
      <Body muted>{t('features.alwaysOn')}</Body>
    </Card>
  );
}

/** On Home, for the Pastor of a church with nothing switched on yet: a pointer to where to choose. */
export function FeaturesPrompt() {
  const { t } = useTranslation();
  const { church } = useActiveChurch();
  const { canChangeRoles } = usePermissions();
  if (!canChangeRoles || church.enabled_features.length > 0) return null;
  return (
    <Card>
      <Heading>{t('features.promptTitle')}</Heading>
      <Body muted>{t('features.promptBody')}</Body>
      <Button title={t('features.promptButton')} onPress={() => router.push('/church-settings')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
