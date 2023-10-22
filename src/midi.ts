
export interface NoteConfig {
	/** -1 means don't replace the note, otherwise the note is replaced with the number*/
	replaceNote: number;
	/**Which channel to output to, -1 will keep channel*/
	replaceChannel: number;
	/**Minimum note to accept, -1 = no minimum*/
	// minNote: number;
	/**Maximum note to accept, -1 = no maximum*/
	// maxNote: number;
}

export type NoteMap = Map<number, NoteConfig>;
export type ChannelMap = Map<number, NoteMap>;

export const midi = {
  ctx: null as MIDIAccess,

  channels: new Map() as ChannelMap,
  channelCached: null as NoteMap,
  channelCachedId: null as number,
  noteCached: null as NoteConfig,
  noteCachedId: null as number,

  async tryInit() {
		if (midi.ctx !== null) return Promise.reject("Already initialized");

    const ctx = await navigator.requestMIDIAccess();

    midi.ctx = ctx;
	},

  has (channelId: number) {
    return midi.channels.has(channelId);
  },
  get (channelId: number) {
    if (channelId === midi.channelCachedId) return midi.channelCached;
    const result = midi.channels.get(channelId);
    midi.channelCached = result;
    midi.channelCachedId = channelId;
    return result;
  },
  getOrCreate (channelId: number) {
    let result = midi.get(channelId);
    if (!result) {
      result = new Map();
      midi.channels.set(channelId, result);
      midi.channelCached = result;
      midi.channelCachedId = channelId;
    }
    return result;
  },
  hasNoteConfig (channelId: number, noteId: number) {
    const ch = midi.channels.get(channelId);
    if (!ch) return false;
    return ch.has(noteId);
  },
  getNoteConfig (channelId: number, noteId: number) {
    if (channelId === midi.channelCachedId && noteId === midi.noteCachedId) return midi.noteCached;
    const ch = midi.get(channelId);
    if (!ch) return undefined;
    const result = ch.get(noteId);
    midi.noteCachedId = noteId;
    midi.noteCached = result;
    return result;
  },
  getOrCreateNoteConfig (channelId: number, noteId: number) {
    if (channelId === midi.channelCachedId && noteId === midi.noteCachedId) return midi.noteCached;
    const ch = midi.getOrCreate(channelId);
    let result = ch.get(noteId);
    if (!result) {
      result = {} as NoteConfig;
      ch.set(noteId, result);
    }
    midi.noteCachedId = noteId;
    midi.noteCached = result;
    return result;
  }
};
