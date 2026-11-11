/** One typed function per backend endpoint (spec section 11). */
import { Platform } from 'react-native';
import { api } from './client';
import type { AgentNotification, AgentProfile, Booking, BookingStatus } from '../domain/types';

export const Auth = {
  sendOtp: (mobile: string) => api.post('auth/user/otp/send', { mobile, type: 'AGENT' }),
  verifyOtp: (mobile: string, otp: string) => api.post<{ token: string }>('auth/user/otp/verify', { mobile, otp, type: 'AGENT' }),
};

export const Profile = {
  get: () => api.get<AgentProfile>('secure/profile'),
  registerDevice: (token: string, appId: string) =>
    api.post('secure/profile/firebase', {
      token,
      bundle_version: '1',
      os_type: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      os_version: String(Platform.Version),
      app_id: appId,
    }),
  deleteAccount: () => api.post('secure/account/delete', {}),
};

export const Bookings = {
  active: (bookingId?: string) => api.post<Booking[]>('secure/bookings/active', bookingId ? { booking_id: bookingId } : {}),
  past: () => api.post<Booking[]>('secure/bookings/past', {}),
  details: (bookingId: string) => api.post<Booking>('secure/bookingdetails', { booking_id: bookingId }),
  /** Uses the numeric id, as the live API does. */
  setStatus: (id: number, status: BookingStatus, otp?: string) =>
    api.post<Booking>('secure/booking/status/change', { booking_id: id, status, ...(otp ? { otp } : null) }),
  addPatients: (id: number, patients: { full_name: string; gender: string; dob: string; patient_mobile: string }[]) =>
    api.post<Booking>(`secure/booking/patient/${id}`, { patients }),
  uploadSamples: (bookingId: string, samples: { color: string; sample_id: string }[], otherId?: number) =>
    api.post<Booking>('secure/booking/samples/upload', { booking_id: bookingId, samples, booking_other_id: otherId ? String(otherId) : '' }),
  collectCashDue: (bookingId: string) => api.post<Booking>('secure/collect-cash-due', { booking_id: bookingId }),
  paymentQr: () => api.get('secure/payment-qr'),
  callPatient: (id: number) => api.post('secure/booking/call-patient', { booking_id: id }),
  callLog: (id: number, event_type: 'INITIATED' | 'SUCCESS' | 'FAILED', message?: string) =>
    api.post('secure/booking/call-log', { booking_id: id, event_type, message, timestamp: new Date().toISOString() }),
};

export const Notifications = {
  page: (n: number) => api.post<{ data: AgentNotification[]; current_page: number; last_page: number }>(`secure/notifications/${n}`, {}),
};

export const Help = {
  request: (subject: string, reason: string) => api.post('secure/help/request', { subject, reason }),
};

export const Cms = {
  page: (path: string) => api.get<{ data: { title: string; updated: string; sections: { heading: string; body: string }[] } }>(`cms/${path}`),
};
