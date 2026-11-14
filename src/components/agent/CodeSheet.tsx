import React, { useEffect, useState } from 'react';
import { Div, P } from '../primitives/index';
import { Button } from '../ui/Button';
import { ModalSheet } from '../ui/Feedback';
import { OtpInput } from '../ui/Inputs';

/**
 * Live builds: the patient's 4-digit collection code, read out at the door. The
 * server checks it; five wrong codes lock the booking until operations resets it.
 * `onSubmit` resolves to an error message, or null when the code was accepted.
 */
export function CodeSheet({ visible, onSubmit, onClose }: { visible: boolean; onSubmit: (code: string) => Promise<string | null>; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
    }
  }, [visible]);

  const submit = async (value = code) => {
    if (value.length !== 4 || busy) return;
    setBusy(true);
    const problem = await onSubmit(value);
    setBusy(false);
    if (problem) {
      setError(problem);
      setCode('');
    }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Enter the collection code" subtitle="Ask the customer for the 4-digit code in their KDC+ app">
      <Div className="pb-2">
        <OtpInput
          length={4}
          value={code}
          error={Boolean(error)}
          onChange={(v: string) => {
            const next = v.replace(/\D/g, '').slice(0, 4);
            setCode(next);
            setError(null);
            if (next.length === 4) submit(next);
          }}
        />
        {error ? <P className="mt-2 text-caption text-critical-600">{error}</P> : null}
        <Div className="mt-5">
          <Button loading={busy} disabled={code.length !== 4} onClick={() => submit()}>
            Start collection
          </Button>
        </Div>
      </Div>
    </ModalSheet>
  );
}
