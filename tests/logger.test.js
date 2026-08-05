import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '../js/logger.js';

describe('logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exposes all level methods', () => {
    ['debug', 'info', 'warn', 'error'].forEach((m) => {
      expect(typeof logger[m]).toBe('function');
    });
  });

  it('error() forwards to console.error with prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('boom');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBe('[AI学社]');
  });

  it('warn() forwards to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('heads up');
    expect(spy).toHaveBeenCalled();
  });

  it('report() is safe to call and does not throw', () => {
    expect(() => logger.report(new Error('x'))).not.toThrow();
  });
});
