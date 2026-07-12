// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createPublicSmsSubscription } from '../api.js';
import { SmsUpdatesPage } from './PublicPages.js';

vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api.js')>()),
  createPublicSmsSubscription: vi.fn(),
}));

const submitSubscription = vi.mocked(createPublicSmsSubscription);

afterEach(() => {
  vi.clearAllMocks();
});

describe('SmsUpdatesPage', () => {
  it('shows the complete branded standalone SMS program disclosure', () => {
    render(<SmsUpdatesPage />);

    expect(
      screen.getByRole('heading', { name: 'Wedding text updates' }),
    ).not.toBeNull();
    expect(
      screen.getAllByText(/Matt & Alison Wedding/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /schedule updates, wedding logistics, and RSVP recovery/i,
      ),
    ).not.toBeNull();
    expect(
      screen.getByText(/fewer than 10 messages per month/i),
    ).not.toBeNull();
    expect(
      screen.getByText(/message and data rates may apply/i),
    ).not.toBeNull();
    expect(
      screen.getByText(/reply HELP for help or STOP to opt out/i),
    ).not.toBeNull();
    expect(screen.getByText(/sole proprietor Matthew Bulger/i)).not.toBeNull();
    expect(screen.getByText(/contact@matt-alison.com/i)).not.toBeNull();
    expect(
      screen.getByRole('link', { name: 'Terms' }).getAttribute('href'),
    ).toBe('/terms');
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href'),
    ).toBe('/privacy');
    expect(
      screen.getByText(
        /SMS consent is independent from submitting or updating an RSVP/i,
      ),
    ).not.toBeNull();
    expect(
      screen.queryByText(/proof|example|does not submit|does not enroll/i),
    ).toBeNull();
  });

  it('requires affirmative consent without making a request', async () => {
    render(<SmsUpdatesPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile phone' }), {
      target: { value: '(480) 555-0100' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign up for text updates' }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Confirm SMS consent',
    );
    expect(submitSubscription).not.toHaveBeenCalled();
  });

  it('submits the controlled phone and affirmative consent', async () => {
    submitSubscription.mockResolvedValue({ status: 'opted_in' });
    render(<SmsUpdatesPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile phone' }), {
      target: { value: '(480) 555-0100' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign up for text updates' }),
    );

    await waitFor(() =>
      expect(submitSubscription).toHaveBeenCalledWith({
        phone: '(480) 555-0100',
        consentAccepted: true,
      }),
    );
    expect(
      await screen.findByText(
        /you’re enrolled for Matt & Alison Wedding text updates/i,
      ),
    ).not.toBeNull();
    expect(
      screen.queryByText(/delivered|sent to your phone|handset/i),
    ).toBeNull();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('renders the pending confirmation response as an accepted pending signup', async () => {
    submitSubscription.mockResolvedValue({ status: 'pending_confirmation' });
    render(<SmsUpdatesPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile phone' }), {
      target: { value: '(480) 555-0100' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign up for text updates' }),
    );

    expect(
      await screen.findByText(
        /your signup was accepted and is pending confirmation/i,
      ),
    ).not.toBeNull();
    expect(
      screen.queryByText(/you’re enrolled for Matt & Alison Wedding/i),
    ).toBeNull();
  });

  it.each([429, 503])(
    'keeps the form retryable after a %s response',
    async (statusCode) => {
      submitSubscription
        .mockRejectedValueOnce(new ApiError('Please try again', statusCode))
        .mockResolvedValueOnce({ status: 'opted_in' });
      render(<SmsUpdatesPage />);

      const phone = screen.getByRole('textbox', {
        name: 'Mobile phone',
      }) as HTMLInputElement;
      fireEvent.change(phone, { target: { value: '(480) 555-0100' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(
        screen.getByRole('button', { name: 'Sign up for text updates' }),
      );

      expect(
        await screen.findByText(
          /couldn’t save your text update signup.*try again/i,
        ),
      ).not.toBeNull();
      expect(phone.value).toBe('(480) 555-0100');
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
        true,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(submitSubscription).toHaveBeenCalledTimes(2));
    },
  );
});
