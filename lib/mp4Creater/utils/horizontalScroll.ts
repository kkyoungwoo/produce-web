import React from 'react';

export function handleHorizontalWheel(
  event: React.WheelEvent<HTMLElement>,
  multiplier = 1
) {
  const container = event.currentTarget;
  if (Math.abs(event.deltaY) < 2 && Math.abs(event.deltaX) < 2) return;
  event.preventDefault();
  container.scrollBy({
    left: (event.deltaY + event.deltaX) * multiplier,
    behavior: 'smooth',
  });
}

export function scrollContainerBy(
  container: HTMLElement | null,
  direction: 'left' | 'right',
  distance = 320
) {
  if (!container) return;
  container.scrollBy({
    left: direction === 'left' ? -distance : distance,
    behavior: 'smooth',
  });
}

export function scrollElementIntoView(target: HTMLElement | null) {
  if (!target) return;
  target.scrollIntoView({
    behavior: 'smooth',
    inline: 'center',
    block: 'nearest',
  });
}
