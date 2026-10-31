// (v5, ROADMAP 13.9) The city's people think for themselves. Each has a temper of their own (bold or
// timid, warm or cold, quick to anger, curious, talkative) and remembers what they saw: what you did
// in front of them (a crime, a drawing come alive, a crash), and what happened in the street. The
// city as a whole knows you too - how famous your drawings have made you, how much your crimes have
// it afraid. What they feel shows on their faces (render/people.js faceOf) and in what they say,
// aloud (game/voices.js): a witness of your crime glares, or backs away pale; one who saw you draw
// a car out of thin air is amazed when you come by again; when you are famous, strangers know you;
// when you are feared, they whisper. And what one saw, the next one hears: people standing together
// pass on what happened, and the one who heard it looks at you differently.
//
// Lines: '[mood] ...' - how they feel saying it (game/voices.js say).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
// (a person's temper: the same person, the same temper - from their own number)
const hash = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// what happened, as they tell it: bad (you did harm), wow (your drawing came alive), street (it
// just happened)
const KIND = {
  carjack: 'bad', steal: 'bad', hurtCiv: 'bad', killCiv: 'bad', hurtCop: 'bad', killCop: 'bad', koCop: 'bad', koCiv: 'bad', shoot: 'bad', copcar: 'bad', quietSteal: 'bad',
  drawn: 'wow',
  crash: 'street', hurt: 'street', blast: 'street', fight: 'street',
};
// how hard it hits the ones who saw it (and the city's dread or fame)
const WEIGHT = { carjack: 0.5, steal: 0.35, hurtCiv: 0.6, killCiv: 1, hurtCop: 0.6, killCop: 1, koCop: 0.6, koCiv: 0.5, shoot: 0.45, copcar: 0.5, quietSteal: 0.2, drawn: 0.5 };

