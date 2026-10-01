import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Heading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { ChurchEvent, RsvpStatus } from '@/lib/database.types';
import { addToPhoneCalendar, phoneCalendarSupported } from '@/lib/phone-calendar';
import { cancelReminder, REMINDER_CHOICES, remindersSupported, setReminder, startsInFuture, useReminder } from '@/lib/reminders';
import { RSVP_CHOICES, useRsvpSummary, useSetRsvp } from '@/lib/rsvp';
import { friendlyError } from '@/lib/supabase';

/** "Are you coming?", a reminder on this phone, and adding the event to the phone's calendar. */
export function EventExtras({ event }: { event: ChurchEvent }) {
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

  const totals = summary.data
    ? [
        summary.data.going ? `${summary.data.going} going` : null,
        summary.data.maybe ? `${summary.data.maybe} maybe` : null,
        summary.data.declined ? `${summary.data.declined} can’t go` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <>
      <ErrorText>{error}</ErrorText>
      {note ? <Body>{note}</Body> : null}

      <Card>
        <Heading>Are you coming?</Heading>
        <View style={styles.chips}>
          {RSVP_CHOICES.map((choice) => (
            <Chip key={choice.value} label={choice.label} selected={mine === choice.value} onPress={() => choose(choice.value)} />
          ))}
        </View>
        <Body muted>{totals || 'No answers yet.'}</Body>
        {summary.data?.people && summary.data.people.length > 0 ? (
          <View style={styles.people}>
            {summary.data.people.map((person, index) => (
              <Body key={`${person.name}-${index}`} muted>
                {`${person.name}: ${RSVP_CHOICES.find((c) => c.value === person.status)?.label}`}
              </Body>
            ))}
          </View>
        ) : null}
      </Card>

      {upcoming && (remindersSupported || phoneCalendarSupported) ? (
        <Card>
          <Heading>Don’t miss it</Heading>
          {remindersSupported ? (
            <>
              <Body muted>
                {minutes
                  ? `A reminder is set on this phone, ${REMINDER_CHOICES.find((c) => c.minutes === minutes)?.label ?? 'before'}.`
                  : 'Get a reminder on this phone.'}
              </Body>
              <View style={styles.chips}>
                {REMINDER_CHOICES.map((choice) => (
                  <Chip
                    key={choice.minutes}
                    label={choice.label}
                    selected={minutes === choice.minutes}
                    onPress={() =>
                      run(async () => {
                        await setReminder(event, choice.minutes);
                        await reload();
                        setNote('Reminder set.');
                      })
                    }
                  />
                ))}
              </View>
              {minutes ? (
                <Button
                  title="Remove the reminder"
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
              title="Add to my calendar"
              variant="secondary"
              onPress={() =>
                run(async () => {
                  const saved = await addToPhoneCalendar(event);
                  if (saved) setNote('Added to your calendar.');
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
