// Sends push notifications through Expo's push service. Shared by the functions that notify people.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo accepts up to 100 messages per request.

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: 'default' | 'alerts';
  data: Record<string, unknown>;
  /** 'high' wakes a sleeping phone at once. */
  priority?: 'default' | 'normal' | 'high';
  /** iOS only. 'time-sensitive' breaks through Focus modes; 'critical' needs Apple's approval for the app. */
  interruptionLevel?: 'active' | 'passive' | 'time-sensitive' | 'critical';
  /** Seconds the push service keeps trying to deliver. */
  ttl?: number;
};

/** Sends the messages and returns how many were accepted, plus tokens Expo says no longer exist. */
export async function sendPush(messages: PushMessage[]) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let accepted = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const response = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
      if (!response.ok) {
        console.error('expo push failed', response.status, await response.text());
        continue;
      }
      const { data } = (await response.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      data?.forEach((ticket, index) => {
        if (ticket.status === 'ok') accepted += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[index].to);
      });
    } catch (e) {
      console.error('expo push error', e);
    }
  }
  return { accepted, dead };
}
