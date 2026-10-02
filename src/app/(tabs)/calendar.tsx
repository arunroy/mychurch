import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MonthView, WeekView, YearView } from '@/components/calendar-views';
import { Button, Chip, Screen, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';

type CalendarView = 'month' | 'week' | 'events';

// The church's shared calendar: anyone can add to it, everyone sees it. Opens on the month; the week view
// is a day-by-day agenda, and Events lists the whole year.
export default function CalendarScreen() {
  const { t } = useTranslation();
  const [view, setView] = useState<CalendarView>('month');

  return (
    <Screen edges={['top']}>
      <Title>{t('calendar.title')}</Title>

      <View style={styles.views}>
        <Chip label={t('calendar.viewMonth')} wide selected={view === 'month'} onPress={() => setView('month')} />
        <Chip label={t('calendar.viewWeek')} wide selected={view === 'week'} onPress={() => setView('week')} />
        <Chip label={t('calendar.viewEvents')} wide selected={view === 'events'} onPress={() => setView('events')} />
      </View>

      <Button title={t('calendar.add')} onPress={() => router.push('/event-edit')} />

      {view === 'month' ? <MonthView /> : view === 'week' ? <WeekView /> : <YearView />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  views: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
