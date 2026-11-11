/** The end-to-end booking flow (spec section 3) against the in-app backend. */
import { Auth, Bookings, Notifications } from '../src/api/endpoints';
import { resetMockDb } from '../src/api/mockServer';
import { useSession } from '../src/store/session';
import { cashDuePending } from '../src/domain/rules';

jest.setTimeout(30000);

beforeEach(() => {
  resetMockDb();
  useSession.setState({ token: null });
});

async function login() {
  expect((await Auth.sendOtp('9876543210')).code).toBe(0);
  const v = await Auth.verifyOtp('9876543210', '1234');
  expect(v.code).toBe(0);
  useSession.getState().setToken(v.data!.token);
}

it('rejects unregistered numbers and wrong OTPs', async () => {
  expect((await Auth.sendOtp('9000000000')).code).not.toBe(0);
  expect((await Auth.verifyOtp('9876543210', '0000')).message).toBe('Invalid Otp.');
});

it('needs a token for secure endpoints', async () => {
  expect((await Bookings.active()).code).toBe(401);
});

it('online booking: trip, collection, samples, complete', async () => {
  await login();
  const b = (await Bookings.active('KDC-HC-10421')).data![0];

  expect((await Bookings.setStatus(b.id, 'ONGOING', b.agent_otp)).code).not.toBe(0); // order enforced
  expect((await Bookings.setStatus(b.id, 'ONMYWAY')).code).toBe(0);
  expect((await Bookings.setStatus(b.id, 'ONGOING', 'wrong')).code).not.toBe(0); // agent OTP
  expect((await Bookings.setStatus(b.id, 'ONGOING', b.agent_otp)).code).toBe(0);
  expect((await Bookings.setStatus(b.id, 'ONGOING', b.agent_otp)).code).toBe(0); // re-send is a no-op

  await Bookings.uploadSamples(b.booking_id, [{ color: 'lavender', sample_id: 'A1' }]);
  await Bookings.uploadSamples(b.booking_id, [{ color: 'lavender', sample_id: 'B1' }], b.others[0].id);
  expect((await Bookings.setStatus(b.id, 'COMPLETED')).code).toBe(0);

  expect((await Bookings.active()).data!.some((x) => x.id === b.id)).toBe(false);
  expect((await Bookings.past()).data!.some((x) => x.id === b.id)).toBe(true);
});

it('added patient on an online booking blocks completion until the due is collected', async () => {
  await login();
  const b = (await Bookings.active('KDC-HC-10415')).data![0]; // ONGOING, online
  const added = await Bookings.addPatients(b.id, [{ full_name: 'Ravi Rao', gender: 'Male', dob: '1990-01-01', patient_mobile: '' }]);
  expect(added.code).toBe(0);
  expect(cashDuePending(added.data)).toBe(true);
  expect(added.data!.cash_due).toBe(1599);

  const blocked = await Bookings.setStatus(b.id, 'COMPLETED');
  expect(blocked.code).toBe(2);

  expect((await Bookings.collectCashDue(b.booking_id)).code).toBe(0);
  expect(cashDuePending((await Bookings.details(b.booking_id)).data)).toBe(false);
  expect((await Bookings.setStatus(b.id, 'COMPLETED')).code).toBe(0);
});

it('cash booking ends PAID', async () => {
  await login();
  const b = (await Bookings.active('KDC-HC-10418')).data![0]; // ONMYWAY, cash ₹649
  expect((await Bookings.setStatus(b.id, 'ONGOING', b.agent_otp)).code).toBe(0);
  expect((await Bookings.setStatus(b.id, 'COMPLETED')).code).toBe(0);
  expect((await Bookings.setStatus(b.id, 'PAID')).code).toBe(0);
  const after = (await Bookings.details(b.booking_id)).data!;
  expect(after.booking_status).toBe('PAID');
  expect(after.payment_status).toBe(1);
});

it('reject only from accepted', async () => {
  await login();
  const b = (await Bookings.active('KDC-HC-10424')).data![0];
  expect((await Bookings.setStatus(b.id, 'REJECTED')).code).toBe(0);
  expect((await Bookings.details(b.booking_id)).data!.booking_status).toBe('REJECTED');
});

it('pages notifications', async () => {
  await login();
  const n1 = await Notifications.page(1);
  expect(n1.data!.data).toHaveLength(20);
  expect(n1.data!.last_page).toBe(2);
});
