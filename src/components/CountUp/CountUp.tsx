import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  separator?: string;
}

export function CountUp({
  end,
  duration = 1000,
  prefix = '',
  suffix = '',
  className,
  separator = ',',
}: CountUpProps) {
  const [current, setCurrent] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const startTimeRef = useRef<number>(0);
  const previousEndRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setCurrent(end);
      return;
    }

    const startValue = previousEndRef.current;
    previousEndRef.current = end;
    startTimeRef.current = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(startValue + (end - startValue) * eased);
      setCurrent(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [end, duration, prefersReducedMotion]);

  const formatted = Math.abs(current)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  const displayValue = current < 0 ? `−${formatted}` : formatted;

  return (
    <span className={className} aria-label={`${prefix}${displayValue}${suffix}`}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}
