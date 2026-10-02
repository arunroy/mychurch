import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Vibration } from 'react-native';

const KEY = 'shake-to-sos';
/** A shake is this many hard jolts within the window. Walking or a bump in a bag is far gentler than 2.5 g. */
const JOLT_G = 2.5;
const JOLTS = 3;
const WINDOW_MS = 1500;
const COOLDOWN_MS = 5000;

// One value for the whole app, so the switch on the SOS screen takes effect for the detector straight away.
let enabledNow = true;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => enabledNow;

function setEnabledNow(next: boolean) {
  enabledNow = next;
  listeners.forEach((listener) => listener());
}

AsyncStorage.getItem(KEY)
  .then((value) => {
    if (value === 'off') setEnabledNow(false);
  })
  .catch(() => {});

/** Whether shaking the phone opens SOS. On unless the person turned it off; remembered on this device. */
export function useShakePreference() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const update = useCallback((next: boolean) => {
    setEnabledNow(next);
    AsyncStorage.setItem(KEY, next ? 'on' : 'off').catch(() => {});
  }, []);
  return [enabled, update] as const;
}

/** Calls `onShake` when the phone is shaken hard, while the app is open. Does nothing when `active` is false. */
export function useShakeDetector(active: boolean, onShake: () => void) {
  const handler = useRef(onShake);
  useEffect(() => {
    handler.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!active) return;
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;
    let jolts: number[] = [];
    let lastFired = 0;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(100);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          // Resting is about 1 g (gravity); a shake adds a lot more.
          if (Math.sqrt(x * x + y * y + z * z) < JOLT_G) return;
          const now = Date.now();
          jolts = [...jolts.filter((t) => now - t < WINDOW_MS), now];
          if (jolts.length >= JOLTS && now - lastFired > COOLDOWN_MS) {
            lastFired = now;
            jolts = [];
            Vibration.vibrate(200);
            handler.current();
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active]);
}
