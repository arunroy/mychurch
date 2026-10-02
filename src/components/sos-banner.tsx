import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch } from '@/lib/church';
import { useActiveSosAlerts } from '@/lib/sos';

/** A red banner at the top of Home for every open alert, so it is seen even when the push notification wasn't. */
export function SosBanner() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const alerts = useActiveSosAlerts(church_id);

  if (!alerts.data?.length) return null;
  return (
    <View style={styles.list}>
      {alerts.data.map((alert) => {
        const mine = alert.sender_id === userId;
        return (
          <Pressable
            key={alert.id}
            accessibilityRole="button"
            onPress={() => (mine ? router.push('/sos') : router.push({ pathname: '/sos-alert', params: { id: alert.id } }))}
            style={styles.banner}>
            <Ionicons name="alert-circle" size={30} color="#FFFFFF" />
            <View style={styles.text}>
              <Text style={styles.title}>{mine ? t('sos.yourAlert') : t('sos.needsHelp', { name: alert.sender_name })}</Text>
              <Text style={styles.subtitle}>{mine ? t('sos.tapToManage') : t('sos.tapToSee')}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: '#D92D20', borderRadius: 20, padding: Spacing.three },
  text: { flex: 1, gap: 2 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: 700 },
  subtitle: { color: '#FFFFFF', fontSize: 14 },
});
