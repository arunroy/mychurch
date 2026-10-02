import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Heading, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { ChurchEvent, RsvpStatus } from '@/lib/database.types';
import { addToPhoneCalendar, phoneCalendarSupported } from '@/lib/phone-calendar';
import { cancelReminder, REMINDER_CHOICES, remindersSupported, setReminder, startsInFuture, useReminder } from '@/lib/reminders';
import { RSVP_CHOICES, useRsvpSummary, useSetRsvp } from '@/lib/rsvp';
import { friendlyError } from '@/lib/supabase';

/** "Are you coming?", a reminder on this phone, and adding the event to the phone's calendar. */
export function EventExtras({ event }: { event: ChurchEvent }) {
  const { t } = useTranslation();
  const summary = useRsvpSummary(event.id);
  const setRsvp = useSetRsvp(event.id);
  const { minutes, reload } = useReminder(event.id);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const upcoming = startsInFuture(event);
  const mine = summary.data?.my_status ?? null;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setNote(null);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function choose(status: RsvpStatus) {
    // Tapping your current answer takes it back.
    return run(() => setRsvp.mutateAsync(mine === status ? null : status));
  }

  const choiceLabel = (value: RsvpStatus) => t(`extras.${value}`);
  const reminderLabel = (m: number) => (m === 60 ? t('extras.hourBefore') : t('extras.dayBefore'));
  const totals = summary.data
    ? [
        summary.data.going ? t('extras.nGoing', { count: summary.data.going }) : null,
        summary.data.maybe ? t('extras.nMaybe', { count: summary.data.maybe }) : null,
        summary.data.declined ? t('extras.nNo', { count: summary.data.declined }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <>
      <ErrorText>{error}</ErrorText>
      {note ? <Body>{note}</Body> : null}

      <Card>
        <Heading>{t('extras.coming')}</Heading>
        <Segmented
          value={mine ?? ''}
          onChange={(value) => value && choose(value as (typeof RSVP_CHOICES)[number]['value'])}
          options={RSVP_CHOICES.map((choice) => ({ value: choice.value as string, label: choiceLabel(choice.value) }))}
        />
        <Body muted>{totals || t('extras.noAnswers')}</Body>
        {summary.data?.people && summary.data.people.length > 0 ? (
          <View style={styles.people}>
            {summary.data.people.map((person, index) => (
              <Body key={`${person.name}-${index}`} muted>
                {`${person.name}: ${choiceLabel(person.status)}`}
              </Body>
            ))}
          </View>
        ) : null}
      </Card>

      {upcoming && (remindersSupported || phoneCalendarSupported) ? (
        <Card>
          <Heading>{t('extras.dontMiss')}</Heading>
          {remindersSupported ? (
            <>
              <Body muted>
                {minutes ? t('extras.reminderSet', { when: reminderLabel(minutes) }) : t('extras.getReminder')}
              </Body>
              <View style={styles.chips}>
                {REMINDER_CHOICES.map((choice) => (
                  <Chip
                    key={choice.minutes}
                    label={reminderLabel(choice.minutes)}
                    selected={minutes === choice.minutes}
                    onPress={() =>
                      run(async () => {
                        await setReminder(event, choice.minutes);
                        await reload();
                        setNote(t('extras.reminderDone'));
                      })
                    }
                  />
                ))}
              </View>
              {minutes ? (
                <Button
                  title={t('extras.removeReminder')}
                  variant="secondary"
                  onPress={() =>
                    run(async () => {
                      await cancelReminder(event.id);
                      await reload();
                    })
                  }
                />
              ) : null}
            </>
          ) : null}
          {phoneCalendarSupported ? (
            <Button
              title={t('extras.addToCalendar')}
              variant="secondary"
              onPress={() =>
                run(async () => {
                  const saved = await addToPhoneCalendar(event);
                  if (saved) setNote(t('extras.addedToCalendar'));
                })
              }
            />
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  people: { gap: Spacing.one },
});
