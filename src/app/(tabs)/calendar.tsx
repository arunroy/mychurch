import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MonthView, WeekView, YearView } from '@/components/calendar-views';
import { Button, Screen, Segmented, Title } from '@/components/ui';

type CalendarView = 'month' | 'week' | 'events';

// The church's shared calendar: anyone can add to it, everyone sees it. Opens on the month; the week view
// is a day-by-day agenda, and Events lists the whole year.
export default function CalendarScreen() {
  const { t } = useTranslation();
  const [view, setView] = useState<CalendarView>('month');

  return (
    <Screen edges={['top']}>
      <Title>{t('calendar.title')}</Title>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'month', label: t('calendar.viewMonth') },
          { value: 'week', label: t('calendar.viewWeek') },
          { value: 'events', label: t('calendar.viewEvents') },
        ]}
      />

      <Button title={t('calendar.add')} variant="tonal" onPress={() => router.push('/event-edit')} />

      {view === 'month' ? <MonthView /> : view === 'week' ? <WeekView /> : <YearView />}
    </Screen>
  );
}

