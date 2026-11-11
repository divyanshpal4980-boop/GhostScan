const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8 // 100MB buffer for high-res images
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Device connected:', socket.id);

  // Phone se image aane par laptop browser ko forward karega
  socket.on('send_frame', (data) => {
    io.emit('new_page', data);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server is running on port 3000');
});