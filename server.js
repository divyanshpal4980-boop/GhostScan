const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 1000MB (1 GB) Buffer Limit
const io = new Server(server, {
  maxHttpBufferSize: 1e9 // 1,000,000,000 bytes (~1000 MB)
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  // Mobile Camera scanner frame
  socket.on('send_frame', (data) => {
    socket.broadcast.emit('new_page', data);
  });

  // Universal Two-Way File Transfer (Phone <-> Laptop)
  socket.on('send_file', (fileData) => {
    socket.broadcast.emit('receive_file', fileData);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GhostScan Server running on port ${PORT}`);
});