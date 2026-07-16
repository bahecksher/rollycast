/**
 * Cross-component gesture flag. Set while a two-finger pinch-zoom is in progress so the throw layer
 * ignores the touch pointers instead of launching a stray roll. A plain module singleton keeps this
 * off the React render path (it is read/written every frame during a pinch).
 */
export const gestureState = {
  pinching: false,
};
