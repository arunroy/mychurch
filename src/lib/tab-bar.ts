import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the bottom menu above the phone's own bottom inset. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

/** The whole bottom menu, including the space for the home indicator or gesture bar. */
export function useTabBarHeight() {
  return TAB_BAR_CONTENT_HEIGHT + useSafeAreaInsets().bottom;
}
