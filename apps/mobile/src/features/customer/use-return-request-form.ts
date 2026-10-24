import { useEffect, useRef, useState } from 'react';
import { ContractsApi } from '../../../lib/contracts-api';
import { todayIso } from '../../../lib/rental-schedule';
import { vietnamDayIso } from '../../../lib/settlement-format';
import type { ApiInspection } from '../../types/contract-api';
import {
  draftFromAccount,
  EMPTY_REFUND_ACCOUNT,
  type RefundAccountDraft,
  refundAccountPayload,
} from './refund-account-draft';
import { returnErrorMessage } from './return-errors';
import { useReturnPreview } from './use-return-preview';

/**
 * State of the return request form: a new request, or a change to the open one (`openReturn`),
 * which starts from its day and note. A new request pre-fills the refund account used last time
 * (unless the customer already started typing). A change starts with an empty account form and
 * sends one only if the customer fills it in: the request's own account is not visible to the
 * app, and the last-used one may belong to another contract or predate a branch-made request.
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
  const isEdit = openReturn !== null;

  const saved = preview.preview?.saved_refund_account;
  useEffect(() => {
    if (!isEdit && saved && !accountTouched.current) {
      setAccount(draftFromAccount(saved));
    }
  }, [isEdit, saved]);

  // No preview yet counts as required: only a known zero deposit leaves nothing to refund.
  const accountRequired = !isEdit && preview.preview?.deposit_held !== 0;

  const changeAccount = (draft: RefundAccountDraft) => {
    accountTouched.current = true;
    setAccount(draft);
    setError(null);
  };

  const payload = () =>
    refundAccountPayload(account, {
      isEdit,
      required: accountRequired,
      touched: accountTouched.current,
    });

  const submit = async () => {
    if (!dayIso || isSubmitting) return;
    const { problem, refundAccount } = payload();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
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
    accountHint: isEdit ? 'Để trống để giữ tài khoản đã gửi' : null,
    preview,
    isSubmitting,
    error,
    // An account that is filled in but not yet verified at the bank cannot be sent.
    canSubmit: dayIso !== null && !preview.isLoading && !isSubmitting && payload().problem === null,
    submit,
  };
}
