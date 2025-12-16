# 🎼 Pentagramma - Interactive MIDI Piano Trainer

An interactive web application for piano learning that loads MIDI files, renders them as musical notation in Grand Staff format, and provides real-time feedback when playing with a connected MIDI keyboard.

## ✨ Features

- 📄 **MIDI File Upload** - Load any .mid/.midi file
- 🎹 **Grand Staff Rendering** - Professional musical notation with VexFlow
- 🎵 **MIDI Playback** - Play/Pause/Stop controls with Tone.js
- 🎹 **MIDI Keyboard Support** - Connect your keyboard via WebMIDI API
- ✅ **Real-Time Feedback** - Visual feedback (green = correct, red = wrong, gray = preview)
- ⚡ **Low Latency** - Web Worker-based matching engine (<50ms)
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Chrome or Edge browser (for WebMIDI support)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## 📖 Usage

1. **Upload a MIDI File**: Click the "Upload MIDI" button and select a .mid file
2. **View the Score**: The Grand Staff notation will appear automatically
3. **Play the MIDI**: Use Play/Pause/Stop controls to hear the piece
4. **Connect MIDI Keyboard**: Click "Connect MIDI" to use your physical keyboard
5. **Practice**: Play along and receive instant visual feedback!

## 🏗️ Tech Stack

- **Framework**: Next.js 15 with React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Music Notation**: VexFlow
- **MIDI Parsing**: @tonejs/midi
- **Audio Playback**: Tone.js
- **MIDI Input**: WebMIDI API
- **Real-time Processing**: Web Workers

## 📁 Project Structure

```
pentagramma/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Homepage
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Layout/           # Header, layout components
│   ├── Score/            # GrandStaff, FeedbackOverlay
│   ├── Upload/           # MIDIUploader
│   ├── Playback/         # PlaybackControls
│   ├── MIDI/             # MIDI device components
│   └── License/          # License modal (future)
├── lib/                  # Core libraries
│   ├── types/           # TypeScript definitions
│   ├── midi/            # MIDI parsing, WebMIDI
│   ├── vexflow/         # VexFlow rendering
│   ├── playback/        # Audio playback manager
│   ├── matching/        # Note matching algorithm
│   └── feedback/        # Feedback rendering
├── hooks/               # React hooks
├── workers/             # Web Workers
└── public/              # Static assets
```

## 🎯 Roadmap

- [ ] Server-side license system with Supabase
- [ ] Playhead synchronization with score
- [ ] Enhanced note quantization
- [ ] Rest calculation
- [ ] Visual playhead on score
- [ ] Advanced tempo mapping
- [ ] Key signature detection
- [ ] Mobile support
- [ ] Practice statistics
- [ ] User accounts

## ⚠️ Browser Compatibility

- ✅ **Chrome/Edge**: Full support including WebMIDI
- ⚙️ **Firefox**: Limited (no WebMIDI support)
- ⚠️ **Safari**: Limited (partial WebMIDI support)

For best experience, use Chrome or Edge with a connected MIDI keyboard.

## 📝 License

Private project - All rights reserved

## 🤝 Contributing

This is a personal learning project. Feedback and suggestions are welcome!

---

Built with ❤️ for piano students everywhere
