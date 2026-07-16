import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { gestureState } from './gestureState';

const MIN_ZOOM = 0.55; // closest (most zoomed in)
const MAX_ZOOM = 1.7; // farthest (most zoomed out)

/**
 * Wheel + pinch zoom for the table. Dollies the camera along its fixed view direction toward the
 * table centre rather than using OrbitControls, so single-pointer throw drags stay untouched. During
 * a two-finger pinch it flags {@link gestureState} so the throw layer skips those touches.
 */
export function CameraZoom() {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);

  useEffect(() => {
    const direction = camera.position.clone().normalize();
    const baseDistance = camera.position.length();
    let zoom = 1;

    const apply = () => {
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
      camera.position.copy(direction).multiplyScalar(baseDistance * zoom);
      camera.lookAt(0, 0, 0);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom *= Math.exp(event.deltaY * 0.0015);
      apply();
    };

    const pinchDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    let pinchStartDistance = 0;
    let pinchStartZoom = 1;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        gestureState.pinching = true;
        pinchStartDistance = pinchDistance(event.touches);
        pinchStartZoom = zoom;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && pinchStartDistance > 0) {
        event.preventDefault();
        const distance = pinchDistance(event.touches);
        if (distance > 0) {
          zoom = pinchStartZoom * (pinchStartDistance / distance);
          apply();
        }
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchStartDistance = 0;
        // Keep the flag set until every finger lifts so the final pointerup can't fire a stray throw.
        if (event.touches.length === 0) gestureState.pinching = false;
      }
    };

    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    domElement.addEventListener('touchend', onTouchEnd);
    domElement.addEventListener('touchcancel', onTouchEnd);
    return () => {
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('touchstart', onTouchStart);
      domElement.removeEventListener('touchmove', onTouchMove);
      domElement.removeEventListener('touchend', onTouchEnd);
      domElement.removeEventListener('touchcancel', onTouchEnd);
      gestureState.pinching = false;
    };
  }, [camera, domElement]);

  return null;
}
