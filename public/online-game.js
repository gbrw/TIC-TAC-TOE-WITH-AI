class OnlineGame {
    constructor() {
        this.socket = null;
        this.playerName = '';
        this.roomId = '';
        this.isHost = false;
        this.playerSymbol = '';
        this.gameState = 'setup';
        this.currentRoom = null;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.initializeOnlineGame();
    }
    
    initializeOnlineGame() {
        this.initializeSocket();
        this.bindOnlineEvents();
        this.showPlayerSetup();
        this.handlePageVisibility();
    }
    
    handlePageVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 Page hidden, maintaining connection...');
            } else {
                console.log('👀 Page visible again');
                if (this.socket && !this.socket.connected && this.gameState !== 'setup') {
                    this.attemptReconnect();
                }
            }
        });

        window.addEventListener('beforeunload', (e) => {
            if (this.gameState === 'playing' || this.gameState === 'waiting') {
                e.preventDefault();
                e.returnValue = 'هل أنت متأكد من مغادرة اللعبة؟ ستفقد التقدم الحالي.';
                return e.returnValue;
            }
        });
    }

    attemptReconnect() {
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.showNotification(`جاري إعادة الاتصال... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');

        setTimeout(() => {
            if (this.socket) {
                this.socket.connect();
            }
            this.isReconnecting = false;
        }, 2000 * this.reconnectAttempts);
    }
    
    initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true,
            timeout: 20000,
            forceNew: false,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            maxReconnectionAttempts: 5
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.reconnectAttempts = 0;
            this.showNotification('متصل بالخادم ✅', 'success');
            
            // إعادة تعيين اسم اللاعب عند إعادة الاتصال
            if (this.playerName && this.gameState !== 'setup') {
                console.log('🔄 Re-setting player name after reconnect:', this.playerName);
                this.socket.emit('setPlayerName', this.playerName);
            }
            
            if (this.roomId && this.gameState !== 'setup') {
                console.log('🏠 Rejoining room:', this.roomId);
                this.socket.emit('joinRoom', this.roomId);
            }
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server:', reason);
            
            if (reason === 'io server disconnect') {
                this.showNotification('تم قطع الاتصال من الخادم', 'error');
                this.gameState = 'setup';
                this.showPlayerSetup();
            } else {
                this.showNotification('انقطع الاتصال - جاري المحاولة...', 'warning');
                this.attemptReconnect();
            }
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
            this.showNotification('تم إعادة الاتصال بنجاح! 🎉', 'success');
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.showNotification('خطأ في الاتصال بالخادم', 'error');
        });
        
        // Game events
        this.socket.on('playerNameSet', (data) => {
            if (data.success) {
                this.gameState = 'menu';
                this.showMainMenu();
                this.showNotification(`مرحباً ${this.playerName}! 👋`, 'success');
            }
        });
        
        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomId;
            this.isHost = true;
            this.handleRoomJoined(data.room);
        });
        
        this.socket.on('joinedRoom', (room) => {
            this.handleRoomJoined(room);
        });
        
        this.socket.on('joinedAsSpectator', (room) => {
            this.handleRoomJoined(room, true);
        });
        
        this.socket.on('playerJoined', (room) => {
            this.updateRoomInfo(room);
            this.showNotification('انضم لاعب جديد للغرفة 👋', 'info');
        });
        
        this.socket.on('spectatorJoined', (room) => {
            this.updateRoomInfo(room);
            this.showNotification('انضم متفرج جديد 👁️', 'info');
        });
        
        this.socket.on('playerLeft', (room) => {
            this.updateRoomInfo(room);
            this.showNotification('غادر لاعب الغرفة 👋', 'warning');
        });
        
        this.socket.on('roomFull', (room) => {
            this.updateRoomInfo(room);
            this.showNotification('الغرفة مكتملة! يمكن بدء اللعبة 🎮', 'success');
        });
        
        this.socket.on('gameStarted', (room) => {
            this.currentRoom = room;
            this.gameState = 'playing';
            this.startOnlineGame(room);
            this.showNotification('بدأت اللعبة! 🚀', 'success');
        });
        
        this.socket.on('moveMade', (data) => {
            this.handleMoveMade(data);
        });
        
        this.socket.on('gameEnded', (data) => {
            this.handleGameEnded(data);
        });
        
        this.socket.on('gameReset', (room) => {
            this.currentRoom = room;
            this.resetOnlineGame();
            this.showNotification('تم إعادة تشغيل اللعبة 🔄', 'info');
        });
        
        this.socket.on('chatMessage', (data) => {
            this.addChatMessage(data);
        });
        
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });
    }
    
    bindOnlineEvents() {
        // Player name setup
        const setNameBtn = document.getElementById('setNameBtn');
        const playerNameInput = document.getElementById('playerNameInput');
        
        if (setNameBtn) {
            setNameBtn.addEventListener('click', () => this.setPlayerName());
            console.log('✅ Set Name button event bound');
        }
        
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.setPlayerName();
            });
            console.log('✅ Player name input event bound');
        }
        
        // Main menu buttons
        const createRoomBtn = document.getElementById('createRoomBtn');
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const localGameBtn = document.getElementById('localGameBtn');
        const aiGameBtn = document.getElementById('aiGameBtn');
        
        if (createRoomBtn) createRoomBtn.addEventListener('click', () => this.createRoom());
        if (joinRoomBtn) joinRoomBtn.addEventListener('click', () => this.showJoinRoom());
        if (localGameBtn) localGameBtn.addEventListener('click', () => this.startLocalGame());
        if (aiGameBtn) aiGameBtn.addEventListener('click', () => this.startAIGame());
        
        // Room setup
        const joinRoomConfirmBtn = document.getElementById('joinRoomConfirmBtn');
        const roomCodeInput = document.getElementById('roomCodeInput');
        const backToMenuBtn = document.getElementById('backToMenuBtn');
        
        if (joinRoomConfirmBtn) joinRoomConfirmBtn.addEventListener('click', () => this.joinRoom());
        if (roomCodeInput) {
            roomCodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinRoom();
            });
        }
        if (backToMenuBtn) backToMenuBtn.addEventListener('click', () => this.showMainMenu());
        
        // Game controls
        const startGameBtn = document.getElementById('startGameBtn');
        const leaveRoomBtn = document.getElementById('leaveRoomBtn');
        const backToMenuFromGameBtn = document.getElementById('backToMenuFromGameBtn');
        const copyRoomCode = document.getElementById('copyRoomCode');
        
        if (startGameBtn) startGameBtn.addEventListener('click', () => this.startGame());
        if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        if (backToMenuFromGameBtn) backToMenuFromGameBtn.addEventListener('click', () => this.backToMenu());
        if (copyRoomCode) copyRoomCode.addEventListener('click', () => this.copyRoomCode());
        
        // Chat - محسن: إصلاح مشكلة إظهار/إخفاء الدردشة
        const sendChatBtn = document.getElementById('sendChatBtn');
        const chatInput = document.getElementById('chatInput');
        const toggleChat = document.getElementById('toggleChat');
        
        if (sendChatBtn) sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
        }
        if (toggleChat) toggleChat.addEventListener('click', () => this.toggleChat());
        
        // Game board
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.handleOnlineCellClick(e));
        });
        
        console.log('🎯 All online events bound successfully');
    }
    
    setPlayerName() {
        console.log('🎯 setPlayerName called');
        
        const playerNameInput = document.getElementById('playerNameInput');
        const nameLoading = document.getElementById('nameLoading');
        const setNameBtn = document.getElementById('setNameBtn');
        
        if (!playerNameInput) {
            console.error('❌ playerNameInput not found');
            return;
        }
        
        const name = playerNameInput.value.trim();
        console.log('📝 Name entered:', name);
        
        if (name.length < 2) {
            this.showNotification('يجب أن يكون الاسم أكثر من حرفين', 'error');
            return;
        }
        
        if (name.length > 20) {
            this.showNotification('الاسم طويل جداً', 'error');
            return;
        }
        
        this.playerName = name;
        
        // Show loading
        if (nameLoading) nameLoading.style.display = 'flex';
        if (setNameBtn) setNameBtn.disabled = true;
        
        console.log('🚀 Emitting setPlayerName to server');
        this.socket.emit('setPlayerName', this.playerName);
    }
    
    createRoom() {
        // التأكد من وجود اسم اللاعب قبل إنشاء الغرفة
        if (!this.playerName) {
            console.log('❌ No player name found, requesting to set name first');
            this.showNotification('يرجى تعيين اسم اللاعب أولاً', 'error');
            this.gameState = 'setup';
            this.showPlayerSetup();
            return;
        }
        
        console.log('🏠 Creating room for player:', this.playerName);
        this.socket.emit('createRoom');
        this.showNotification('جاري إنشاء الغرفة...', 'info');
    }
    
    showJoinRoom() {
        this.hideAllScreens();
        const roomSetup = document.getElementById('roomSetup');
        if (roomSetup) roomSetup.style.display = 'block';
    }
    
    joinRoom() {
        const roomCodeInput = document.getElementById('roomCodeInput');
        const roomLoading = document.getElementById('roomLoading');
        const joinRoomConfirmBtn = document.getElementById('joinRoomConfirmBtn');
        
        if (!roomCodeInput) return;
        
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        
        if (roomCode.length !== 6) {
            this.showNotification('رمز الغرفة يجب أن يكون 6 أحرف', 'error');
            return;
        }
        
        if (roomLoading) roomLoading.style.display = 'flex';
        if (joinRoomConfirmBtn) joinRoomConfirmBtn.disabled = true;
        
        this.socket.emit('joinRoom', roomCode);
    }
    
    startLocalGame() {
        this.gameState = 'local';
        this.showGameArea();
        this.hideOnlineElements();
        this.showLocalElements();
        this.hideGameModeButtons();
        
        if (!window.localGame) {
            window.localGame = new TicTacToe();
        } else {
            window.localGame.setGameMode('pvp');
        }
        
        this.showNotification('بدأ اللعب المحلي 🎮', 'success');
    }
    
    startAIGame() {
        this.gameState = 'ai';
        this.showGameArea();
        this.hideOnlineElements();
        this.showLocalElements();
        this.hideGameModeButtons();
        
        if (!window.localGame) {
            window.localGame = new TicTacToe();
        }
        
        setTimeout(() => {
            if (window.localGame) {
                window.localGame.setGameMode('pvc');
            }
        }, 100);
        
        this.showNotification('بدأ اللعب ضد الكمبيوتر 🤖', 'success');
    }
    
    hideGameModeButtons() {
        const localGameModes = document.getElementById('localGameModes');
        if (localGameModes) {
            localGameModes.style.display = 'none';
        }
    }
    
    handleRoomJoined(room, isSpectator = false) {
        this.currentRoom = room;
        this.roomId = room.id;
        this.gameState = 'waiting';
        
        const player = room.players.find(p => p.id === this.socket.id);
        if (player) {
            this.playerSymbol = player.symbol;
            this.isHost = player.isHost;
        }
        
        this.showGameArea();
        this.showOnlineElements();
        this.hideLocalElements();
        this.updateRoomInfo(room);
        
        if (isSpectator) {
            this.showNotification('انضممت كمتفرج 👁️', 'info');
        } else {
            this.showNotification(`انضممت للغرفة ${room.id} ✅`, 'success');
        }
    }
    
    updateRoomInfo(room) {
        this.currentRoom = room;
        
        const roomCode = document.getElementById('roomCode');
        if (roomCode) roomCode.textContent = room.id;
        
        const playersList = document.getElementById('playersList');
        if (playersList) {
            playersList.innerHTML = '';
            
            room.players.forEach(player => {
                const playerTag = document.createElement('div');
                playerTag.className = `player-tag ${player.isHost ? 'host' : ''}`;
                playerTag.innerHTML = `
                    <i class="fas ${player.isHost ? 'fa-crown' : 'fa-user'}"></i>
                    <span>${player.name} (${player.symbol})</span>
                `;
                playersList.appendChild(playerTag);
            });
            
            room.spectators.forEach(spectator => {
                const spectatorTag = document.createElement('div');
                spectatorTag.className = 'player-tag';
                spectatorTag.innerHTML = `
                    <i class="fas fa-eye"></i>
                    <span>${spectator.name}</span>
                `;
                playersList.appendChild(spectatorTag);
            });
        }
        
        const gameStatusText = document.getElementById('gameStatusText');
        const startGameBtn = document.getElementById('startGameBtn');
        
        if (room.gameStarted && room.isGameActive) {
            if (gameStatusText) gameStatusText.textContent = 'اللعبة جارية...';
            if (startGameBtn) startGameBtn.style.display = 'none';
        } else if (room.players.length === 2) {
            if (gameStatusText) gameStatusText.textContent = 'جاهز للبدء!';
            if (startGameBtn && this.isHost) {
                startGameBtn.style.display = 'inline-flex';
            }
        } else {
            if (gameStatusText) gameStatusText.textContent = 'في انتظار لاعب آخر...';
            if (startGameBtn) startGameBtn.style.display = 'none';
        }
        
        const playerXName = document.getElementById('playerXName');
        const playerOName = document.getElementById('playerOName');
        
        if (room.players.length > 0) {
            const playerX = room.players.find(p => p.symbol === 'X');
            const playerO = room.players.find(p => p.symbol === 'O');
            
            if (playerXName && playerX) playerXName.textContent = playerX.name;
            if (playerOName && playerO) playerOName.textContent = playerO.name;
        }
        
        if (room.scores) {
            const scoreX = document.getElementById('scoreX');
            const scoreO = document.getElementById('scoreO');
            const scoreTie = document.getElementById('scoreTie');
            
            if (scoreX) scoreX.textContent = room.scores.X;
            if (scoreO) scoreO.textContent = room.scores.O;
            if (scoreTie) scoreTie.textContent = room.scores.tie;
        }
    }
    
    startGame() {
        this.socket.emit('startGame');
    }
    
    startOnlineGame(room) {
        this.resetGameBoard();
        this.updateCurrentPlayerDisplay(room.currentPlayer);
        this.updateCellStates(room);
    }
    
    handleOnlineCellClick(event) {
        if (this.gameState !== 'playing') return;
        
        const cellIndex = parseInt(event.target.getAttribute('data-index'));
        const cell = event.target;
        
        if (!this.currentRoom || this.currentRoom.currentPlayer !== this.playerSymbol) {
            this.showNotification('ليس دورك الآن!', 'warning');
            return;
        }
        
        if (cell.textContent !== '') return;
        
        this.socket.emit('makeMove', cellIndex);
    }
    
    handleMoveMade(data) {
        const cell = document.querySelector(`[data-index="${data.cellIndex}"]`);
        if (cell) {
            cell.textContent = data.player;
            cell.classList.add(data.player.toLowerCase());
            cell.style.animation = 'cellPop 0.5s ease';
        }
        
        this.updateCurrentPlayerDisplay(data.currentPlayer);
        this.updateCellStates(data);
        this.playMoveSound();
        
        if (data.result.type === 'win') {
            this.highlightWinningCells(data.result.winningLine);
            setTimeout(() => {
                this.showGameResult(data.result, data.scores);
            }, 1000);
        } else if (data.result.type === 'tie') {
            setTimeout(() => {
                this.showGameResult(data.result, data.scores);
            }, 500);
        }
    }
    
    handleGameEnded(data) {
        this.showGameResult(data.result, data.scores);
    }
    
    showGameResult(result, scores) {
        const resultModal = document.getElementById('gameResult');
        const resultIcon = document.getElementById('resultIcon');
        const resultText = document.getElementById('resultText');
        
        if (result.type === 'win') {
            const winner = result.winner;
            const winnerPlayer = this.currentRoom.players.find(p => p.symbol === winner);
            const isWinner = this.playerSymbol === winner;
            
            if (resultIcon) {
                resultIcon.innerHTML = isWinner ? '<i class="fas fa-trophy"></i>' : '<i class="fas fa-sad-tear"></i>';
            }
            if (resultText) {
                resultText.textContent = isWinner ? 'فزت! 🎉' : `فاز ${winnerPlayer.name}`;
                resultText.style.color = isWinner ? '#2ecc71' : '#e74c3c';
            }
            
            this.playSound(isWinner ? 'win' : 'lose');
        } else if (result.type === 'tie') {
            if (resultIcon) resultIcon.innerHTML = '<i class="fas fa-handshake"></i>';
            if (resultText) {
                resultText.textContent = 'تعادل!';
                resultText.style.color = '#f39c12';
            }
            
            this.playSound('tie');
        }
        
        if (resultModal) resultModal.style.display = 'flex';
        
        if (scores) {
            const scoreX = document.getElementById('scoreX');
            const scoreO = document.getElementById('scoreO');
            const scoreTie = document.getElementById('scoreTie');
            
            if (scoreX) scoreX.textContent = scores.X;
            if (scoreO) scoreO.textContent = scores.O;
            if (scoreTie) scoreTie.textContent = scores.tie;
        }
    }
    
    updateCurrentPlayerDisplay(currentPlayer) {
        const currentPlayerSymbol = document.getElementById('currentPlayerSymbol');
        const currentPlayerText = document.getElementById('currentPlayerText');
        
        if (currentPlayerSymbol) {
            currentPlayerSymbol.textContent = currentPlayer;
            currentPlayerSymbol.style.color = currentPlayer === 'X' ? '#e74c3c' : '#3498db';
        }
        
        if (currentPlayerText) {
            if (this.playerSymbol === currentPlayer) {
                currentPlayerText.textContent = 'دورك';
                currentPlayerText.style.color = '#2ecc71';
            } else {
                const otherPlayer = this.currentRoom.players.find(p => p.symbol === currentPlayer);
                currentPlayerText.textContent = `دور ${otherPlayer ? otherPlayer.name : currentPlayer}`;
                currentPlayerText.style.color = '#6c757d';
            }
        }
    }
    
    updateCellStates(data) {
        const isMyTurn = data.currentPlayer === this.playerSymbol;
        
        document.querySelectorAll('.cell').forEach(cell => {
            if (cell.textContent === '') {
                if (isMyTurn) {
                    cell.classList.remove('disabled');
                } else {
                    cell.classList.add('disabled');
                }
            }
        });
    }
    
    highlightWinningCells(winningLine) {
        if (!winningLine) return;
        
        winningLine.forEach(index => {
            const cell = document.querySelector(`[data-index="${index}"]`);
            if (cell) cell.classList.add('winning');
        });
    }
    
    resetGameBoard() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'winning', 'disabled');
            cell.style.animation = '';
        });
        
        const resultModal = document.getElementById('gameResult');
        if (resultModal) resultModal.style.display = 'none';
    }
    
    resetOnlineGame() {
        this.resetGameBoard();
        if (this.currentRoom) {
            this.updateCurrentPlayerDisplay(this.currentRoom.currentPlayer);
            this.updateCellStates(this.currentRoom);
        }
    }
    
    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        
        const message = chatInput.value.trim();
        if (message === '') return;
        
        this.socket.emit('sendChatMessage', message);
        chatInput.value = '';
    }
    
    addChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        const isOwnMessage = data.playerId === this.socket.id;
        
        messageDiv.innerHTML = `
            <div class="sender">
                <i class="fas ${isOwnMessage ? 'fa-user' : 'fa-user-friends'}"></i>
                <span>${isOwnMessage ? 'أنت' : data.playerName}</span>
            </div>
            <div class="message">${this.escapeHtml(data.message)}</div>
            <div class="timestamp">
                <i class="fas fa-clock"></i>
                <span>${new Date(data.timestamp).toLocaleTimeString('ar-SA')}</span>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    toggleChat() {
        const chatSection = document.getElementById('chatSection');
        const toggleBtn = document.getElementById('toggleChat');
        
        if (!chatSection || !toggleBtn) return;
        
        const chatMessages = chatSection.querySelector('.chat-messages');
        const chatInput = chatSection.querySelector('.chat-input');
        
        if (chatMessages && chatInput) {
            const isHidden = chatMessages.style.display === 'none' || 
                           chatInput.style.display === 'none';
            
            if (isHidden) {
                chatMessages.style.display = 'block';
                chatInput.style.display = 'flex';
                toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i><span>إخفاء</span>';
                this.showNotification('تم إظهار الدردشة 💬', 'info');
            } else {
                chatMessages.style.display = 'none';
                chatInput.style.display = 'none';
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i><span>إظهار الدردشة</span>';
                this.showNotification('تم إخفاء الدردشة', 'info');
            }
        }
    }
    
    leaveRoom() {
        this.socket.emit('leaveRoom');
        this.gameState = 'menu';
        this.roomId = '';
        this.showMainMenu();
        this.showNotification('غادرت الغرفة', 'info');
    }
    
    backToMenu() {
        if (this.gameState === 'playing' || this.gameState === 'waiting') {
            this.leaveRoom();
        } else {
            this.gameState = 'menu';
            this.showMainMenu();
        }
    }
    
    copyRoomCode() {
        if (!this.roomId) return;
        
        const textToCopy = `انضم للعب معي! 🎮\nرمز الغرفة: ${this.roomId}\nالرابط: ${window.location.origin}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            this.showNotification('تم نسخ معلومات الغرفة 📋\nأرسلها لصديقك!', 'success');
        }).catch(() => {
            navigator.clipboard.writeText(this.roomId).then(() => {
                this.showNotification('تم نسخ رمز الغرفة 📋', 'success');
            }).catch(() => {
                this.showNotification('فشل في نسخ رمز الغرفة', 'error');
            });
        });
    }
    
    // UI Management
    showPlayerSetup() {
        this.hideAllScreens();
        const playerSetup = document.getElementById('playerSetup');
        if (playerSetup) playerSetup.style.display = 'block';
        
        const nameLoading = document.getElementById('nameLoading');
        const setNameBtn = document.getElementById('setNameBtn');
        if (nameLoading) nameLoading.style.display = 'none';
        if (setNameBtn) setNameBtn.disabled = false;
    }
    
    showMainMenu() {
        this.hideAllScreens();
        const mainMenu = document.getElementById('mainMenu');
        if (mainMenu) mainMenu.style.display = 'block';
        
        const currentPlayerName = document.getElementById('currentPlayerName');
        if (currentPlayerName) currentPlayerName.textContent = this.playerName;
    }
    
    showGameArea() {
        this.hideAllScreens();
        const gameArea = document.getElementById('gameArea');
        if (gameArea) gameArea.style.display = 'block';
    }
    
    hideAllScreens() {
        const screens = ['playerSetup', 'mainMenu', 'roomSetup', 'gameArea'];
        screens.forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) screen.style.display = 'none';
        });
        
        const roomLoading = document.getElementById('roomLoading');
        const joinRoomConfirmBtn = document.getElementById('joinRoomConfirmBtn');
        if (roomLoading) roomLoading.style.display = 'none';
        if (joinRoomConfirmBtn) joinRoomConfirmBtn.disabled = false;
    }
    
    showOnlineElements() {
        const onlineElements = ['roomInfo', 'onlineStatus', 'chatSection',
