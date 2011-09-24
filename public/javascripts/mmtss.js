WINDOW_WIDTH = $(window).width();
WINDOW_HEIGHT = $(window).height() - 10;
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

INSTRUMENT_GROUPS = {
  'bass':[1],
  'pads':[2,3],
  'repeater':[4,5],
  'chorus':[6,7,8],
  'twang':[9,10],
  'beat':[11]
}

CLIP_COUNTER = {}

NUM_INSTRUMENTS = 11;

function getGroup(trk) {
  for (var group in INSTRUMENT_GROUPS) {
    if (_.include(INSTRUMENT_GROUPS[group], trk)) {
      return group;
    }
  }
}

function Instrument(trkNum) {
  this.trackNum = trkNum;
}

function nextInstrument() {
   State.prevTrack = State.currentTrack;
   eligibleGroups = _.without(_.keys(INSTRUMENT_GROUPS), getGroup(State.prevTrack));
   currentGroup = eligibleGroups[Math.floor(Math.random()*5)];
   State.currentTrack = INSTRUMENT_GROUPS[currentGroup][Math.floor(Math.random()*INSTRUMENT_GROUPS[currentGroup].length)];
}

function getInputTrack(trk) {
  return trk + NUM_INSTRUMENTS;
}

function stopClipsInGroup() {
  insts = INSTRUMENT_GROUPS[getGroup(State.currentTrack)];
  for (var i in insts) {
    cmd.stopClip(insts[i]);
  }
}

/**
 * Command - Wrapper around socket to send messages.
 */
function Command(sock) {
  this.socket = sock;
}

Command.prototype.init = function() {
  this.socket.on('message', function (data) {
    console.log('Server message: '+data);
  });
  this.socket.on('osc_response', function(data) {
    var address = data._address;
    var args = data._args;
    //console.log(data);
    // Emit events based on OSC messages.
    $(document).trigger(EVENT_MAP[address], [args]);
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
 */
Command.prototype.send = function(path, argArr) {
  if (!argArr instanceof Array) {
    argArr = [argArr];
  }
  var msgObj = {
    address: path,
    args: argArr
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

Command.prototype.stopClip = function(trk) {
  this.send('/live/stop/track', [trk]);
}

Command.prototype.storeClip = function(trk) {
  this.send('/live/play/clipslot', [trk, CLIP_COUNTER[trk]]);
}

Command.prototype.newClip = function(trk) {
  if (CLIP_COUNTER[trk] === undefined) {
      CLIP_COUNTER[trk] = 0;
  } else {
    CLIP_COUNTER[trk] = CLIP_COUNTER[trk]+1;
  }
  this.send('/live/play/clipslot', [trk, CLIP_COUNTER[trk]]);
}

/**
 * @param trk TrkId
 * @param mute 1 or 0
 */
Command.prototype.muteTrack = function(trk, mute) {
  this.send('/live/mute', [getInputTrack(trk), mute]);
}

/**
 * Manages playhead objects
 */
function PlayerView() {
  this.r = new Raphael('viewport', WINDOW_WIDTH, WINDOW_HEIGHT);
  this.trackView = new TrackView(this.r);
}
PlayerView.prototype.render = function() {
  this.trackView.render();
}

/**
 * Manages track objects: timeline, marker.
 */
function TrackView(r) {
  this.r = r;
  this.timeline = null;
  this.timeMarker = null;

  return this;
}

/**
 * Draws our track objects
 */
TrackView.prototype.render = function() {
  this.timeline = this.r.rect(0, 0, WINDOW_WIDTH*2/3, WINDOW_HEIGHT/2);
  this.timeline.attr({fill: 'blue'});
  var tbox = this.timeline.getBBox();
  // Draw the timeline marker line
  var timeMarkerPath = "M"+tbox.x+","+tbox.y+"L"+tbox.x+","+(tbox.y+tbox.height);
  this.timeMarker = this.r.path(timeMarkerPath).attr({stroke: 'red'});

  return this;
}

/**
 * Push the marker according to the beat.
 * The timeline marker should increment to beat / BEATS_PER_LOOP
 * percent of the timeline width.
 */
TrackView.prototype.moveMarker = function(beat) {
  var tlBbox = this.timeline.getBBox();
  var markBbox = this.timeMarker.getBBox();
  var markX = markBbox.x;
  var newX = beat / BEATS_PER_LOOP * tlBbox.width;
  this.timeMarker.translate(newX - markX);
}

$(window).ready(function() {
  pv = new PlayerView();
  pv.render();

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
  opts = opts[0];
  pv.trackView.moveMarker(opts.value);
  
  // On beat 0, send loopbegin event to the fsm
  if ((opts.value == 0) && (fsm.current == 'wait')) {
      fsm.loopbegin();
  } else if ((opts.value == 31) && (fsm.current == 'record')) {
      fsm.loopend();
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
      cmd.newClip(State.currentTrack);

      // ----- when I hear beat 0
      // ----- fsm.loopbegin()
    },
    onenterrecord: function(e, f, t) {
      // entered with event "loopbegin"
      cmd.storeClip(State.currentTrack);

      nextInstrument();

      // when I hear beat 0
      // emit loopend (fsm.loopend())
      console.log('now in state ' + t);
    },
    onenterpractice: function(e, f, t) {
      cmd.muteTrack(State.prevTrack, 1);
      cmd.muteTrack(State.currentTrack, 0);
      // stop any clips in getInstrumentGroup(newtrk)
      stopClipsInGroup();
      console.log('now in state ' + t);
    }
  }
});
