/*
 * The cast of the opening film "הַטּוֹב מִמֶּךָּ" (docs/intro-script.md; docs/visual-bible.md is binding).
 * See FilmActor.ts (one character) and performances.ts (shots 5-12). Lazy-import this module (film-only content).
 */
export { FilmActor, type ActorSpec, type CastRole, type ArmPose, type Quality } from './FilmActor';
export { GilgalPerformance, RamahPerformance, FaceDriver, speechJaw, actionTime, POSES, GILGAL_CLIPS, RAMAH_CLIPS, TEAR_BEATS, FACE_FILL, type GilgalCast, type RamahMark } from './performances';
