/** Collect Payment (spec 5): booking and cash-due modes, UPI QR, confirm sequence, success. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Div, P, Span } from '../components/primitives/index';
import { AlertTriangle, Banknote, Check, CheckCircle2, Home, QrCode, UserPlus, X } from '../components/primitives/icons';
import { Screen, DEVICE, solidBarInset } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/Nav';
import { Button, StickyBar } from '../components/ui/Button';
import { Card, KeyValue, Divider } from '../components/ui/Display';
import { Skeleton, StateBlock } from '../components/ui/Feedback';
import { UpiSheet } from '../components/agent/UpiSheet';
import { useNav, useParams } from '../navigation/navigation';
import { useFocusFetch } from '../hooks/useFocusFetch';
import { Bookings } from '../api/endpoints';
import { showToast } from '../store/toast';
import { cashDuePending, formatDate, rupee } from '../domain/rules';
import { markDueCleared } from './collection';
import type { Booking } from '../domain/types';

type Method = 'Cash' | 'UPI / QR';
type Outcome = { kind: 'completed' | 'collected'; method: Method; booking: Booking; amount: number };

export function CollectPaymentScreen() {
  const nav = useNav();
  const { bookingId, mode = 'booking', completeAfter = true, returnTo } = useParams<'collect-payment'>();
  const { data: booking, loading, error } = useFocusFetch(() => Bookings.details(bookingId));
  const [busy, setBusy] = useState(false);
  const [upi, setUpi] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const dueMode = mode === 'cash_due';
  const amount = booking ? (dueMode ? booking.cash_due : booking.amount) : 0;

  /** Spec 5.4 — every step checked; a retry starts from the top (each call is idempotent). */
  const confirm = async (method: Method) => {
    if (!booking) return;
    setBusy(true);
    try {
      if (dueMode || cashDuePending(booking)) {
        const r = await Bookings.collectCashDue(booking.booking_id);
        if (r.code !== 0) return showToast('Couldn’t record the payment. Please tap again to retry.', 'critical');
        markDueCleared(booking.booking_id);
      }
      if (!completeAfter) {
        setUpi(false);
        setOutcome({ kind: 'collected', method, booking, amount });
        return;
      }
      if (!dueMode) {
        const r = await Bookings.setStatus(booking.id, 'ONGOING', booking.agent_otp);
        if (r.code !== 0) return showToast(r.message || 'Couldn’t update the booking. Tap again to retry.', 'critical');
      }
      const done = await Bookings.setStatus(booking.id, 'COMPLETED');
      if (done.code !== 0) return showToast(done.message || 'Couldn’t complete the booking. Tap again to retry.', 'critical');
      if (!dueMode) {
        const paid = await Bookings.setStatus(booking.id, 'PAID');
        if (paid.code !== 0) return showToast(paid.message || 'Couldn’t mark the booking paid. Tap again to retry.', 'critical');
      }
      setUpi(false);
      setOutcome({ kind: 'completed', method, booking, amount });
    } finally {
      setBusy(false);
    }
  };

  if (outcome) return <PaymentDone outcome={outcome} onHome={() => nav.resetTo('home')} onBack={() => (returnTo ? nav.back() : nav.back())} />;

  if (loading || !booking) {
    return (
      <Screen>
        <ScreenHeader title={dueMode ? 'Added Patient Payment' : 'Collect Cash'} />
        <Div className="gap-3 p-4">
          {error ? (
            <StateBlock icon={<X className="h-[26px] w-[26px]" strokeWidth={2.2} />} tone="critical" title="Couldn’t load the booking" body={error} />
          ) : (
            <>
              <Skeleton className="h-[120px] w-full" rounded={18} />
              <Skeleton className="h-[160px] w-full" rounded={18} />
            </>
          )}
        </Div>
      </Screen>
    );
  }

  return (
    <Screen padBottom={false}>
      <ScreenHeader
        title={dueMode ? 'Added Patient Payment' : 'Collect Cash'}
        subtitle={booking.booking_id}
        right={
          <Span className={`mr-1 rounded-[7px] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[.1em] ${dueMode ? 'bg-caution-50 text-caution-700' : 'bg-vital-50 text-vital-700'}`}>
            {dueMode ? 'Due' : 'Cash'}
          </Span>
        }
      />
      <Div className="mx-auto w-full max-w-[640px] gap-3.5 px-4 pb-[190px] pt-4">
        <Card elevation="card">
          <Div className="flex-row items-center justify-between">
            <P className="text-caption font-semibold tabular-nums text-ink-400">{booking.booking_id}</P>
            <Span className="rounded-[8px] bg-caution-50 px-2 py-[3px] text-micro font-semibold uppercase tracking-[.04em] text-caution-700">
              {dueMode ? 'Payment Pending' : 'Cash Pending'}
            </Span>
          </Div>
          <P className="mt-2 text-title-sm text-ink-900">{booking.user.name}</P>
          <P className="mt-0.5 text-body-sm text-ink-500">{booking.plan_name} · {formatDate(booking.booking_date)}</P>
        </Card>

        <View style={{ borderRadius: 22, padding: 22, experimental_backgroundImage: 'linear-gradient(165deg, #0A3D70 0%, #0057A8 48%, #0068C8 100%)' } as any}>
          <P className="text-caption font-semibold uppercase tracking-[.1em] text-white/70">{dueMode ? 'Amount to Collect' : 'Amount Due'}</P>
          <P className="mt-1.5 font-display text-[42px] font-extrabold tabular-nums tracking-[-1px] text-white">{rupee(amount)}</P>
          <P className="mt-1 text-body-sm text-white/75">
            {dueMode ? 'For the patient you added at this address' : `Cash on collection · ${booking.plan_name}`}
          </P>
        </View>

        {dueMode && (
          <Card elevation="tile">
            <Div className="flex-row items-start gap-3">
              <UserPlus className="mt-[2px] h-[18px] w-[18px] shrink-0 text-caution-700" strokeWidth={2.2} />
              <P className="min-w-0 flex-1 text-body-sm leading-[19px] text-ink-600">
                The rest of this booking was paid online. The patient you added isn’t covered by that payment, so collect this amount before completing.
              </P>
            </Div>
          </Card>
        )}

        <Card elevation="tile">
          <P className="text-body-sm font-semibold text-ink-900">Before you confirm</P>
          <Div className="mt-3 gap-2.5">
            {[`Ask the customer for ${rupee(amount)}`, 'Count and verify the cash, or check the UPI success screen', 'Confirm only after the money is with you'].map((t, i) => (
              <Div key={t} className="flex-row items-start gap-2.5">
                <Span className="flex-col h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <Span className="text-[11px] font-bold text-brand-700">{i + 1}</Span>
                </Span>
                <P className="min-w-0 flex-1 text-body-sm leading-[19px] text-ink-600">{t}</P>
              </Div>
            ))}
          </Div>
        </Card>

        <Div className="flex-row items-start gap-2.5 rounded-tile bg-critical-50 p-3.5">
          <AlertTriangle className="mt-[1px] h-[16px] w-[16px] shrink-0 text-critical-700" strokeWidth={2.2} />
          <P className="min-w-0 flex-1 text-body-sm leading-[19px] text-critical-700">
            This action cannot be undone. Only tap after you have received the payment.
          </P>
        </Div>
      </Div>

      <StickyBar>
        <Div className="gap-2.5">
          <Button variant="secondary" icon={<QrCode className="h-[18px] w-[18px] text-brand-700" strokeWidth={2.2} />} disabled={busy} onClick={() => setUpi(true)}>
            Show QR / UPI
          </Button>
          <Button variant="success" loading={busy && !upi} icon={<Banknote className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />} onClick={() => confirm('Cash')}>
            {completeAfter ? 'Mark Collected & Complete' : 'Mark as Collected'}
          </Button>
        </Div>
      </StickyBar>

      <UpiSheet
        visible={upi}
        amount={amount}
        note={`KDC+ ${booking.booking_id}`}
        busy={busy}
        onClose={() => setUpi(false)}
        onReceived={() => confirm('UPI / QR')}
      />
    </Screen>
  );
}

