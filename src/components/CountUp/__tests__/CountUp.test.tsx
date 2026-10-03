import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountUp } from '../CountUp';

describe('CountUp component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders positive number with yen prefix and default aria-label', () => {
    render(<CountUp end={1000} prefix="¥" duration={0} />);
    act(() => {
      vi.runAllTimers();
    });
    const el = screen.getByLabelText('1,000円');
    expect(el).toBeDefined();
    expect(el.textContent).toBe('¥1,000');
  });

  it('renders negative number with yen prefix correctly formatted as −¥2,200', () => {
    render(<CountUp end={-2200} prefix="¥" duration={0} />);
    act(() => {
      vi.runAllTimers();
    });
    // マイナス記号（U+2212）が ¥ の前に配置される
    const el = screen.getByLabelText('マイナス2,200円');
    expect(el).toBeDefined();
    expect(el.textContent).toBe('−¥2,200');
    expect(el.textContent?.charCodeAt(0)).toBe(0x2212);
  });

  it('renders positive number with showPlusSign as +¥3,000', () => {
    render(<CountUp end={3000} prefix="¥" showPlusSign duration={0} />);
    act(() => {
      vi.runAllTimers();
    });
    const el = screen.getByLabelText('プラス3,000円');
    expect(el).toBeDefined();
    expect(el.textContent).toBe('+¥3,000');
  });

  it('renders custom ariaLabel if specified', () => {
    render(<CountUp end={-500} prefix="¥" ariaLabel="カスタム読み上げ" duration={0} />);
    act(() => {
      vi.runAllTimers();
    });
    const el = screen.getByLabelText('カスタム読み上げ');
    expect(el).toBeDefined();
    expect(el.textContent).toBe('−¥500');
  });
});
