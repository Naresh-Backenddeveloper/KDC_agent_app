import { useCallback, useMemo } from 'react';
import { Platform, Settings } from 'react-native';
import {
  CommonActions,
  StackActions,
  createNavigationContainerRef,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { RouteName, RouteParams } from './routes';

/** Kept for the shared header components; the agent app has no tab bar. */
export type TabId = 'home';

export interface NavState {
  current: string;
  from?: string;
  navigate: <R extends RouteName>(id: R, opts?: { params?: RouteParams[R]; replace?: boolean; from?: string }) => void;
  back: () => void;
  resetTo: <R extends RouteName>(id: R, params?: RouteParams[R]) => void;
}

export const navigationRef = createNavigationContainerRef<any>();

/** Development only: the screen named by `simctl launch ... -kdcScreen <id>`, for QA. */
export function devLaunchScreen(): string | undefined {
  if (!__DEV__ || Platform.OS !== 'ios') return undefined;
  try {
    return Settings.get('kdcScreen');
  } catch {
    return undefined;
  }
}

/** Set when a dev deep link opened the current screen. */
export const devLink = { active: false };
export const isDevLaunch = () => devLink.active || devLaunchScreen() !== undefined;

export function resetAction(id: string, params?: object) {
  return CommonActions.reset({ index: 0, routes: [{ name: id, params }] });
}

/** Navigates from outside a screen (push taps, session expiry). */
export function resetRoot(id: RouteName, params?: object) {
  if (navigationRef.isReady()) navigationRef.dispatch(resetAction(id, params));
}

export function useNav(): NavState {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const navigate = useCallback<NavState['navigate']>(
    (id, opts) => {
      const params = { ...(opts?.params as object), from: opts?.from ?? route.name };
      if (opts?.replace) navigation.dispatch(StackActions.replace(id, params));
      else navigation.dispatch(StackActions.push(id, params));
    },
    [navigation, route.name],
  );

  const back = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch(resetAction('home'));
  }, [navigation]);

  const resetTo = useCallback<NavState['resetTo']>(
    (id, params) => navigation.dispatch(resetAction(id, params as object)),
    [navigation],
  );

  return useMemo(
    () => ({ current: route.name, from: route.params?.from, navigate, back, resetTo }),
    [route.name, route.params?.from, navigate, back, resetTo],
  );
}

/** The current screen's parameters. */
export function useParams<R extends RouteName>(): RouteParams[R] {
  return (useRoute<any>().params ?? {}) as RouteParams[R];
}
