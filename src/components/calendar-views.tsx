import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Heading, Row, useAccent, useAccentSoft, useAccentText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayAfter, monthGrid, monthName, monthTitle, shiftMonth, weekdayLabels, weekKeys, weekRangeLabel } from '@/lib/calendar';
import { useActiveChurch } from '@/lib/church';
import { addDays, dateKey, formatDay, getDateLocale, parseDateKey } from '@/lib/dates';
import { eventDayKey, eventTimeText, groupByDay, useEventsBetween, type EventWithCreator } from '@/lib/events';
import { friendlyError } from '@/lib/supabase';

/** The little bar above each view: earlier, what is showing, later, and a way back to today. */
function Navigator({
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onToday,
}: {
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.navigator}>
      <Pressable accessibilityRole="button" accessibilityLabel={prevLabel} onPress={onPrev} hitSlop={10} style={styles.arrow}>
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </Pressable>
      <Text style={[styles.navLabel, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
        {label}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={nextLabel} onPress={onNext} hitSlop={10} style={styles.arrow}>
        <Ionicons name="chevron-forward" size={26} color={theme.text} />
      </Pressable>
      {onToday ? <Chip label={t('calendar.today')} onPress={onToday} /> : null}
    </View>
  );
}

function openEvent(event: EventWithCreator) {
  router.push({ pathname: '/event/[id]', params: { id: event.id } });
}

function EventRows({ events }: { events: EventWithCreator[] }) {
  return (
    <>
      {events.map((event) => (
        <Row
          key={event.id}
          title={event.title}
          subtitle={[eventTimeText(event), event.location].filter(Boolean).join(' · ')}
          onPress={() => openEvent(event)}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

/** A month as a grid of days, with a dot under each day that has events. Tap a day to see its events below. */
export function MonthView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = useAccent();
  const accentText = useAccentText();
  const accentSoft = useAccentSoft();
  const { church_id } = useActiveChurch();
  const today = dateKey();
  const now = parseDateKey(today);
  const [shown, setShown] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(today);
  const locale = getDateLocale();

  const grid = monthGrid(shown.year, shown.month);
  const events = useEventsBetween(church_id, grid[0].key, dayAfter(grid[grid.length - 1].key));
  const byDay = groupByDay(events.data ?? []);
  const dayEvents = byDay.get(selected) ?? [];
  const weekdays = weekdayLabels(locale);

  function go(delta: number) {
    const next = shiftMonth(shown.year, shown.month, delta);
    setShown(next);
    // Keep the day picked if it is still in view; otherwise start the new month on its first day (or today).
    const first = dateKey(new Date(next.year, next.month, 1));
    setSelected(next.year === now.getFullYear() && next.month === now.getMonth() ? today : first);
  }

  function goToday() {
    setShown({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(today);
  }

  return (
    <>
      <Navigator
        label={monthTitle(shown.year, shown.month, locale)}
        prevLabel={t('calendar.prevMonth')}
        nextLabel={t('calendar.nextMonth')}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        onToday={goToday}
      />

      <Card>
        <View style={styles.weekRow}>
          {weekdays.map((label, i) => (
            <Text key={i} style={[styles.weekday, { color: theme.textSecondary }]} numberOfLines={1}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {grid.map((cell) => {
            const count = byDay.get(cell.key)?.length ?? 0;
            const isSelected = cell.key === selected;
            const isToday = cell.key === today;
            return (
              <Pressable
                key={cell.key}
                accessibilityRole="button"
                accessibilityLabel={count > 0 ? t('calendar.dayLabel', { day: formatDay(cell.key), count }) : formatDay(cell.key)}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(cell.key)}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    isSelected ? { backgroundColor: accent } : isToday ? { backgroundColor: accentSoft } : null,
                  ]}>
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: isSelected ? '#FFFFFF' : cell.inMonth ? theme.text : theme.textSecondary, opacity: cell.inMonth ? 1 : 0.5 },
                      isToday && !isSelected ? { fontWeight: 700 } : null,
                    ]}>
                    {cell.day}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: accentText }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
        {events.isPending ? <ActivityIndicator /> : null}
      </Card>

      <ErrorText>{events.error ? friendlyError(events.error) : null}</ErrorText>

      <Card>
        <Heading>{selected === today ? t('calendar.todayHeading', { day: formatDay(selected) }) : formatDay(selected)}</Heading>
        {dayEvents.length === 0 ? <Body muted>{t('calendar.noEvents')}</Body> : <EventRows events={dayEvents} />}
        <Button
          title={t('calendar.addOnDay')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/event-edit', params: { date: selected } })}
        />
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------

/** One week, a day at a time, with each day's events listed. */
export function WeekView() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const today = dateKey();
  const [anchor, setAnchor] = useState(today);
  const locale = getDateLocale();

  const days = weekKeys(anchor);
  const events = useEventsBetween(church_id, days[0], dayAfter(days[6]));
  const byDay = groupByDay(events.data ?? []);

  return (
    <>
      <Navigator
        label={weekRangeLabel(anchor, locale)}
        prevLabel={t('calendar.prevWeek')}
        nextLabel={t('calendar.nextWeek')}
        onPrev={() => setAnchor(addDays(anchor, -7))}
        onNext={() => setAnchor(addDays(anchor, 7))}
        onToday={() => setAnchor(today)}
      />
      {events.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{events.error ? friendlyError(events.error) : null}</ErrorText>

      {days.map((key) => {
        const list = byDay.get(key) ?? [];
        return (
          <Card key={key}>
            <Heading>{key === today ? t('calendar.todayHeading', { day: formatDay(key) }) : formatDay(key)}</Heading>
            {list.length === 0 ? <Body muted>{t('calendar.noEvents')}</Body> : <EventRows events={list} />}
          </Card>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Events (the whole year as a list)
// ---------------------------------------------------------------------------

/** Every event of a year as one list, month by month, soonest first. */
export function YearView() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const thisYear = parseDateKey(dateKey()).getFullYear();
  const [year, setYear] = useState(thisYear);
  const locale = getDateLocale();

  const events = useEventsBetween(church_id, `${year}-01-01`, `${year + 1}-01-01`);
  const months = Array.from({ length: 12 }, (_, month) => ({
    month,
    events: (events.data ?? []).filter((event) => parseDateKey(eventDayKey(event)).getMonth() === month),
  })).filter((m) => m.events.length > 0);

  return (
    <>
      <Navigator
        label={String(year)}
        prevLabel={t('calendar.prevYear')}
        nextLabel={t('calendar.nextYear')}
        onPrev={() => setYear(year - 1)}
        onNext={() => setYear(year + 1)}
        onToday={year === thisYear ? undefined : () => setYear(thisYear)}
      />
      {events.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{events.error ? friendlyError(events.error) : null}</ErrorText>
      {events.data && months.length === 0 ? <Body muted>{t('calendar.yearEmpty', { year })}</Body> : null}

      {months.map(({ month, events: list }) => (
        <Card key={month}>
          <Heading>{monthName(month, locale)}</Heading>
          {list.map((event) => (
            <Row
              key={event.id}
              title={event.title}
              subtitle={[formatDay(eventDayKey(event)), eventTimeText(event), event.location].filter(Boolean).join(' · ')}
              onPress={() => openEvent(event)}
            />
          ))}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  navigator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  arrow: { padding: Spacing.one },
  navLabel: { flex: 1, fontSize: 20, fontWeight: 700, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 600, paddingBottom: Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, gap: 2, minHeight: 52 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 16 },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
