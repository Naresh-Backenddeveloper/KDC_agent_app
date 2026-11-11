/**
 * Push notifications (spec 9). The prototype receives "pushes" from the mock
 * backend through the same path a real FCM message would take: bump the
 * unread badge, show a heads-up banner in the foreground, and route a tap.
 *
 * To go live: add @react-native-firebase/messaging + notifee with the KDC+
 * Firebase files, call registerDevice() with the FCM token after login, on
 * launch and on token refresh, and forward onMessage / opened events to
 * receivePush() and openFromPush().
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';
import type { AgentNotification } from '../domain/types';
import { onMockPush } from '../api/mockServer';
import { Bookings, Profile } from '../api/endpoints';
import { useSession } from '../store/session';
import { navigationRef, resetRoot } from '../navigation/navigation';

/** The heads-up banner currently shown in the foreground. */
export const useHeadsUp = create<{ current: AgentNotification | null; dismiss: () => void }>((set) => ({
  current: null,
  dismiss: () => set({ current: null }),
}));

export async function requestPermission() {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    try {
      await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
    } catch {
      /* the user can enable it later in settings */
    }
  }
}

/** After login, on every launch while logged in, and on token rotation. */
export async function registerDevice() {
  const { token, ensureInstallId } = useSession.getState();
  if (!token) return;
  await Profile.registerDevice(`mock-fcm-${ensureInstallId().slice(0, 8)}`, ensureInstallId());
}

export function receivePush(n: AgentNotification) {
  useSession.getState().bumpUnread();
  useHeadsUp.setState({ current: n });
  setTimeout(() => {
    if (useHeadsUp.getState().current?.id === n.id) useHeadsUp.getState().dismiss();
  }, 5000);
}

let pending: AgentNotification | null = null;

/** Tap routing (spec 9.3), queued until navigation is ready on a cold start. */
export async function openFromPush(n: AgentNotification) {
  if (!useSession.getState().token) return;
  if (!navigationRef.isReady()) {
    pending = n;
    return;
  }
  useHeadsUp.getState().dismiss();
  if (n.type === 'ADMIN_BROADCAST' || !n.booking_id) {
    navigationRef.navigate('notifications' as never);
    return;
  }
  const res = await Bookings.details(n.booking_id);
  if (res.code === 0 && res.data) navigationRef.navigate(...(['booking-details', { bookingId: res.data.booking_id }] as never));
  else resetRoot('home');
}

export function flushPendingPush() {
  if (pending) {
    const n = pending;
    pending = null;
    openFromPush(n);
  }
}

let started = false;
export function startPush() {
  if (started) return;
  started = true;
  onMockPush(receivePush);
}
