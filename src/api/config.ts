/**
 * Where the app gets its data, fixed per build.
 *
 * - Live (`useMock: false`): the KDC+ backend at `baseUrl` (its /api/v1 root).
 * - Demo (`useMock: true`): the in-app mock backend with fictional bookings
 *   (demo login 9876543210 / OTP 1234). Never use it with real patients.
 */
export const API_CONFIG = {
  useMock: false,
  baseUrl: 'https://api.kdcplus.in/api/v1',
  timeoutMs: 20_000,
};
