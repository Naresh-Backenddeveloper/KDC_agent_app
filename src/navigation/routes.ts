/** The 14 screens of the agent app (spec section 4), one native stack. */
export type PaymentMode = 'booking' | 'cash_due';

export interface RouteParams {
  splash: undefined;
  login: undefined;
  otp: { mobile: string };
  home: undefined;
  'test-details': { bookingId: string; justCollectedKey?: string };
  sample: { bookingId: string; patientKey: string };
  'collect-payment': {
    bookingId: string;
    mode?: PaymentMode;
    /** True when reached from Proceed: completes the booking after payment. */
    completeAfter?: boolean;
    /** Screen to return to after an early collection. */
    returnTo?: RouteName;
  };
  profile: undefined;
  history: undefined;
  'booking-details': { bookingId: string };
  notifications: undefined;
  help: undefined;
  policy: { path: 'privacy-policy' | 'terms' | 'refund-policy'; title: string };
}

export type RouteName = keyof RouteParams;
