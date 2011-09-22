var socket = io.connect('http://localhost:3000');

$(window).ready(function() {
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
  $('#logarea').append('<div>'+data+'</div>')
});
