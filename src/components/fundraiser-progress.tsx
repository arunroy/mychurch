import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Body, useAccent } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FundraiserSummary } from '@/lib/database.types';
import { formatMoney } from '@/lib/funds';
import { progressOf, raisedOf } from '@/lib/fundraisers';

/**
 * How far a fundraiser has got, counting pledges and money received together. With a target: a bar and what is left.
 * Without one: the total only.
 */
export function FundraiserProgress({ fundraiser, large }: { fundraiser: FundraiserSummary; large?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = useAccent();
  const progress = progressOf(fundraiser);
  const money = (n: number) => formatMoney(n, fundraiser.currency);
  const percent = progress ? Math.floor(progress.share * 100) : 0;

  return (
    <View style={styles.box}>
      <Text style={[large ? styles.raisedLarge : styles.raised, { color: theme.text }]}>
        {fundraiser.target_amount
          ? t('fundraisers.raisedOf', { raised: money(raisedOf(fundraiser)), target: money(fundraiser.target_amount) })
          : t('fundraisers.raised', { raised: money(raisedOf(fundraiser)) })}
      </Text>

      {progress ? (
        <>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t('fundraisers.percentReceived', { percent })}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={[styles.track, { backgroundColor: theme.backgroundSelected, height: large ? 18 : 12 }]}>
            <View style={[styles.fill, { width: `${progress.share * 100}%`, backgroundColor: accent }]} />
          </View>
          <View style={styles.legend}>
            <Body muted>{progress.reached ? t('fundraisers.reached') : t('fundraisers.left', { left: money(progress.left) })}</Body>
            <Body muted>{`${percent}%`}</Body>
          </View>
        </>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
  raised: { fontSize: 17, fontWeight: 600 },
  raisedLarge: { fontSize: 22, fontWeight: 700 },
  track: { borderRadius: 9, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
});
