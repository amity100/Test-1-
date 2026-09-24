/**
 * Strings for THRESHOLD: The Tower (EN + HE).
 *
 * - `t(key, vars)` accepts any key. Lookup order: current language device
 *   variant (`key.touch` / `key.pad` / `key.kbm`), current language base key,
 *   then the same in English, then the key itself.
 * - `addStrings(lang, dict)` merges more strings (META merges trick and
 *   challenge names through it).
 * - `setDevice(d)` picks device variants for hints (Input calls it when the
 *   last used device changes).
 * - Hebrew switches the document to RTL. HUD numbers stay LTR (the HUD pins
 *   its own direction).
 */

export type Lang = 'en' | 'he';
export type Device = 'kbm' | 'pad' | 'touch';
/** Kept for older call sites: any string is a key. */
export type StrKey = string;

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

const EN: Record<string, string> = {
  // brand
  title: 'THRESHOLD',
  subtitle: 'RIFT ACTION',
  tagline: 'No gun. One rift. The world does the killing.',
  loading: 'Loading',
  'boot.webgl': 'WebGL is not available on this device or browser.',

  // menu
  'menu.play': 'PLAY',
  'menu.continue': 'CONTINUE',
  'menu.zones': 'ZONES',
  'menu.challenges': 'CHALLENGES',
  'menu.controls': 'CONTROLS',
  'menu.settings': 'SETTINGS',
  'menu.language': 'LANGUAGE',
  'menu.quit': 'MAIN MENU',
  'menu.resume': 'RESUME',
  'menu.restart': 'RESTART',
  'menu.retry': 'RETRY FROM CHECKPOINT',
  'menu.back': 'BACK',
  'menu.paused': 'PAUSED',
  'menu.playAgain': 'PLAY AGAIN',
  'menu.zoneSelect': 'SELECT ZONE',
  'menu.locked': 'LOCKED',
  'menu.daily': 'DAILY',
  'menu.done': 'DONE',
  'menu.noChallenges': 'No challenges yet. Go make some noise.',
  'menu.challengesDone': '{n}/{m} complete',
  'menu.rules': 'THE THREE RULES',

  // briefing
  'briefing.tag': 'MISSION BRIEFING',
  'briefing.title': 'KESSLER THRESHOLD TOWER',
  'briefing.text':
    'Kessler Industries invented the rift gate, and now they are building an empire on it: a 100-metre tower rising over the harbour. You stole their prototype Rift Gauntlet. No gun, no armour, just one rift pair and whatever Kessler throws at you. Climb from the pier to the roof and take down Director Voss.',

  // settings
  'set.quality': 'Graphics quality',
  'set.low': 'Low',
  'set.medium': 'Medium',
  'set.high': 'High',
  'set.ultra': 'Ultra',
  'set.sensitivity': 'Look sensitivity',
  'set.invertY': 'Invert Y',
  'set.slowmo': 'Slow-mo while aiming',
  'set.on': 'On',
  'set.off': 'Off',
  'set.language': 'Language',

  // end screens
  'end.victory': 'TOWER TAKEN',
  'end.victorySub': 'Voss is down. The rift is yours.',
  'end.defeat': 'YOU FELL',
  'end.defeatSub': 'The tower is still standing.',
  'end.rank': 'RANK',
  'end.time': 'Time',
  'end.kills': 'Kills',
  'end.bestCombo': 'Best combo',
  'end.styleTotal': 'Style total',
  'end.tricks': 'Tricks discovered',
  'end.challenges': 'Challenges',
  'end.deaths': 'Deaths',

  // zones
  'zone.pier.name': 'THE PIER',
  'zone.pier.sub': 'Sea level. Kessler owns the docks.',
  'zone.yard.name': 'THE YARD',
  'zone.yard.sub': 'Cranes, cargo, and a brute with a grudge.',
  'zone.skeleton.name': 'THE SKELETON',
  'zone.skeleton.sub': 'Bare steel. Forty metres of nothing below.',
  'zone.lab.name': 'THE LAB',
  'zone.lab.sub': 'Where Kessler builds his gates.',
  'zone.crown.name': 'THE CROWN',
  'zone.crown.sub': 'The roof. Voss is waiting.',

  // the three rules
  'rule.1': 'Everything keeps its speed through a rift.',
  'rule.2': 'The rift is your only weapon: whatever passes through can hurt anyone.',
  'rule.3': 'You control both ends. Close a rift on something and it gets cut.',

  // lesson hints (device variants where controls are named)
  'hint.door':
    "Rifts are doors. Look across the channel and hold <kbd>LMB</kbd>: time slows and a ghost shows where you’ll come out. Let go: the orange <b>ENTRANCE</b> opens in front of you, the blue <b>EXIT</b> over there. Walk through. (A quick click puts the exit where you look.)",
  'hint.door.pad':
    "Rifts are doors. Look across the channel and hold <kbd>RT</kbd>: time slows and a ghost shows where you’ll come out. Let go: the orange <b>ENTRANCE</b> opens in front of you, the blue <b>EXIT</b> over there. Walk through. (A quick press puts the exit where you look.)",
  'hint.door.touch':
    "Rifts are doors. Hold <b>PORTAL</b> and drag to look across the channel: time slows and a ghost shows where you’ll come out. Lift your finger: the orange <b>ENTRANCE</b> opens in front of you, the blue <b>EXIT</b> over there. Walk through.",
  'hint.trapdoor':
    "Two guards on the edge, the sea behind them. Crosshair on a guard and click <kbd>LMB</kbd>: he sinks into the floor and comes out over the water. Hold it instead to aim where he flies. (A man already fighting you costs one ⚡.)",
  'hint.trapdoor.pad':
    "Two guards on the edge, the sea behind them. Crosshair on a guard and press <kbd>RT</kbd>: he sinks into the floor and comes out over the water. Hold it instead to aim where he flies. (A man already fighting you costs one ⚡.)",
  'hint.trapdoor.touch':
    "Two guards on the edge, the sea behind them. Look at a guard and tap <b>PORTAL</b>: he sinks into the floor and comes out over the water. Hold and drag to aim where he flies. (A man already fighting you costs one ⚡.)",
  'hint.returnToSender':
    "His gun can’t hurt Kessler, until the bullets pass through your rift. When his red laser locks on you, click <kbd>LMB</kbd>: a CATCH door takes the burst and sends it back into him. Hold it to send it somewhere else.",
  'hint.returnToSender.pad':
    "His gun can’t hurt Kessler, until the bullets pass through your rift. When his red laser locks on you, press <kbd>RT</kbd>: a CATCH door takes the burst and sends it back into him. Hold it to send it somewhere else.",
  'hint.returnToSender.touch':
    "His gun can’t hurt Kessler, until the bullets pass through your rift. When his red laser locks on you, tap <b>PORTAL</b>: a CATCH door takes the burst and sends it back into him. Hold and drag to send it somewhere else.",
  'hint.slingshot':
    "Jump off the stack and hold <kbd>LMB</kbd> as you fall: an entrance opens below you. Look at a wall that faces the group and let go: you come out of it at full speed.",
  'hint.slingshot.pad':
    "Jump off the stack and hold <kbd>RT</kbd> as you fall: an entrance opens below you. Look at a wall that faces the group and let go: you come out of it at full speed.",
  'hint.slingshot.touch':
    "Jump off the stack and hold <b>PORTAL</b> as you fall: an entrance opens below you. Drag to a wall that faces the group and lift your finger: you come out of it at full speed.",
  'hint.arena': "Four riflemen and a warden. Every bullet they fire is yours to borrow. Keep moving, keep the chain alive.",
  'hint.loop':
    "The shaft runs through every floor. Look down at its bottom and hold <kbd>LMB</kbd>: a hole opens there. Aim the exit right above it (a quick click does that for you) and jump in: faster every lap. Hold <kbd>LMB</kbd> again as you fall to fire yourself out.",
  'hint.loop.pad':
    "The shaft runs through every floor. Look down at its bottom and hold <kbd>RT</kbd>: a hole opens there. Aim the exit right above it (a quick press does that for you) and jump in: faster every lap. Hold <kbd>RT</kbd> again as you fall to fire yourself out.",
  'hint.loop.touch':
    "The shaft runs through every floor. Look down at its bottom and hold <b>PORTAL</b>: a hole opens there. Aim the exit right above it (a quick tap does that for you) and jump in: faster every lap. Hold <b>PORTAL</b> again as you fall to fire yourself out.",
  'hint.cargo':
    "Loads hang from the crane over the guards. Crosshair on a load and click <kbd>LMB</kbd>: it drops through a hole and lands on the nearest head. Hold it to aim it yourself.",
  'hint.cargo.pad':
    "Loads hang from the crane over the guards. Crosshair on a load and press <kbd>RT</kbd>: it drops through a hole and lands on the nearest head. Hold it to aim it yourself.",
  'hint.cargo.touch':
    "Loads hang from the crane over the guards. Look at a load and tap <b>PORTAL</b>: it drops through a hole and lands on the nearest head. Hold and drag to aim it yourself.",
  'hint.matador':
    "The brute charges in a straight line. When he roars, click <kbd>LMB</kbd>: a door opens in his path and throws him over the edge. Olé.",
  'hint.matador.pad':
    "The brute charges in a straight line. When he roars, press <kbd>RT</kbd>: a door opens in his path and throws him over the edge. Olé.",
  'hint.matador.touch':
    "The brute charges in a straight line. When he roars, tap <b>PORTAL</b>: a door opens in his path and throws him over the edge. Olé.",
  'hint.grenade':
    "Watch the arc: the ring shows where it lands. When a grenade comes close, click <kbd>LMB</kbd>: a CATCH door swallows it and sends it back to the thrower.",
  'hint.grenade.pad':
    "Watch the arc: the ring shows where it lands. When a grenade comes close, press <kbd>RT</kbd>: a CATCH door swallows it and sends it back to the thrower.",
  'hint.grenade.touch':
    "Watch the arc: the ring shows where it lands. When a grenade comes close, tap <b>PORTAL</b>: a CATCH door swallows it and sends it back to the thrower.",
  'hint.shield':
    "His shield blocks everything from the front. <kbd>V</kbd> SHOVE knocks him off balance: then <kbd>LMB</kbd> on him is a free grab (while he stands firm it costs a ⚡).",
  'hint.shield.pad':
    "His shield blocks everything from the front. <kbd>RB</kbd> SHOVE knocks him off balance: then <kbd>RT</kbd> on him is a free grab (while he stands firm it costs a ⚡).",
  'hint.shield.touch':
    "His shield blocks everything from the front. <b>SHOVE</b> knocks him off balance: then <b>PORTAL</b> on him is a free grab (while he stands firm it costs a ⚡).",
  'hint.firingLine':
    "The sniper’s beam charges for a second. As it locks on you, click <kbd>LMB</kbd>: the CATCH door sends the beam back down his own line.",
  'hint.firingLine.pad':
    "The sniper’s beam charges for a second. As it locks on you, press <kbd>RT</kbd>: the CATCH door sends the beam back down his own line.",
  'hint.firingLine.touch':
    "The sniper’s beam charges for a second. As it locks on you, tap <b>PORTAL</b>: the CATCH door sends the beam back down his own line.",
  'hint.hijack':
    "Kessler gates bring reinforcements. Press <kbd>F</kbd> at the panel, or crosshair on the gate and <kbd>LMB</kbd>: everything that comes through now leaves from YOUR exit. Over the void, ideally.",
  'hint.hijack.pad':
    "Kessler gates bring reinforcements. Press <kbd>X</kbd> at the panel, or crosshair on the gate and <kbd>RT</kbd>: everything that comes through now leaves from YOUR exit. Over the void, ideally.",
  'hint.hijack.touch':
    "Kessler gates bring reinforcements. Tap <b>ACTION</b> at the panel, or look at the gate and tap <b>PORTAL</b>: everything that comes through now leaves from YOUR exit. Over the void, ideally.",
  'hint.jammer': "No rift opens inside the jammer’s bubble. Open yours outside it and send things in: grenades, bodies, cargo.",
  'hint.borrowedGun':
    "The turret never stops shooting. When it locks on you, hold <kbd>LMB</kbd>: the CATCH takes the stream and its other end goes wherever you look. Look at its friends. Borrowed gun.",
  'hint.borrowedGun.pad':
    "The turret never stops shooting. When it locks on you, hold <kbd>RT</kbd>: the CATCH takes the stream and its other end goes wherever you look. Look at its friends. Borrowed gun.",
  'hint.borrowedGun.touch':
    "The turret never stops shooting. When it locks on you, hold <b>PORTAL</b>: the CATCH takes the stream and its other end goes wherever you drag your view. Look at its friends. Borrowed gun.",
  'hint.boss':
    "Voss catches straight shots with his own rift. Hit him from behind or from above; stunned, he can be grabbed. Caught halfway through your rift? <kbd>X</kbd> closes it on him.",
  'hint.boss.pad':
    "Voss catches straight shots with his own rift. Hit him from behind or from above; stunned, he can be grabbed. Caught halfway through your rift? <kbd>LB</kbd> closes it on him.",
  'hint.boss.touch':
    "Voss catches straight shots with his own rift. Hit him from behind or from above; stunned, he can be grabbed. Caught halfway through your rift? <b>✕</b> closes it on him.",
  'hint.leap': "Run and jump off the roof. As you fall, <kbd>LMB</kbd> opens an entrance below you. Trust the rift.",
  'hint.leap.pad': "Run and jump off the roof. As you fall, <kbd>RT</kbd> opens an entrance below you. Trust the rift.",
  'hint.leap.touch': "Run and jump off the roof. As you fall, tap <b>PORTAL</b> to open an entrance below you. Trust the rift.",
  'hint.strikes':
    "<b>STRIKES</b> cost rift charge ⚡ (kills with your own portal tricks refill it). Aim near an enemy: <kbd>RMB</kbd> <b>REFLECT</b> his own gun fires into him · <kbd>Q</kbd> <b>LOOP</b> he falls forever (<kbd>Q</kbd> again: geyser, hold: human cannon) · <kbd>E</kbd> <b>SWAP</b> places · <kbd>R</kbd> <b>DASH</b> into him.",
  'hint.strikes.pad':
    "<b>STRIKES</b> cost rift charge ⚡ (kills with your own portal tricks refill it). Aim near an enemy: <kbd>LT</kbd> <b>REFLECT</b> his own gun fires into him · <kbd>Y</kbd> <b>LOOP</b> he falls forever (<kbd>Y</kbd> again: geyser, hold: human cannon) · <kbd>◀</kbd> <b>SWAP</b> places · <kbd>▶</kbd> <b>DASH</b> into him.",
  'hint.strikes.touch':
    "<b>STRIKES</b> (the round buttons on the left) cost rift charge ⚡; kills with your own portal tricks refill it. Aim near an enemy: <b>REFLECT</b> his own gun fires into him · <b>LOOP</b> he falls forever (again: geyser, hold: human cannon) · <b>SWAP</b> places · <b>DASH</b> into him.",
  'hint.grabHold': "Keep holding: time slows, look where to throw him (the dotted arc shows where he lands). Let go to throw.",
  'hint.loopAgain': "LOOP again: a tap fires him up as a GEYSER, a hold aims a HUMAN CANNON.",
  'hint.doorPlaced':
    "Your rifts stay open until your next PORTAL. <kbd>X</kbd> closes them, and cuts whatever is halfway through.",
  'hint.doorPlaced.pad':
    "Your rifts stay open until your next PORTAL. <kbd>LB</kbd> closes them, and cuts whatever is halfway through.",
  'hint.doorPlaced.touch':
    "Your rifts stay open until your next PORTAL. <b>✕</b> closes them, and cuts whatever is halfway through.",

  // exit aim refusals
  'aim.tooHigh': 'Above your feet: climb higher first',
  'aim.range': 'Out of range',
  'aim.los': 'No line of sight',
  'aim.blocked': 'Jammed: no rifts here',
  'aim.enemyClose': 'Too close to an enemy',
  'aim.space': 'Not enough room',
  'aim.noSurface': 'Nothing to open on',
  'aim.throw': 'THROW',

  // PORTAL: what a press does now (HUD + the touch caption), refusals
  'portal.air': 'AIR',
  'portal.catch': 'CATCH',
  'portal.grab': 'GRAB',
  'portal.load': 'LOAD',
  'portal.hijack': 'HIJACK',
  'portal.hole': 'HOLE',
  'portal.door': 'DOOR',
  'portal.anchored': "He won't budge (stun him first)",
  'portal.noCharge': "He's fighting you: grabbing him takes a ⚡",
  'portal.noFloor': 'No floor under him to open',
  'portal.nowhere': 'Nowhere to throw it',
  'portal.loopLow': 'Too low for a loop: aim the exit yourself',
  'portal.paid': '⚡ −1: he was fighting you',
  'gate.steady': 'STEADY: knock him off balance',
  'gate.enemyClose': 'Too close to an enemy',
  'gate.blocked': 'Jammed: no rifts here',
  'gate.noSpace': 'No room for a rift',
  'gate.range': 'Out of range',

  // what falls out of the exit
  'outcome.splash': 'Drown',
  'outcome.void': 'Void',
  'outcome.skull': 'Lethal drop',
  'outcome.stars': 'Knockdown',
  'outcome.safe': 'Safe',

  // exit orientation / surface
  'orient.auto': 'AUTO',
  'orient.hatch': 'HATCH',
  'orient.door': 'DOOR',
  'kind.floor': 'FLOOR',
  'kind.wall': 'WALL',
  'kind.ceiling': 'CEILING',
  'kind.stand': 'DOOR',
  'kind.air': 'AIR',

  // context prompts
  'prompt.finish': 'FINISH',
  'prompt.grab': 'GRAB',
  'prompt.throw': 'THROW',
  'prompt.hijack': 'HIJACK',
  'prompt.lift': 'RIDE LIFT',
  'prompt.drop': 'DROP',

  // objectives
  'obj.clear': 'Clear the area',
  'obj.lift': 'Get to the lift',
  'obj.boss': 'Take down Director Voss',
  'obj.escape': 'Jump. Trust the rift.',
  'obj.next': 'Push on to the next area',
  'strike.reflect': 'REFLECT',
  'strike.loop': 'LOOP',
  'strike.loop.again': 'FIRE!',
  'strike.swap': 'SWAP',
  'strike.dash': 'DASH',
  'strike.cooldown': 'Not ready yet',
  'strike.noCharge': 'No rift charge: a trick kill refills one',
  'strike.noTarget': 'No enemy near your aim',
  'strike.tooClose': 'Too close',
  'strike.tooHigh': 'Too high above you',
  'strike.grounded': 'Stand on something first',
  'strike.noFloor': "He isn't on solid floor",
  'strike.noRoom': 'No room for it here',
  'strike.anchored': "He won't budge (stun him first)",
  'ctl.strike1': 'REFLECT: his own gun fires into him',
  'ctl.strike2': 'LOOP: he falls forever (again: geyser, hold: human cannon)',
  'ctl.strike3': 'SWAP: trade places with him',
  'ctl.strike4': 'DASH: out of a rift, straight into him',

  // toasts
  'toast.checkpoint': 'Checkpoint',
  'toast.hijack': 'Gate hijacked',
  'toast.clipSaved': 'Clip saved',
  'toast.clipFailed': 'Couldn’t save the clip',
  'toast.photoSaved': 'Photo saved',
  'toast.challenge': 'Challenge complete',
  'toast.zoneClear': 'Area clear',

  // enemy barks
  'bark.contact': 'Contact!',
  'bark.reload': 'Reloading!',
  'bark.grenade': 'Grenade out!',
  'bark.charge': 'Coming through!',
  'bark.lost': 'Lost visual.',
  'bark.mateDown': 'Man down!',
  'bark.what': 'What the hell was that?',
  'bark.grabbed': 'The floor’s gone!',
  'bark.boss1': 'That gauntlet is Kessler property. I’m taking it back.',
  'bark.boss2': 'You think you invented these tricks? I wrote the manual.',
  'bark.boss3': 'Enough! I’ll tear this whole tower open!',

  // respawn
  'respawn.void': 'Lost to the void',
  'respawn.dead': 'You died',

  // clip / photo
  'clip.title': 'REPLAY',
  'clip.saving': 'Saving clip…',
  'clip.ready': 'Clip ready',
  'clip.share': 'SHARE',
  'clip.download': 'DOWNLOAD',
  'clip.close': 'CLOSE',
  'clip.offer': 'CLIP',
  'photo.title': 'PHOTO MODE',
  'photo.snap': 'SNAP',
  'photo.exit': 'EXIT',

  // HUD labels
  'hud.style': 'STYLE',
  'hud.total': 'TOTAL',
  'hud.exit': 'EXIT',
  'hud.entrance': 'ENTRANCE',
  'hud.objective': 'OBJECTIVE',
  'hud.airtime': 'AIRTIME',
  'hud.combo': 'COMBO',
  'hud.drop': 'DROP',
  'hud.charged': 'CHARGED',

  // touch buttons
  'touch.portal': 'PORTAL',
  'touch.jump': 'JUMP',
  'touch.shove': 'SHOVE',
  'touch.crouch': 'CROUCH',
  'touch.cancel': 'CANCEL',
  'touch.flip': 'FLIP',
  'touch.close': 'CLOSE',
  'touch.action': 'ACTION',
  'touch.rotate': 'Rotate your device',

  // controls pages
  'ctl.tab.kbm': 'KEYBOARD + MOUSE',
  'ctl.tab.pad': 'GAMEPAD',
  'ctl.tab.touch': 'TOUCH',
  'ctl.move': 'Move',
  'ctl.look': 'Look',
  'ctl.jump': 'Jump / mantle',
  'ctl.sprint': 'Sprint',
  'ctl.crouch': 'Crouch',
  'ctl.shove': 'SHOVE: dash that knocks enemies off balance',
  'ctl.portal': 'PORTAL: press = the entrance (by what you aim at) · hold = aim the exit in slow motion · let go = the exit',
  'ctl.cancel': 'Let go of a held PORTAL without an exit',
  'ctl.flip': 'Flip the exit (hatch / door) while holding',
  'ctl.dist': 'Exit distance while holding',
  'ctl.close': 'CLOSE your rifts (cuts whatever is halfway through)',
  'ctl.action': 'ACTION: finish, grab, throw, hijack, lift',
  'ctl.vision': 'Rift vision',
  'ctl.clip': 'Save a clip',
  'ctl.photo': 'Photo mode',
  'photo.hint.pad': 'Sticks: look / move · D-pad ←/→: zoom · RT: snap · D-pad ↑: exit',
  'menu.photo': 'Photo mode',
  'ctl.pause': 'Pause',
  'key.mouse': 'Mouse',
  'key.lmb': 'LMB (hold)',
  'key.rmbHeld': 'RMB while holding',
  'key.wheel': 'Wheel',
  'key.mmb': 'X / MMB',
  'key.space': 'Space',
  'ctl.padLine':
    'RT PORTAL (while held: LT cancel · Y flip · D-pad ←/→ distance) · LT REFLECT · Y LOOP · D-pad ← SWAP · D-pad → DASH · LB close · RB shove · A jump · X action · B crouch · L3 sprint · D-pad ↓ vision · D-pad ↑ photo · View clip · Start pause',
  'ctl.touch.left': 'Left thumb',
  'ctl.touch.right': 'Right side',
  'ctl.touch.stick': 'Move. Push all the way to sprint.',
  'ctl.touch.look': 'Drag to look',
  'ctl.touch.portal': 'Tap: a rift by what you look at. Hold + drag: aim the exit (time slows). Lift: open it. Slide onto ✕: cancel.',
  'ctl.touch.strikes': 'STRIKES: hold LOOP to aim the cannon',
  'ctl.touch.jump': 'Jump / mantle',
  'ctl.touch.shove': 'Dash that knocks enemies off balance',
  'ctl.touch.close': 'Close the rift (cuts)',
  'ctl.touch.action': 'Finish, grab, throw, hijack, lift',
  'ctl.touch.flip': 'Flip the exit (while aiming)',
  'ctl.touch.crouch': 'Crouch',
  'ctl.touch.clip': 'Save a clip (when offered)',

  // trick names (fallbacks: META's strings override these through addStrings)
  'trick.returnToSender': 'RETURN TO SENDER',
  'trick.crossfire': 'CROSSFIRE',
  'trick.postage': 'POSTAGE',
  'trick.firingLine': 'FIRING LINE',
  'trick.borrowedGun': 'BORROWED GUN',
  'trick.trapdoor': 'TRAPDOOR',
  'trick.splashdown': 'SPLASHDOWN',
  'trick.void': 'INTO THE VOID',
  'trick.skyfall': 'SKYFALL',
  'trick.matador': 'MATADOR',
  'trick.bowling': 'BOWLING',
  'trick.headsUp': 'HEADS UP',
  'trick.loop': 'LOOP',
  'trick.cannonball': 'CANNONBALL',
  'trick.slingshot': 'SLINGSHOT',
  'trick.comet': 'COMET',
  'trick.guillotine': 'GUILLOTINE',
  'trick.cargo': 'CARGO',
  'trick.boom': 'BOOM',
  'trick.finisher': 'FINISHER',
  'trick.ghost': 'GHOST',
  'trick.airtime': 'AIRTIME',
  'trick.double': 'DOUBLE',
  'trick.triple': 'TRIPLE',
  'trick.multi': 'MULTI',
  'trick.mirror': 'MIRROR',
  'trick.hijack': 'HIJACK',
  'trick.juggle': 'JUGGLE',
};

