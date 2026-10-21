import { findVnBank } from '@storage/types';
import { useEffect, useRef, useState } from 'react';
import { ContractsApi } from '../../../lib/contracts-api';
import { todayIso } from '../../../lib/rental-schedule';
import { vietnamDayIso } from '../../../lib/settlement-format';
import type { ApiInspection } from '../../types/contract-api';
import {
  draftFromAccount,
  EMPTY_REFUND_ACCOUNT,
  isDraftEmpty,
  type RefundAccountDraft,
  refundAccountProblem,
  toRefundAccountInput,
} from './refund-account-draft';
import { returnErrorMessage } from './return-errors';
import { useReturnPreview } from './use-return-preview';

const isListedBin = (bin: string) => findVnBank(bin) !== undefined;

/**
 * State of the return request form: a new request, or a change to the open one (`openReturn`),
 * which starts from its day and note. The refund account is pre-filled from the one used last
 * time, unless the customer already started typing.
 */
export function useReturnRequestForm(
  contractId: string,
  openReturn: ApiInspection | null,
  onDone: () => void,
) {
  // The API bounds the day on the Vietnam calendar.
  const today = vietnamDayIso(new Date()) ?? todayIso();
  const currentDay = openReturn?.scheduledAt ? vietnamDayIso(openReturn.scheduledAt) : null;
  // An appointment already behind us cannot be previewed or kept: a new day must be picked.
  const [dayIso, setDayIso] = useState<string | null>(
    currentDay && currentDay >= today ? currentDay : null,
  );
  const [note, setNote] = useState(openReturn?.requestNote ?? '');
  const [account, setAccount] = useState<RefundAccountDraft>(EMPTY_REFUND_ACCOUNT);
  const accountTouched = useRef(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useReturnPreview(contractId, dayIso);

  const saved = preview.preview?.saved_refund_account;
  useEffect(() => {
    if (saved && !accountTouched.current) setAccount(draftFromAccount(saved, isListedBin));
  }, [saved]);

  // No preview yet counts as required: only a known zero deposit leaves nothing to refund.
  const accountRequired = preview.preview?.deposit_held !== 0;
  const movedEarlier = Boolean(openReturn && currentDay && dayIso && dayIso < currentDay);

  const changeAccount = (draft: RefundAccountDraft) => {
    accountTouched.current = true;
    setAccount(draft);
    setError(null);
  };

  const submit = async () => {
    if (!dayIso || isSubmitting) return;
    const skipAccount = !accountRequired && isDraftEmpty(account);
    const problem = skipAccount ? null : refundAccountProblem(account);
    if (problem) {
      setError(problem);
      return;
    }
    const refundAccount = skipAccount ? undefined : toRefundAccountInput(account);
    setSubmitting(true);
    setError(null);
    try {
      if (openReturn) {
        await ContractsApi.updateReturn(contractId, {
          dayIso: dayIso === currentDay ? undefined : dayIso,
          note: note.trim(),
          refundAccount,
        });
      } else {
        await ContractsApi.requestReturn(contractId, { dayIso, note: note.trim(), refundAccount });
      }
      onDone();
    } catch (err) {
      setError(returnErrorMessage(err, 'Không gửi được yêu cầu. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    today,
    dayIso,
    setDayIso,
    note,
    setNote,
    account,
    changeAccount,
    accountRequired,
    movedEarlier,
    preview,
    isSubmitting,
    error,
    canSubmit: dayIso !== null && !preview.isLoading && !isSubmitting,
    submit,
  };
}
