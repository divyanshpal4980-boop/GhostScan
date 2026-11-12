const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 1000MB Buffer Limit
const io = new Server(server, {
  maxHttpBufferSize: 1e9
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  // Device joins a private room using a 4-digit PIN
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Device connected to private room: ${roomId}`);
  });

  // Photo frame goes ONLY to devices in the same room
  socket.on('send_frame', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('new_page', data);
    }
  });

  // Files go ONLY to devices in the same room
  socket.on('send_file', (fileData) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('receive_file', fileData);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});