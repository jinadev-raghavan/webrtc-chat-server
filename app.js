
var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');
var open = require('open');
let isLocal = process.env.PORT == null;
var serverPort = (process.env.PORT  || 4443);
var server = null;
if (isLocal) {
  server = require('http').createServer(app);
} else {
  server = require('http').createServer(app);
}
var io = require('socket.io')(server);

let socketIdToNames = {};
//------------------------------------------------------------------------------
//  Serving static files
app.get('/', function(req, res){
  console.log('get /');
  res.sendFile(__dirname + '/index.html');
});

server.listen(serverPort, function(){
  console.log('server is running in port', serverPort);
  if (isLocal) {
    open('http://192.168.0.28:' + serverPort)
  }
});

//------------------------------------------------------------------------------
//  WebRTC Signaling
function socketIdsInRoom(roomId) {
  var socketIds = io.nsps['/'].adapter.rooms[roomId];
  if (socketIds) {
    var collection = [];
    for (var key in socketIds) {
      collection.push(key);
    }
    return collection;
  } else {
    return [];
  }
}

io.on('connection', function(socket){
  console.log('Connection');
  socket.on('disconnect', function(){
    console.log('Disconnect');
    delete socketIdToNames[socket.id];
    if (socket.room) {
      var room = socket.room;
      io.to(room).emit('leave', socket.id);
      socket.leave(room);
    }
  });

  /**
   * Callback: list of {socketId, name: name of user}
   */
  socket.on('join', function(joinData, callback){ //Join room
    let roomId = joinData.roomId;
    let name = joinData.name;
    socket.join(roomId);
    socket.room = roomId;
    socketIdToNames[socket.id] = name;
    var socketIds = socketIdsInRoom(roomId);
    let friends = socketIds.map((socketId) => {
      return {
        socketId: socketId,
        name: socketIdToNames[socketId]
      }
    }).filter((friend) => friend.socketId != socket.id);
    callback(friends);
    //broadcast
    friends.forEach((friend) => {
      io.sockets.connected[friend.socketId].emit("join", {
        socketId: socket.id, name
      });
    });
    console.log('Join: ', joinData);
  });

  socket.on('exchange', function(data){
    console.log('exchange', data);
    data.from = socket.id;
    var to = io.sockets.connected[data.to];
    to.emit('exchange', data);
  });

  socket.on("count", function(roomId, callback) {
    var socketIds = socketIdsInRoom(roomId);
    callback(socketIds.length);
  });

});
