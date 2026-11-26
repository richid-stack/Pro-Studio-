import { drumLabel, instrumentLabel, type Channel } from '@pro-studio/shared';
import type { IconName } from '../components/Icon';

/** A channel's colour as a CSS value. Channels store a token name such as "ch-3". */
export const channelColor = (c: Pick<Channel, 'color'>): string => `var(--${c.color})`;

/** What kind of sound a channel is, in words: "Kick", "808 sub". */
export const channelKind = (c: Channel): string => (c.type === 'drum' ? drumLabel(c.drum) : instrumentLabel(c.inst));

export const DEFAULT_CHANNEL_DB = -6;

/** The picture on a channel button: a drum for drum channels, a waveform for the 808 and samples, keys for keyboards. */
export const channelIcon = (c: Channel): IconName => {
  if (c.type === 'drum') return 'drum';
  if (c.inst === 'sub' || c.inst === 'sampler' || c.inst === 'chop') return 'wave';
  if (c.inst === 'rhodes' || c.inst === 'organ') return 'keys';
  return 'note';
};

/** Which channel-button colour a channel gets: drums, instruments, and sample-based channels each have one. */
export const channelRole = (c: Channel): 'drum' | 'inst' | 'sample' => (c.type === 'drum' ? 'drum' : c.inst === 'sampler' || c.inst === 'chop' ? 'sample' : 'inst');
