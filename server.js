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

// Active devices tracked by their fresh session PIN: { [pin]: { socketId, targetPin, roomId } }
const activeDevices = {};

function generateUniquePin() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (activeDevices[pin]);
  return pin;
}

io.on('connection', (socket) => {
  // Assign a fresh, unique 4-digit PIN every time a device connects/refreshes
  const myPin = generateUniquePin();
  socket.myPin = myPin;
  activeDevices[myPin] = {
    socketId: socket.id,
    targetPin: null,
    roomId: null
  };

  socket.emit('assigned_pin', myPin);

  // Mutual Dual-PIN Pairing Request
  socket.on('pair_request', (enteredPartnerPin) => {
    const partnerPin = String(enteredPartnerPin || '').trim();
    const me = activeDevices[socket.myPin];
    if (!me) return;

    if (partnerPin === socket.myPin) {
      socket.emit('pair_status', { ok: false, msg: 'Apna hi PIN nahi, dusre device ka PIN daalein! 😅' });
      return;
    }

    // Leave any previous room if re-pairing
    if (me.roomId) {
      socket.leave(me.roomId);
      me.roomId = null;
    }

    me.targetPin = partnerPin;
    const partner = activeDevices[partnerPin];

    if (!partner) {
      socket.emit('pair_status', {
        ok: false,
        msg: `⏳ Waiting... Dusre device par PIN ${socket.myPin} daalein (ya PIN ${partnerPin} check karein).`
      });
      return;
    }

    // Check if partner has ALSO entered myPin
    if (partner.targetPin === socket.myPin) {
      const roomId = `pair_${[socket.myPin, partnerPin].sort().join('_')}`;
      const partnerSocket = io.sockets.sockets.get(partner.socketId);

      if (partnerSocket) {
        socket.join(roomId);
        partnerSocket.join(roomId);

        me.roomId = roomId;
        partner.roomId = roomId;

        socket.emit('paired_success', { partnerPin });
        partnerSocket.emit('paired_success', { partnerPin: socket.myPin });
      }
    } else {
      socket.emit('pair_status', {
        ok: false,
        msg: `⏳ Waiting for device (${partnerPin}) to enter your PIN (${socket.myPin})...`
      });

      const partnerSocket = io.sockets.sockets.get(partner.socketId);
      if (partnerSocket) {
        partnerSocket.emit('incoming_pair_hint', { fromPin: socket.myPin });
      }
    }
  });

  // Camera frame goes ONLY to paired partner
  socket.on('send_frame', (data) => {
    const me = activeDevices[socket.myPin];
    if (me && me.roomId) {
      socket.to(me.roomId).emit('new_page', data);
    }
  });

  // Files go ONLY to paired partner
  socket.on('send_file', (fileData) => {
    const me = activeDevices[socket.myPin];
    if (me && me.roomId) {
      socket.to(me.roomId).emit('receive_file', fileData);
    }
  });

  socket.on('disconnect', () => {
    const me = activeDevices[socket.myPin];
    if (me) {
      if (me.roomId) {
        socket.to(me.roomId).emit('partner_disconnected');
      }
      delete activeDevices[socket.myPin];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});