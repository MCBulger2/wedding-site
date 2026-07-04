// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResponsiveImage } from './ResponsiveImage.js';

describe('ResponsiveImage', () => {
  it('renders responsive sources for an existing content image key', () => {
    render(
      <ResponsiveImage
        src="/ring.jpg"
        alt="Engagement ring"
        sizes="(min-width: 900px) 50vw, 100vw"
        loading="lazy"
        className="photo"
        objectPosition="center top"
      />,
    );

    const image = screen.getByRole('img', { name: 'Engagement ring' });
    const picture = image.closest('picture');

    expect(picture).not.toBeNull();
    expect(image.getAttribute('src')).toBe('/images/ring-1200.jpg');
    expect(image.getAttribute('width')).toBe('1200');
    expect(image.getAttribute('height')).toBe('1167');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('decoding')).toBe('async');
    expect(image.classList.contains('photo')).toBe(true);
    expect(image.style.objectPosition).toBe('center top');

    const sources = Array.from(picture!.querySelectorAll('source'));
    expect(sources).toHaveLength(2);
    expect(sources[0].getAttribute('type')).toBe('image/avif');
    expect(sources[0].getAttribute('srcset')).toBe(
      '/images/ring-480.avif 480w, /images/ring-800.avif 800w, /images/ring-1200.avif 1200w',
    );
    expect(sources[0].getAttribute('sizes')).toBe(
      '(min-width: 900px) 50vw, 100vw',
    );
    expect(sources[1].getAttribute('type')).toBe('image/webp');
    expect(sources[1].getAttribute('srcset')).toBe(
      '/images/ring-480.webp 480w, /images/ring-800.webp 800w, /images/ring-1200.webp 1200w',
    );
  });
});