// ---------------------------------------------------------------------------
// Hebrew
// ---------------------------------------------------------------------------

const HE: Record<string, string> = {
  title: 'THRESHOLD',
  subtitle: 'אקשן של פורטלים',
  tagline: 'בלי נשק. פורטל אחד. העולם כבר יהרוג בשבילך.',
  loading: 'טוען',
  'boot.webgl': 'WebGL לא זמין במכשיר או בדפדפן הזה.',

  'menu.play': 'שחק',
  'menu.continue': 'המשך',
  'menu.zones': 'אזורים',
  'menu.challenges': 'אתגרים',
  'menu.controls': 'שליטה',
  'menu.settings': 'הגדרות',
  'menu.language': 'שפה',
  'menu.quit': 'תפריט ראשי',
  'menu.resume': 'חזרה למשחק',
  'menu.restart': 'התחל מחדש',
  'menu.retry': 'חזור לנקודת השמירה',
  'menu.back': 'חזרה',
  'menu.paused': 'הפסקה',
  'menu.playAgain': 'שחק שוב',
  'menu.zoneSelect': 'בחר אזור',
  'menu.locked': 'נעול',
  'menu.daily': 'יומי',
  'menu.done': 'בוצע',
  'menu.noChallenges': 'אין עדיין אתגרים. צא לעשות קצת רעש.',
  'menu.challengesDone': '{n}/{m} הושלמו',
  'menu.rules': 'שלושת החוקים',

  'briefing.tag': 'תדריך משימה',
  'briefing.title': 'מגדל קסלר',
  'briefing.text':
    'קסלר תעשיות המציאו את שער הפורטל, ועכשיו הם בונים עליו אימפריה: מגדל של מאה מטר מעל הנמל. גנבת להם את אב־הטיפוס של כפפת הפורטלים. אין לך נשק ואין לך שריון, רק זוג פורטלים אחד ומה שקסלר יזרקו עליך. טפס מהרציף עד הגג, והפל את המנהל ווֹס.',

  'set.quality': 'איכות גרפיקה',
  'set.low': 'נמוכה',
  'set.medium': 'בינונית',
  'set.high': 'גבוהה',
  'set.ultra': 'אולטרה',
  'set.sensitivity': 'רגישות מבט',
  'set.invertY': 'היפוך ציר Y',
  'set.slowmo': 'הילוך איטי בזמן כיוון',
  'set.on': 'פעיל',
  'set.off': 'כבוי',
  'set.language': 'שפה',

  'end.victory': 'המגדל שלך',
  'end.victorySub': 'ווֹס הופל. הפורטל נשאר אצלך.',
  'end.defeat': 'נפלת',
  'end.defeatSub': 'המגדל עדיין עומד.',
  'end.rank': 'דרגה',
  'end.time': 'זמן',
  'end.kills': 'הריגות',
  'end.bestCombo': 'הקומבו הכי טוב',
  'end.styleTotal': 'סה״כ סטייל',
  'end.tricks': 'טריקים שגילית',
  'end.challenges': 'אתגרים',
  'end.deaths': 'פעמים שמתת',

  'zone.pier.name': 'הרציף',
  'zone.pier.sub': 'גובה פני הים. הרציפים שייכים לקסלר.',
  'zone.yard.name': 'אתר הבנייה',
  'zone.yard.sub': 'עגורנים, מטענים, וענק אחד עם חשבון פתוח.',
  'zone.skeleton.name': 'השלד',
  'zone.skeleton.sub': 'פלדה חשופה. ארבעים מטר של כלום מתחתיך.',
  'zone.lab.name': 'המעבדה',
  'zone.lab.sub': 'כאן קסלר בונים את השערים שלהם.',
  'zone.crown.name': 'הכתר',
  'zone.crown.sub': 'הגג. ווֹס מחכה לך.',

  'rule.1': 'כל דבר שומר על המהירות שלו כשהוא עובר בפורטל.',
  'rule.2': 'הפורטל הוא הנשק היחיד שלך: מה שעובר דרכו פוגע בכל אחד.',
  'rule.3': 'שני הקצוות בשליטה שלך. סגור פורטל על משהו באמצע, והוא נחתך.',

  'hint.door':
    "פורטל הוא דלת. הסתכל לצד השני של התעלה והחזק <kbd>קליק שמאלי</kbd>: הזמן מאט, ודמות רפאים מראה איפה תצא. שחרר: ה<b>כניסה</b> הכתומה נפתחת מולך, וה<b>יציאה</b> הכחולה שם. עבור דרכה. (קליק מהיר שם את היציאה איפה שאתה מסתכל.)",
  'hint.door.pad':
    "פורטל הוא דלת. הסתכל לצד השני של התעלה והחזק <kbd>RT</kbd>: הזמן מאט, ודמות רפאים מראה איפה תצא. שחרר: ה<b>כניסה</b> הכתומה נפתחת מולך, וה<b>יציאה</b> הכחולה שם. עבור דרכה. (לחיצה מהירה שמה את היציאה איפה שאתה מסתכל.)",
  'hint.door.touch':
    "פורטל הוא דלת. החזק <b>פורטל</b> וגרור כדי להסתכל לצד השני של התעלה: הזמן מאט, ודמות רפאים מראה איפה תצא. הרם את האצבע: ה<b>כניסה</b> הכתומה נפתחת מולך, וה<b>יציאה</b> הכחולה שם. עבור דרכה.",
  'hint.trapdoor':
    "שני שומרים על הקצה, והים מאחוריהם. שים את הכוונת על שומר ולחץ <kbd>קליק שמאלי</kbd>: הוא שוקע ברצפה ויוצא מעל המים. אם מחזיקים, מכוונים לאן הוא יעוף. (מי שכבר נלחם בך עולה ⚡ אחד.)",
  'hint.trapdoor.pad':
    "שני שומרים על הקצה, והים מאחוריהם. שים את הכוונת על שומר ולחץ <kbd>RT</kbd>: הוא שוקע ברצפה ויוצא מעל המים. אם מחזיקים, מכוונים לאן הוא יעוף. (מי שכבר נלחם בך עולה ⚡ אחד.)",
  'hint.trapdoor.touch':
    "שני שומרים על הקצה, והים מאחוריהם. הסתכל על שומר וגע ב<b>פורטל</b>: הוא שוקע ברצפה ויוצא מעל המים. החזק וגרור כדי לכוון לאן הוא יעוף. (מי שכבר נלחם בך עולה ⚡ אחד.)",
  'hint.returnToSender':
    "הנשק שלו לא פוגע באנשי קסלר, עד שהכדורים עוברים בפורטל שלך. כשהלייזר האדום ננעל עליך, לחץ <kbd>קליק שמאלי</kbd>: דלת תפיסה בולעת את הצרור ומחזירה אותו אליו. אם מחזיקים, שולחים אותו למקום אחר.",
  'hint.returnToSender.pad':
    "הנשק שלו לא פוגע באנשי קסלר, עד שהכדורים עוברים בפורטל שלך. כשהלייזר האדום ננעל עליך, לחץ <kbd>RT</kbd>: דלת תפיסה בולעת את הצרור ומחזירה אותו אליו. אם מחזיקים, שולחים אותו למקום אחר.",
  'hint.returnToSender.touch':
    "הנשק שלו לא פוגע באנשי קסלר, עד שהכדורים עוברים בפורטל שלך. כשהלייזר האדום ננעל עליך, גע ב<b>פורטל</b>: דלת תפיסה בולעת את הצרור ומחזירה אותו אליו. החזק וגרור כדי לשלוח אותו למקום אחר.",
  'hint.slingshot':
    "קפוץ מערימת המכולות והחזק <kbd>קליק שמאלי</kbd> תוך כדי נפילה: נפתחת כניסה מתחתיך. הסתכל על קיר שפונה אל החבורה ושחרר: אתה יוצא ממנו במלוא המהירות.",
  'hint.slingshot.pad':
    "קפוץ מערימת המכולות והחזק <kbd>RT</kbd> תוך כדי נפילה: נפתחת כניסה מתחתיך. הסתכל על קיר שפונה אל החבורה ושחרר: אתה יוצא ממנו במלוא המהירות.",
  'hint.slingshot.touch':
    "קפוץ מערימת המכולות והחזק <b>פורטל</b> תוך כדי נפילה: נפתחת כניסה מתחתיך. גרור אל קיר שפונה אל החבורה והרם את האצבע: אתה יוצא ממנו במלוא המהירות.",
  'hint.arena': "ארבעה רובאים ולוחם עם מגן. כל כדור שהם יורים הוא שלך להשאיל. תמשיך לזוז, תשמור על השרשרת.",
  'hint.loop':
    "הפיר עובר דרך כל הקומות. הסתכל למטה אל התחתית שלו והחזק <kbd>קליק שמאלי</kbd>: נפתח שם בור. כוון את היציאה ממש מעליו (קליק מהיר עושה את זה לבד) וקפוץ פנימה: מהר יותר בכל סיבוב. החזק שוב <kbd>קליק שמאלי</kbd> תוך כדי נפילה כדי לירות את עצמך החוצה.",
  'hint.loop.pad':
    "הפיר עובר דרך כל הקומות. הסתכל למטה אל התחתית שלו והחזק <kbd>RT</kbd>: נפתח שם בור. כוון את היציאה ממש מעליו (לחיצה מהירה עושה את זה לבד) וקפוץ פנימה: מהר יותר בכל סיבוב. החזק שוב <kbd>RT</kbd> תוך כדי נפילה כדי לירות את עצמך החוצה.",
  'hint.loop.touch':
    "הפיר עובר דרך כל הקומות. הסתכל למטה אל התחתית שלו והחזק <b>פורטל</b>: נפתח שם בור. כוון את היציאה ממש מעליו (נגיעה מהירה עושה את זה לבד) וקפוץ פנימה: מהר יותר בכל סיבוב. החזק שוב <b>פורטל</b> תוך כדי נפילה כדי לירות את עצמך החוצה.",
  'hint.cargo':
    "מטענים תלויים על העגורן מעל השומרים. שים את הכוונת על מטען ולחץ <kbd>קליק שמאלי</kbd>: הוא נופל לבור ונוחת על הראש הקרוב. אם מחזיקים, מכוונים בעצמך.",
  'hint.cargo.pad':
    "מטענים תלויים על העגורן מעל השומרים. שים את הכוונת על מטען ולחץ <kbd>RT</kbd>: הוא נופל לבור ונוחת על הראש הקרוב. אם מחזיקים, מכוונים בעצמך.",
  'hint.cargo.touch':
    "מטענים תלויים על העגורן מעל השומרים. הסתכל על מטען וגע ב<b>פורטל</b>: הוא נופל לבור ונוחת על הראש הקרוב. החזק וגרור כדי לכוון בעצמך.",
  'hint.matador':
    "הענק מסתער בקו ישר. כשהוא שואג, לחץ <kbd>קליק שמאלי</kbd>: נפתחת דלת בדרך שלו והיא זורקת אותו מהקצה. אולה.",
  'hint.matador.pad':
    "הענק מסתער בקו ישר. כשהוא שואג, לחץ <kbd>RT</kbd>: נפתחת דלת בדרך שלו והיא זורקת אותו מהקצה. אולה.",
  'hint.matador.touch':
    "הענק מסתער בקו ישר. כשהוא שואג, גע ב<b>פורטל</b>: נפתחת דלת בדרך שלו והיא זורקת אותו מהקצה. אולה.",
  'hint.grenade':
    "שים לב לקשת: הטבעת מראה איפה הרימון ינחת. כשרימון מתקרב, לחץ <kbd>קליק שמאלי</kbd>: דלת תפיסה בולעת אותו ומחזירה אותו לזורק.",
  'hint.grenade.pad':
    "שים לב לקשת: הטבעת מראה איפה הרימון ינחת. כשרימון מתקרב, לחץ <kbd>RT</kbd>: דלת תפיסה בולעת אותו ומחזירה אותו לזורק.",
  'hint.grenade.touch':
    "שים לב לקשת: הטבעת מראה איפה הרימון ינחת. כשרימון מתקרב, גע ב<b>פורטל</b>: דלת תפיסה בולעת אותו ומחזירה אותו לזורק.",
  'hint.shield':
    "המגן שלו חוסם הכול מלפנים. <kbd>V</kbd> דוחף אותו משיווי משקל, ואז <kbd>קליק שמאלי</kbd> עליו הוא חטיפה בחינם (כשהוא יציב זה עולה ⚡).",
  'hint.shield.pad':
    "המגן שלו חוסם הכול מלפנים. <kbd>RB</kbd> דוחף אותו משיווי משקל, ואז <kbd>RT</kbd> עליו הוא חטיפה בחינם (כשהוא יציב זה עולה ⚡).",
  'hint.shield.touch':
    "המגן שלו חוסם הכול מלפנים. <b>דחיפה</b> מוציאה אותו משיווי משקל, ואז <b>פורטל</b> עליו הוא חטיפה בחינם (כשהוא יציב זה עולה ⚡).",
  'hint.firingLine':
    "הקרן של הצלף נטענת שנייה אחת. כשהיא ננעלת עליך, לחץ <kbd>קליק שמאלי</kbd>: דלת התפיסה שולחת את הקרן בחזרה לאורך הקו שלו.",
  'hint.firingLine.pad':
    "הקרן של הצלף נטענת שנייה אחת. כשהיא ננעלת עליך, לחץ <kbd>RT</kbd>: דלת התפיסה שולחת את הקרן בחזרה לאורך הקו שלו.",
  'hint.firingLine.touch':
    "הקרן של הצלף נטענת שנייה אחת. כשהיא ננעלת עליך, גע ב<b>פורטל</b>: דלת התפיסה שולחת את הקרן בחזרה לאורך הקו שלו.",
  'hint.hijack':
    "שערי קסלר מביאים תגבורת. לחץ <kbd>F</kbd> ליד הלוח, או שים את הכוונת על השער ולחץ <kbd>קליק שמאלי</kbd>: כל מי שעובר בו יוצא עכשיו מהיציאה שלך. רצוי מעל התהום.",
  'hint.hijack.pad':
    "שערי קסלר מביאים תגבורת. לחץ <kbd>X</kbd> ליד הלוח, או שים את הכוונת על השער ולחץ <kbd>RT</kbd>: כל מי שעובר בו יוצא עכשיו מהיציאה שלך. רצוי מעל התהום.",
  'hint.hijack.touch':
    "שערי קסלר מביאים תגבורת. גע ב<b>פעולה</b> ליד הלוח, או הסתכל על השער וגע ב<b>פורטל</b>: כל מי שעובר בו יוצא עכשיו מהיציאה שלך. רצוי מעל התהום.",
  'hint.jammer': "בתוך הבועה של המשבש לא נפתח שום פורטל. פתח את שלך מחוץ לבועה ושלח דברים פנימה: רימונים, גופות, מטענים.",
  'hint.borrowedGun':
    "הצריח לא מפסיק לירות. כשהוא ננעל עליך, החזק <kbd>קליק שמאלי</kbd>: התפיסה לוקחת את הצרור, והקצה השני הולך לאן שאתה מסתכל. הסתכל על החברים שלו. רובה בהשאלה.",
  'hint.borrowedGun.pad':
    "הצריח לא מפסיק לירות. כשהוא ננעל עליך, החזק <kbd>RT</kbd>: התפיסה לוקחת את הצרור, והקצה השני הולך לאן שאתה מסתכל. הסתכל על החברים שלו. רובה בהשאלה.",
  'hint.borrowedGun.touch':
    "הצריח לא מפסיק לירות. כשהוא ננעל עליך, החזק <b>פורטל</b>: התפיסה לוקחת את הצרור, והקצה השני הולך לאן שאתה גורר את המבט. הסתכל על החברים שלו. רובה בהשאלה.",
  'hint.boss':
    "ווֹס תופס בפורטל שלו כל מה שנורה ישר עליו. תפגע בו מאחור או מלמעלה; כשהוא המום אפשר לחטוף אותו. נתקע באמצע הפורטל שלך? <kbd>X</kbd> סוגר אותו עליו.",
  'hint.boss.pad':
    "ווֹס תופס בפורטל שלו כל מה שנורה ישר עליו. תפגע בו מאחור או מלמעלה; כשהוא המום אפשר לחטוף אותו. נתקע באמצע הפורטל שלך? <kbd>LB</kbd> סוגר אותו עליו.",
  'hint.boss.touch':
    "ווֹס תופס בפורטל שלו כל מה שנורה ישר עליו. תפגע בו מאחור או מלמעלה; כשהוא המום אפשר לחטוף אותו. נתקע באמצע הפורטל שלך? <b>✕</b> סוגר אותו עליו.",
  'hint.leap': "רוץ וקפוץ מהגג. תוך כדי נפילה, <kbd>קליק שמאלי</kbd> פותח כניסה מתחתיך. תסמוך על הפורטל.",
  'hint.leap.pad': "רוץ וקפוץ מהגג. תוך כדי נפילה, <kbd>RT</kbd> פותח כניסה מתחתיך. תסמוך על הפורטל.",
  'hint.leap.touch': "רוץ וקפוץ מהגג. תוך כדי נפילה, גע ב<b>פורטל</b> ונפתחת כניסה מתחתיך. תסמוך על הפורטל.",
  'hint.strikes':
    "<b>מתקפות</b> עולות טעינה ⚡ (חיסולים עם טריקים משלך ממלאים אותה). כוון ליד אויב: <kbd>קליק ימני</kbd> <b>מחזיר</b>: הנשק שלו יורה בו · <kbd>Q</kbd> <b>לולאה</b>: הוא נופל בלי סוף (<kbd>Q</kbd> שוב: גייזר, החזקה: תותח אנושי) · <kbd>E</kbd> <b>החלפה</b>: מתחלפים במקומות · <kbd>R</kbd> <b>זינוק</b>: עפים לתוכו.",
  'hint.strikes.pad':
    "<b>מתקפות</b> עולות טעינה ⚡ (חיסולים עם טריקים משלך ממלאים אותה). כוון ליד אויב: <kbd>LT</kbd> <b>מחזיר</b>: הנשק שלו יורה בו · <kbd>Y</kbd> <b>לולאה</b>: הוא נופל בלי סוף (<kbd>Y</kbd> שוב: גייזר, החזקה: תותח אנושי) · <kbd>◀</kbd> <b>החלפה</b>: מתחלפים במקומות · <kbd>▶</kbd> <b>זינוק</b>: עפים לתוכו.",
  'hint.strikes.touch':
    "<b>מתקפות</b> (הכפתורים העגולים משמאל) עולות טעינה ⚡; חיסולים עם טריקים משלך ממלאים אותה. כוון ליד אויב: <b>מחזיר</b>: הנשק שלו יורה בו · <b>לולאה</b>: הוא נופל בלי סוף (שוב: גייזר, החזקה: תותח אנושי) · <b>החלפה</b>: מתחלפים במקומות · <b>זינוק</b>: עפים לתוכו.",
  'hint.grabHold': "תמשיך להחזיק: הזמן מאט, תסתכל לאן לזרוק אותו (הקשת המנוקדת מראה איפה הוא ינחת). שחרר כדי לזרוק.",
  'hint.loopAgain': "לולאה שוב: נגיעה קצרה יורה אותו למעלה כגייזר, החזקה מכוונת תותח אנושי.",
  'hint.doorPlaced':
    "הפורטלים שלך נשארים פתוחים עד הפורטל הבא. <kbd>X</kbd> סוגר אותם, וחותך את מה שנמצא באמצע.",
  'hint.doorPlaced.pad':
    "הפורטלים שלך נשארים פתוחים עד הפורטל הבא. <kbd>LB</kbd> סוגר אותם, וחותך את מה שנמצא באמצע.",
  'hint.doorPlaced.touch':
    "הפורטלים שלך נשארים פתוחים עד הפורטל הבא. <b>✕</b> סוגר אותם, וחותך את מה שנמצא באמצע.",

  'aim.tooHigh': 'מעל הרגליים שלך: עלה גבוה יותר קודם',
  'aim.range': 'מחוץ לטווח',
  'aim.los': 'אין קו ראייה',
  'aim.blocked': 'משובש: אין פורטלים כאן',
  'aim.enemyClose': 'קרוב מדי לאויב',
  'aim.space': 'אין מספיק מקום',
  'aim.noSurface': 'אין על מה לפתוח',
  'aim.throw': 'זריקה',

  'portal.air': 'אוויר',
  'portal.catch': 'תפיסה',
  'portal.grab': 'חטיפה',
  'portal.load': 'מטען',
  'portal.hijack': 'השתלטות',
  'portal.hole': 'בור',
  'portal.door': 'דלת',
  'portal.anchored': 'הוא לא זז (קודם תהמם אותו)',
  'portal.noCharge': 'הוא נלחם בך: חטיפה שלו עולה ⚡',
  'portal.noFloor': 'אין מתחתיו רצפה לפתוח',
  'portal.nowhere': 'אין לאן לזרוק',
  'portal.loopLow': 'נמוך מדי ללולאה: כוון את היציאה בעצמך',
  'portal.paid': '⚡ −1: הוא נלחם בך',
  'gate.steady': 'יציב: הוצא אותו משיווי משקל',
  'gate.enemyClose': 'קרוב מדי לאויב',
  'gate.blocked': 'משובש: אין פורטלים כאן',
  'gate.noSpace': 'אין מקום לפורטל',
  'gate.range': 'מחוץ לטווח',

  'outcome.splash': 'טביעה',
  'outcome.void': 'תהום',
  'outcome.skull': 'נפילה קטלנית',
  'outcome.stars': 'הלם',
  'outcome.safe': 'נחיתה בטוחה',

  'orient.auto': 'אוטו',
  'orient.hatch': 'צוהר',
  'orient.door': 'דלת',
  'kind.floor': 'רצפה',
  'kind.wall': 'קיר',
  'kind.ceiling': 'תקרה',
  'kind.stand': 'דלת',
  'kind.air': 'אוויר',

  'prompt.finish': 'חיסול',
  'prompt.grab': 'תפוס',
  'prompt.throw': 'זרוק',
  'prompt.hijack': 'השתלט',
  'prompt.lift': 'עלה למעלית',
  'prompt.drop': 'שחרר',

  'obj.clear': 'נקה את האזור',
  'obj.lift': 'הגע למעלית',
  'obj.boss': 'הפל את המנהל ווֹס',
  'obj.escape': 'קפוץ. תסמוך על הפורטל.',
  'obj.next': 'המשך לאזור הבא',
  'strike.reflect': 'מחזיר',
  'strike.loop': 'לולאה',
  'strike.loop.again': 'שגר!',
  'strike.swap': 'החלפה',
  'strike.dash': 'זינוק',
  'strike.cooldown': 'עוד לא מוכן',
  'strike.noCharge': 'אין טעינה: חיסול עם טריק ממלא אחת',
  'strike.noTarget': 'אין אויב ליד הכוונת',
  'strike.tooClose': 'קרוב מדי',
  'strike.tooHigh': 'גבוה מדי מעליך',
  'strike.grounded': 'קודם תעמוד על משהו',
  'strike.noFloor': 'הוא לא עומד על רצפה',
  'strike.noRoom': 'אין לזה מקום כאן',
  'strike.anchored': 'הוא לא זז (קודם תהמם אותו)',
  'ctl.strike1': 'מחזיר: הנשק שלו יורה בו',
  'ctl.strike2': 'לולאה: הוא נופל בלי סוף (שוב: גייזר, החזקה: תותח אנושי)',
  'ctl.strike3': 'החלפה: מתחלפים איתו במקומות',
  'ctl.strike4': 'זינוק: יוצאים מפורטל ישר לתוכו',

  'toast.checkpoint': 'נקודת שמירה',
  'toast.hijack': 'השתלטת על השער',
  'toast.clipSaved': 'הקליפ נשמר',
  'toast.clipFailed': 'לא הצלחנו לשמור את הקליפ',
  'toast.photoSaved': 'התמונה נשמרה',
  'photo.hint.pad': 'סטיקים: להסתכל / לזוז · D-pad ←/→: זום · RT: צילום · D-pad ↑: יציאה',
  'menu.photo': 'מצב צילום',
  'toast.challenge': 'אתגר הושלם',
  'toast.zoneClear': 'האזור נוקה',

  'bark.contact': 'מגע!',
  'bark.reload': 'מחליף מחסנית!',
  'bark.grenade': 'רימון!',
  'bark.charge': 'פנו דרך!',
  'bark.lost': 'איבדתי אותו.',
  'bark.mateDown': 'יש נפגע!',
  'bark.what': 'מה זה היה, לעזאזל?',
  'bark.grabbed': 'הרצפה נעלמה!',
  'bark.boss1': 'הכפפה הזאת שייכת לקסלר. באתי לקחת אותה בחזרה.',
  'bark.boss2': 'אתה חושב שהמצאת את הטריקים האלה? אני כתבתי את המדריך.',
  'bark.boss3': 'די! אני אקרע את כל המגדל הזה!',

  'respawn.void': 'התהום בלעה אותך',
  'respawn.dead': 'מתת',

  'clip.title': 'שידור חוזר',
  'clip.saving': 'שומר קליפ…',
  'clip.ready': 'הקליפ מוכן',
  'clip.share': 'שתף',
  'clip.download': 'הורד',
  'clip.close': 'סגור',
  'clip.offer': 'קליפ',
  'photo.title': 'מצב צילום',
  'photo.snap': 'צלם',
  'photo.exit': 'יציאה',

  'hud.style': 'סטייל',
  'hud.total': 'סה״כ',
  'hud.exit': 'יציאה',
  'hud.entrance': 'כניסה',
  'hud.objective': 'משימה',
  'hud.airtime': 'באוויר',
  'hud.combo': 'קומבו',
  'hud.drop': 'נפילה',
  'hud.charged': 'טעון',

  'touch.portal': 'פורטל',
  'touch.jump': 'קפיצה',
  'touch.shove': 'דחיפה',
  'touch.crouch': 'כריעה',
  'touch.cancel': 'ביטול',
  'touch.flip': 'היפוך',
  'touch.close': 'סגור',
  'touch.action': 'פעולה',
  'touch.rotate': 'סובב את המכשיר לרוחב',

  'ctl.tab.kbm': 'מקלדת ועכבר',
  'ctl.tab.pad': 'שלט',
  'ctl.tab.touch': 'מגע',
  'ctl.move': 'תנועה',
  'ctl.look': 'מבט',
  'ctl.jump': 'קפיצה / טיפוס',
  'ctl.sprint': 'ריצה',
  'ctl.crouch': 'כריעה',
  'ctl.shove': 'דחיפה: זינוק שמוציא אויבים משיווי משקל',
  'ctl.portal': 'פורטל: לחיצה = הכניסה (לפי מה שאתה מכוון אליו) · החזקה = כיוון היציאה בהילוך איטי · שחרור = היציאה',
  'ctl.cancel': 'שחרור פורטל מוחזק בלי יציאה',
  'ctl.flip': 'היפוך היציאה (צוהר / דלת) בזמן החזקה',
  'ctl.dist': 'מרחק היציאה בזמן החזקה',
  'ctl.close': 'סגירת הפורטלים שלך (חותך את מה שבאמצע)',
  'ctl.action': 'פעולה: חיסול, תפיסה, זריקה, השתלטות, מעלית',
  'ctl.vision': 'ראיית פורטל',
  'ctl.clip': 'שמירת קליפ',
  'ctl.photo': 'מצב צילום',
  'ctl.pause': 'הפסקה',
  'key.mouse': 'עכבר',
  'key.lmb': 'קליק שמאלי (החזקה)',
  'key.rmbHeld': 'קליק ימני בזמן החזקה',
  'key.wheel': 'גלגלת',
  'key.mmb': 'X / לחיצה על הגלגלת',
  'key.space': 'רווח',
  'ctl.padLine':
    'RT פורטל (בזמן החזקה: LT ביטול · Y היפוך · חצים ←/→ מרחק) · LT מחזיר · Y לולאה · חץ ← החלפה · חץ → זינוק · LB סגירה · RB דחיפה · A קפיצה · X פעולה · B כריעה · L3 ריצה · חץ ↓ ראיית פורטל · חץ ↑ צילום · View קליפ · Start הפסקה',
  'ctl.touch.left': 'אגודל שמאל',
  'ctl.touch.right': 'צד ימין',
  'ctl.touch.stick': 'תנועה. דחוף עד הסוף כדי לרוץ.',
  'ctl.touch.look': 'גרור כדי להסתכל',
  'ctl.touch.portal': 'נגיעה: פורטל לפי מה שאתה מסתכל עליו. החזקה וגרירה: כיוון היציאה (הזמן מאט). הרמה: פתיחה. החלקה אל ✕: ביטול.',
  'ctl.touch.strikes': 'מתקפות: החזק לולאה כדי לכוון את התותח',
  'ctl.touch.jump': 'קפיצה / טיפוס',
  'ctl.touch.shove': 'זינוק שמוציא אויבים משיווי משקל',
  'ctl.touch.close': 'סגירת הפורטל (חותך)',
  'ctl.touch.action': 'חיסול, תפיסה, זריקה, השתלטות, מעלית',
  'ctl.touch.flip': 'היפוך היציאה (בזמן כיוון)',
  'ctl.touch.crouch': 'כריעה',
  'ctl.touch.clip': 'שמירת קליפ (כשמוצע)',

  'trick.returnToSender': 'החזרה לשולח',
  'trick.crossfire': 'אש צולבת',
  'trick.postage': 'דואר חוזר',
  'trick.firingLine': 'קו אש',
  'trick.borrowedGun': 'רובה בהשאלה',
  'trick.trapdoor': 'מלכודת',
  'trick.splashdown': 'צלילה',
  'trick.void': 'לתוך התהום',
  'trick.skyfall': 'נפילה מהשמיים',
  'trick.matador': 'מטדור',
  'trick.bowling': 'באולינג',
  'trick.headsUp': 'מלמעלה!',
  'trick.loop': 'לולאה',
  'trick.cannonball': 'כדור תותח',
  'trick.slingshot': 'קלע',
  'trick.comet': 'שביט',
  'trick.guillotine': 'גיליוטינה',
  'trick.cargo': 'מטען',
  'trick.boom': 'בום',
  'trick.finisher': 'חיסול',
  'trick.ghost': 'רוח רפאים',
  'trick.airtime': 'זמן אוויר',
  'trick.double': 'כפול',
  'trick.triple': 'משולש',
  'trick.multi': 'מולטי',
  'trick.mirror': 'מראה',
  'trick.hijack': 'השתלטות',
  'trick.juggle': 'להטוטן',
};

