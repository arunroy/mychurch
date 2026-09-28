import { router } from 'expo-router';

import { stateFor, type MyMembership } from './church';

/** After joining, registering or switching, go to the right place for that church. */
export function goToChurch(memberships: MyMembership[], churchId: string) {
  const membership = memberships.find((m) => m.church_id === churchId);
  if (router.canDismiss()) router.dismissAll();
  router.replace(stateFor(membership) === 'ready' ? '/' : '/waiting');
}
