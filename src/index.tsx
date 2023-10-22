import { Component, VNode, render } from 'preact';
import preactLogo from './assets/preact.svg';
import './style.css';
import { useRef } from 'preact/hooks';
import { NoteConfig, midi } from './midi';

interface Props {

}
interface State {
	initialized?: boolean;
}

function pitchShiftNote(data: Uint8Array, semitoneOffset): Uint8Array {
  // Check if it's a note on or note off event
  if (data[0] >= 0x90 && data[0] < 0xA0) {
    // Assuming eventData[1] contains the note number
    const originalNote = data[1];

    // Apply pitch shift (modifying the note number)
    const newNote = originalNote + semitoneOffset;

    // Create a new MIDI message with the modified note number
    const modifiedMessage = Uint8Array.from([
      (data[0] & 0xF0) | (data[0] & 0x0F), // status byte with original channel
      newNote, // modified note number
      data[2] // velocity (assuming it's a note-on message)
    ]);

    return modifiedMessage;
  }

  // If it's not a note on/off event, return null or handle as needed
  return null;
}

export class App extends Component<Props, State> {
	inputs: MIDIInputMap;
	outputs: MIDIOutputMap;

	midiInputOptions: Array<VNode>;
	midiOutputOptions: Array<VNode>;

	onMidiMsg: (evt: MIDIMessageEvent) => void;

	currentInput: MIDIInput;
	currentOutput: MIDIOutput;


	constructor() {
		super();
		
		let j=0;
		for (let i=36; i<52; i++) {
			const cfg = midi.getOrCreateNoteConfig(9, i);
			cfg.replaceChannel = j;
			cfg.replaceNote = 69;
			
			j++;
		}

		this.onMidiMsg = (evt) => {
			if (!this.currentOutput) return; //nowhere to go yet

			const data = evt.data;

			const header = data[0];
			
			//is note on/off evt
			if (header >= 0x90 && header < 0xA0) {
				// The lower 4 bits represent the channel
				const channelId = header & 0x0F;
				const noteId = data[1];

				const nc = midi.getNoteConfig(channelId, noteId);
				// console.log(midi);

				console.log("Note", noteId);
				if (nc) {
					if (nc.replaceChannel !== -1) {
						// Modify the channel (assuming it's a 3-byte message)
						data[0] = (header & 0xF0) | nc.replaceChannel;
					}
					if (nc.replaceNote !== -1) {
						data[1] = nc.replaceNote;
					}
				} else {
					console.log(`ignoring note ${channelId}:${noteId}`);
				}

				this.currentOutput.send(data);
			}

		}
	}

	useMidiInput(input: MIDIInput) {
		if (this.currentInput) {
			this.currentInput.removeEventListener("midimessage", this.onMidiMsg);
		}
		this.currentInput = input;

		input.addEventListener("midimessage", this.onMidiMsg);
	}

	useMidiOutput(output: MIDIOutput) {
		this.currentOutput = output;
	}

	tryInit() {
		if (this.state.initialized) return;

		midi.tryInit().then(()=>{

			this.inputs = midi.ctx.inputs;
			this.outputs = midi.ctx.outputs;
	
			this.midiInputOptions = [
				<option value="none">None</option>
			];
			this.inputs.forEach((mi, k) => {
				this.midiInputOptions.push(<option
					value={k}
				>{mi.name}</option>);
			});
	
			this.midiOutputOptions = [
				<option value="none">None</option>
			];
			this.outputs.forEach((mi, k) => {
				this.midiOutputOptions.push(<option
					value={k}
				>{mi.name}</option>);
			});
	
			this.setState({ initialized: true });
		});

	}

	renderNoteConfig (noteId: number, nc: NoteConfig) {
		return <div className="note">
			<span className="note-id">Note {noteId}</span>
			<div className="field">
				<span className="field-label">Replace Channel With</span>
				<input className="field-input" type="number" value={nc.replaceChannel}/>
			</div>

			<div className="field">
				<span className="field-label">Replace Note With</span>
				<input className="field-input" type="number" value={nc.replaceNote}/>
			</div>

		</div>
	}
	renderConfigs () {
		const results = new Array(midi.channels.size+1);

		let i=0;
		for (const [channelId, ch] of midi.channels) {
			const ncs = new Array(ch.size);
			let j=0;
			for (const [noteId, nc] of ch) {
				ncs[j] = this.renderNoteConfig(noteId, nc);
				j++;
			}
			results[i] = <div className="channel">
				<span className="channel-id">Channel {channelId}</span>
				<div className="channel-content">
				{ncs}
				</div>
			</div>
			i++;
		}

		results[results.length-1] = <div className="channel">
			<span>Add a channel filter</span>
		</div>
		
		return results;
	}

	render() {
		const isr = useRef<HTMLSelectElement>();
		const osr = useRef<HTMLSelectElement>();
		const cr = useRef<HTMLDivElement>();
		return (
			<div className="container">
				<h1 className="title">midi-red</h1>
				<h2 className="subtitle">Redirect midi input using the browser</h2>

				{(this.state.initialized &&
					<div className="selects">
						<span className="lbl">Select a midi input:</span>
						<select
							
							ref={isr}

							onChange={(evt) => {
								const opts = isr.current.selectedOptions;
								if (opts.length < 1) return;

								const first = opts[0];
								const k = first.value;

								const v = this.inputs.get(k);

								console.log(k, v);

								this.useMidiInput(v);
							}}>{this.midiInputOptions}</select>
						
						<span className="lbl">Select a midi output:</span>
						<select
							ref={osr}

							onChange={(evt) => {
								const opts = osr.current.selectedOptions;
								if (opts.length < 1) return;

								const first = opts[0];
								const k = first.value;

								const v = this.outputs.get(k);

								console.log(k, v);

								this.useMidiOutput(v);
							}}>{this.midiOutputOptions}</select>

							<div className="channels"
								ref={cr}
								onWheel={(e)=>{
									if (e.target !== cr.current) return;
								e.preventDefault();
								const container = e.target as HTMLDivElement;
								const sl = container.scrollLeft;
								container.scrollTo({
									top: 0,
									left: sl + e.deltaY,
									behavior: "smooth"
								});
							}}
							>
							{this.renderConfigs()}
							</div>
					</div>
				) || (
						<button
							onClick={() => this.tryInit()}
						>Init Web Midi</button>
					)}

			</div>
		);
	}
}

render(<App />, document.getElementById('app'));
