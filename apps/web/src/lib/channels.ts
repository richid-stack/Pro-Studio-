import { drumLabel, instrumentLabel, type Channel } from '@pro-studio/shared';

/** A channel's colour as a CSS value. Channels store a token name such as "ch-3". */
export const channelColor = (c: Pick<Channel, 'color'>): string => `var(--${c.color})`;

/** What kind of sound a channel is, in words: "Kick", "808 sub". */
export const channelKind = (c: Channel): string => (c.type === 'drum' ? drumLabel(c.drum) : instrumentLabel(c.inst));

export const DEFAULT_CHANNEL_DB = -6;
