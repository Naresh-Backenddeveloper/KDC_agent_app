# KDC+ Agent

The field-agent (phlebotomist) app for KDC+ home sample collection. It is a bare React Native CLI app for Android and iOS, with no Expo. It uses the same KDC+ design system as the patient and doctor apps.

It follows the agent flow spec: assignment, trip, collection, barcode scanning of each tube, payment and completion. The wallet from the spec has been removed at the client’s request. There is no backend yet. An in-app mock server implements every endpoint in the spec, so the app works end to end on demo data.

## Run

```bash
npm install
npm start                      # Metro
npm run android                # or: npm run ios  (run `cd ios && pod install` first)
```

**Demo login:** mobile `98765 43210`, OTP `1234`. Any other number gets "Please contact admin for registration."

Profile → **Reset demo data** restores the sample bookings after a demo run.

## Screens

These are 13 routes from spec section 4 (the spec’s Wallet screen is removed), in one native stack. Back-swipe is off.

| Route | Screen |
| --- | --- |
| `splash` | Splash and session check |
| `login` | Agent Login (mobile number) |
| `otp` | OTP, 4 digits, with a working Resend and a 30 s timer |
| `home` | Active bookings: status badges, tube and payment chips, directions, call, slide-to-confirm, reject |
| `test-details` | Patients with Pending/Done and progress, Add Patient, cash-due banner, Proceed decision table |
| `sample` | Tube slots (with Urine when needed), camera barcode scan with an editable confirm, upload |
| `collect-payment` | Cash or UPI QR, booking and cash-due modes, the confirm sequence, success |
| `profile` | Menu: history, help, call us, policies, delete account, logout |
| `history` | Past bookings with totals |
| `booking-details` | Tubes (scan and submit), plan, customer (call countdown, directions), other patients, tests |
| `notifications` | Inbox with infinite scroll, unread highlighting, relative time, tap routing |
| `help` | Support request with subject chips and a 10–500 character description |
| `policy` | Policy pages, rendered natively |

App-wide: an offline overlay (NetInfo), toasts, a confirm dialog, the slide button, a heads-up banner for pushes, an unread badge, and two- or three-column lists on tablets.

## Where things live

| Path | What |
| --- | --- |
| `src/api/client.ts` | API client: `{ code, message, data }` envelope, Bearer token, a single forced logout on 401. `API_CONFIG.useMock` switches to the real backend. |
| `src/api/endpoints.ts` | One function per endpoint in spec section 11 |
| `src/api/mockServer.ts` | The demo backend: status order, agent OTP on ONGOING, cash-due gate, paging |
| `src/domain/rules.ts` | Business rules: status normalising, time resolution, the cash-due gate, the Proceed decision, tube colours and slots, the UPI intent, list paging |
| `src/notifications/push.ts` | Push pipeline: badge, heads-up banner, tap routing, cold-start queue |
| `src/components/agent/` | Booking card, slide button, scanner, UPI sheet, dialogs, offline overlay |
| `src/screens/` | The screens |

## Going live

1. Set `API_CONFIG.useMock = false` and `baseUrl` in `src/api/client.ts`. Screens don't change.
2. Push: add `@react-native-firebase/messaging` and `notifee` with the KDC+ Firebase files. Send the FCM token to `registerDevice()`, and forward incoming and opened messages to `receivePush()` and `openFromPush()`.
3. Move the token from MMKV to the Keychain / Keystore.
4. Remove the demo hint on Login and the Reset demo data row on Profile.

## Improvements over the source app (spec 14.6)

- OTP Resend works and has a timer.
- Delete Account calls a deletion request instead of logging out.
- The cash-due mode is always passed to the payment screen.
- No tokens are logged.
- Only the permissions actually used are requested: camera, notifications and network state. Location and microphone are not.

## Tests

`npm test`: business rules, the full booking flow against the mock backend (online, cash, added-patient due, reject, paging), and a render of every screen.
