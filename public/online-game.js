class OnlineGame {
    constructor() {
        this.socket = io();
        this.playerName = '';
        this.currentRoom = null;
        this.isHost = false;
        this.isOnlineMode = false;
        this.localGame = null;
        
        this.initializeSocketEvents();
        this.initializeUI();
        this.createParticles();
    }
    
    initializeSocketEvents() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('متصل بالخادم');
            this.showNotification('تم الاتصال بالخادم بنجاح', 'success');
        });
        
        this.socket.on('disconnect', () => {
            console.log('انقطع الاتصال بالخادم');
            this.showNotification('انقطع الاتصال بالخادم', 'error');
        });
        
        // Player events
        this.socket.on('playerNameSet', (data) => {
            if (data.success) {
                this.showMainMenu();
            }
        });
        
        // Room events
        this.socket.on('roomCreated', (data) => {
            this.currentRoom = data.room;
            this.isHost = true;
            this.showGameArea();
            this.showNotification(`تم إنشاء الغرفة: ${data.roomId}`, 'success');
        });
        
        this.socket.on('joinedRoom', (room) => {
            this.currentRoom = room;
            this.isHost = room.players.find(p => p.id === this.socket.id)?.isHost || false;
            this.showGameArea();
            this.updateRoomInfo();
            this.showNotification('تم الانضمام للغرفة بنجاح', 'success');
        });
        
        this.socket.on('joinedAsSpectator', (room) => {
            this.currentRoom = room;
            this.isHost = false;
            this.showGameArea();
            this.updateRoomInfo();
            this.showNotification('تم الانضمام كمتفرج', 'success');
            this.disableGameBoard();
        });
        
        this.socket.on('playerJoined', (room) => {
            this.currentRoom = room;
            this.updateRoomInfo();
            this.showNotification('انضم لاعب جديد', 'success');
        });
        
        this.socket.on('playerLeft', (room) => {
            this.currentRoom = room;
            this.updateRoomInfo();
            this.showNotification('غادر أحد اللاعبين', 'warning');
        });
        
        this.socket.on('spectatorJoined', (room) => {
            this.currentRoom = room;
            this.updateRoomInfo();
        });
        
        this.socket.on('roomFull', (room) => {
            this.currentRoom = room;
            this.updateRoomInfo();
            this.showNotification('الغرفة ممتلئة - يمكن بدء اللعب!', 'success');
        });
        
        // Game events
        this.socket.on('gameStarted', (room) => {
            this.currentRoom = room;
            this.updateGameState();
            this.showNotification('بدأت اللعبة!', 'success');
        });
        
        this.socket.on('moveMade', (data) => {
            this.updateCell(data.cellIndex, data.player);
            this.currentRoom.board = data.board;
            this.currentRoom.currentPlayer = data.currentPlayer;
            this.currentRoom.scores = data.scores;
            this.updateGameState();
            
            if (data.result.type === 'win') {
                this.highlightWinningCells(data.result.winningLine);
            }
        });
        
        this.socket.on('gameEnded', (data) => {
            setTimeout(() => {
                if (data.result.type === 'win') {
                    const winnerName = this.getPlayerName(data.result.winner);
                    this.showResult('🎉', `${winnerName} فاز!`, this.getPlayerColor(data.result.winner));
                } else {
                    this.showResult('🤝', 'تعادل!', '#f39c12');
                }
            }, 1000);
        });
        
        this.socket.on('gameReset', (room) => {
            this.currentRoom = room;
            this.resetGameBoard();
            this.updateGameState();
            this.hideResult();
            this.showNotification('تم إعادة تشغيل اللعبة', 'success');
        });
        
        // Chat events
        this.socket.on('chatMessage', (data) => {
            this.addChatMessage(data);
        });
        
        // Error events
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });
    }
    
    initializeUI() {
        // Player name setup
        document.getElementById('setNameBtn').addEventListener('click', () => {
            this.setPlayerName();
        });
        
        document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.setPlayerName();
            }
        });
        
        // Main menu buttons
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.createRoom();
        });
        
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.showRoomSetup('join');
        });
        
        document.getElementById('localGameBtn').addEventListener('click', () => {
            this.startLocalGame();
        });
        
        document.getElementById('aiGameBtn').addEventListener('click', () => {
            this.startAIGame();
        });
        
        // Room setup
        document.getElementById('joinRoomConfirmBtn').addEventListener('click', () => {
            this.joinRoom();
        });
        
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
        
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.showMainMenu();
        });
        
        // Game controls
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startOnlineGame();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (this.isOnlineMode) {
                this.resetOnlineGame();
            } else if (this.localGame) {
                this.localGame.resetGame();
            }
        });
        
        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });
        
        // Room code copy
        document.getElementById('copyRoomCode').addEventListener('click', () => {
            this.copyRoomCode();
        });
        
        // Game board
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });
        
        // Result modal
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            if (this.isOnlineMode) {
                this.resetOnlineGame();
            } else if (this.localGame) {
                this.localGame.playAgain();
            }
        });
        
        document.getElementById('newGameBtn').addEventListener('click', () => {
            if (this.isOnlineMode) {
                this.leaveRoom();
            } else if (this.localGame) {
                this.localGame.newGame();
            }
        });
        
        // Chat
        document.getElementById('sendChatBtn').addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        document.getElementById('toggleChat').addEventListener('click', () => {
            this.toggleChat();
        });
    }
    
    setPlayerName() {
        const nameInput = document.getElementById('playerNameInput');
        const name = nameInput.value.trim();
        
        if (name.length < 2) {
            this.showNotification('يجب أن يكون الاسم أكثر من حرفين', 'error');
            return;
        }
        
        this.playerName = name;
        document.getElementById('currentPlayerName').textContent = name;
        this.socket.emit('setPlayerName', name);
    }
    
    showMainMenu() {
        document.getElementById('playerSetup').style.display = 'none';
        document.getElementById('roomSetup').style.display = 'none';
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'block';
    }
    
    showRoomSetup(mode) {
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('roomSetup').style.display = 'block';
        
        if (mode === 'join') {
            document.getElementById('roomSetupTitle').textContent = 'الانضمام لغرفة';
            document.getElementById('roomCodeInput').placeholder = 'رمز الغرفة';
        }
    }
    
    showGameArea() {
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('roomSetup').style.display = 'none';
        document.getElementById('playerSetup').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        
        if (this.isOnlineMode) {
            document.getElementById('chatSection').style.display = 'block';
            document.getElementById('onlineStatus').style.display = 'block';
            document.getElementById('localGameModes').style.display = 'none';
            document.getElementById('difficultySelector').style.display = 'none';
        } else {
            document.getElementById('chatSection').style.display = 'none';
            document.getElementById('onlineStatus').style.display = 'none';
            document.getElementById('localGameModes').style.display = 'flex';
        }
    }
    
    createRoom() {
        this.isOnlineMode = true;
        this.socket.emit('createRoom');
    }
    
    joinRoom() {
        const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        if (roomCode.length !== 6) {
            this.showNotification('رمز الغرفة يجب أن يكون 6 أحرف', 'error');
            return;
        }
        
        this.isOnlineMode = true;
        this.socket.emit('joinRoom', roomCode);
    }
    
    startLocalGame() {
        this.isOnlineMode = false;
        this.showGameArea();
        
        // Initialize local game
        if (!this.localGame) {
            this.localGame = new TicTacToe();
        }
        this.localGame.setGameMode('pvp');
    }
    
    startAIGame() {
        this.isOnlineMode = false;
        this.showGameArea();
        document.getElementById('difficultySelector').style.display = 'block';
        
        // Initialize local game
        if (!this.localGame) {
            this.localGame = new TicTacToe();
        }
        this.localGame.setGameMode('pvc');
    }
    
    startOnlineGame() {
        if (this.isHost) {
            this.socket.emit('startGame');
        }
    }
    
    resetOnlineGame() {
        if (this.isHost) {
            this.socket.emit('resetGame');
        }
    }
    
    leaveRoom() {
        this.socket.emit('leaveRoom');
        this.currentRoom = null;
        this.isHost = false;
        this.isOnlineMode = false;
        this.showMainMenu();
        this.hideResult();
    }
    
    updateRoomInfo() {
        if (!this.currentRoom) return;
        
        document.getElementById('roomCode').textContent = this.currentRoom.id;
        
        // Update player names in scoreboard
        const players = this.currentRoom.players;
        if (players.length > 0) {
            document.getElementById('playerXName').textContent = players[0].name + ' (X)';
        }
        if (players.length > 1) {
            document.getElementById('playerOName').textContent = players[1].name + ' (O)';
        }
        
        // Update game status
        this.updateGameStatus();
        
        // Update scores
        this.updateScores();
    }
    
    updateGameStatus() {
        const statusText = document.getElementById('gameStatusText');
        const startBtn = document.getElementById('startGameBtn');
        
        if (!this.currentRoom.gameStarted) {
            if (this.currentRoom.players.length < 2) {
                statusText.textContent = 'في انتظار لاعب آخر...';
                startBtn.style.display = 'none';
            } else {
                statusText.textContent = 'جاهز للبدء!';
                startBtn.style.display = this.isHost ? 'block' : 'none';
            }
        } else {
            statusText.textContent = 'اللعبة قيد التشغيل';
            startBtn.style.display = 'none';
        }
    }
    
    updateGameState() {
        if (!this.currentRoom) return;
        
        // Update current player display
        const currentPlayerSymbol = document.getElementById('currentPlayerSymbol');
        currentPlayerSymbol.textContent = this.currentRoom.currentPlayer;
        currentPlayerSymbol.style.color = this.getPlayerColor(this.currentRoom.currentPlayer);
        
        // Update scores
        this.updateScores();
        
        // Update game status
        this.updateGameStatus();
        
        // Enable/disable board based on turn and role
        this.updateBoardState();
    }
    
    updateBoardState() {
        const isMyTurn = this.isMyTurn();
        const isSpectator = this.isSpectator();
        
        document.querySelectorAll('.cell').forEach(cell => {
            if (isSpectator || !this.currentRoom.isGameActive || !isMyTurn) {
                cell.classList.add('disabled');
            } else {
                cell.classList.remove('disabled');
            }
        });
    }
    
    updateScores() {
        if (!this.currentRoom) return;
        
        document.getElementById('scoreX').textContent = this.currentRoom.scores.X;
        document.getElementById('scoreO').textContent = this.currentRoom.scores.O;
        document.getElementById('scoreTie').textContent = this.currentRoom.scores.tie;
    }
    
    handleCellClick(event) {
        if (this.isOnlineMode) {
            const cellIndex = parseInt(event.target.getAttribute('data-index'));
            
            if (!this.isMyTurn() || this.isSpectator() || 
                !this.currentRoom.isGameActive || 
                this.currentRoom.board[cellIndex] !== '') {
                return;
            }
            
            this.socket.emit('makeMove', cellIndex);
        } else if (this.localGame) {
            this.localGame.handleCellClick(event);
        }
    }
    
    updateCell(cellIndex, player) {
        const cell = document.querySelector(`[data-index="${cellIndex}"]`);
        cell.textContent = player;
        cell.classList.add(player.toLowerCase());
        cell.style.animation = 'cellPop 0.5s ease';
    }
    
    resetGameBoard() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.className = 'cell';
            cell.style.animation = '';
        });
    }
    
    highlightWinningCells(winningLine) {
        if (winningLine) {
            winningLine.forEach(index => {
                document.querySelector(`[data-index="${index}"]`).classList.add('winning');
            });
        }
    }
    
    disableGameBoard() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });
    }
    
    isMyTurn() {
        if (!this.currentRoom) return false;
        
        const myPlayer = this.currentRoom.players.find(p =>