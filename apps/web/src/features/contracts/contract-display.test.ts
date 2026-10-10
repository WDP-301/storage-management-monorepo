import { describe, expect, it } from 'vitest';
import { contractRecord } from '../../test-utils/contract-fixtures';
import {
  buildContractPatch,
  endOfDateInput,
  fromDateInput,
  handoverState,
  plannedEnd,
  shortContractNo,
  toContractForm,
  toDateInput,
  validateContractForm,
  validateNewDocuments,
} from './contract-display';

describe('contract display helpers', () => {
  it('shortens the generated contract number to its first block', () => {
    expect(shortContractNo('CT-41bf439c-f69b-44ee-a615-3ccd5fa65e8f')).toBe('CT-41BF439C');
    expect(shortContractNo('HD-2026-001')).toBe('HD-2026-001');
  });

  it('round-trips a local day through the date input format', () => {
    const iso = fromDateInput('2027-10-15');
    expect(toDateInput(iso)).toBe('2027-10-15');
    expect(toDateInput(null)).toBe('');
  });

  it('ends the term the day before the same date N months later, like the customer app', () => {
    const end = (start: string, months: number) =>
      toDateInput(plannedEnd({ effective_at: fromDateInput(start), months }));
    expect(end('2026-10-15', 6)).toBe('2027-04-14');
    expect(end('2026-10-15', 12)).toBe('2027-10-14');
    // 31/01 + 1 month clamps to 28/02 instead of rolling into March.
    expect(end('2027-01-31', 1)).toBe('2027-02-27');
    expect(end('2028-01-31', 1)).toBe('2028-02-28');
  });

  it('describes the handover progress', () => {
    const base = contractRecord();
    const handover = base.handover as NonNullable<typeof base.handover>;
    expect(handoverState({ handover: null })).toBe('none');
    expect(handoverState(base)).toBe('unassigned');
    expect(handoverState({ handover: { ...handover, inspector_name: 'Võ Kỹ Thuật' } })).toBe(
      'assigned',
    );
    expect(
      handoverState({
        handover: { ...handover, finalized_at: '2026-10-15T03:00:00.000Z' },
      }),
    ).toBe('done');
  });

  it('checks new contract files before any upload', () => {
    const file = (name: string, type: string, size = 1000) =>
      new File([new Uint8Array(size)], name, { type });
    expect(
      validateNewDocuments(0, [file('a.jpg', 'image/jpeg'), file('b.pdf', 'application/pdf')]),
    ).toBeNull();
    expect(
      validateNewDocuments(9, [file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')]),
    ).toMatch(/tối đa 10/);
    expect(validateNewDocuments(0, [file('notes.txt', 'text/plain')])).toMatch(/notes\.txt/);
    expect(
      validateNewDocuments(0, [file('big.pdf', 'application/pdf', 15 * 1024 * 1024 + 1)]),
    ).toMatch(/15 MB/);
  });

  it('validates the commercial terms only while the contract is unsigned', () => {
    const draft = contractRecord();
    const signed = contractRecord({ status: 'ACTIVE', signed_at: '2026-10-15T03:00:00.000Z' });
    const form = toContractForm(draft);
    expect(validateContractForm(form, draft)).toBeNull();
    expect(validateContractForm({ ...form, months: '0' }, draft)).toContain('1 đến 60');
    expect(validateContractForm({ ...form, months: '2.5' }, draft)).toContain('1 đến 60');
    expect(validateContractForm({ ...form, monthlyPrice: '-1' }, draft)).toContain('không âm');
    expect(validateContractForm({ ...form, monthlyPrice: ' ' }, draft)).toContain('không âm');
    expect(validateContractForm({ ...form, effectiveAt: '' }, draft)).toContain('ngày hiệu lực');
    expect(validateContractForm({ ...form, months: '0' }, signed)).toBeNull();
    expect(validateContractForm({ ...form, endedAt: form.effectiveAt }, signed)).toContain(
      'sau ngày hiệu lực',
    );
  });

  it('refuses to clear a stored end date, which the API cannot do', () => {
    const ended = contractRecord({ ended_at: '2027-04-14T16:59:59.999Z' });
    const form = toContractForm(ended);
    expect(validateContractForm(form, ended)).toBeNull();
    expect(validateContractForm({ ...form, endedAt: '' }, ended)).toBe(
      'Không thể xóa ngày kết thúc đã lưu.',
    );
  });

  it('patches only changed fields and never the sealed terms of a signed contract', () => {
    const draft = contractRecord();
    const form = toContractForm(draft);
    expect(buildContractPatch(form, draft)).toEqual({});
    expect(buildContractPatch({ ...form, months: '12', monthlyPrice: '3500000' }, draft)).toEqual({
      months: 12,
      monthlyPriceSnapshot: 3500000,
    });
    // "3200000" vs the stored "3200000.00" is not a change.
    expect(buildContractPatch({ ...form, monthlyPrice: '3200000.0' }, draft)).toEqual({});

    const signed = contractRecord({ status: 'ACTIVE', signed_at: '2026-10-15T03:00:00.000Z' });
    const patch = buildContractPatch(
      { ...toContractForm(signed), months: '12', endedAt: '2027-10-15' },
      signed,
    );
    // The end date keeps its whole last day.
    expect(patch).toEqual({ endedAt: endOfDateInput('2027-10-15') });
    expect(toDateInput(endOfDateInput('2027-10-15'))).toBe('2027-10-15');
    expect(new Date(endOfDateInput('2027-10-15')).getHours()).toBe(23);
  });
});
