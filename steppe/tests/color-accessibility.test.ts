import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

type Color = [number, number, number, number];
const read = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
function declarations(css: string, selector: string) {
  const values: Record<string, string> = {};
  postcss.parse(css).walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(d => { values[d.prop] = d.value; });
  });
  return values;
}
function color(value: string): Color {
  if (value.startsWith('#')) return [1, 3, 5].map(i => Number.parseInt(value.slice(i, i + 2), 16)).concat(1) as Color;
  const n = value.match(/[\d.]+/g)!.map(Number);
  if (value.startsWith('rgb')) return [n[0], n[1], n[2], n[3] ?? 1];
  const [h, sat, light, alpha = 1] = n;
  const s = sat / 100, l = light / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (offset: number) => {
    const k = (offset + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4), alpha];
}
function luminance(c: Color) {
  return c.slice(0, 3).reduce((total, v, i) => {
    const x = v / 255;
    return total + (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}
function composite(fg: Color, bg: Color): Color {
  return [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as Color;
}
function contrast(foreground: Color, background: Color) {
  const [lo, hi] = [luminance(composite(foreground, background)), luminance(background)].sort((a, b) => a - b);
  return (hi + .05) / (lo + .05);
}
const appCss = read('app/globals.css');
const app = declarations(appCss, ':root');
const appColor = (token: string) => color(app[token]);
const siteCss = read('app/(site)/tokens.css');
const siteBase = declarations(siteCss, ':root');
const siteThemes = ['light', 'dark'].map(theme => ({theme, tokens: {...siteBase, ...declarations(siteCss, `html[data-theme="${theme}"]`)}}));

describe('WCAG color pairs used by interactive states', () => {
  it('uses the WCAG reference extremes', () => {
    expect(contrast(color('#ffffff'), color('#000000'))).toBe(21);
    expect(contrast(color('#ffffff'), color('#ffffff'))).toBe(1);
  });
  for (const surface of ['--background', '--muted']) {
    for (const ink of ['--foreground', '--muted-foreground']) {
      it(`keeps choice-card ${ink} readable on ${surface}`, () => {
        expect(contrast(appColor(ink), appColor(surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`keeps field boundaries and focus visible on ${surface}`, () => {
      expect(contrast(appColor('--input'), appColor(surface))).toBeGreaterThanOrEqual(3);
      expect(contrast(appColor('--ring'), appColor(surface))).toBeGreaterThanOrEqual(3);
    });
  }
  for (const {theme, tokens} of siteThemes) {
    const c = (token: string) => color(tokens[token]);
    for (const surface of ['--bg', '--bg-paper', '--site-card', '--paper', '--bg-alt']) {
      for (const ink of ['--text', '--text-muted', '--site-accent-ink']) {
        it(`${theme}: ${ink} stays readable on ${surface}`, () => {
          expect(contrast(c(ink), c(surface))).toBeGreaterThanOrEqual(4.5);
        });
      }
      it(`${theme}: control edge and focus contrast on ${surface}`, () => {
        expect(contrast(c('--site-input-border'), c(surface))).toBeGreaterThanOrEqual(3);
        expect(contrast(c('--site-focus'), c(surface))).toBeGreaterThanOrEqual(3);
      });
    }
    for (const [ink, fill] of [['--site-on-action','--site-action'], ['--site-on-action','--site-action-hover'], ['--site-on-juniper','--juniper'], ['--site-on-juniper','--juniper-deep'], ['--site-on-sage','--sage']]) {
      it(`${theme}: ${ink} on ${fill} meets normal-text contrast`, () => {
        expect(contrast(c(ink), c(fill))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('keeps the website from replacing app color tokens on client navigation', () => {
    postcss.parse(siteCss).walkDecls(d => {
      expect(['--card', '--border']).not.toContain(d.prop);
    });
  });
});
