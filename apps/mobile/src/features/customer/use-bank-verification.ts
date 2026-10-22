import { useEffect, useRef, useState } from 'react';
import { BanksApi } from '../../../lib/banks-api';
import { bankCheckErrorMessage } from './bank-verify-errors';
import {
  compactAccountNo,
  isAccountNoValid,
  type RefundAccountDraft,
  verifiedAccount,
} from './refund-account-draft';

/**
 * Asks the bank who owns the typed account and stores the answer on the draft. An answer that
 * arrives after the bank or number changed is dropped, so it never vouches for a different account.
 */
export function useBankVerification(
  draft: RefundAccountDraft,
  onChange: (draft: RefundAccountDraft) => void,
) {
  const [isChecking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(draft);
  latest.current = draft;
  const mounted = useRef(true);
  // Blur and the button can both fire in one tick; one lookup is enough.
  const inFlight = useRef(false);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const isVerified = verifiedAccount(draft) !== null;
  const canVerify =
    draft.bankBin !== null && isAccountNoValid(draft.accountNo) && !isVerified && !isChecking;

  // A different bank or number makes the previous failure irrelevant.
  useEffect(() => setError(null), [draft.bankBin, draft.accountNo]);

  const verify = async () => {
    const { bankBin, accountNo } = latest.current;
    if (!canVerify || bankBin === null || inFlight.current) return;
    const number = compactAccountNo(accountNo);
    inFlight.current = true;
    setChecking(true);
    setError(null);
    try {
      const verified = await BanksApi.verify(bankBin, number);
      const current = latest.current;
      if (!mounted.current || current.bankBin !== bankBin) return;
      if (compactAccountNo(current.accountNo) !== number) return;
      onChange({ ...current, verified });
    } catch (err) {
      const current = latest.current;
      const sameAccount =
        current.bankBin === bankBin && compactAccountNo(current.accountNo) === number;
      if (mounted.current && sameAccount) setError(bankCheckErrorMessage(err));
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return { isChecking, isVerified, canVerify, error, verify };
}
