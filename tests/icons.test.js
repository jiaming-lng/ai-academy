import { describe, it, expect } from 'vitest';
import { Icons } from '../js/icons.js';

describe('Icons', () => {
  it('exposes get, renderAll, and colors', () => {
    expect(typeof Icons.get).toBe('function');
    expect(typeof Icons.renderAll).toBe('function');
    expect(typeof Icons.colors).toBe('object');
  });

  it('colors has expected keys', () => {
    expect(Icons.colors).toHaveProperty('primary');
    expect(Icons.colors).toHaveProperty('secondary');
    expect(Icons.colors).toHaveProperty('success');
    expect(Icons.colors).toHaveProperty('warning');
  });

  describe('get()', () => {
    it('returns a string for known icons', () => {
      const known = ['home', 'book', 'users', 'info', 'brain', 'cpu', 'star', 'moon'];
      known.forEach((name) => {
        const svg = Icons.get(name);
        expect(typeof svg).toBe('string');
        expect(svg).toContain('<svg');
        expect(svg).toContain('viewBox="0 0 24 24"');
        expect(svg).toContain('</svg>');
      });
    });

    it('returns info icon for unknown name', () => {
      const svg = Icons.get('nonexistent-icon-xyz');
      expect(svg).toContain('<svg');
      // should contain the 'info' path (circle elements)
      expect(svg).toContain('circle');
    });

    it('returns info icon for empty string', () => {
      const svg = Icons.get('');
      expect(svg).toContain('<svg');
    });

    it('uses custom color when provided', () => {
      const svg = Icons.get('star', '#FF0000');
      expect(svg).toContain('stroke="#FF0000"');
    });

    it('uses currentColor when no color provided', () => {
      const svg = Icons.get('star');
      expect(svg).toContain('stroke="currentColor"');
    });
  });
});
