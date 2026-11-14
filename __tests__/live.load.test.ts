/// <reference types="node" />
/**
 * Round 2 load: many agents at once, each with its own copy of the app (session, Keychain),
 * doing a full visit on the live backend through a load balancer. Runs only with AGENT_LOAD=1:
 *   AGENT_LOAD=1 AGENT_LIVE_URL=… AGENT_DATA=… AGENT_QR_CONTROL=… npx jest live.load
 * Mid-run every agent's access token is expired at once (all refresh), and AGENT_KILL (a shell
 * command) is run to stop one backend while the agents are working.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LOAD = process.env.AGENT_LOAD === '1' && process.env.AGENT_LIVE_URL;
const suite = LOAD ? describe : describe.skip;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const data = LOAD ? JSON.parse(readFileSync(process.env.AGENT_DATA!, 'utf8')) : null;
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

type App = {
  endpoints: typeof import('../src/api/endpoints');
  live: typeof import('../src/api/live');
  client: typeof import('../src/api/client');
  secure: typeof import('../src/store/secure');
};
/** A fresh copy of the app's modules: its own session store, Keychain and refresh queue. */
function freshApp(): App {
  let app!: App;
  jest.isolateModules(() => {
    app = { endpoints: require('../src/api/endpoints'), live: require('../src/api/live'), client: require('../src/api/client'), secure: require('../src/store/secure') };
  });
  return app;
}

async function smsCodeFor(mobile: string, since: number): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const lines = readFileSync(data.smsLog, 'utf8').trim().split('\n').slice(since).map((l: string) => JSON.parse(l));
    const hit = lines.filter((e: { kind: string; to: string }) => e.kind === 'sms' && e.to === `91${mobile}`).at(-1);
    if (hit) return hit.code;
    await sleep(100);
  }
  throw new Error(`no SMS for ${mobile}`);
}

suite('many agents at once on the live backend', () => {
  jest.setTimeout(600_000);

  it('every agent completes both visits; refresh storms and a backend going down don’t break anyone', async () => {
    const timings: number[] = [];
    const failures: string[] = [];
    const ended: number[] = [];
    const timed = async <T,>(fn: () => Promise<T>) => {
      const t = Date.now();
      const r = await fn();
      timings.push(Date.now() - t);
      return r;
    };
    const expectOk = (label: string, r: { code: number; message?: string }) => {
      if (r.code !== 0) failures.push(`${label}: ${r.code} ${r.message}`);
      return r.code === 0;
    };
    const smsBase = readFileSync(data.smsLog, 'utf8').trim().split('\n').length;
    let reachedMiddle = 0;
    const middle = new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (reachedMiddle >= data.agents.length - Number(process.env.AGENT_LOAD_FROM ?? 1)) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    const runAgent = async (agent: { mobile: string; bookings: { code: string; paymentType: string; collectionCode: string }[] }, i: number) => {
      const { endpoints: E, live, client } = freshApp();
      client.setSessionExpiredHandler(() => ended.push(i));
      const [online, cash] = agent.bookings;
      if (!expectOk(`otp ${i}`, await timed(() => E.Auth.sendOtp(agent.mobile)))) return;
      const code = await smsCodeFor(agent.mobile, smsBase);
      if (!expectOk(`verify ${i}`, await timed(() => E.Auth.verifyOtp(agent.mobile, code)))) return;
      const active = await timed(() => E.Bookings.active());
      expectOk(`active ${i}`, active);
      for (const b of [online, cash]) {
        const id = live.idOf(b.code);
        expectOk(`trip ${b.code}`, await timed(() => E.Bookings.setStatus(id, 'ONMYWAY')));
        expectOk(`code ${b.code}`, await timed(() => E.Bookings.setStatus(id, 'ONGOING', b.collectionCode)));
      }
      // Everyone is mid-visit: wait for the others, then the storm and the outage happen.
      reachedMiddle++;
      await middle;
      for (const b of [online, cash]) {
        const details = await timed(() => E.Bookings.details(b.code));
        if (!expectOk(`details ${b.code}`, details)) continue;
        const tubes = details.data!.lab_samples.map((s) => s.sample_color);
        const urine = details.data!.plan.plan_tests.some((t) => t.urine_sample_flag === 1);
        const samples = [...tubes.map((c, k) => ({ color: c, sample_id: `L${i}${b.code.slice(-4)}${k}` })), ...(urine ? [{ color: 'urine', sample_id: `U${i}${b.code.slice(-4)}` }] : [])];
        expectOk(`samples ${b.code}`, await timed(() => E.Bookings.uploadSamples(b.code, samples)));
      }
      expectOk(`complete ${online.code}`, await timed(() => E.Bookings.setStatus(live.idOf(online.code), 'COMPLETED')));
      // Cash booking by UPI: the customer pays the booking's QR; the bank confirms.
      const qr = await timed(() => E.Bookings.paymentQr(cash.code, false));
      if (!expectOk(`qr ${cash.code}`, qr)) return;
      const scan = await fetch(`${process.env.AGENT_QR_CONTROL}/payqr`, { method: 'POST', body: JSON.stringify({ booking: cash.code }) });
      if (scan.status !== 200) failures.push(`scan ${cash.code}: ${scan.status}`);
      let status = 'created';
      for (let k = 0; k < 60 && status !== 'paid'; k++) {
        await sleep(2000);
        const s = await E.Bookings.qrStatus(cash.code);
        if (s.code === 0) status = s.data!.status;
      }
      if (status !== 'paid') failures.push(`qr never paid ${cash.code}`);
      expectOk(`complete ${cash.code}`, await timed(() => E.Bookings.setStatus(live.idOf(cash.code), 'COMPLETED')));
      expectOk(`paid ${cash.code}`, await timed(() => E.Bookings.setStatus(live.idOf(cash.code), 'PAID')));
      const past = await timed(() => E.Bookings.past());
      if (expectOk(`past ${i}`, past) && !past.data!.some((x) => x.booking_id === cash.code)) failures.push(`past ${i}: missing ${cash.code}`);
    };

    // Agent 0 belongs to the contract test.
    const from = Number(process.env.AGENT_LOAD_FROM ?? 1);
    const all = Promise.all(data.agents.map((a: Parameters<typeof runAgent>[0], i: number) => (i < from ? Promise.resolve() : runAgent(a, i))));
    await middle;
    // Every agent's access token expires at once, and one backend goes down.
    execSync(`mysql ${process.env.AGENT_DB ?? 'kdcplus_r2'} -N -e "update user_sessions s join users u on u.id = s.user_id set s.access_expires_at = utc_timestamp(3) - interval 1 minute where u.account_type = 'agent' and s.revoked_at is null"`);
    if (process.env.AGENT_KILL) execSync(process.env.AGENT_KILL);
    await all;

    console.log(`${data.agents.length - from} agents, ${timings.length} calls: p50 ${pct(timings, 0.5)} ms, p95 ${pct(timings, 0.95)} ms, max ${Math.max(...timings)} ms`);
    expect(failures).toEqual([]);
    expect(ended).toEqual([]);
  });
});
