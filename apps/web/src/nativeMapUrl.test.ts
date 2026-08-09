import { describe, expect, it } from 'vitest';
import { getNativeMapUrl } from './nativeMapUrl.js';

const urls = {
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Phoenix',
  appleMapsUrl: 'https://maps.apple.com/?q=Phoenix',
};

describe('getNativeMapUrl', () => {
  it('falls back to Google Maps without browser information', () => {
    expect(getNativeMapUrl(urls, undefined)).toBe(urls.googleMapsUrl);
  });

  it('uses Apple Maps for iPhone and Mac platforms', () => {
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 0,
        platform: 'iPhone',
        userAgent: 'Mobile Safari',
      }),
    ).toBe(urls.appleMapsUrl);
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 0,
        platform: 'MacIntel',
        userAgent: 'Safari',
      }),
    ).toBe(urls.appleMapsUrl);
  });

  it('recognizes iPadOS using a touch-capable MacIntel platform', () => {
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 5,
        platform: 'MacIntel',
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe(urls.appleMapsUrl);
  });

  it('uses Google Maps for non-Apple platforms', () => {
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 0,
        platform: 'Win32',
        userAgent: 'Chrome',
      }),
    ).toBe(urls.googleMapsUrl);
  });
});