function PaymentDone({ outcome, onHome, onBack }: { outcome: Outcome; onHome: () => void; onBack: () => void }) {
  const completed = outcome.kind === 'completed';
  return (
    <Screen background="bg-white" padBottom={false}>
      <Div className="mx-auto w-full max-w-[560px] flex-1 items-center px-6 pt-16">
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#E7F7EC', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' }}>
            <Check className="h-[34px] w-[34px] text-white" strokeWidth={3} />
          </View>
        </View>
        <P className="mt-6 text-center font-display text-[28px] font-extrabold tracking-[-0.6px] text-ink-900">
          {completed ? 'Booking Completed!' : 'Payment Collected!'}
        </P>
        <P className="mt-2 text-center text-body text-ink-500">
          {completed
            ? 'Samples are on their way to the lab.'
            : 'Recorded for the added patient. Finish collecting samples to complete the booking.'}
        </P>

        <Card elevation="card" className="mt-7">
          <KeyValue label="Booking ID" value={outcome.booking.booking_id} />
          <KeyValue label="Customer" value={outcome.booking.user.name} />
          <Divider className="my-1.5" />
          <KeyValue label="Amount" value={rupee(outcome.amount)} strong />
          <KeyValue label="Mode" value={outcome.method} />
          <KeyValue label="Status" value={completed ? (outcome.booking.payment_type === 'CASH' ? 'Paid' : 'Completed') : 'Collected'} tone="success" />
        </Card>
      </Div>
      <Div className="mx-auto w-full max-w-[560px] px-6" style={{ paddingBottom: DEVICE.safeBottom + 20 + solidBarInset() }}>
        {completed ? (
          <Button icon={<Home className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />} onClick={onHome}>
            Go Home
          </Button>
        ) : (
          <Button icon={<CheckCircle2 className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />} onClick={onBack}>
            Back to booking
          </Button>
        )}
      </Div>
    </Screen>
  );
}
