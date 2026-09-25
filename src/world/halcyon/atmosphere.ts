import type { SkyStyle } from '../../render/fx';
import type { TowerAtmosphere } from '../tower';

/**
 * Halcyon's golden hour under a blue sky: deep zenith, a cool clear horizon
 * that warms toward the sun, bright cumulus and towering heaps on the horizon.
 * Linear RGB. The env map is baked from it too, so glass, brass and water
 * reflect blue.
 */
export const HALCYON_SKY: SkyStyle = {
  zenith: [0.045, 0.15, 0.46],
  upper: [0.19, 0.38, 0.76],
  horizonAway: [0.5, 0.63, 0.8],
  horizonSun: [1.0, 0.86, 0.62],
  glow: [0.5, 0.3, 0.14],
  cloudLit: [[1.15, 1.12, 1.05], [1.5, 1.18, 0.8]],
  cloudShade: [[0.46, 0.55, 0.72], [0.7, 0.6, 0.58]],
  cover: [0.52, 0.7],
  top: 0.8,
  // (the concept's towering golden-rimmed heaps behind the towers)
  heaps: 1.4,
  haze: [0.56, 0.64, 0.73],
  puff: 1,
  // (a softer halo: looking toward the low sun keeps its blue and its clouds)
  halo: 0.45,
};

export function halcyonAtmosphere(mobile: boolean): TowerAtmosphere {
  return {
    // (a low golden sun, cream-gold on the stone rather than mustard, and a cool blue fill: the concept's warm light, blue shade)
    sunColor: 0xffc98e,
    sunIntensity: 4.6,
    hemiSky: 0x98b0da,
    hemiGround: 0x9c8264,
    hemiIntensity: 0.6,
    fogColor: 0xbfcbd6,
    fogDensity: 0.0012,
    exposure: 0.9,
    environmentIntensity: 0.45,
    sky: HALCYON_SKY,
    skyline: 'deco',
    // (bloom only above the lit clouds' brightness: lower, they veil the whole view looking toward the sun)
    // (a gentler rift pass flash: in this pale palette the full one smeared the frame just as a door put you before men)
    // (and the sun's glitter on the river and on brass feeds the bloom no more than a lantern does: no veil over a phone's wide view)
    // (phones: their wide view takes in the low sun and the paving's sheen toward it, and the half-res bloom spreads that
    // over the frame: a higher threshold keeps it to lanterns, orbs and rifts)
    look: { bloom: mobile ? [0.4, 0.35, 2.4] : [0.45, 0.5, 1.7], saturation: 1.06, flash: [0.005, 0.2], bloomClamp: mobile ? 3 : 6 },
    // lanterns read in daylight, as in the concept (no light cones on phones: a whole additive pass saved)
    lampLook: { glow: 0.55, cones: mobile ? 0 : 0.25, power: 0.6 },
    // (the shadow box reaches ahead along the view: the square is lit and shaded while you look at it from above;
    // phones get the same box)
    shadow: { extent: 50, ahead: 18 },
    // (the route walks into the low sun: without a rim every man is a black cut-out)
    rim: 1,
  };
}
