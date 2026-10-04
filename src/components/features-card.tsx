import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Heading, IconSquare, ListSection, Row, ToggleRow } from '@/components/ui';
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
    <>
      <ErrorText>{error}</ErrorText>
      <ListSection title={t('features.title')} footer={t('features.alwaysOn')} inset={44}>
        {FEATURES.map((f) => (
          <ToggleRow
            key={f.key}
            title={t(f.label)}
            left={<IconSquare icon={f.icon} color={f.color} />}
            value={on.has(f.key)}
            onValueChange={(value) => toggle(f.key, value)}
            disabled={busy}
          />
        ))}
      </ListSection>
      <ListSection footer={t('features.intro')}>
        <Row title={t('features.allOn')} chevron={false} onPress={busy ? undefined : () => change(FEATURES.map((f) => f.key))} />
        <Row title={t('features.allOff')} chevron={false} onPress={busy ? undefined : () => change([])} />
      </ListSection>
    </>
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

