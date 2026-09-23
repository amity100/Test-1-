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
    'Rifts are doors. Hold <kbd>RMB</kbd> and aim across the channel, <kbd>LMB</kbd> places your blue <b>EXIT</b>. Then <kbd>LMB</kbd> again opens the orange <b>ENTRANCE</b> in front of you. Walk through.',
  'hint.door.pad':
    'Rifts are doors. Hold <kbd>LT</kbd> and aim across the channel, <kbd>RT</kbd> places your blue <b>EXIT</b>. Then <kbd>RT</kbd> again opens the orange <b>ENTRANCE</b> in front of you. Walk through.',
  'hint.door.touch':
    'Rifts are doors. Hold <b>RIFT</b> and drag to aim across the channel, let go to place your blue <b>EXIT</b>. Then tap <b>GATE</b> to open the orange <b>ENTRANCE</b>. Walk through.',
  'hint.trapdoor':
    'Two guards on the edge, the sea behind them. Put your <b>EXIT</b> out over the water. Then crosshair on a guard and <kbd>LMB</kbd>: the floor opens under him.',
  'hint.trapdoor.pad':
    'Two guards on the edge, the sea behind them. Put your <b>EXIT</b> out over the water. Then crosshair on a guard and <kbd>RT</kbd>: the floor opens under him.',
  'hint.trapdoor.touch':
    'Two guards on the edge, the sea behind them. Put your <b>EXIT</b> out over the water. Then look at a guard and tap <b>GATE</b>: the floor opens under him.',
  'hint.returnToSender':
    'His gun can’t hurt Kessler, until the bullets pass through your rift. Aim your <b>EXIT</b> at him. When his red laser locks on you, <kbd>LMB</kbd> CATCHES the burst.',
  'hint.returnToSender.pad':
    'His gun can’t hurt Kessler, until the bullets pass through your rift. Aim your <b>EXIT</b> at him. When his red laser locks on you, <kbd>RT</kbd> CATCHES the burst.',
  'hint.returnToSender.touch':
    'His gun can’t hurt Kessler, until the bullets pass through your rift. Aim your <b>EXIT</b> at him. When his red laser locks on you, tap <b>GATE</b> to CATCH the burst.',
  'hint.slingshot':
    'Put your <b>EXIT</b> on a wall facing the group. Now jump off the stack and hit <kbd>LMB</kbd> as you fall: an entrance opens under you and you come out at full speed.',
  'hint.slingshot.pad':
    'Put your <b>EXIT</b> on a wall facing the group. Now jump off the stack and hit <kbd>RT</kbd> as you fall: an entrance opens under you and you come out at full speed.',
  'hint.slingshot.touch':
    'Put your <b>EXIT</b> on a wall facing the group. Now jump off the stack and tap <b>GATE</b> as you fall: an entrance opens under you and you come out at full speed.',
  'hint.arena':
    'Four riflemen and a warden. Every bullet they fire is yours to borrow. Keep moving, keep the chain alive.',
  'hint.loop':
    'The shaft runs through every floor. Open the <b>ENTRANCE</b> at the bottom and the <b>EXIT</b> above it: whatever falls in keeps falling, faster every lap. Move the exit to fire it out.',
  'hint.cargo':
    'Loads hang from the crane. Put your <b>EXIT</b> above the guards. Crosshair on a load, <kbd>LMB</kbd>: the floor opens under it and the cargo drops on them.',
  'hint.cargo.pad':
    'Loads hang from the crane. Put your <b>EXIT</b> above the guards. Crosshair on a load, <kbd>RT</kbd>: the floor opens under it and the cargo drops on them.',
  'hint.cargo.touch':
    'Loads hang from the crane. Put your <b>EXIT</b> above the guards. Look at a load and tap <b>GATE</b>: the floor opens under it and the cargo drops on them.',
  'hint.matador':
    'The brute charges in a straight line. Put your <b>EXIT</b> over the sea. When he roars, <kbd>LMB</kbd> opens a door in his path. Olé.',
  'hint.matador.pad':
    'The brute charges in a straight line. Put your <b>EXIT</b> over the sea. When he roars, <kbd>RT</kbd> opens a door in his path. Olé.',
  'hint.matador.touch':
    'The brute charges in a straight line. Put your <b>EXIT</b> over the sea. When he roars, tap <b>GATE</b> to open a door in his path. Olé.',
  'hint.grenade':
    'Watch the arc: the ring shows where it lands. When a grenade comes close, <kbd>LMB</kbd> CATCHES it and it drops out of your <b>EXIT</b>. Put the exit above him.',
  'hint.grenade.pad':
    'Watch the arc: the ring shows where it lands. When a grenade comes close, <kbd>RT</kbd> CATCHES it and it drops out of your <b>EXIT</b>. Put the exit above him.',
  'hint.grenade.touch':
    'Watch the arc: the ring shows where it lands. When a grenade comes close, tap <b>GATE</b> to CATCH it and it drops out of your <b>EXIT</b>. Put the exit above him.',
  'hint.shield':
    'His shield blocks everything from the front. Put your <b>EXIT</b> behind him, or <kbd>V</kbd> SHOVE him off balance and open the floor under him.',
  'hint.shield.pad':
    'His shield blocks everything from the front. Put your <b>EXIT</b> behind him, or <kbd>RB</kbd> SHOVE him off balance and open the floor under him.',
  'hint.shield.touch':
    'His shield blocks everything from the front. Put your <b>EXIT</b> behind him, or <b>SHOVE</b> him off balance and open the floor under him.',
  'hint.firingLine':
    'The sniper’s beam charges for a second. Aim your <b>EXIT</b> at him, then <kbd>LMB</kbd> CATCHES the beam and it fires out the other side.',
  'hint.firingLine.pad':
    'The sniper’s beam charges for a second. Aim your <b>EXIT</b> at him, then <kbd>RT</kbd> CATCHES the beam and it fires out the other side.',
  'hint.firingLine.touch':
    'The sniper’s beam charges for a second. Aim your <b>EXIT</b> at him, then tap <b>GATE</b> to CATCH the beam and it fires out the other side.',
  'hint.hijack':
    'Kessler gates bring reinforcements. Press <kbd>F</kbd> at the panel, or open your <b>ENTRANCE</b> on the gate: everything that comes through now leaves from YOUR exit. Over the void, ideally.',
  'hint.hijack.pad':
    'Kessler gates bring reinforcements. Press <kbd>X</kbd> at the panel, or open your <b>ENTRANCE</b> on the gate: everything that comes through now leaves from YOUR exit. Over the void, ideally.',
  'hint.hijack.touch':
    'Kessler gates bring reinforcements. Tap <b>ACTION</b> at the panel, or open your <b>ENTRANCE</b> on the gate: everything that comes through now leaves from YOUR exit. Over the void, ideally.',
  'hint.jammer':
    'No rift opens inside the jammer’s bubble. Open yours outside it and send things in: grenades, bodies, cargo.',
  'hint.borrowedGun':
    'The turret never stops shooting. Aim your <b>EXIT</b> at its friends, then <kbd>LMB</kbd> CATCHES the stream. Borrowed gun.',
  'hint.borrowedGun.pad':
    'The turret never stops shooting. Aim your <b>EXIT</b> at its friends, then <kbd>RT</kbd> CATCHES the stream. Borrowed gun.',
  'hint.borrowedGun.touch':
    'The turret never stops shooting. Aim your <b>EXIT</b> at its friends, then tap <b>GATE</b> to CATCH the stream. Borrowed gun.',
  'hint.boss':
    'Voss catches straight shots with his own rift. Hit him from behind or from above. Caught halfway through your rift? <kbd>X</kbd> closes it on him.',
  'hint.boss.pad':
    'Voss catches straight shots with his own rift. Hit him from behind or from above. Caught halfway through your rift? <kbd>LB</kbd> closes it on him.',
  'hint.boss.touch':
    'Voss catches straight shots with his own rift. Hit him from behind or from above. Caught halfway through your rift? <b>✕</b> closes it on him.',
  'hint.leap': 'Run and jump off the roof. As you fall, <kbd>LMB</kbd> opens an entrance below you. Trust the rift.',
  'hint.leap.pad': 'Run and jump off the roof. As you fall, <kbd>RT</kbd> opens an entrance below you. Trust the rift.',
  'hint.leap.touch': 'Run and jump off the roof. As you fall, tap <b>GATE</b> to open an entrance below you. Trust the rift.',

  // exit aim refusals
  'aim.tooHigh': 'Above your feet: climb higher first',
  'aim.range': 'Out of range',
  'aim.los': 'No line of sight',
  'aim.blocked': 'Jammed: no rifts here',
  'aim.enemyClose': 'Too close to an enemy',
  'aim.space': 'Not enough room',
  'aim.noSurface': 'Nothing to open on',

  // gate (entrance) modes + refusals
  'gate.air': 'Entrance below you',
  'gate.catch': 'CATCH it',
  'gate.trapdoor': 'Trapdoor under it',
  'gate.door': 'Door ahead',
  'gate.steady': 'STEADY: knock him off balance',
  'gate.enemyClose': 'Too close to an enemy',
  'gate.blocked': 'Jammed: no rifts here',
  'gate.noSpace': 'No room for a rift',
  'gate.range': 'Out of range',
  'gate.noExit': 'Place an EXIT first',
  'gateLabel.air': 'AIR',
  'gateLabel.catch': 'CATCH',
  'gateLabel.trapdoor': 'TRAPDOOR',
  'gateLabel.door': 'DOOR',

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
  'strike.mirror': 'REFLECT',
  'strike.geyser': 'GEYSER',
  'strike.drop': 'DROP',
  'strike.cooldown': 'Not ready yet',
  'strike.noCharge': 'No rift charge: a trick kill refills one',
  'strike.noTarget': 'No enemy near your aim',
  'strike.tooClose': 'Too close',
  'strike.noFloor': "He isn't on solid floor",
  'strike.noRoom': 'No room above him',
  'strike.anchored': "He won't budge (stun him first)",
  'hint.strikes': '<b>STRIKES</b>: aim near an enemy and press. <b>1 REFLECT</b> sends his bullets back · <b>2 GEYSER</b> throws him into the sky · <b>3 DROP</b> throws him off the edge (or out of the sky). Each costs a rift charge; kills with your own portal tricks refill them.',
  'hint.strikes.pad': '<b>STRIKES</b>: aim near an enemy and press. <b>R3 REFLECT</b> sends his bullets back · <b>◀ GEYSER</b> throws him into the sky · <b>▶ DROP</b> throws him off the edge.',
  'hint.strikes.touch': '<b>STRIKES</b> (left buttons): aim near an enemy and tap. <b>REFLECT</b> sends his bullets back · <b>GEYSER</b> throws him into the sky · <b>DROP</b> throws him off the edge.',
  'ctl.strikes': 'STRIKES: Reflect / Geyser / Drop',
  'ctl.strike1': 'REFLECT: his bullets go back into him',
  'ctl.strike2': 'GEYSER: throw him into the sky',
  'ctl.strike3': 'DROP: throw him off the edge / out of the sky',

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
  'touch.rift': 'RIFT',
  'touch.gate': 'GATE',
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
  'ctl.aim': 'Aim the EXIT (time slows)',
  'ctl.place': 'Place the EXIT',
  'ctl.gate': 'GATE: open the ENTRANCE (air, catch, trapdoor, door)',
  'ctl.flip': 'Flip exit (hatch / door)',
  'ctl.dist': 'Air distance',
  'ctl.close': 'CLOSE the rift (cuts whatever is halfway through)',
  'ctl.action': 'ACTION: finish, grab, throw, hijack, lift',
  'ctl.vision': 'Rift vision',
  'ctl.clip': 'Save a clip',
  'ctl.photo': 'Photo mode',
  'photo.hint.pad': 'Sticks: look / move · D-pad ←/→: zoom · RT: snap · D-pad ↑: exit',
  'menu.photo': 'Photo mode',
  'ctl.pause': 'Pause',
  'key.mouse': 'Mouse',
  'key.rmb': 'RMB (hold)',
  'key.lmbAim': 'LMB while aiming',
  'key.lmb': 'LMB',
  'key.wheel': 'Wheel',
  'key.mmb': 'X / MMB',
  'key.space': 'Space',
  'ctl.padLine':
    'LT aim · RT place / gate · LB close · RB shove · A jump · X action · B crouch · Y flip · L3 sprint · D-pad ↓ vision · D-pad ↑ photo · D-pad ←/→ distance while aiming, else GEYSER / DROP · R3 REFLECT · View clip · Start pause',
  'ctl.touch.left': 'Left thumb',
  'ctl.touch.right': 'Right side',
  'ctl.touch.stick': 'Move. Push all the way to sprint.',
  'ctl.touch.look': 'Drag to look',
  'ctl.touch.rift': 'Hold + drag: aim the EXIT. Let go: place it. Slide onto ✕: cancel.',
  'ctl.touch.gate': 'Open the ENTRANCE. The label shows what it will do.',
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
    'פורטל הוא דלת. החזק <kbd>קליק ימני</kbd> וכוון לצד השני של התעלה, <kbd>קליק שמאלי</kbd> מציב את ה<b>יציאה</b> הכחולה. עוד <kbd>קליק שמאלי</kbd> פותח את ה<b>כניסה</b> הכתומה מולך. עבור דרכה.',
  'hint.door.pad':
    'פורטל הוא דלת. החזק <kbd>LT</kbd> וכוון לצד השני של התעלה, <kbd>RT</kbd> מציב את ה<b>יציאה</b> הכחולה. עוד <kbd>RT</kbd> פותח את ה<b>כניסה</b> הכתומה מולך. עבור דרכה.',
  'hint.door.touch':
    'פורטל הוא דלת. החזק <b>פורטל</b> וגרור כדי לכוון לצד השני של התעלה, ושחרר כדי להציב את ה<b>יציאה</b> הכחולה. אחר כך גע ב<b>שער</b> כדי לפתוח את ה<b>כניסה</b> הכתומה. עבור דרכה.',
  'hint.trapdoor':
    'שני שומרים על הקצה, והים מאחוריהם. הצב את ה<b>יציאה</b> מעל המים. עכשיו שים את הכוונת על שומר ולחץ <kbd>קליק שמאלי</kbd>: הרצפה נפתחת מתחתיו.',
  'hint.trapdoor.pad':
    'שני שומרים על הקצה, והים מאחוריהם. הצב את ה<b>יציאה</b> מעל המים. עכשיו שים את הכוונת על שומר ולחץ <kbd>RT</kbd>: הרצפה נפתחת מתחתיו.',
  'hint.trapdoor.touch':
    'שני שומרים על הקצה, והים מאחוריהם. הצב את ה<b>יציאה</b> מעל המים. עכשיו הסתכל על שומר וגע ב<b>שער</b>: הרצפה נפתחת מתחתיו.',
  'hint.returnToSender':
    'הנשק שלו לא פוגע באנשי קסלר, עד שהכדורים עוברים בפורטל שלך. כוון את ה<b>יציאה</b> אליו. כשהלייזר האדום ננעל עליך, <kbd>קליק שמאלי</kbd> תופס את הצרור.',
  'hint.returnToSender.pad':
    'הנשק שלו לא פוגע באנשי קסלר, עד שהכדורים עוברים בפורטל שלך. כוון את ה<b>יציאה</b> אליו. כשהלייזר האדום ננעל עליך, <kbd>RT</kbd> תופס את הצרור.',
  'hint.returnToSender.touch':
    'הנשק שלו לא פוגע באנשי קסלר, עד שהכדורים עוברים בפורטל שלך. כוון את ה<b>יציאה</b> אליו. כשהלייזר האדום ננעל עליך, גע ב<b>שער</b> כדי לתפוס את הצרור.',
  'hint.slingshot':
    'הצב את ה<b>יציאה</b> על קיר מול החבורה. עכשיו קפוץ מערימת המכולות ולחץ <kbd>קליק שמאלי</kbd> תוך כדי נפילה: נפתחת כניסה מתחתיך, ואתה יוצא במלוא המהירות.',
  'hint.slingshot.pad':
    'הצב את ה<b>יציאה</b> על קיר מול החבורה. עכשיו קפוץ מערימת המכולות ולחץ <kbd>RT</kbd> תוך כדי נפילה: נפתחת כניסה מתחתיך, ואתה יוצא במלוא המהירות.',
  'hint.slingshot.touch':
    'הצב את ה<b>יציאה</b> על קיר מול החבורה. עכשיו קפוץ מערימת המכולות וגע ב<b>שער</b> תוך כדי נפילה: נפתחת כניסה מתחתיך, ואתה יוצא במלוא המהירות.',
  'hint.arena': 'ארבעה רובאים ולוחם עם מגן. כל כדור שהם יורים הוא שלך להשאיל. תמשיך לזוז, תשמור על השרשרת.',
  'hint.loop':
    'הפיר עובר דרך כל הקומות. פתח <b>כניסה</b> בתחתית ו<b>יציאה</b> מעליה: מה שנופל פנימה ממשיך ליפול, מהר יותר בכל סיבוב. הזז את היציאה כדי לירות אותו החוצה.',
  'hint.cargo':
    'מטענים תלויים על העגורן. הצב את ה<b>יציאה</b> מעל השומרים. שים את הכוונת על מטען ולחץ <kbd>קליק שמאלי</kbd>: הרצפה נפתחת מתחתיו והמטען נוחת עליהם.',
  'hint.cargo.pad':
    'מטענים תלויים על העגורן. הצב את ה<b>יציאה</b> מעל השומרים. שים את הכוונת על מטען ולחץ <kbd>RT</kbd>: הרצפה נפתחת מתחתיו והמטען נוחת עליהם.',
  'hint.cargo.touch':
    'מטענים תלויים על העגורן. הצב את ה<b>יציאה</b> מעל השומרים. הסתכל על מטען וגע ב<b>שער</b>: הרצפה נפתחת מתחתיו והמטען נוחת עליהם.',
  'hint.matador':
    'הענק מסתער בקו ישר. הצב את ה<b>יציאה</b> מעל הים. כשהוא שואג, <kbd>קליק שמאלי</kbd> פותח דלת בדרך שלו. אולה.',
  'hint.matador.pad':
    'הענק מסתער בקו ישר. הצב את ה<b>יציאה</b> מעל הים. כשהוא שואג, <kbd>RT</kbd> פותח דלת בדרך שלו. אולה.',
  'hint.matador.touch':
    'הענק מסתער בקו ישר. הצב את ה<b>יציאה</b> מעל הים. כשהוא שואג, גע ב<b>שער</b> ונפתחת דלת בדרך שלו. אולה.',
  'hint.grenade':
    'שים לב לקשת: הטבעת מראה איפה הרימון ינחת. כשרימון מתקרב, <kbd>קליק שמאלי</kbd> תופס אותו והוא נופל מה<b>יציאה</b> שלך. הצב את היציאה מעל הרימונאי.',
  'hint.grenade.pad':
    'שים לב לקשת: הטבעת מראה איפה הרימון ינחת. כשרימון מתקרב, <kbd>RT</kbd> תופס אותו והוא נופל מה<b>יציאה</b> שלך. הצב את היציאה מעל הרימונאי.',
  'hint.grenade.touch':
    'שים לב לקשת: הטבעת מראה איפה הרימון ינחת. כשרימון מתקרב, גע ב<b>שער</b> כדי לתפוס אותו, והוא נופל מה<b>יציאה</b> שלך. הצב את היציאה מעל הרימונאי.',
  'hint.shield':
    'המגן שלו חוסם הכול מלפנים. הצב את ה<b>יציאה</b> מאחוריו, או לחץ <kbd>V</kbd> כדי לדחוף אותו משיווי משקל ולפתוח את הרצפה מתחתיו.',
  'hint.shield.pad':
    'המגן שלו חוסם הכול מלפנים. הצב את ה<b>יציאה</b> מאחוריו, או לחץ <kbd>RB</kbd> כדי לדחוף אותו משיווי משקל ולפתוח את הרצפה מתחתיו.',
  'hint.shield.touch':
    'המגן שלו חוסם הכול מלפנים. הצב את ה<b>יציאה</b> מאחוריו, או גע ב<b>דחיפה</b> כדי להוציא אותו משיווי משקל ולפתוח את הרצפה מתחתיו.',
  'hint.firingLine':
    'הקרן של הצלף נטענת שנייה אחת. כוון את ה<b>יציאה</b> אליו, ואז <kbd>קליק שמאלי</kbd> תופס את הקרן והיא נורית מהצד השני.',
  'hint.firingLine.pad':
    'הקרן של הצלף נטענת שנייה אחת. כוון את ה<b>יציאה</b> אליו, ואז <kbd>RT</kbd> תופס את הקרן והיא נורית מהצד השני.',
  'hint.firingLine.touch':
    'הקרן של הצלף נטענת שנייה אחת. כוון את ה<b>יציאה</b> אליו, ואז גע ב<b>שער</b> כדי לתפוס את הקרן, והיא נורית מהצד השני.',
  'hint.hijack':
    'שערי קסלר מביאים תגבורת. לחץ <kbd>F</kbd> ליד הלוח, או פתח את ה<b>כניסה</b> שלך על השער: כל מי שעובר בו יוצא עכשיו מהיציאה שלך. רצוי מעל התהום.',
  'hint.hijack.pad':
    'שערי קסלר מביאים תגבורת. לחץ <kbd>X</kbd> ליד הלוח, או פתח את ה<b>כניסה</b> שלך על השער: כל מי שעובר בו יוצא עכשיו מהיציאה שלך. רצוי מעל התהום.',
  'hint.hijack.touch':
    'שערי קסלר מביאים תגבורת. גע ב<b>פעולה</b> ליד הלוח, או פתח את ה<b>כניסה</b> שלך על השער: כל מי שעובר בו יוצא עכשיו מהיציאה שלך. רצוי מעל התהום.',
  'hint.jammer': 'בתוך הבועה של המשבש לא נפתח שום פורטל. פתח את שלך מחוץ לבועה ושלח דברים פנימה: רימונים, גופות, מטענים.',
  'hint.borrowedGun':
    'הצריח לא מפסיק לירות. כוון את ה<b>יציאה</b> אל החברים שלו, ואז <kbd>קליק שמאלי</kbd> תופס את הצרור. רובה בהשאלה.',
  'hint.borrowedGun.pad':
    'הצריח לא מפסיק לירות. כוון את ה<b>יציאה</b> אל החברים שלו, ואז <kbd>RT</kbd> תופס את הצרור. רובה בהשאלה.',
  'hint.borrowedGun.touch':
    'הצריח לא מפסיק לירות. כוון את ה<b>יציאה</b> אל החברים שלו, ואז גע ב<b>שער</b> כדי לתפוס את הצרור. רובה בהשאלה.',
  'hint.boss':
    'ווֹס תופס בפורטל שלו כל מה שנורה ישר עליו. תפגע בו מאחור או מלמעלה. נתקע באמצע הפורטל שלך? <kbd>X</kbd> סוגר אותו עליו.',
  'hint.boss.pad':
    'ווֹס תופס בפורטל שלו כל מה שנורה ישר עליו. תפגע בו מאחור או מלמעלה. נתקע באמצע הפורטל שלך? <kbd>LB</kbd> סוגר אותו עליו.',
  'hint.boss.touch':
    'ווֹס תופס בפורטל שלו כל מה שנורה ישר עליו. תפגע בו מאחור או מלמעלה. נתקע באמצע הפורטל שלך? <b>✕</b> סוגר אותו עליו.',
  'hint.leap': 'רוץ וקפוץ מהגג. תוך כדי נפילה, <kbd>קליק שמאלי</kbd> פותח כניסה מתחתיך. תסמוך על הפורטל.',
  'hint.leap.pad': 'רוץ וקפוץ מהגג. תוך כדי נפילה, <kbd>RT</kbd> פותח כניסה מתחתיך. תסמוך על הפורטל.',
  'hint.leap.touch': 'רוץ וקפוץ מהגג. תוך כדי נפילה, גע ב<b>שער</b> ונפתחת כניסה מתחתיך. תסמוך על הפורטל.',

  'aim.tooHigh': 'מעל הרגליים שלך: עלה גבוה יותר קודם',
  'aim.range': 'מחוץ לטווח',
  'aim.los': 'אין קו ראייה',
  'aim.blocked': 'משובש: אין פורטלים כאן',
  'aim.enemyClose': 'קרוב מדי לאויב',
  'aim.space': 'אין מספיק מקום',
  'aim.noSurface': 'אין על מה לפתוח',

  'gate.air': 'כניסה מתחתיך',
  'gate.catch': 'תפוס את זה',
  'gate.trapdoor': 'מלכודת מתחתיו',
  'gate.door': 'דלת לפניך',
  'gate.steady': 'יציב: הוצא אותו משיווי משקל',
  'gate.enemyClose': 'קרוב מדי לאויב',
  'gate.blocked': 'משובש: אין פורטלים כאן',
  'gate.noSpace': 'אין מקום לפורטל',
  'gate.range': 'מחוץ לטווח',
  'gate.noExit': 'קודם הצב יציאה',
  'gateLabel.air': 'אוויר',
  'gateLabel.catch': 'תפיסה',
  'gateLabel.trapdoor': 'מלכודת',
  'gateLabel.door': 'דלת',

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
  'strike.mirror': 'מחזיר',
  'strike.geyser': 'גייזר',
  'strike.drop': 'השלכה',
  'strike.cooldown': 'עוד לא מוכן',
  'strike.noCharge': 'אין טעינה: חיסול עם טריק ממלא אחת',
  'strike.noTarget': 'אין אויב ליד הכוונת',
  'strike.tooClose': 'קרוב מדי',
  'strike.noFloor': 'הוא לא עומד על רצפה',
  'strike.noRoom': 'אין מקום מעליו',
  'strike.anchored': 'הוא לא זז (קודם תהמם אותו)',
  'hint.strikes': '<b>מתקפות</b>: כוונו ליד אויב ולחצו. <b>1 מחזיר</b> מחזיר לו את הכדורים · <b>2 גייזר</b> זורק אותו לשמיים · <b>3 השלכה</b> זורקת אותו מהקצה (או מהשמיים). כל מתקפה עולה טעינה; חיסולים עם טריקים משלכם ממלאים אותה.',
  'hint.strikes.pad': '<b>מתקפות</b>: כוונו ליד אויב ולחצו. <b>R3 מחזיר</b> מחזיר לו את הכדורים · <b>◀ גייזר</b> זורק אותו לשמיים · <b>▶ השלכה</b> זורקת אותו מהקצה.',
  'hint.strikes.touch': '<b>מתקפות</b> (הכפתורים משמאל): כוונו ליד אויב ולחצו. <b>מחזיר</b> מחזיר לו את הכדורים · <b>גייזר</b> זורק אותו לשמיים · <b>השלכה</b> זורקת אותו מהקצה.',
  'ctl.strikes': 'מתקפות: מחזיר / גייזר / השלכה',
  'ctl.strike1': 'מחזיר: הכדורים שלו חוזרים אליו',
  'ctl.strike2': 'גייזר: זורק אותו לשמיים',
  'ctl.strike3': 'השלכה: זורקת אותו מהקצה / מהשמיים',

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

  'touch.rift': 'פורטל',
  'touch.gate': 'שער',
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
  'ctl.aim': 'כיוון היציאה (הזמן מאט)',
  'ctl.place': 'הצבת היציאה',
  'ctl.gate': 'שער: פתיחת הכניסה (אוויר, תפיסה, מלכודת, דלת)',
  'ctl.flip': 'היפוך היציאה (צוהר / דלת)',
  'ctl.dist': 'מרחק באוויר',
  'ctl.close': 'סגירת הפורטל (חותך את מה שבאמצע)',
  'ctl.action': 'פעולה: חיסול, תפיסה, זריקה, השתלטות, מעלית',
  'ctl.vision': 'ראיית פורטל',
  'ctl.clip': 'שמירת קליפ',
  'ctl.photo': 'מצב צילום',
  'ctl.pause': 'הפסקה',
  'key.mouse': 'עכבר',
  'key.rmb': 'קליק ימני (החזקה)',
  'key.lmbAim': 'קליק שמאלי בזמן כיוון',
  'key.lmb': 'קליק שמאלי',
  'key.wheel': 'גלגלת',
  'key.mmb': 'X / לחיצה על הגלגלת',
  'key.space': 'רווח',
  'ctl.padLine':
    'LT כיוון · RT הצבה / שער · LB סגירה · RB דחיפה · A קפיצה · X פעולה · B כריעה · Y היפוך · L3 ריצה · חץ ↓ ראיית פורטל · חץ ↑ צילום · חצים ←/→ מרחק בזמן כיוון, אחרת גייזר / השלכה · R3 מחזיר · View קליפ · Start הפסקה',
  'ctl.touch.left': 'אגודל שמאל',
  'ctl.touch.right': 'צד ימין',
  'ctl.touch.stick': 'תנועה. דחוף עד הסוף כדי לרוץ.',
  'ctl.touch.look': 'גרור כדי להסתכל',
  'ctl.touch.rift': 'החזק וגרור: כיוון היציאה. שחרר: הצבה. החלק אל ✕: ביטול.',
  'ctl.touch.gate': 'פתיחת הכניסה. התווית מראה מה היא תעשה.',
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
