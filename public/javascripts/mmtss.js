WINDOW_WIDTH = $(window).width();
WINDOW_HEIGHT = $(window).height() - 10;
BEATS_PER_LOOP = 16;

var socket = io.connect('http://localhost:3000');

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

$(document).bind('beat', function(e, opts) {
    pv.trackView.moveMarker(opts.value);
    console.log('beat detected with arg: ' + opts.value);
});

$(window).ready(function() {

  pv = new PlayerView();
  pv.render();

  $(':submit').click(function(e) {
    e.preventDefault();
    var msg = {
        address: $('#address').val(),
        type: $('#typ').val(),
        args: $('#args').val()
    };
    socket.send(JSON.stringify(msg));
  });
});

socket.on('message', function (data) {
  console.log(data);

  var msgObj = JSON.parse(data);
  var sender = msgObj.sender;
  var dataObj = msgObj.body;

  if (sender == "OSCMSG") {
      var address = dataObj._address;
      var args = dataObj._args;

      // Emit events based on OSC messages.
      switch(address) {
      case '/live/beat':
          $(document).trigger('beat', args);
          break;
      }
  }
  //$('#logarea').prepend('<div>'+data+'</div>')
});

