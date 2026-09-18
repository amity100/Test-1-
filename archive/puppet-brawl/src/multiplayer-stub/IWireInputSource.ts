import { Vector3 } from 'three';
export type StrikeLimb = 'leftHand' | 'rightHand';
export type WireInputFrame = { crossTarget: Vector3; activeLimb: StrikeLimb; strikeHeld: boolean; strikeTarget: Vector3; releaseVelocity: Vector3; switchRequested?: boolean };
export interface IWireInputSource { update(dt: number): WireInputFrame; }
export interface NetworkInputFrame extends WireInputFrame { tick: number; playerId: string; }
export interface ReplayInputFrame extends WireInputFrame { playbackTime: number; }
