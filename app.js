// import module
// also req: jade
var osc = require('osc4node');
var express = require('express');
var sys = require('sys');


SERVER_PORT = 9001
CLIENT_PORT = 9000

// create osc server and client
var oscServer = new osc.Server(SERVER_PORT, 'localhost')
  , oscClient = new osc.Client('localhost', CLIENT_PORT);

console.log('OSC Server set up, listening on port '  + SERVER_PORT);
console.log('OSC Client set up, listening on port '  + CLIENT_PORT);


var message = new osc.Message('/live/time');
sys.puts("sending message" + sys.inspect(message));
oscServer.send(message, oscClient);

var web = express.createServer();

web.configure(function(){
    web.set('views', __dirname + '/views');
    web.set('view engine', 'jade');
    web.use(express.bodyParser());
    web.use(express.methodOverride());
    web.use(web.router);
    web.use(express.static(__dirname + '/public'));
});

web.get('/', function(req, res) {
  res.render('index', {
    title: 'mmtss'
  });
});

var io = require('socket.io').listen(web);
web.listen(3000, 'localhost');
console.log('Web server listening on %s:%d', 'localhost', 3000);

/**
 * We define our own message syntax:
 * {address {str}
 *  type {str: i|f|s|a
 *  args: [] tuples: [<val, type>]
 */
sendMessage = function(msg) {
    var args = msg.args;
    var address = msg.address;
    var typ = msg.type;

    var param = null;

    if (typ == 'i') {
        param = parseInt(args);
    } else if (typ == 'f') {
        param = parseFloat(args);
    } else if (typ == 's') {
        param = msg.args
    }

    var oscMsg = new osc.Message(address, param)
    oscServer.send(oscMsg, oscClient);
};


io.sockets.on('connection', function(socket) {
  sys.puts('Web browser connected');
  socket.send('hey, you connected to me the server.');
  socket.on('message', function(msg) {
    sys.puts("receiving from browser: " + msg);
    msg = JSON.parse(msg);
    console.log('msg rcv from client was: ' + sys.inspect(msg));
    sendMessage(msg);
  });

  oscServer.on('oscmessage', function(msg, rinfo) {
    sys.puts(sys.inspect(msg));
    //debugger;
    socket.send('OSCMSG' + sys.inspect(msg));
  });

});