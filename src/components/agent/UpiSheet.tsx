import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Div, P, Span } from '../primitives/index';
import { QrCode, RefreshCw, Smartphone } from '../primitives/icons';
import { Button } from '../ui/Button';
import { ModalSheet } from '../ui/Feedback';
import { Bookings, LIVE } from '../../api/endpoints';
import { normaliseQr, rupee, type UpiData } from '../../domain/rules';
import { EcgLoader } from '../ui/Feedback';

/** UPI QR bottom sheet (spec 5.3): server image or an on-device QR of the UPI intent. */
export function UpiSheet({
  visible,
  amount,
  note,
  busy,
  bookingId,
  forCashDue = false,
  onReceived,
  onClose,
}: {
  visible: boolean;
  amount: number;
  note: string;
  busy?: boolean;
  /** Live: the booking the single-use QR is for. */
  bookingId?: string;
  /** Live: the QR is for the cash due on people added at the door. */
  forCashDue?: boolean;
  onReceived: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<'loading' | 'error' | 'ready' | 'expired'>('loading');
  const [qr, setQr] = useState<UpiData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // The caller passes a fresh callback each render; keep the latest without reloading the QR.
  const received = useRef(onReceived);
  received.current = onReceived;

  const load = useCallback(async () => {
    setState('loading');
    const res = await Bookings.paymentQr(bookingId, forCashDue);
    // Live: an already-confirmed payment needs no QR.
    if (LIVE && res.code === 0 && (res.data as { status?: string } | undefined)?.status === 'paid') return received.current();
    const data = res.code === 0 ? normaliseQr(res.data, amount, note) : null;
    setMessage(res.code === 0 ? null : (res.message ?? null));
    setQr(data);
    setState(data ? 'ready' : 'error');
  }, [amount, note, bookingId, forCashDue]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  // Live: the payment counts when the bank confirms it, so poll instead of asking the agent.
  useEffect(() => {
    if (!LIVE || !visible || state !== 'ready' || !bookingId) return;
    let alive = true;
    const timer = setInterval(async () => {
      const r = await Bookings.qrStatus(bookingId);
      if (!alive || r.code !== 0) return;
      if (r.data?.status === 'paid') {
        clearInterval(timer);
        received.current();
      } else if (r.data?.status === 'cancelled') {
        clearInterval(timer);
        setState('expired');
      }
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [visible, state, bookingId]);

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Collect by UPI" subtitle="Ask the customer to scan with any UPI app">
      {state === 'loading' && (
        <View style={{ height: 300, justifyContent: 'center' }}>
          <EcgLoader label="Loading payment QR" />
        </View>
      )}
      {state === 'error' && (
        <Div className="items-center py-10">
          <Span className="flex-col h-[56px] w-[56px] items-center justify-center rounded-[18px] bg-critical-50">
            <QrCode className="h-[26px] w-[26px] text-critical-600" strokeWidth={2} />
          </Span>
          <P className="mt-3 text-title-sm text-ink-900">Couldn't load the payment QR.</P>
          {message ? <P className="mt-1 px-6 text-center text-body-sm text-ink-500">{message}</P> : null}
          <Div className="mt-4 w-[180px]">
            <Button variant="secondary" size="md" icon={<RefreshCw className="h-[16px] w-[16px] text-brand-700" strokeWidth={2.4} />} onClick={load}>
              Retry
            </Button>
          </Div>
        </Div>
      )}
      {state === 'expired' && (
        <Div className="items-center py-10">
          <P className="text-title-sm text-ink-900">This QR has expired.</P>
          <P className="mt-1 text-body-sm text-ink-500">No payment was received. Show a new one.</P>
          <Div className="mt-4 w-[180px]">
            <Button variant="secondary" size="md" icon={<RefreshCw className="h-[16px] w-[16px] text-brand-700" strokeWidth={2.4} />} onClick={load}>
              New QR
            </Button>
          </Div>
        </Div>
      )}
      {state === 'ready' && qr && (
        <Div className="items-center pb-2">
          <P className="text-caption font-semibold uppercase tracking-[.08em] text-ink-400">Amount</P>
          <P className="mt-1 font-display text-[34px] font-extrabold tabular-nums text-ink-900">{rupee(amount)}</P>
          <View style={{ marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E1EA' }}>
            {qr.kind === 'image' ? (
              <Image source={{ uri: qr.value }} style={{ width: 220, height: 220 }} resizeMode="contain" />
            ) : (
              <QRCode value={qr.value} size={220} color="#071724" backgroundColor="#FFFFFF" />
            )}
          </View>
          <P className="mt-3 text-body font-semibold text-ink-900">{qr.payee}</P>
          <Div className="mt-2 flex-row items-center gap-1.5">
            <Smartphone className="h-[14px] w-[14px] text-ink-400" strokeWidth={2.2} />
            <P className="text-body-sm text-ink-500">GPay · PhonePe · Paytm · BHIM</P>
          </Div>
          {LIVE ? (
            <Div className="mt-5 w-full items-center">
              <EcgLoader label={busy ? 'Completing the booking' : 'Waiting for the bank to confirm the payment'} />
            </Div>
          ) : (
            <Div className="mt-5 w-full">
              <Button variant="success" loading={busy} onClick={onReceived}>
                Payment Received
              </Button>
            </Div>
          )}
        </Div>
      )}
    </ModalSheet>
  );
}
