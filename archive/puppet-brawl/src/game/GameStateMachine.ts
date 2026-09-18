export type GameMode='training'|'campaign'|'endless'; export type GameScreen='menu'|'match'|'result';
export class GameStateMachine { screen:GameScreen='match'; mode:GameMode='campaign'; setMode(mode:GameMode){this.mode=mode;this.screen='match';} showResult(){this.screen='result';} restart(){this.screen='match';} }