const DICT: Record<Lang, Record<string, string>> = { en: EN, he: HE };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let lang: Lang = (() => {
  try {
    const s = localStorage.getItem('threshold.lang');
    if (s === 'en' || s === 'he') return s;
  } catch {}
  try {
    if (typeof navigator !== 'undefined' && navigator.language?.startsWith('he')) return 'he';
  } catch {}
  return 'en';
})();

let device: Device = 'kbm';
const langListeners = new Set<(l: Lang) => void>();

function applyDocumentLang() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang) {
  const changed = l !== lang;
  lang = l;
  try {
    localStorage.setItem('threshold.lang', l);
  } catch {}
  applyDocumentLang();
  if (changed) for (const f of langListeners) f(l);
}

/** Subscribe to language changes (HUD / touch refresh their static labels). Returns an unsubscribe. */
export function onLangChange(f: (l: Lang) => void): () => void {
  langListeners.add(f);
  return () => langListeners.delete(f);
}

export function getDevice(): Device {
  return device;
}

/** Which device variants `t()` prefers (`key.touch`, `key.pad`, `key.kbm`). */
export function setDevice(d: Device) {
  device = d;
}

/** Merge strings into a language (later calls win). */
export function addStrings(l: Lang, dict: Record<string, string>) {
  Object.assign(DICT[l], dict);
}

/** The key exists (in the current language or English). */
export function has(key: string): boolean {
  return key in DICT[lang] || key in DICT.en;
}

/** Raw dictionary access for tests and tools. */
export function strings(l: Lang): Readonly<Record<string, string>> {
  return DICT[l];
}

function lookup(d: Record<string, string>, key: string): string | undefined {
  return d[`${key}.${device}`] ?? d[key];
}

/** Translate. Any key; falls back to English, then to the key itself. `{name}` placeholders take `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = lookup(DICT[lang], key) ?? (lang !== 'en' ? lookup(DICT.en, key) : undefined) ?? key;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(String(b));
  return s;
}

const nf = (() => {
  try {
    return new Intl.NumberFormat('en-US');
  } catch {
    return null;
  }
})();

/** HUD number format: "12,400" in every language (numbers stay LTR). */
export function formatNumber(n: number): string {
  const v = Math.round(n);
  return nf ? nf.format(v) : String(v);
}

applyDocumentLang();
