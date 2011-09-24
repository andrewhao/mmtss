BEATS_PER_LOOP = 32;

// Map an OSC event to an app-specific event.
// {<oscPath>: <event>} map
EVENT_MAP = {
  '/live/beat': 'beat'
}

State = {
  prevTrack: 10,
  currentTrack: 11
}

SHAKER = [0]
INST_BASS = [1]
INST_PADS = [2, 3]
INST_ARPEGGIATOR = [4, 5]
INST_CHORAL = [6, 7, 8]
INST_STRING = [9, 10]
INST_DRUMS = [11]

INSTRUMENT_TRACKS = {
  1: {
    name: "bass"
  },
  2: {
    name: "pad1"
  },
  3: {
    name: "pad2"
  },
  4: {
    name: "arp1"
  },
  5: {
    name: "arp2"
  },
  6: {
    name: "choral1"
  },
  7: {
    name: "choral2"
  },
  8: {
    name: "choral3"
  },
  9: {
    name: "string1"
  },
  10: {
    name: "string2"
  },
  11: {
    name: "drums"
  }
}

NUM_INSTRUMENTS = _.keys(INSTRUMENT_TRACKS).length;

function Instrument(trkNum) {
  this.trackNum = trkNum;
}

/** STUB */
function getNextInstrument() {
  return State.currentTrack - 1;
}

function getInputTrack(trk) {
  return trk + NUM_INSTRUMENTS;
}

/** STUB */
function deleteClipsInGroup() {
  return null;
}

/**
 * Command - Wrapper around socket to send messages.
 */
function Command(sock) {
  this.socket = sock;
  this.callbacks = {};
}

Command.prototype.init = function() {
  this.socket.on('message', function (data) {
    console.log('Server message: '+data);
  });
  var cmdObj = this;
  this.socket.on('osc_response', function(data) {
    var address = data._address;
    var args = data._args;
    
    // Fire any associated callbacks.
    if (cmdObj.callbacks[address] !== undefined) {
      var cbList = cmdObj.callbacks[address];
      _.each(cbList, function(cb) {
        cb.call(this, data);
      });
      // Clear the callback entry.
      cmdObj.callbacks[address] = [];
    }

    // Emit events based on OSC messages.
    if (EVENT_MAP[address] !== undefined) {
      $(document).trigger(EVENT_MAP[address], args);
    }
  });
  return this;
}

/**
 * Add a CB to handle an event.
 * e.g. a 'beat' callback will know how to increment the
 * Time slider
 */
Command.prototype.addListener = function(ev, cb) {
  $(document).bind(ev, cb);
}

/**
 * Expects:
 * @param address OSC message path address
 * @param argArr List of arguments to pass to the method.
 *   If this is a non-Array type, it will be assumed to be an
 *    one-argument array
 *   This can be left empty in lieu of arguments.
 *
 * Usage:
 *   sendMessage('/live/play')
 *   sendMessage('/live/tempo', 50)
 *   sendMessage('/live/clip/info', [0, 1])
 *
 * @param {String} path The command path
 * @param {Array} argArr An array of arguments to pass to the command
 * @param {Function} cb Callback method to execute when the
 *   server response returns.
 */
Command.prototype.send = function(path, argArr, cb) {
  if (!argArr instanceof Array) {
    argArr = [argArr];
  }
  var msgObj = {
    address: path,
    args: argArr
  }
  
  if (cb !== undefined) {
    // Add callback to method stack.
    if (this.callbacks[path] === undefined) {
      this.callbacks[path] = [cb];
    } else {
      this.callbacks[path].push(cb);
    }
  }
  
  this.socket.emit('osc_command', msgObj);
}

/**
 * Expect arguments in batch object to be of form:
 * {<path>: [<arg1>, <arg2>]}
 */
Command.prototype.sendBatch = function(batch) {
  for (var i in batch) {
    console.log('===== SENDING BATCH =====');
    console.log('path: ' + batch[i][0]);
    console.log('args: ' + batch[i][1]);
    this.send(batch[i][0], batch[i][1]);
  }
}

Command.prototype.doClip = function(trk) {
  this.send('/live/play/clipslot', [trk, 1])
}

/**
 * @param trk track id
 * @param mute 1 or 0
 */
Command.prototype.muteTrack = function(trk, mute) {
  this.send('/live/mute', [getInputTrack(trk), mute]);
}

