const { Server } = require('socket.io');
const logger = require('../modules/logger');

let io = null;

function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    
    io.on('connection', (socket) => {
        logger.info(`Socket client connected: ${socket.id}`);
        
        // Join activation room
        socket.on('join-room', (room) => {
            socket.join(room);
            logger.info(`Socket ${socket.id} joined room: ${room}`);
        });
        
        // Broadcast message
        socket.on('broadcast', (data) => {
            logger.info(`Broadcast from ${socket.id}: ${data.message}`);
            socket.broadcast.emit('broadcast', data);
        });
        
        // Webhook spam progress
        socket.on('spam-progress', (data) => {
            socket.broadcast.emit('spam-update', data);
        });
        
        // Disconnect
        socket.on('disconnect', () => {
            logger.info(`Socket client disconnected: ${socket.id}`);
        });
        
        // Error handling
        socket.on('error', (error) => {
            logger.error(`Socket error: ${socket.id}`, { error: error.message });
        });
    });
    
    return io;
}

function getIO() {
    return io;
}

function broadcastToAll(event, data) {
    if (io) {
        io.emit(event, data);
    }
}

function broadcastToRoom(room, event, data) {
    if (io) {
        io.to(room).emit(event, data);
    }
}

module.exports = {
    initializeSocket,
    getIO,
    broadcastToAll,
    broadcastToRoom
};