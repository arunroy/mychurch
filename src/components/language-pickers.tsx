import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Body, Chip, Heading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-preference';
import { LANGUAGES } from '@/i18n/languages';

/**
 * The language of the app's own text. Each language is written in its own script, so people can find
 * theirs without reading English. Used on the sign-in screen and in the profile settings.
 */
export function AppLanguagePicker({ showHeading = true }: { showHeading?: boolean }) {
  const { t } = useTranslation();
  const { appLanguage, setAppLanguage } = useLanguage();
  const betaSelected = LANGUAGES.find((l) => l.code === appLanguage)?.beta;

  return (
    <View style={styles.wrap}>
      {showHeading ? <Heading>{t('language.appLanguage')}</Heading> : null}
      <View style={styles.chips}>
        {LANGUAGES.map((l) => (
          <Chip key={l.code} label={l.native} selected={l.code === appLanguage} onPress={() => setAppLanguage(l.code)} />
        ))}
      </View>
      {betaSelected ? <Body muted>{`${t('language.beta')}: ${t('language.appHint')}`}</Body> : null}
    </View>
  );
}

/** The language of the Bible text and book names. By default it follows the app language. */
export function BibleLanguagePicker() {
  const { t } = useTranslation();
  const { bibleChoice, setBibleChoice } = useLanguage();

  return (
    <View style={styles.wrap}>
      <Heading>{t('language.bibleLanguage')}</Heading>
      <View style={styles.chips}>
        <Chip label={t('language.sameAsApp')} selected={bibleChoice === 'app'} onPress={() => setBibleChoice('app')} />
        {LANGUAGES.map((l) => (
          <Chip key={l.code} label={l.native} selected={bibleChoice === l.code} onPress={() => setBibleChoice(l.code)} />
        ))}
      </View>
      <Body muted>{t('language.bibleHint')}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