const SAW_BAD_BOLD = ['[angry] I saw what you did back there.', '[angry] You! I saw you!', '[angry] People like you ruin this city.', '[angry] The cops are looking for you, you know.'];
const SAW_BAD_TIMID = ['[scared] Please... just leave me alone.', '[scared] I did not see anything. Nothing!', '[scared] Stay away from me!', '[scared] Oh no, not him again...'];
const SAW_WOW = ['[surprised] It is you! The one who draws things alive!', '[joy] That thing you drew - it was amazing!', '[surprised] How do you DO that?', '[joy] Draw me something! Anything!'];
const FAN = ['[joy] No way... you are the artist from the news!', '[surprised] Wait, I know you! You are famous!', '[joy] My kid has your drawing on the fridge!', '[joy] Can I get a picture with you?'];
const FEARED = ['[scared] That is him... do not look.', '[scared] Walk faster, walk faster...', '[scared] Is that the guy from the news?', '[scared] Keep your head down.'];
const LINGER_WARM = ['[joy] Hey there! Lovely day, right?', '[joy] Hi! Can I help you find something?', '[joy] I like your jacket!', '[joy] You look like you need a coffee.'];
const LINGER_COLD = ['[angry] What are you looking at?', '[angry] Do I owe you money?', '[angry] Take a picture, it lasts longer.', '[angry] Personal space, buddy.'];
const LINGER_TIMID = ['[scared] Uh... hi?', '[scared] Sorry, am I in your way?', '[surprised] Oh! You startled me.'];
const LINGER_CURIOUS = ['[surprised] Is that a real pencil? It is huge!', 'Do I know you from somewhere?', '[surprised] Wait... are you the one who draws stuff?', 'Can I help you?'];
// what they tell each other: about you, and about the street - what it was, as it was (a fist fight is
// not told as a blast), and whether it was right here a moment ago or somewhere else a while back
const TOLD = {
  carjack: 'theft', steal: 'theft', quietSteal: 'theft', hurtCiv: 'fight', koCiv: 'fight', fight: 'fight', hurt: 'fight', koCop: 'fight', hurtCop: 'fight',
  killCiv: 'kill', killCop: 'kill', shoot: 'shots', copcar: 'theft', blast: 'blast', crash: 'crash', drawn: 'wow',
};
const TELL_HERE = {
  fight: [['[surprised] Did you see that? He just hit that guy!', '[scared] Come on, let us get out of here.'], ['[angry] Unbelievable. In broad daylight.', '[sad] I hope that poor guy is okay.'], ['[surprised] Whoa, whoa. Did he just punch him?', '[scared] Do not look. Just keep walking.']],
  shots: [['[scared] Those were gunshots. Right here!', '[scared] Keep walking. Do not look back.'], ['[scared] Was that a gun?!', '[scared] I am not staying to find out.']],
  kill: [['[scared] Is he... is that man dead?', '[scared] Oh my god. Somebody call the police!'], ['[scared] I just saw somebody get killed.', '[sad] I am shaking. I am actually shaking.']],
  theft: [['[angry] He just took that car! Just like that!', '[surprised] Did anybody get the plate?'], ['[surprised] Was that his car? I do not think that was his car.', '[angry] Somebody call the cops.']],
  blast: [['[scared] What was that?! Something blew up!', '[scared] Just keep moving!'], ['[scared] My ears are still ringing.', '[scared] Mine too. What was it?']],
  crash: [['[surprised] Did you see that crash?', '[sad] I hope everybody is okay.'], ['[angry] People drive like maniacs here.', '[sad] Every single week.']],
  wow: [['[surprised] Did you see that? The drawing - it came alive!', '[joy] I have to tell everybody!'], ['[surprised] He drew it... and it was real!', '[joy] Best day ever!']],
};
const TELL_THERE = {
  fight: [['[surprised] Did you hear? There was a fight a few blocks from here.', '[sad] This city, I swear.'], ['[sad] Somebody got beaten up earlier. Out of nowhere.', '[scared] I will take the long way home.']],
  shots: [['[scared] There was shooting, a few blocks from here.', '[scared] I am going home early.'], ['[scared] Did you hear the shots before?', '[sad] I thought it was fireworks.']],
  kill: [['[sad] Somebody was killed today, not far from here.', '[scared] In this neighborhood? I do not believe it.']],
  theft: [['[angry] Some lunatic stole a car right in front of people!', '[surprised] In broad daylight?'], ['[angry] Another car stolen around here.', '[sad] I am selling mine.']],
  blast: [['[surprised] Something blew up earlier, did you hear it?', '[scared] What is going on lately?']],
  crash: [['[surprised] There was a bad crash on the boulevard.', '[sad] Again? Somebody will get killed.']],
  wow: [['[surprised] I saw a guy draw a car - and then drive it away!', '[joy] Come on. Really?'], ['[joy] There is an artist whose drawings come alive!', '[surprised] I want to see that!'], ['[surprised] A drawing! It just stood up and walked!', '[joy] No way!']],
};

export class Minds {
  constructor(game) {
    this.game = game;
    // (the city's: how famous your drawings have made you, how much your crimes have it afraid)
    this.fame = 0;
    this.dread = 0;
    // what happened lately, and where
    this.news = [];
    this.t = 0;
    this.saidT = 0;
    this.tellT = 6;
    this.stats = { minds: 0, saw: 0, said: 0, told: 0, fans: 0, feared: 0 };
    // (every crime of yours, every incident in the street: game.js onCrime, game/reactions.js note)
    if (game.classic) return;
    const crime = game.onCrime.bind(game);
    game.onCrime = (kind, x, z) => {
      this.happened(kind, x, z, true);
      return crime(kind, x, z);
    };
    if (game.reactions) {
      const note = game.reactions.note.bind(game.reactions);
      game.reactions.note = (kind, x, z) => {
        this.happened(kind, x, z, false);
        return note(kind, x, z);
      };
    }
  }

