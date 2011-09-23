- mmtss is a loop station built for live performances.

It wraps Ableton around a Web wrapper using a Webkit view, backed by nodejs and
socket.io. Communication is done via LiveOSC

### Installation

* Make sure you have npm installed: http://www.npmjs.org
* Copy `lib/LiveOSC` into `/Applications/Live x.y.z OS X/Live.app/Contents/App-Resources/MIDI\ Remote\ Scripts/`
folder
* Set it as your MIDI remote in the Ableton Live Preferences pane, in the "MIDI Remote" tab.
* Do `npm install` from the project root.
* Run `node app.js` from the root directory.
* Open a Web browser and visit `localhost:3000`

### Credits

* Design and architectural inspiration taken from vtouch: github.com/vnoise/vtouch.
* LiveOSC source is found at: http://monome.q3f.org/browser/trunk/LiveOSC

### License
MIT and GPL licensed. Go for it.
