/** Shared, mutable (non-React) state the 3D scene reads every frame. Written by Lenis / pointer listeners. */
export const scrollState = {
  progress: 0, // 0..1 page scroll
  pointerX: 0, // -1..1
  pointerY: 0,
  reducedMotion: false,
};