  // somebody's mind, made the first time it is asked for
  of(c) {
    let m = c.mind;
    if (!m) {
      const s = (c.fig && c.fig.seed) || Math.random() * 100;
      m = c.mind = {
        bold: hash(s * 1.3),
        warm: hash(s * 2.7 + 1),
        temper: hash(s * 3.1 + 2),
        curious: hash(s * 4.9 + 3),
        chatty: hash(s * 5.3 + 4),
        // (how they feel about you, -1..1; what they saw of yours, and when; how afraid they are now)
        you: 0,
        saw: null,
        sawT: -99,
        fear: 0,
        heard: null,
        nextT: 0,
      };
      this.stats.minds++;
    }
    return m;
  }

  // something happened at x, z (you: you did it): the news, and everybody who saw it
  happened(kind, x, z, you) {
    const game = this.game;
    const what = KIND[kind];
    if (!what) return;
    const now = game.time;
    const w = WEIGHT[kind] || 0.3;
    if (you && what === 'bad') this.dread = Math.min(3, this.dread + w);
    if (you && what === 'wow') this.fame = Math.min(3, this.fame + w);
    // (one piece of news a place at a time)
    const old = this.news.find((n) => Math.abs(n.x - x) + Math.abs(n.z - z) < 20 && now - n.t < 30);
    if (old) {
      old.t = now;
      if (you) old.you = true;
    } else {
      this.news.push({ kind, what, x, z, t: now, you });
      if (this.news.length > 12) this.news.shift();
    }
    const civs = game.civilians;
    if (!civs) return;
    for (const c of civs.list) {
      if (!c.alive || c.inside || c.gone) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d > 32) continue;
      const m = this.of(c);
      m.saw = { kind, what, you };
      m.sawT = now;
      if (you && what === 'bad') {
        m.you = Math.max(-1, m.you - w * (1.2 - d / 40));
        m.fear = Math.min(1, m.fear + w * (1.1 - m.bold * 0.6));
      } else if (you && what === 'wow') m.you = Math.min(1, m.you + w * 0.8);
      this.stats.saw++;
    }
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || !game.civilians || !game.player) return;
    this.t += dt;
    // (the city forgets, slowly)
    this.fame = Math.max(0, this.fame - dt * 0.002);
    this.dread = Math.max(0, this.dread - dt * 0.006);
    if (this.t < 0.25) return;
    const step = this.t;
    this.t = 0;
    const now = game.time;
    const pl = game.player;
    const p = pl.pos;
    const civs = game.civilians.list;
    const onFoot = pl.mode === 'foot' && !pl.inVehicle;
    const w = game.weapons;
    const armed = !!(w && w.current && w.current.def && w.current.def.kind === 'gun');
    const head = pl.fig && pl.fig.j ? pl.fig.j.headC : null;
    let said = now < this.saidT;
    for (const c of civs) {
      if (!c.alive || c.inside || c.gone || c.headless || !c.fig) continue;
      const dx = c.pos.x - p.x;
      const dz = c.pos.z - p.z;
      if (dx > 14 || dx < -14 || dz > 14 || dz < -14) continue;
      const d = Math.hypot(dx, dz);
      const m = this.of(c);
      m.fear = Math.max(0, m.fear - step * 0.03);
      // what they feel about you, on their face while you are near
      const fresh = m.saw && m.saw.you && now - m.sawT < 240;
      let feel = null;
      if (fresh && m.saw.what === 'bad') feel = m.bold > 0.55 && !armed ? 'angry' : 'scared';
      else if (fresh && m.saw.what === 'wow') feel = 'surprised';
      else if (this.dread > 1.2 && d < 9 && (armed || m.bold < 0.5)) feel = 'scared';
      if (feel && d < 10 && !(c.panicT > 0)) {
        c.fig.feel = { mood: feel, until: now + 1 };
        // (and a look at you now and then - not a stare: ROADMAP 13.10)
        if (head && now > (m.glanceT || 0) && !c.convo) {
          m.glanceT = now + 3 + Math.random() * 5;
          c.glanceAt = head;
          c.glanceUntil = now + 0.8 + Math.random() * 0.8;
        }
      }
      // a word to you, now and then: one person at a time, one line every few seconds in all
      if (said || !onFoot || d > 6 || d < 0.6 || now < m.nextT || c.convo || c.panicT > 0 || c.scripted) continue;
      let line = null;
      if (fresh && m.saw.what === 'bad') line = pick(m.bold > 0.55 && !armed ? SAW_BAD_BOLD : SAW_BAD_TIMID);
      else if (fresh && m.saw.what === 'wow') line = pick(SAW_WOW);
      else if (this.fame > 1 && Math.random() < 0.12 * this.fame) {
        line = pick(FAN);
        this.stats.fans++;
      } else if (this.dread > 1.2 && Math.random() < 0.1 * this.dread) {
        line = pick(FEARED);
        this.stats.feared++;
      }
      m.nextT = now + 6 + Math.random() * 6;
      if (!line) continue;
      m.nextT = now + 30 + Math.random() * 30;
      game.voices.sayToYou(c, line);
      said = true;
      this.saidT = now + 2.5;
      this.stats.said++;
    }
    // what they tell each other
    this.tellT -= step;
    if (this.tellT <= 0) {
      this.tellT = 5 + Math.random() * 5;
      this.gossip(p);
    }
  }

  // two people near you standing or walking together: one tells the other what happened lately
  gossip(p) {
    const game = this.game;
    const now = game.time;
    const news = this.news.filter((n) => now - n.t < 300);
    if (!news.length) return;
    const civs = game.civilians.list;
    for (const a of civs) {
      if (!a.alive || a.convo || a.scripted || a.panicT > 0 || a.inside || !a.fig) continue;
      if (Math.abs(a.pos.x - p.x) > 20 || Math.abs(a.pos.z - p.z) > 20) continue;
      const ma = this.of(a);
      if (ma.chatty < 0.35) continue;
      for (const b of civs) {
        if (b === a || !b.alive || b.convo || b.scripted || b.panicT > 0 || b.inside || !b.fig) continue;
        if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 2.6) continue;
        // (what a knows: what they saw, else the latest news - told as it was, here or elsewhere)
        const n = ma.saw && now - ma.sawT < 300 ? ma.saw : news[news.length - 1];
        const what = n.what || 'street';
        const told = TOLD[n.kind] || (what === 'wow' ? 'wow' : 'fight');
        const N = news.find((q) => q.kind === n.kind) || news[news.length - 1];
        const here = N && Math.hypot(N.x - a.pos.x, N.z - a.pos.z) < 45 && now - N.t < 90;
        const sets = (here ? TELL_HERE : TELL_THERE)[told] || TELL_THERE.fight;
        const set = pick(sets);
        if (!game.voices.talk([a, b], set.slice())) return;
        // (and now b knows it - and what to think of you, if it was you)
        const mb = this.of(b);
        mb.heard = n;
        if (n.you && what === 'bad') mb.you = Math.max(-1, mb.you - 0.25);
        if (n.you && what === 'wow') mb.you = Math.min(1, mb.you + 0.25);
        this.stats.told++;
        return;
      }
    }
  }

  // (game/voices.js: someone you stand right by and look at - what they make of it, by their temper
  // and what they think of you)
  lingerLine(c) {
    const m = this.of(c);
    if (m.saw && m.saw.you && this.game.time - m.sawT < 240) return m.saw.what === 'bad' ? pick(m.bold > 0.55 ? SAW_BAD_BOLD : SAW_BAD_TIMID) : pick(SAW_WOW);
    if (m.you < -0.3) return pick(LINGER_COLD);
    if (this.fame > 1 && m.curious > 0.4) return pick(FAN);
    if (m.bold < 0.3) return pick(LINGER_TIMID);
    if (m.temper > 0.7 && m.warm < 0.5) return pick(LINGER_COLD);
    if (m.curious > 0.65) return pick(LINGER_CURIOUS);
    if (m.warm > 0.55) return pick(LINGER_WARM);
    return null;
  }
}
