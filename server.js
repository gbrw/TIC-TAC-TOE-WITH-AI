const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: PORT,
        activeRooms: rooms.size,
        activePlayers: players.size,
        message: '🎮 Tic Tac Toe Server is running!'
    });
});

app.get('/api/stats', (req, res) => {
    res.json({
        rooms: rooms.size,
        players: players.size,
        timestamp: new Date().toISOString()
    });
});

// Game storage
const rooms = new Map();
const players = new Map();

// Game Room Class
class GameRoom {
    constructor(id, hostId, hostName) {
        this.id = id;
        this.players = [{
            id: hostId,
            name: hostName,
            symbol: 'X',
            isHost: true
        }];
        this.board = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.isGameActive = false;
        this.scores = { X: 0, O: 0, tie: 0 };
        this.gameStarted = false;
        this.spectators = [];
        this.chat = [];
        this.createdAt = new Date();
    }

    addPlayer(playerId, playerName) {
        if (this.players.length < 2) {
            this.players.push({
                id: playerId,
                name: playerName,
                symbol: 'O',
                isHost: false
            });
            return true;
        }
        return false;
    }

    addSpectator(spectatorId, spectatorName) {
        this.spectators.push({
            id: spectatorId,
            name: spectatorName,
            joinedAt: new Date()
        });
    }

    removePlayer(playerId) {
        this.players = this.players.filter(player => player.id !== playerId);
        this.spectators = this.spectators.filter(spectator => spectator.id !== playerId);
        
        if (this.players.length === 0) {
            return true;
        }
        
        if (this.players.length === 1 && !this.players[0].isHost) {
            this.players[0].isHost = true;
        }
        
        return false;
    }

    makeMove(playerId, cellIndex) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !this.isGameActive || this.board[cellIndex] !== '' || 
            player.symbol !== this.currentPlayer) {
            return false;
        }

        this.board[cellIndex] = this.currentPlayer;
        
        if (this.checkWinner()) {
            this.scores[this.currentPlayer]++;
            this.isGameActive = false;
            return { type: 'win', winner: this.currentPlayer, winningLine: this.getWinningLine() };
        } else if (this.board.every(cell => cell !== '')) {
            this.scores.tie++;
            this.isGameActive = false;
            return { type: 'tie' };
        } else {
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            return { type: 'continue' };
        }
    }

    checkWinner() {
        const winningConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        return winningConditions.some(condition => {
            const [a, b, c] = condition;
            return this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c];
        });
    }

    getWinningLine() {
        const winningConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (let condition of winningConditions) {
            const [a, b, c] = condition;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return condition;
            }
        }
        return null;
    }

    resetGame() {
        this.board = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.isGameActive = true;
        this.gameStarted = true;
    }

    addChatMessage(playerId, message) {
        const player = this.players.find(p => p.id === playerId) || 
                      this.spectators.find(s => s.id === playerId);
        
        if (player) {
            this.chat.push({
                id: uuidv4(),
                playerId,
                playerName: player.name,
                message,
                timestamp: new Date()
            });
            
            if (this.chat.length > 50) {
                this.chat = this.chat.slice(-50);
            }
        }
    }

    getRoomInfo() {
        return {
            id: this.id,
            players: this.players,
            spectators: this.spectators,
            board: this.board,
            currentPlayer: this.currentPlayer,
            isGameActive: this.isGameActive,
            scores: this.scores,
            gameStarted: this.gameStarted,
            chat: this.chat,
            createdAt: this.createdAt
        };
    }
}

