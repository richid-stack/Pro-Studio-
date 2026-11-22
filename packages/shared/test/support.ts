import type { DrumName } from '../src/index';

/** The drums the engine renders. Kept here so shared tests do not import the engine. */
export const DRUM_NAMES_FOR_TEST: readonly DrumName[] = ['kick', 'snare', 'clap', 'hat', 'ohat', 'rim'];
