import React from 'react';
import { View } from 'react-native';
import { Btn, Div, P, Span } from '../primitives/index';
import { CalendarDays, Clock, MapPin, Users, X } from '../primitives/icons';
import { Card } from '../ui/Display';
import type { Booking } from '../../domain/types';
import { addressLine, formatDate, normaliseStatus, patientCount, resolveTime, statusMeta } from '../../domain/rules';
import { CallIcon, CardAction, DirectionsIcon, openDirections, PaymentChip, StatusPill, TubeChip } from './index';
import { SlideButton } from './SlideButton';

/**
 * A booking as the agent sees it on Home (with the slider and reject) or in
 * History (read-only, opens details).
 */
export function BookingCard({
  booking: b,
  variant = 'active',
  calling,
  onCall,
  onSlide,
  onReject,
  onOpen,
}: {
  booking: Booking;
  variant?: 'active' | 'past';
  calling?: boolean;
  onCall?: () => void;
  onSlide?: () => Promise<unknown> | void;
  onReject?: () => void;
  onOpen?: () => void;
}) {
  const status = normaliseStatus(b.booking_status);
  const meta = statusMeta(status);
  const past = variant === 'past';
  const count = patientCount(b);

  return (
    <Card padded={false} elevation="card" className="overflow-hidden" onClick={past ? onOpen : undefined}>
      <Div className="p-4">
        <Div className="flex-row items-center justify-between gap-3">
          <P className="text-caption font-semibold tabular-nums tracking-[.02em] text-ink-400">{b.booking_id}</P>
          <StatusPill status={status} />
        </Div>
        <P className="mt-2 text-title-sm text-ink-900">{b.plan_name}</P>

        <Div className="mt-2.5 flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
          <Meta icon={<CalendarDays className="h-[14px] w-[14px] text-ink-400" strokeWidth={2.2} />} text={formatDate(b.booking_date)} />
          <Meta icon={<Clock className="h-[14px] w-[14px] text-ink-400" strokeWidth={2.2} />} text={resolveTime(b)} />
          <Meta icon={<Users className="h-[14px] w-[14px] text-ink-400" strokeWidth={2.2} />} text={`${count} ${count === 1 ? 'patient' : 'patients'}`} />
        </Div>

        <Div className="mt-3.5 flex-row items-start gap-3 rounded-tile bg-ink-50 p-3">
          <MapPin className="mt-[2px] h-[16px] w-[16px] shrink-0 text-brand-600" strokeWidth={2.2} />
          <Div className="min-w-0 flex-1">
            <P className="text-body font-semibold text-ink-900">{b.user.name}</P>
            <P className="mt-0.5 text-body-sm leading-[19px] text-ink-500">{addressLine(b)}</P>
          </Div>
        </Div>

        {!past && (
          <Div className="mt-3 flex-row gap-2.5">
            <CardAction icon={<DirectionsIcon />} label="Directions" onPress={() => openDirections(b)} />
            <CardAction icon={<CallIcon />} label="Call customer" tone="brand" busy={calling} onPress={() => onCall?.()} />
          </Div>
        )}

        <Div className="mt-3.5 flex-row flex-wrap gap-2">
          {!past && b.lab_samples?.map((s) => <TubeChip key={s.id} color={s.sample_color} label={s.sample_name} />)}
          <PaymentChip booking={b} past={past} />
        </Div>
      </Div>

      {!past && meta.slide && (
        <Div className="border-t border-ink-100 px-4 pb-4 pt-3.5">
          <SlideButton
            label={meta.slide}
            tone={status === 'ONGOING' ? 'purple' : status === 'ONMYWAY' ? 'success' : 'brand'}
            onComplete={() => onSlide?.()}
          />
          {status === 'ACCEPTED' && (
            <Btn onPress={onReject} className="tap mt-2.5 flex-row h-[40px] items-center justify-center gap-1.5 self-center px-4">
              <X className="h-[15px] w-[15px] text-critical-600" strokeWidth={2.6} />
              <Span className="text-body-sm font-semibold text-critical-600">Reject Booking</Span>
            </Btn>
          )}
        </Div>
      )}
    </Card>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <P className="text-body-sm text-ink-600">{text}</P>
    </View>
  );
}