// Socket.io events
io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    socket.on('setPlayerName', (playerName) => {
        if (!playerName || playerName.trim().length < 2) {
            socket.emit('error', { message: 'يجب أن يكون الاسم أكثر من حرفين' });
            return;
        }
        
        players.set(socket.id, { name: playerName.trim(), roomId: null });
        socket.emit('playerNameSet', { success: true });
        console.log(`👤 Player ${playerName} set name with ID: ${socket.id}`);
    });

    socket.on('createRoom', () => {
        const player = players.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'يرجى تعيين اسم اللاعب أولاً' });
            return;
        }

        // إحصل على اسم اللاعب الحالي
        const currentPlayerName = player.name;
        const roomId = uuidv4().substring(0, 6).toUpperCase();
        const room = new GameRoom(roomId, socket.id, currentPlayerName);
        rooms.set(roomId, room);
        
        // تحديث معلومات اللاعب
        player.roomId = roomId;
        socket.join(roomId);
        
        socket.emit('roomCreated', { roomId, room: room.getRoomInfo() });
        socket.emit('joinedRoom', room.getRoomInfo());
        
        console.log(`🏠 Room ${roomId} created by ${currentPlayerName} (${socket.id})`);
    });

    socket.on('joinRoom', (roomId) => {
        const player = players.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'يرجى تعيين اسم اللاعب أولاً' });
            return;
        }

        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'الغرفة غير موجودة' });
            return;
        }

        if (room.players.length < 2) {
            room.addPlayer(socket.id, player.name);
            player.roomId = roomId;
            socket.join(roomId);
            
            socket.emit('joinedRoom', room.getRoomInfo());
            socket.to(roomId).emit('playerJoined', room.getRoomInfo());
            
            console.log(`🚪 ${player.name} joined room ${roomId}`);
            
            if (room.players.length === 2) {
                io.to(roomId).emit('roomFull', room.getRoomInfo());
                console.log(`✅ Room ${roomId} is now full`);
            }
        } else {
            room.addSpectator(socket.id, player.name);
            player.roomId = roomId;
            socket.join(roomId);
            
            socket.emit('joinedAsSpectator', room.getRoomInfo());
            socket.to(roomId).emit('spectatorJoined', room.getRoomInfo());
            
            console.log(`👁️ ${player.name} joined room ${roomId} as spectator`);
        }
    });

    socket.on('startGame', () => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.get(player.roomId);
        if (!room || room.players.length !== 2) return;

        const playerInRoom = room.players.find(p => p.id === socket.id);
        if (!playerInRoom || !playerInRoom.isHost) return;

        room.resetGame();
        io.to(player.roomId).emit('gameStarted', room.getRoomInfo());
        
        console.log(`🎮 Game started in room ${player.roomId}`);
    });

    socket.on('makeMove', (cellIndex) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.get(player.roomId);
        if (!room) return;

        const result = room.makeMove(socket.id, cellIndex);
        if (result) {
            io.to(player.roomId).emit('moveMade', {
                cellIndex,
                player: room.board[cellIndex],
                board: room.board,
                currentPlayer: room.currentPlayer,
                result,
                scores: room.scores
            });

            if (result.type === 'win' || result.type === 'tie') {
                io.to(player.roomId).emit('gameEnded', {
                    result,
                    scores: room.scores
                });
                console.log(`🏆 Game ended in room ${player.roomId}: ${result.type}`);
            }
        }
    });

    socket.on('sendChatMessage', (message) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId || !message || message.trim().length === 0) return;

        const room = rooms.get(player.roomId);
        if (!room) return;

        room.addChatMessage(socket.id, message.trim());
        io.to(player.roomId).emit('chatMessage', {
            playerId: socket.id,
            playerName: player.name,
            message: message.trim(),
            timestamp: new Date()
        });
    });

    socket.on('resetGame', () => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.get(player.roomId);
        if (!room) return;

        const playerInRoom = room.players.find(p => p.id === socket.id);
        if (!playerInRoom || !playerInRoom.isHost) return;

        room.resetGame();
        io.to(player.roomId).emit('gameReset', room.getRoomInfo());
        
        console.log(`🔄 Game reset in room ${player.roomId}`);
    });

    socket.on('leaveRoom', () => {
        handlePlayerDisconnect(socket.id, false); // false = مغادرة عادية، ليس انقطاع
    });

    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
        handlePlayerDisconnect(socket.id, true); // true = انقطاع اتصال
    });

    // جديد: التعامل مع مغادرة الغرفة بدون حذف اسم اللاعب
    function handlePlayerDisconnect(playerId, isDisconnect = true) {
        const player = players.get(playerId);
        if (player && player.roomId) {
            const room = rooms.get(player.roomId);
            if (room) {
                const shouldDeleteRoom = room.removePlayer(playerId);
                
                if (shouldDeleteRoom) {
                    rooms.delete(player.roomId);
                    console.log(`🗑️ Room ${player.roomId} deleted`);
                } else {
                    socket.to(player.roomId).emit('playerLeft', room.getRoomInfo());
                    console.log(`👋 ${player.name} left room ${player.roomId}`);
                }
            }
            
            // إعادة تعيين معرف الغرفة فقط، وليس حذف اللاعب
            player.roomId = null;
        }
        
        // حذف اللاعب فقط عند الانقطاع النهائي
        if (isDisconnect) {
            players.delete(playerId);
        }
    }
});

setInterval(() => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    for (const [roomId, room] of rooms.entries()) {
        if (room.createdAt < thirtyMinutesAgo && room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`🧹 Cleaned up inactive room: ${roomId}`);
        }
    }
}, 30 * 60 * 1000);

server.listen(PORT, () => {
    console.log(`🚀 Tic Tac Toe Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
