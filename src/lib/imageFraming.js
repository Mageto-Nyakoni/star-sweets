function percentage(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : 50;
}

export function imagePosition(focalPoint) {
  return `${percentage(focalPoint?.x)}% ${percentage(focalPoint?.y)}%`;
}

export function hotspotPosition(hotspot) {
  return imagePosition({
    x: typeof hotspot?.x === 'number' ? hotspot.x * 100 : undefined,
    y: typeof hotspot?.y === 'number' ? hotspot.y * 100 : undefined,
  });
}