/**
 * Manages playhead objects
 */
function PlayerView(viewportEl) {
  this.viewport = viewportEl;
  this.r = new Raphael('viewport', this.viewport.width(), this.viewport.height());
  this.trackView = new TrackView(this.r, viewportEl);
}
PlayerView.prototype.render = function() {
  this.trackView.render();
  return this;
}

/**
 * Manages track objects: timeline, marker.
 */
function TrackView(r, viewportEl) {
  this.r = r;
  this.viewport = viewportEl;
  this.timeline = null;
  this.timeMarker = null;

  this.squares = this.r.set();

  return this;
}

/**
 * Draws our track objects
 */
TrackView.prototype.render = function() {
  // Draw 32 squares in an 8x4 grid.
  RECT_SPACING = 20;
  RECT_LENGTH = this.viewport.width() / 10;
  NUM_COLS = 8;
  
  for (var i = 0; i < BEATS_PER_LOOP / NUM_COLS; i++) {
    var y = i * (RECT_LENGTH + RECT_SPACING);
    for (var j = 0; j < NUM_COLS; j++) {
      var x = j * (RECT_LENGTH + RECT_SPACING);
      var sq = this.r.rect(x, y, RECT_LENGTH, RECT_LENGTH);
      sq.attr({ fill: 'black' })
      this.squares.push(sq);      
    }
  }

  return this;
}

/**
 * Push the marker according to the beat.
 * The timeline marker should increment to beat / BEATS_PER_LOOP
 * percent of the timeline width.
 *
 * Rendered as a grid of boxes that change color according to their.
 */
TrackView.prototype.moveMarker = function(beat) {
  // When resetting the marker, clear the other squares.
  if (beat == 0) {
    _.each(this.squares, function(s) {
      s.attr({fill: 'black'})
    })
  }
  // Draw a fill on the previous squares.
  for (var i = 0; i <= beat; i++) {
    this.squares[i].animate({
      fill: 'yellow'
    }, 200);
  }
}

$(window).ready(function() {
  pv = new PlayerView($('#viewport')).render();

  $('#play').click(function(e) {
    e.preventDefault();
    cmd.send('/live/play');
  });

  $('#stop').click(function(e) {
    e.preventDefault();
    cmd.send('/live/stop');
  });

  $('#recordready').click(function(e) {
    e.preventDefault();
    fsm.recordready();
  });
});

var socket = io.connect('http://localhost:3000');
cmd = new Command(socket).init();

// When we hear a beat, then move the marker
cmd.addListener('beat', function(e, opts) {
  pv.trackView.moveMarker(opts.value);
  
  // On beat 0, send loopbegin event to the fsm
  if (opts.value == 0) {
    if (fsm.current == 'wait') {
      fsm.loopbegin();
    } else if (fsm.current == 'record') {
      fsm.loopend();
    }
  }
});

/*
 * STATE MACHINE DEFINITION
 * Keep track of app state and logic.
 */
var fsm = StateMachine.create({
  initial: 'practice',
  events: [
    // When the user indicates they want to record a track, they're done practicing.
    { name: 'recordready', from: 'practice', to: 'wait' },
    // When the track has begun.
    { name: 'loopbegin', from: 'wait', to: 'record' },
    // When the track has finished recording.
    { name: 'loopend', from: 'record', to: 'practice' }
  ],
  callbacks: {
    onenterwait: function(e, f, t) {
      // you entered with event "recordready"
      // from practice
      console.log('now in state ' + t);
      cmd.doClip(State.currentTrack);

      // ----- when I hear beat 0
      // ----- fsm.loopbegin()
    },
    onenterrecord: function(e, f, t) {
      // entered with event "loopbegin"
      cmd.doClip(State.currentTrack);

      State.prevTrack = State.currentTrack;
      State.currentTrack = getNextInstrument();

      // when I hear beat 0
      // emit loopend (fsm.loopend())
      console.log('now in state ' + t);
    },
    onenterpractice: function(e, f, t) {
      cmd.muteTrack(State.prevTrack, 1);
      cmd.muteTrack(State.currentTrack, 0);
      // delete any clips in getInstrumentGroup(newtrk)
      deleteClipsInGroup();
      console.log('now in state ' + t);
    }
  }
});
