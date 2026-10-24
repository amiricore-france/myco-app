import { useEffect, useRef, useState } from 'react';

/**
 * Cap de la boussole du téléphone (0 = nord), ou null si indisponible.
 *  - Android / Chrome : événement « deviceorientationabsolute ».
 *  - iPhone : « webkitCompassHeading », après autorisation explicite
 *    (DeviceOrientationEvent.requestPermission, sur un geste de l'utilisateur).
 */
const norm = a => ((a % 360) + 360) % 360;
const screenAngle = () => (window.screen?.orientation?.angle ?? window.orientation ?? 0);

export function useHeading() {
  const iosPermission = typeof window !== 'undefined' &&
    typeof window.DeviceOrientationEvent !== 'undefined' &&
    typeof window.DeviceOrientationEvent.requestPermission === 'function';

  const [enabled, setEnabled] = useState(!iosPermission);
  const [heading, setHeading] = useState(null);
  const smooth = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let absolute = false;

    function update(raw) {
      const h = norm(raw + screenAngle());
      // Lissage (filtre passe-bas qui gère le passage 359° → 0°)
      if (smooth.current == null) smooth.current = h;
      else {
        const diff = ((h - smooth.current + 540) % 360) - 180;
        smooth.current = norm(smooth.current + diff * 0.25);
      }
      setHeading(prev => (prev == null || Math.abs(((smooth.current - prev + 540) % 360) - 180) > 1.5
        ? Math.round(smooth.current) : prev));
    }
    function onAbsolute(e) {
      if (e.alpha == null) return;
      absolute = true;
      update(360 - e.alpha);
    }
    function onRelative(e) {
      if (e.webkitCompassHeading != null) update(e.webkitCompassHeading);
      else if (!absolute && e.absolute && e.alpha != null) update(360 - e.alpha);
    }
    window.addEventListener('deviceorientationabsolute', onAbsolute);
    window.addEventListener('deviceorientation', onRelative);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      window.removeEventListener('deviceorientation', onRelative);
    };
  }, [enabled]);

  async function requestPermission() {
    try {
      const r = await window.DeviceOrientationEvent.requestPermission();
      if (r === 'granted') setEnabled(true);
    } catch { /* refusé */ }
  }

  return { heading, needsPermission: iosPermission && !enabled, requestPermission };
}
