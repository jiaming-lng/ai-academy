import { describe, it, expect } from 'vitest';
import { siteConfig } from '../js/config/site.config.js';

describe('siteConfig', () => {
  it('has brand with required fields', () => {
    expect(siteConfig.brand).toBeDefined();
    expect(typeof siteConfig.brand.name).toBe('string');
    expect(siteConfig.brand.name.length).toBeGreaterThan(0);
    expect(typeof siteConfig.brand.tagline).toBe('string');
    expect(typeof siteConfig.brand.copyright).toBe('string');
    expect(siteConfig.brand.copyright).toContain('AI学社');
  });

  it('nav has 5 items with href and label', () => {
    expect(siteConfig.nav).toHaveLength(5);
    siteConfig.nav.forEach((item, i) => {
      expect(item, `nav[${i}] missing href`).toHaveProperty('href');
      expect(item, `nav[${i}] missing label`).toHaveProperty('label');
      expect(typeof item.href).toBe('string');
      expect(typeof item.label).toBe('string');
    });
  });

  it('nav links are valid (all .html pages)', () => {
    const pages = siteConfig.nav.map((n) => n.href);
    expect(pages).toContain('index.html');
    expect(pages).toContain('courses.html');
    expect(pages).toContain('community.html');
    expect(pages).toContain('about.html');
  });

  it('footer has 3 columns each with title and links', () => {
    expect(siteConfig.footer).toHaveLength(3);
    siteConfig.footer.forEach((col, i) => {
      expect(col, `footer[${i}] missing title`).toHaveProperty('title');
      expect(Array.isArray(col.links)).toBe(true);
      expect(col.links.length).toBeGreaterThan(0);
      col.links.forEach((link, j) => {
        expect(link, `footer[${i}].links[${j}] missing label`).toHaveProperty('label');
        expect(link, `footer[${i}].links[${j}] missing href`).toHaveProperty('href');
      });
    });
  });

  it('cta has text and href', () => {
    expect(siteConfig.cta).toHaveProperty('text');
    expect(siteConfig.cta).toHaveProperty('href');
    expect(typeof siteConfig.cta.text).toBe('string');
    expect(typeof siteConfig.cta.href).toBe('string');
  });

  it('themeKey is a string', () => {
    expect(typeof siteConfig.themeKey).toBe('string');
    expect(siteConfig.themeKey.length).toBeGreaterThan(0);
  });
});
