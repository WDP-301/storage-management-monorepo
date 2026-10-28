import { fireEvent, screen, waitFor } from '@testing-library/react';

const isDisabled = (el: HTMLElement) =>
  el.hasAttribute('disabled') ||
  el.getAttribute('aria-disabled') === 'true' ||
  el.hasAttribute('data-disabled');

/**
 * Opens a Kumo Select and picks an option by its visible label. Waits for the trigger to be
 * enabled (options loaded), and drives the pointer sequence Base UI commits a choice on.
 */
export async function pickSelectOption(trigger: HTMLElement, optionName: string | RegExp) {
  await waitFor(() => {
    if (isDisabled(trigger)) throw new Error('Select is still disabled');
  });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.pointerUp(option, { pointerType: 'mouse' });
  fireEvent.click(option);
}
