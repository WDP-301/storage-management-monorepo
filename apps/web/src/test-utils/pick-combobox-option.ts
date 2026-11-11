import { fireEvent, screen, waitFor } from '@testing-library/react';

const isDisabled = (el: HTMLElement) =>
  el.hasAttribute('disabled') ||
  el.getAttribute('aria-disabled') === 'true' ||
  el.hasAttribute('data-disabled');

const setNativeValue = (input: HTMLElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
};

// Base UI only opens the popup for typed input: an event without `inputType` counts
// as autofill and never opens it. Dispatch a real 'input' event flagged as text entry.
export const typeIntoCombobox = (input: HTMLElement, value: string) => {
  setNativeValue(input, value);
  const event = new Event('input', { bubbles: true });
  Object.defineProperty(event, 'inputType', { value: 'insertText' });
  fireEvent(input, event);
};

/**
 * Filters a Kumo Combobox by typing in its input, then picks an option by its visible label.
 * Waits for the input to be enabled (options loaded), and drives the pointer sequence Base UI
 * commits a choice on.
 */
export async function pickComboboxOption(
  input: HTMLElement,
  query: string,
  optionName: string | RegExp,
) {
  await waitFor(() => {
    if (isDisabled(input)) throw new Error('Combobox is still disabled');
  });
  input.focus();
  typeIntoCombobox(input, query);
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.pointerUp(option, { pointerType: 'mouse' });
  fireEvent.click(option);
}
