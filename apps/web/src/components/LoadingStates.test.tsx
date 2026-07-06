// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LoadingPulse,
  LoadingScreen,
  RouteLoadingFallback,
  SkeletonDashboard,
  SkeletonStat,
} from './LoadingStates.js';

const visibleProgressCopy =
  /Loading|Preparing|Refreshing|Saving|Generating|Opening|Sending/i;

describe('shared loading states', () => {
  it('renders the standard loading animation without visible progress copy', () => {
    const { container } = render(<LoadingPulse compact />);

    expect(container.textContent).not.toMatch(visibleProgressCopy);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(container.querySelector('.loading-mark')).not.toBeNull();
  });

  it('renders full-card loading skeletons without visible progress copy', () => {
    const { container } = render(<LoadingScreen />);

    expect(container.textContent).not.toMatch(visibleProgressCopy);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(
      container.querySelector('.skeleton-stack')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('renders route fallbacks without visible progress copy', () => {
    const { container } = render(<RouteLoadingFallback />);

    expect(container.textContent).not.toMatch(visibleProgressCopy);
    expect(screen.getByRole('status')).not.toBeNull();
  });

  it('marks shape-only skeletons as hidden from assistive technology', () => {
    const { container } = render(
      <>
        <SkeletonStat />
        <SkeletonDashboard />
      </>,
    );

    expect(container.textContent).toBe('');
    expect(
      container.querySelector('.skeleton-stat')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      container.querySelector('.admin-skeleton')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
