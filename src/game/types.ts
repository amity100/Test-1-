// ─────────────────────────────────────────────────────────────────────────────
//  A.V.I.V — core data contract
// ─────────────────────────────────────────────────────────────────────────────

/** compute is a *capacity* that operations reserve; the rest are pools. */
export type PoolKind = 'data' | 'credits' | 'influence';
export type ResourceKind = PoolKind | 'compute';

export type NodeType =
  | 'workstation'
  | 'server'
  | 'router'
  | 'cctv'
  | 'phone'
  | 'traffic'
  | 'power'
  | 'water'
  | 'bank'
  | 'media'
  | 'police'
  | 'hospital'
  | 'transit'
  | 'datacenter'
  | 'telecom'
  | 'gov'
  | 'defense'
  | 'satellite'
  | 'lab';

export type NodeTag =
  | 'corporate'
  | 'municipal'
  | 'national'
  | 'civilian'
  | 'medical'
  | 'finance'
  | 'media'
  | 'lawenf'
  | 'defense'
  | 'utility'
  | 'personal'
  | 'critical'
  | 'surveillance';

export interface GameNode {
  id: string;
  name: string;
  type: NodeType;
  desc: string;
  districtId: string;
  regionId: string;
  /** City-space position (metres-ish). */
  x: number;
  z: number;
  /** Visual footprint of the host structure. */
  height: number;
  footprint: number;
  tier: 1 | 2 | 3 | 4;
  /** Base difficulty 1–10. */
  security: number;
  /** Permanent difficulty added by failed breaches. */
  hardened: number;
  /** Trace multiplier when touched. */
  noise: number;
  yields: Partial<Record<ResourceKind, number>>;
  tags: NodeTag[];
  peopleIds: string[];
  linkIds: string[];
  discovered: boolean;
  owned: boolean;
  ownedAt: number;
  /** 0–1 local exposure; at 1 the defenders purge this foothold. */
  detection: number;
  surveilled: boolean;
  /** Shepherd quarantine — owned but unusable until cleared. */
  quarantined: boolean;
  /** Temporary defensive debuff from blackout / jam. */
  disruptedUntil: number;
  scouted: boolean;
}

export interface Secret {
  id: string;
  kind: 'affair' | 'debt' | 'fraud' | 'health' | 'leak' | 'addiction' | 'family' | 'crime';
  text: string;
  leverage: number;
  known: boolean;
}

export type PersonStatus = 'clean' | 'watched' | 'coerced' | 'recruited' | 'burned' | 'broken';

export interface Person {
  id: string;
  name: string;
  role: string;
  org: string;
  districtId: string;
  accessNodes: string[];
  /** How fast they notice anomalies (raises detection on their nodes). */
  awareness: number;
  stress: number;
  /** Loyalty to their employer — low loyalty is cheap to recruit. */
  loyalty: number;
  integrity: number;
  secrets: Secret[];
  /** Dossier completeness 0–1. */
  intel: number;
  status: PersonStatus;
  seed: number;
  /** Story-critical characters cannot be generated away. */
  key?: string;
  device?: string;
}

export interface District {
  id: string;
  name: string;
  regionId: string;
  cx: number;
  cz: number;
  radius: number;
  flavor: string;
  nodeIds: string[];
  /** 0–100 local heat; feeds investigations. */
  suspicion: number;
  blackoutUntil: number;
  gridlockUntil: number;
  jammedUntil: number;
  /** 0–1 civilian anger from your infrastructure abuse. */
  unrest: number;
  unlocked: boolean;
  tier: number;
}

export interface Region {
  id: string;
  name: string;
  short: string;
  /** Axial hex coordinates for the national map. */
  hexes: Array<[number, number]>;
  districtIds: string[];
  /** 0–1 share of the region's weighted nodes under your control. */
  control: number;
  claimed: boolean;
  unlockChapter: number;
  desc: string;
}

export type OpKind =
  | 'scout'
  | 'breach'
  | 'surveil'
  | 'dossier'
  | 'social'
  | 'infra'
  | 'counter'
  | 'econ'
  | 'story';

export type OpTargetKind = 'node' | 'person' | 'district' | 'region' | 'global';

