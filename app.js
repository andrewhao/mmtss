// import module
var osc = require('osc4node');
var sys = require('sys');

SERVER_PORT = 9000
CLIENT_PORT = 9001

// create osc server and client
var oscServer = new osc.Server(SERVER_PORT, 'localhost')
  , oscClient = new osc.Client('localhost', CLIENT_PORT);

debugger;

// create osc message
var message = new osc.Message('/live/tempo', '123.00');
sys.puts("here");

// send
oscServer.send(message, oscClient);
sys.puts("heree");

// oscServer dispatches 'oscmessage' event when receives the message.
// so we attach handler on the event for global message handling.
oscServer.on('oscmessage', function(msg, rinfo) {
  console.log(msg);
});