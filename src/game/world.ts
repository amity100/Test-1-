import { RNG } from '../core/rng';
import { clamp, uid } from '../core/util';
import {
  ARCHETYPES, CITY_DISTRICTS, COMPANIES, COUNTRY_ROWS, FIRST_NAMES, LAST_NAMES,
  NODE_NAME_WORDS, REGIONS, ROLES, SECRETS, regionForHex,
} from './content';
import type { District, GameNode, NodeType, Person, Region, Secret } from './types';

export interface World {
  nodes: Record<string, GameNode>;
  districts: Record<string, District>;
  regions: Record<string, Region>;
  people: Record<string, Person>;
}

const roleWeightTable = (() => {
  const t: number[] = [];
  ROLES.forEach((r, i) => { for (let k = 0; k < r.weight; k++) t.push(i); });
  return t;
})();

function personName(rng: RNG, used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const n = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)} ${used.size}`;
}

function makeSecrets(rng: RNG, integrity: number): Secret[] {
  const out: Secret[] = [];
  const count = integrity > 0.8 ? (rng.chance(0.3) ? 1 : 0) : integrity > 0.55 ? rng.int(0, 2) : rng.int(1, 2);
  const pool = rng.sample(SECRETS, count);
  for (const tpl of pool) {
    out.push({
      id: uid('sec'),
      kind: tpl.kind,
      text: tpl.text,
      leverage: rng.range(tpl.leverage[0], tpl.leverage[1]) * (1.15 - integrity * 0.3),
      known: false,
    });
  }
  return out;
}

function makePerson(rng: RNG, districtId: string, org: string, used: Set<string>): Person {
  const role = ROLES[rng.pick(roleWeightTable)];
  const integrity = rng.range(role.integrity[0], role.integrity[1]);
  return {
    id: uid('per'),
    name: personName(rng, used),
    role: role.title,
    org,
    districtId,
    accessNodes: [],
    awareness: rng.range(role.awareness[0], role.awareness[1]),
    stress: rng.range(0.05, 0.35),
    loyalty: rng.range(role.loyalty[0], role.loyalty[1]),
    integrity,
    secrets: makeSecrets(rng, integrity),
    intel: 0,
    status: 'clean',
    seed: rng.int(0, 1e6),
  };
}

function nodeName(rng: RNG, type: NodeType, ctxName: string): string {
  const arch = ARCHETYPES[type];
  const tpl = rng.pick(arch.names);
  return tpl
    .replace('{name}', ctxName || rng.pick(NODE_NAME_WORDS))
    .replace('{n}', String(rng.int(1, 48)).padStart(2, '0'));
}

/** Rejection-sampled placement so towers never overlap. */
function scatter(rng: RNG, count: number, radius: number, minDist: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  let guard = 0;
  while (pts.length < count && guard < count * 200) {
    guard++;
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * radius;
    const p: [number, number] = [Math.cos(a) * r, Math.sin(a) * r];
    if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > minDist)) pts.push(p);
  }
  while (pts.length < count) {
    const a = (pts.length / count) * Math.PI * 2;
    pts.push([Math.cos(a) * radius * 0.9, Math.sin(a) * radius * 0.9]);
  }
  return pts;
}

function buildDistrict(
  rng: RNG,
  world: World,
  opts: {
    id: string; name: string; regionId: string; cx: number; cz: number; radius: number;
    tier: number; nodeCount: number; bias: NodeType[]; flavor: string; unlocked: boolean;
    securityBonus: number;
  },
): District {
  const district: District = {
    id: opts.id, name: opts.name, regionId: opts.regionId,
    cx: opts.cx, cz: opts.cz, radius: opts.radius,
    flavor: opts.flavor, nodeIds: [], suspicion: 0,
    blackoutUntil: 0, gridlockUntil: 0, jammedUntil: 0,
    unrest: 0, unlocked: opts.unlocked, tier: opts.tier,
  };

  const orgs = rng.sample(COMPANIES, 3);
  const usedNames = new Set<string>();
  const peopleCount = Math.max(4, Math.round(opts.nodeCount * 0.8));
  const people: Person[] = [];
  for (let i = 0; i < peopleCount; i++) {
    const p = makePerson(rng, district.id, rng.pick(orgs), usedNames);
    people.push(p);
    world.people[p.id] = p;
  }

  const spots = scatter(rng, opts.nodeCount, opts.radius, opts.radius / (2.2 + opts.nodeCount * 0.05));
  const typePool: NodeType[] = [];
  for (const t of opts.bias) {
    const w = Math.max(1, ARCHETYPES[t].weight);
    for (let i = 0; i < w; i++) typePool.push(t);
  }

  for (let i = 0; i < opts.nodeCount; i++) {
    const type = rng.pick(typePool);
    const arch = ARCHETYPES[type];
    const [ox, oz] = spots[i];
    const security = clamp(
      Math.round(rng.range(arch.security[0], arch.security[1]) + opts.securityBonus),
      1, 10,
    );
    const scale = 1 + (security - 3) * 0.14 + opts.tier * 0.08;
    const yields: GameNode['yields'] = {};
    for (const [k, v] of Object.entries(arch.yields)) {
      yields[k as keyof GameNode['yields']] = Math.round(v * scale * 10) / 10;
    }
    const linkedPerson = type === 'phone' ? rng.pick(people) : undefined;
    const ctx = linkedPerson ? linkedPerson.name : rng.chance(0.4) ? rng.pick(orgs) : rng.pick(NODE_NAME_WORDS);

    const node: GameNode = {
      id: uid('nd'),
      name: nodeName(rng, type, ctx),
      type,
      desc: arch.desc,
      districtId: district.id,
      regionId: opts.regionId,
      x: opts.cx + ox,
      z: opts.cz + oz,
      height: rng.range(arch.height[0], arch.height[1]) * (1 + opts.tier * 0.06),
      footprint: rng.range(arch.footprint[0], arch.footprint[1]),
      tier: clamp(opts.tier, 1, 4) as 1 | 2 | 3 | 4,
      security,
      hardened: 0,
      noise: arch.noise,
      yields,
      tags: arch.tags.slice(),
      peopleIds: [],
      linkIds: [],
      discovered: false,
      owned: false,
      ownedAt: 0,
      detection: 0,
      surveilled: false,
      quarantined: false,
      disruptedUntil: 0,
      scouted: false,
    };
    if (linkedPerson) {
      node.peopleIds.push(linkedPerson.id);
      linkedPerson.accessNodes.push(node.id);
      linkedPerson.device = node.id;
    }
    world.nodes[node.id] = node;
    district.nodeIds.push(node.id);
  }

  // Staff assignment: each person can reach 1–3 nodes matching their role.
  for (const p of people) {
    const role = ROLES.find((r) => r.title === p.role)!;
    const candidates = district.nodeIds
      .map((id) => world.nodes[id])
      .filter((n) => role.nodeTypes.includes(n.type) && n.type !== 'phone');
    const picked = rng.sample(candidates.length ? candidates : district.nodeIds.map((id) => world.nodes[id]), rng.int(1, 3));
    for (const n of picked) {
      if (!n.peopleIds.includes(p.id)) n.peopleIds.push(p.id);
      if (!p.accessNodes.includes(n.id)) p.accessNodes.push(n.id);
    }
  }

  // Local topology: link each node to its two nearest neighbours.
  const list = district.nodeIds.map((id) => world.nodes[id]);
  for (const n of list) {
    const near = list
      .filter((o) => o !== n)
      .sort((a, b) => Math.hypot(a.x - n.x, a.z - n.z) - Math.hypot(b.x - n.x, b.z - n.z))
      .slice(0, 2);
    for (const o of near) {
      if (!n.linkIds.includes(o.id)) n.linkIds.push(o.id);
      if (!o.linkIds.includes(n.id)) o.linkIds.push(n.id);
    }
  }

  world.districts[district.id] = district;
  return district;
}

export function generateWorld(seedStr: string): World {
  const rng = new RNG(seedStr);
  const world: World = { nodes: {}, districts: {}, regions: {}, people: {} };

  // ── Regions & hex silhouette ───────────────────────────────────────────────
  for (const seed of REGIONS) {
    world.regions[seed.id] = {
      id: seed.id, name: seed.name, short: seed.short, hexes: [],
      districtIds: [], control: 0, claimed: false,
      unlockChapter: seed.unlockChapter, desc: seed.desc,
    };
  }
  COUNTRY_ROWS.forEach((range, r) => {
    for (let q = range[0]; q <= range[1]; q++) {
      const rid = regionForHex(q, r);
      world.regions[rid]?.hexes.push([q, r]);
    }
  });

  // ── Tel Aviv metro: handcrafted layout ────────────────────────────────────
  for (const d of CITY_DISTRICTS) {
    const district = buildDistrict(rng, world, {
      id: d.id, name: d.name, regionId: 'tlv', cx: d.cx, cz: d.cz, radius: d.radius,
      tier: d.tier, nodeCount: d.nodeCount, bias: d.bias, flavor: d.flavor,
      unlocked: d.tier === 1, securityBonus: (d.tier - 1) * 0.9,
    });
    world.regions.tlv.districtIds.push(district.id);
  }

  // ── Remaining regions: districts laid out in local region space ───────────
  for (const seed of REGIONS) {
    if (seed.id === 'tlv') continue;
    const n = seed.districts.length;
    seed.districts.forEach((d, i) => {
      const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      const spread = n > 1 ? 620 : 0;
      const district = buildDistrict(rng, world, {
        id: `${seed.id}_${i}`,
        name: d.name,
        regionId: seed.id,
        cx: Math.cos(angle) * spread,
        cz: Math.sin(angle) * spread,
        radius: 200,
        tier: Math.min(4, 1 + Math.floor(seed.unlockChapter / 2)),
        nodeCount: d.nodeCount,
        bias: d.bias,
        flavor: d.flavor,
        unlocked: false,
        securityBonus: seed.unlockChapter * 0.55,
      });
      world.regions[seed.id].districtIds.push(district.id);
    });
  }

  // ── Long-haul links between district hubs (lateral movement across the map)
  const hubs = Object.values(world.districts).map((d) => {
    const ids = d.nodeIds.map((id) => world.nodes[id]);
    const hub = ids.find((n) => n.type === 'router' || n.type === 'telecom') ?? ids[0];
    return hub;
  });
  for (let i = 0; i < hubs.length; i++) {
    for (let j = i + 1; j < hubs.length; j++) {
      const a = hubs[i], b = hubs[j];
      if (a.regionId !== b.regionId) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) > 900) continue;
      if (!a.linkIds.includes(b.id)) a.linkIds.push(b.id);
      if (!b.linkIds.includes(a.id)) b.linkIds.push(a.id);
    }
  }

  return world;
}