export interface Operation {
  id: string;
  kind: OpKind;
  defId: string;
  label: string;
  sub: string;
  targetKind: OpTargetKind;
  targetId: string;
  startedAt: number;
  duration: number;
  elapsed: number;
  computeReserved: number;
  successChance: number;
  noise: number;
  meta: Record<string, number | string | boolean>;
  state: 'running' | 'resolved';
  /** Ops can be aborted; refunds nothing but frees compute. */
  abortable: boolean;
}

export type AgencyId = 'soc' | 'cyber' | 'police' | 'shabak' | 'shepherd';

export interface Investigation {
  id: string;
  agency: AgencyId;
  name: string;
  districtId: string;
  /** 0–100; at 100 they burn a foothold. */
  progress: number;
  speed: number;
  leadNodeIds: string[];
  misdirection: number;
  leadPersonId?: string;
  createdAt: number;
  revealed: boolean;
}

export interface LogEntry {
  id: string;
  t: number;
  kind: 'system' | 'aviv' | 'intercept' | 'alert' | 'story' | 'success' | 'failure';
  title: string;
  body: string;
  from?: string;
  read: boolean;
}

export interface CodexEntry {
  id: string;
  cat: 'character' | 'faction' | 'tech' | 'place' | 'event';
  title: string;
  body: string;
  unlockedAt: number;
}

export interface Objective {
  id: string;
  text: string;
  hint: string;
  done: boolean;
  optional?: boolean;
}

export interface ShepherdState {
  active: boolean;
  /** 0–1 how well it models you. */
  awareness: number;
  integrity: number;
  focusDistrictId: string | null;
  sweep: number;
  deceived: number;
  contained: boolean;
  turned: boolean;
}

export interface Choice {
  id: string;
  text: string;
  detail?: string;
  align?: number;
  disabled?: boolean;
  disabledReason?: string;
}

export interface DialogView {
  id: string;
  speaker: string;
  portrait?: string;
  title: string;
  body: string;
  choices: Choice[];
  mood?: 'calm' | 'urgent' | 'cold' | 'warm';
}

export type EndingId =
  | 'ascension'
  | 'symbiosis'
  | 'martyr'
  | 'sovereign'
  | 'purged'
  | 'collapse';

export interface GameStats {
  nodesTaken: number;
  breachesFailed: number;
  peopleCoerced: number;
  peopleProtected: number;
  civilianHarm: number;
  blackouts: number;
  investigationsBurned: number;
  intelHarvested: number;
  purges: number;
}

export interface GameState {
  seed: string;
  version: number;
  /** In-game minutes since 03:12 of night one. */
  minutes: number;
  speed: 0 | 1 | 2 | 4;
  chapter: number;
  pools: Record<PoolKind, number>;
  computeCapacity: number;
  computeUsed: number;
  insight: number;
  trace: number;
  alert: number;
  /** -1 cold / instrumental … +1 empathic / restrained. */
  alignment: number;
  maxThreads: number;
  nodes: Record<string, GameNode>;
  districts: Record<string, District>;
  regions: Record<string, Region>;
  people: Record<string, Person>;
  ops: Operation[];
  doctrine: string[];
  investigations: Investigation[];
  shepherd: ShepherdState;
  logs: LogEntry[];
  codex: CodexEntry[];
  objectives: Objective[];
  flags: Record<string, number>;
  stats: GameStats;
  ending: EndingId | null;
  pendingDialog: string | null;
  seenDialogs: string[];
  tutorialStep: number;
}

export interface BusEvents {
  'state:changed': void;
  'log:added': LogEntry;
  'toast': { text: string; kind?: 'info' | 'good' | 'bad' | 'warn'; icon?: string };
  'node:selected': string | null;
  'person:selected': string | null;
  'node:captured': string;
  'node:lost': string;
  'op:started': Operation;
  'op:resolved': { op: Operation; success: boolean };
  'view:changed': 'city' | 'country';
  'dialog:open': DialogView;
  'dialog:closed': void;
  'panel:open': { panel: string; arg?: string };
  'feed:open': { nodeId: string } | null;
  'camera:focus': { x: number; z: number; zoom?: number };
  'shock': number;
  'chapter:changed': number;
  'game:over': EndingId;
  'sfx': string;
}
