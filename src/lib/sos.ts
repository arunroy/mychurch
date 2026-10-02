import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useId } from 'react';
import { Linking, Platform } from 'react-native';

import type { SosAlert, SosHistoryEntry } from './database.types';
import { callFunction } from './functions';
import { supabase } from './supabase';

/** 112 reaches the emergency services in India, the UK and across the EU. */
export const EMERGENCY_NUMBER = '112';

export function callEmergency() {
  return Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
}

/** Opens a pin on the phone's own map app (Apple Maps on iPhone, the default maps app on Android, the web otherwise). */
export function openInMaps(latitude: number, longitude: number, label: string) {
  const coords = `${latitude},${longitude}`;
  const url = Platform.select({
    ios: `http://maps.apple.com/?ll=${coords}&q=${encodeURIComponent(label)}`,
    android: `geo:${coords}?q=${coords}(${encodeURIComponent(label)})`,
    default: `https://www.google.com/maps/search/?api=1&query=${coords}`,
  });
  return Linking.openURL(url);
}

export type Position = { latitude: number; longitude: number; accuracy: number | null };

/** True when the app may read the location right now. */
export async function hasLocationPermission() {
  const { granted } = await Location.getForegroundPermissionsAsync();
  return granted;
}

/** Asks for permission (only if not already decided) and returns whether it was given. */
export async function askLocationPermission() {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  return granted;
}

function toPosition(p: Location.LocationObject): Position {
  return { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy ?? null };
}

/**
 * The phone's position now: a fresh fix if one arrives within 10 seconds, otherwise the last one it knew about,
 * otherwise null. Never asks for permission; call `askLocationPermission` first.
 */
export async function getPosition(): Promise<Position | null> {
  if (!(await hasLocationPermission())) return null;
  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    if (fresh) return toPosition(fresh);
    const last = await Location.getLastKnownPositionAsync();
    return last ? toPosition(last) : null;
  } catch {
    return null;
  }
}

/** Follows the phone while the alert is open: roughly every 10 seconds or 10 metres. Returns a function that stops it. */
export async function watchPosition(onPosition: (position: Position) => void) {
  if (!(await hasLocationPermission())) return () => {};
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 10 },
    (p) => onPosition(toPosition(p)),
  );
  return () => subscription.remove();
}

/** The alerts open in the church now, live. Everything is erased from here the moment an alert ends. */
export function useActiveSosAlerts(churchId: string) {
  const queryClient = useQueryClient();
  // Same reasoning as the chat: one channel name per user of this hook, so two screens never share a subscribed channel.
  const instance = useId();

  const alerts = useQuery({
    queryKey: ['sos-active', churchId],
    queryFn: async (): Promise<SosAlert[]> => {
      const { data, error } = await supabase.rpc('active_sos_alerts', { p_church: churchId });
      if (error) throw error;
      return data;
    },
    // A safety net for a dropped connection; the live subscription does the real work.
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['sos-active', churchId] });
    const channel = supabase
      .channel(`sos:${churchId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts', filter: `church_id=eq.${churchId}` }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [churchId, instance, queryClient]);

  return alerts;
}

export type SosSent = { alert_id: string; notified: number; already_open: boolean };

export function useSendSos(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { position: Position | null; message: string }) =>
      callFunction<SosSent>('send-sos-alert', {
        church_id: churchId,
        latitude: input.position?.latitude ?? null,
        longitude: input.position?.longitude ?? null,
        accuracy: input.position?.accuracy ?? null,
        message: input.message,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sos-active', churchId] }),
  });
}

export function useEndSos(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { alertId: string; reason: 'safe' | 'false_alarm' | 'ended_by_leader' }) => {
      const { error } = await supabase.rpc('end_sos_alert', { p_alert: input.alertId, p_reason: input.reason });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sos-active', churchId] }),
  });
}

export async function updateSosLocation(alertId: string, position: Position) {
  const { error } = await supabase.rpc('update_sos_location', {
    p_alert: alertId,
    p_latitude: position.latitude,
    p_longitude: position.longitude,
    p_accuracy: position.accuracy,
  });
  if (error) throw error;
}

/** The last 30 days of alerts, for the Pastor and elders. No locations. */
export function useSosHistory(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sos-history', churchId],
    enabled,
    queryFn: async (): Promise<SosHistoryEntry[]> => {
      const { data, error } = await supabase.rpc('sos_history', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}
