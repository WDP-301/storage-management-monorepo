import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractsApi } from '../../lib/api';
import { MoveSlotsApi } from '../../lib/move-slots-api';
import { addDays, vnToday } from '../../lib/vn-day';
import { contractRecord } from '../../test-utils/contract-fixtures';
import { ManagedReturnForm } from './ManagedReturnForm';

const day = addDays(vnToday(), 2);
const at = (time: string) => new Date(`${day}T${time}:00+07:00`).toISOString();

const open = async () => {
  const onChanged = vi.fn();
  render(
    <ManagedReturnForm
      contract={contractRecord({ status: 'ACTIVE' })}
      canRequest
      onChanged={onChanged}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu trả kho thay khách' }));
  return onChanged;
};

describe('ManagedReturnForm', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the chosen office slot as the appointment instant', async () => {
    const windows = vi
      .spyOn(MoveSlotsApi, 'windows')
      .mockResolvedValue([{ startAt: at('08:00'), endAt: at('11:00') }]);
    const create = vi.spyOn(ContractsApi, 'createReturnOnBehalf').mockResolvedValue({} as never);
    const onChanged = await open();

    fireEvent.change(screen.getByLabelText('Ngày hẹn trả'), { target: { value: day } });
    await waitFor(() => expect(windows).toHaveBeenCalledWith(day));
    const submit = screen.getByRole('button', { name: 'Tạo yêu cầu trả kho' });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(submit);

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('c-1', { scheduledAt: at('08:00'), source: 'HOTLINE' }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('cannot submit while the day has no office hours left', async () => {
    vi.spyOn(MoveSlotsApi, 'windows').mockResolvedValue([]);
    const create = vi.spyOn(ContractsApi, 'createReturnOnBehalf');
    await open();

    expect(await screen.findByText(/không còn khung giờ hành chính/)).toBeTruthy();
    const submit = screen.getByRole('button', { name: 'Tạo yêu cầu trả kho' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the API message for the appointment time', async () => {
    vi.spyOn(MoveSlotsApi, 'windows').mockResolvedValue([
      { startAt: at('08:00'), endAt: at('11:00') },
    ]);
    vi.spyOn(ContractsApi, 'createReturnOnBehalf').mockRejectedValue(
      Object.assign(new Error('Validation failed'), {
        status: 400,
        code: 'VALIDATION_FAILED',
        details: {
          fields: [
            {
              field: 'scheduledAt',
              code: 'returnTimeNotInShift',
              message: 'Giờ hẹn trả phải nằm trong ca làm việc hành chính.',
            },
          ],
        },
      }),
    );
    await open();
    fireEvent.change(screen.getByLabelText('Ngày hẹn trả'), { target: { value: day } });
    const submit = screen.getByRole('button', { name: 'Tạo yêu cầu trả kho' });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(submit);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Giờ hẹn trả phải nằm trong ca làm việc hành chính.',
    );
  });
});
