# Beyond FL: producer-assist features

Goal: let someone who has never made a beat reach an industry-level result, while giving experienced producers tools no mainstream DAW has. Everything here is **planned** unless marked built. Each feature lists the rule it must follow so it stays a tool and not a gimmick.

Design rules for all assist features:

- **Assist, never lock in.** Every generated result is normal, editable project data (notes, clips, automation). Nothing is a black box the user cannot open.
- **Explain.** Each suggestion says why ("this chord keeps the 7th of your last chord", "your 808 and kick overlap at 55 Hz").
- **Genre-aware.** Trap, drill, R&B and Afrobeat have different grids, swing, drum vocabularies and chord habits; defaults come from the genre, not a generic template.
- **Undoable and previewable.** Hover to audition, click to apply, one undo to remove.

Every feature below is registered with a mode (`packages/shared/src/modes.ts`). Beginner mode surfaces the starters and explanations; Pro mode adds the technical controls behind them. See ARCHITECTURE section 5b.

## A. Start a beat from nothing

| Feature | What it does | Status |
| --- | --- | --- |
| **Vibe Starter** | Pick genre, mood and tempo range; get a full loop (drums, 808, chords, melody) with 8 variations. Lock any layer and re-roll the rest. | Genre progressions built in `@pro-studio/shared`; generator planned |
| **Hum / tap / beatbox to MIDI** | Sing a melody, tap a rhythm or beatbox; it becomes notes or drum hits on the grid. Uses the shipped YIN pitch detector and onset detector. | Detectors built and tested; capture UI planned |
| **Song-section builder** | Build intro, verse, hook, bridge and drop from one loop, with genre-appropriate lengths and transitions. | Planned |
| **Learn mode** | Guided lessons that operate the real interface and check what you made. | Planned |

## B. Theory without the theory

| Feature | What it does | Status |
| --- | --- | --- |
| **Harmony guide** | Roll shows scale degrees; out-of-key notes are flagged and can be snapped. | Scale tools built; UI planned |
| **Chord brain** | Click a degree to stamp a diatonic chord; suggests next chords with reasons; detects the chord you are playing and names it (slash chords included). | Chord build / detect built and tested; UI planned |
| **Melody coach** | Scores a melody against the chords (chord-tone landings, leaps, repetition) and offers fixes. | Planned |
| **Key and BPM from any sample** | Drop a sample, see its key and tempo, and have it follow the project. | Pitch detection built; BPM and key-follow planned |

## C. Drums and low end, done properly

| Feature | What it does | Status |
| --- | --- | --- |
| **Hi-hat designer** | Draw the rhythm of rolls, ratchets, triplet bursts and velocity shapes with live preview; genre presets (trap rolls, drill slides, afro shuffles). | Ratchet and roll model exists in the schema; designer planned |
| **808 Doctor** | Detects kick/808 clashes, out-of-key 808s, missing glides and sub that disappears on small speakers; offers one-click fixes (tune to key, sidechain, harmonic layer). | Planned |
| **Groove cloner** | Extracts the timing and velocity feel of a drum loop you drop in and applies it to your pattern. | Onset detection built; apply planned |

## D. Mixing and finishing

| Feature | What it does | Status |
| --- | --- | --- |
| **Mix assistant and masking map** | Shows which channels fight in which frequency range and suggests EQ, level and sidechain moves. | Planned |
| **Reference match** | Drop a reference track; compare loudness, spectrum and stereo width, and get a target curve. | Planned |
| **Mix health check** | Pre-export checks: clipping, true peak, low-end mono-compatibility, DC offset, silence at the ends. Pass or fail with the fix. | Planned |

## E. Samples and sound creation

| Feature | What it does | Status |
| --- | --- | --- |
| **Sample flip lab** | Stem separation (vocals, drums, bass, other), auto-slice on transients, loop finder with crossfaded seam, pitch and time matching to the project. | Slicer and loop finder built; separation planned |
| **Clearance and split-sheet helper** | Tracks which sounds are original, licensed or sampled and generates a split sheet. Informational only, not legal advice. | Planned |
| **AI vocal-chop and instrument maker** | Turn a vocal or any recording into a playable instrument; generate new instrument timbres from a description. | Planned |

## F. Workflow

| Feature | What it does | Status |
| --- | --- | --- |
| **Version timeline and branches** | Every save is a version; branch an idea, compare and merge. | Planned |
| **Retro-record** | Always-listening buffer: play something good before pressing record and it is captured. | Planned |
| **Collaboration** | Realtime co-editing with presence. | Planned |
| **Producer hub export** | One export gives a tagged MP3 with producer tag, stems, and licence PDFs (lease, exclusive). | Planned |
| **Performance mode and phone mode** | Pads and scenes for live use; a touch layout for ideas on the go. | Planned |
| **Command palette and full keyboard control** | Every command searchable and rebindable. | Planned |
| **Accessibility** | Full keyboard operation, screen-reader model for the canvas views, reduced motion, comfortable density. | Contrast gate built; the rest planned |

## Ordering and why

See `docs/ROADMAP.md` Phase 4. The first three items to ship are Vibe Starter, the chord brain and harmony guide, and the hi-hat designer plus 808 Doctor, because they remove the three biggest walls for a new producer: starting, harmony and drums/bass.

## Honesty about AI features

Features that need a model (stem separation, vocal-chop and instrument generation, reference matching) will state what runs on-device and what runs on a server, will show a cost or time estimate before running, and will degrade to a manual tool when the service is unavailable.
