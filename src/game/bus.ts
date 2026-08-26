import { Bus } from '../core/bus';
import type { BusEvents } from './types';

export const bus = new Bus<BusEvents>();
