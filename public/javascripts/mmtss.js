WINDOW_WIDTH = $(window).width();
WINDOW_HEIGHT = $(window).height() - 10;
BEATS_PER_LOOP = 16;

// Map an OSC event to an app-specific event.
// {<oscPath>: <event>} map
EVENT_MAP = {
  '/live/beat': 'beat'
}


var socket = io.connect('http://localhost:3000');

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
    console.log(data);
    // Emit events based on OSC messages.
    $(document).trigger(EVENT_MAP[address], args);
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
  cmd = new Command(socket).init();

  cmd.addListener('beat', function(e, opts) {
    pv.trackView.moveMarker(opts.value);
    console.log('beat detected with arg: ' + opts.value);
  });

  $('#play').click(function(e) {
    e.preventDefault();
    cmd.send('/live/play');
  });

  $('#stop').click(function(e) {
    e.preventDefault();
    cmd.send('/live/stop');
  });
  
  $('#test').click(function(e) {
    e.preventDefault();
    cmd.sendBatch([
      ['/live/mute', [0, 1]],
      ['/live/mute', [1, 1]],
      ['/live/mute', [2, 0]]
    ]);
  });
});


