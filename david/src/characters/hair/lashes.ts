import type { HumanModel } from '../human/HumanModel';
import type { StrandMaterial } from '../human/HairStrands';

/**
 * Make the MakeHuman eyelashes read at portrait distance (they are thin and faint by default): wider ribbons,
 * a higher minimum pixel width and darker roots. Works through the public `StrandMaterial.strandUniforms`;
 * call once after HumanModel.load (createGroom does it unless `opts.lashes === false`). Idempotent.
 */
export function enhanceLashes(human: HumanModel, o: { width?: number; minPx?: number; darken?: number } = {}) {
  const m = human.lashes?.material as StrandMaterial | undefined;
  if (!m || !m.strandUniforms || m.userData.hairEnhanced) return;
  const u = m.strandUniforms;
  u.uWidthScale.value *= o.width ?? 1.8;
  u.uMinPx.value = Math.max(u.uMinPx.value, o.minPx ?? 0.9);
  u.uRootColor.value.multiplyScalar(o.darken ?? 0.7);
  u.uTipColor.value.multiplyScalar(o.darken ?? 0.7);
  // backlight: a glossy lash ribbon lit through the skin normal under its root flared into a bright white line along
  // the lid (skin report, film shots 5 / 7-12) — lashes are matte, dark and never mirror the sky
  m.roughness = Math.max(m.roughness, 0.85);
  m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 0.25);
  m.userData.hairEnhanced = true;
}
