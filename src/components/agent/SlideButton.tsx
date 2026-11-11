import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { P } from '../primitives/index';
import { ChevronRight, Loader2 } from '../primitives/icons';
import { colors } from '../primitives/tokens';

const KNOB = 48;
const PAD = 4;

/**
 * Drag-to-confirm control for status changes (spec 10.3). Completes when the
 * knob passes 75% of the track; otherwise springs back.
 */
export function SlideButton({
  label,
  onComplete,
  tone = 'brand',
  disabled = false,
}: {
  label: string;
  onComplete: () => Promise<unknown> | void;
  tone?: 'brand' | 'success' | 'purple';
  disabled?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, width - KNOB - PAD * 2);
  const maxRef = useRef(max);
  maxRef.current = max;
  const busyRef = useRef(false);

  const fill = { brand: colors['brand-600'], success: colors['vital-600'], purple: '#7C3AED' }[tone];
  const track = { brand: colors['brand-50'], success: colors['vital-50'], purple: '#F3EEFF' }[tone];

  const reset = () => Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !busyRef.current && !disabled,
        onMoveShouldSetPanResponder: (_, g) => !busyRef.current && !disabled && Math.abs(g.dx) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => x.setValue(Math.min(maxRef.current, Math.max(0, g.dx))),
        onPanResponderRelease: async (_, g) => {
          const m = maxRef.current;
          if (m > 0 && g.dx >= m * 0.75) {
            Animated.timing(x, { toValue: m, duration: 120, useNativeDriver: false }).start();
            busyRef.current = true;
            setBusy(true);
            try {
              await onComplete();
            } finally {
              busyRef.current = false;
              setBusy(false);
              reset();
            }
          } else reset();
        },
        onPanResponderTerminate: reset,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, onComplete],
  );

  const labelOpacity = x.interpolate({ inputRange: [0, Math.max(1, max * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  const fillWidth = Animated.add(x, KNOB + PAD);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: KNOB + PAD * 2, borderRadius: 16, backgroundColor: track, justifyContent: 'center', overflow: 'hidden', opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: fillWidth, backgroundColor: fill, opacity: 0.16, borderRadius: 16 }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: KNOB + PAD * 2, right: 12, opacity: labelOpacity }}>
        <P className="text-center text-body font-semibold" style={{ color: fill }}>
          {busy ? 'Updating…' : label}
        </P>
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        style={{
          position: 'absolute',
          left: PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: 13,
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: x }],
          boxShadow: '0 6px 14px -6px rgba(7,23,36,0.45)',
        } as any}
      >
        {busy ? (
          <Loader2 className="h-[20px] w-[20px] animate-spinSlow text-white" strokeWidth={2.6} />
        ) : (
          <ChevronRight className="h-[22px] w-[22px] text-white" strokeWidth={2.8} />
        )}
      </Animated.View>
    </View>
  );
}
