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
        
        // إضافة متغيرات أسماء اللاعبين المحليين
        this.localPlayerXName = 'اللاعب X';
        this.localPlayerOName = 'اللاعب O';
        
        // تحميل الأسماء المحفوظة قبل التهيئة
        this.loadLocalPlayersNames();
        
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
        console.log('🎯 Binding online events...');
        
        // إزالة جميع المستمعات السابقة وإضافة جديدة
        this.removeAllEventListeners();
        
        // Player name setup
        const setNameBtn = document.getElementById('setNameBtn');
        const playerNameInput = document.getElementById('playerNameInput');
        
        if (setNameBtn) {
            setNameBtn.addEventListener('click', () => {
                console.log('🎯 Set name button clicked');
                this.setPlayerName();
            });
            console.log('✅ Set Name button event bound');
        } else {
            console.error('❌ setNameBtn not found');
        }
        
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('🎯 Enter key pressed in player name input');
                    this.setPlayerName();
                }
            });
            console.log('✅ Player name input event bound');
        } else {
            console.error('❌ playerNameInput not found');
        }
        
        // Main menu buttons
        const createRoomBtn = document.getElementById('createRoomBtn');
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const localGameBtn = document.getElementById('localGameBtn');
        const aiGameBtn = document.getElementById('aiGameBtn');
        
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => this.createRoom());
            console.log('✅ Create room button bound');
        }
        
        if (joinRoomBtn) {
            joinRoomBtn.addEventListener('click', () => this.showJoinRoom());
            console.log('✅ Join room button bound');
        }
        
        if (localGameBtn) {
            localGameBtn.addEventListener('click', () => this.startLocalGame());
            console.log('✅ Local game button bound');
        }
        
        if (aiGameBtn) {
            aiGameBtn.addEventListener('click', () => this.startAIGame());
            console.log('✅ AI game button bound');
        }
        
        // Room setup
        const joinRoomConfirmBtn = document.getElementById('joinRoomConfirmBtn');
        const roomCodeInput = document.getElementById('roomCodeInput');
        const backToMenuBtn = document.getElementById('backToMenuBtn');
        
        if (joinRoomConfirmBtn) {
            joinRoomConfirmBtn.addEventListener('click', () => this.joinRoom());
            console.log('✅ Join room confirm button bound');
        }
        
        if (roomCodeInput) {
            roomCodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinRoom();
            });
            console.log('✅ Room code input bound');
        }
        
        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', () => this.showMainMenu());
            console.log('✅ Back to menu button bound');
        }
        
        // Game controls
        const startGameBtn = document.getElementById('startGameBtn');
        const leaveRoomBtn = document.getElementById('leaveRoomBtn');
        const backToMenuFromGameBtn = document.getElementById('backToMenuFromGameBtn');
        
        // أزرار النسخ
        const copyRoomCodeOnly = document.getElementById('copyRoomCodeOnly');
        const copyRoomCodeWithLink = document.getElementById('copyRoomCodeWithLink');
        
        // أزرار إعدادات اللاعبين المحليين
        const playersSettingsBtn = document.getElementById('playersSettingsBtn');
        const applyPlayersNames = document.getElementById('applyPlayersNames');
        const resetPlayersNames = document.getElementById('resetPlayersNames');
        
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => this.startGame());
            console.log('✅ Start game button bound');
        }
        
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
            console.log('✅ Leave room button bound');
        }
        
        if (backToMenuFromGameBtn) {
            backToMenuFromGameBtn.addEventListener('click', () => this.backToMenu());
            console.log('✅ Back to menu from game button bound');
        }
        
        if (copyRoomCodeOnly) {
            copyRoomCodeOnly.addEventListener('click', () => this.copyRoomCodeOnly());
            console.log('✅ Copy room code only button bound');
        }
        
        if (copyRoomCodeWithLink) {
            copyRoomCodeWithLink.addEventListener('click', () => this.copyRoomCodeWithLink());
            console.log('✅ Copy room code with link button bound');
        }
        
        // إعدادات اللاعبين المحليين
        if (playersSettingsBtn) {
            playersSettingsBtn.addEventListener('click', () => this.togglePlayersSettings());
            console.log('✅ Players settings button bound');
        }
        
        if (applyPlayersNames) {
            applyPlayersNames.addEventListener('click', () => this.applyPlayersNames());
            console.log('✅ Apply players names button bound');
        }
        
        if (resetPlayersNames) {
            resetPlayersNames.addEventListener('click', () => this.resetPlayersNames());
            console.log('✅ Reset players names button bound');
        }
        
        // Chat
        const sendChatBtn = document.getElementById('sendChatBtn');
        const chatInput = document.getElementById('chatInput');
        const toggleChat = document.getElementById('toggleChat');
        
        if (sendChatBtn) {
            sendChatBtn.addEventListener('click', () => this.sendChatMessage());
            console.log('✅ Send chat button bound');
        }
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
            console.log('✅ Chat input bound');
        }
        
        if (toggleChat) {
            toggleChat.addEventListener('click', () => this.toggleChat());
            console.log('✅ Toggle chat button bound');
        }
        
        // Game board
        document.querySelectorAll('.cell').forEach((cell, index) => {
            cell.addEventListener('click', (e) => this.handleOnlineCellClick(e));
        });
        console.log('✅ Game board cells bound');
        
        console.log('🎯 All online events bound successfully');
    }
    
    removeAllEventListeners() {
        console.log('🧹 Removing old event listeners...');
        
        // إزالة المستمعات من الأزرار الرئيسية
        const buttons = [
            'setNameBtn', 'createRoomBtn', 'joinRoomBtn', 'localGameBtn', 'aiGameBtn',
            'joinRoomConfirmBtn', 'backToMenuBtn', 'startGameBtn', 'leaveRoomBtn',
            'backToMenuFromGameBtn', 'copyRoomCodeOnly', 'copyRoomCodeWithLink',
            'playersSettingsBtn', 'applyPlayersNames', 'resetPlayersNames',
            'sendChatBtn', 'toggleChat'
        ];
        
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
            }
        });
        
        // إزالة المستمعات من حقول الإدخال
        const inputs = ['playerNameInput', 'roomCodeInput', 'chatInput'];
        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
            }
        });
        
        console.log('✅ Old event listeners removed');
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
        console.log('🏠 createRoom called, playerName:', this.playerName);
        
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
        console.log('🚪 showJoinRoom called');
        this.hideAllScreens();
        const roomSetup = document.getElementById('roomSetup');
        if (roomSetup) roomSetup.style.display = 'block';
    }
    
    joinRoom() {
        console.log('🚪 joinRoom called');
        
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
        console.log('🎮 startLocalGame called');
        
        this.gameState = 'local';
        this.showGameArea();
        this.hideOnlineElements();
        this.showLocalElements();
        this.hideGameModeButtons();
        
        // إظهار زر إعدادات اللاعبين للعب المحلي
        this.showPlayersSettingsButton();
        
        if (!window.localGame) {
            window.localGame = new TicTacToe();
        } else {
            window.localGame.setGameMode('pvp');
        }
        
        // تطبيق أسماء اللاعبين المحفوظة
        this.updateLocalPlayersDisplay();
        
        this.showNotification('بدأ اللعب المحلي 🎮\nيمكنك تعديل أسماء اللاعبين من الإعدادات', 'success');
    }
    
    startAIGame() {
        console.log('🤖 startAIGame called');
        
        this.gameState = 'ai';
        this.showGameArea();
        this.hideOnlineElements();
        this.showLocalElements();
        this.hideGameModeButtons();
        
        // إظهار زر إعدادات اللاعبين للعب ضد الكمبيوتر
        this.showPlayersSettingsButton();
        
        if (!window.localGame) {
            window.localGame = new TicTacToe();
        }
        
        setTimeout(() => {
            if (window.localGame) {
                window.localGame.setGameMode('pvc');
            }
        }, 100);
        
        // تطبيق أسماء اللاعبين المحفوظة (اللاعب O سيكون "الكمبيوتر")
        this.localPlayerOName = 'الكمبيوتر';
        this.updateLocalPlayersDisplay();
        
        this.showNotification('بدأ اللعب ضد الكمبيوتر 🤖\nيمكنك تعديل اسم اللاعب من الإعدادات', 'success');
    }
    
    hideGameModeButtons() {
        const localGameModes = document.getElementById('localGameModes');
        if (localGameModes) {
            localGameModes.style.display = 'none';
        }
    }
    
    // دوال إدارة أسماء اللاعبين المحليين
    showPlayersSettingsButton() {
        const playersSettingsBtn = document.getElementById('playersSettingsBtn');
        if (playersSettingsBtn) {
            playersSettingsBtn.style.display = 'inline-flex';
        }
    }
    
    hidePlayersSettingsButton() {
        const playersSettingsBtn = document.getElementById('playersSettingsBtn');
        if (playersSettingsBtn) {
            playersSettingsBtn.style.display = 'none';
        }
    }
    
    togglePlayersSettings() {
        const localPlayersSetup = document.getElementById('localPlayersSetup');
        if (!localPlayersSetup) return;
        
        const isHidden = localPlayersSetup.style.display === 'none' || 
                        localPlayersSetup.style.display === '';
        
        if (isHidden) {
            localPlayersSetup.style.display = 'block';
            // تحديث قيم الحقول بالأسماء الحالية
            const playerXInput = document.getElementById('localPlayerXName');
            const playerOInput = document.getElementById('localPlayerOName');
            
            if (playerXInput) playerXInput.value = this.localPlayerXName;
            if (playerOInput) {
                if (this.gameState === 'ai') {
                    playerOInput.value = 'الكمبيوتر';
                    playerOInput.disabled = true;
                } else {
                    playerOInput.value = this.localPlayerOName;
                    playerOInput.disabled = false;
                }
            }
            
            this.showNotification('يمكنك الآن تعديل أسماء اللاعبين ⚙️', 'info');
        } else {
            localPlayersSetup.style.display = 'none';
        }
    }
    
    applyPlayersNames() {
        const playerXInput = document.getElementById('localPlayerXName');
        const playerOInput = document.getElementById('localPlayerOName');
        
        if (!playerXInput || !playerOInput) return;
        
        const newPlayerXName = playerXInput.value.trim();
        const newPlayerOName = playerOInput.value.trim();
        
        // التحقق من صحة الأسماء
        if (newPlayerXName.length < 2) {
            this.showNotification('اسم اللاعب X يجب أن يكون أكثر من حرفين', 'error');
            return;
        }
        
        if (newPlayerOName.length < 2 && this.gameState !== 'ai') {
            this.showNotification('اسم اللاعب O يجب أن يكون أكثر من حرفين', 'error');
            return;
        }
        
        if (newPlayerXName.length > 15) {
            this.showNotification('اسم اللاعب X طويل جداً', 'error');
            return;
        }
        
        if (newPlayerOName.length > 15) {
            this.showNotification('اسم اللاعب O طويل جداً', 'error');
            return;
        }
        
        // تطبيق الأسماء الجديدة
        this.localPlayerXName = newPlayerXName;
        
        if (this.gameState === 'ai') {
            this.localPlayerOName = 'الكمبيوتر';
        } else {
            this.localPlayerOName = newPlayerOName;
        }
        
        // تحديث العرض
        this.updateLocalPlayersDisplay();
        
        // إخفاء قسم الإعدادات
        const localPlayersSetup = document.getElementById('localPlayersSetup');
        if (localPlayersSetup) localPlayersSetup.style.display = 'none';
        
        // حفظ الأسماء في التخزين المحلي
        this.saveLocalPlayersNames();
        
        this.showNotification('✅ تم تطبيق أسماء اللاعبين بنجاح!', 'success');
    }
    
    resetPlayersNames() {
        // إعادة تعيين الأسماء الافتراضية
        this.localPlayerXName = 'اللاعب X';
        
        if (this.gameState === 'ai') {
            this.localPlayerOName = 'الكمبيوتر';
        } else {
            this.localPlayerOName = 'اللاعب O';
        }
        
        // تحديث حقول الإدخال
        const playerXInput = document.getElementById('localPlayerXName');
        const playerOInput = document.getElementById('localPlayerOName');
        
        if (playerXInput) playerXInput.value = this.localPlayerXName;
        if (playerOInput) playerOInput.value = this.localPlayerOName;
        
        // تحديث العرض
        this.updateLocalPlayersDisplay();
        
        // حفظ الأسماء المعاد تعيينها
        this.saveLocalPlayersNames();
        
        this.showNotification('🔄 تم إعادة تعيين أسماء اللاعبين للافتراضية', 'info');
    }
    
    updateLocalPlayersDisplay() {
        const playerXNameElement = document.getElementById('playerXName');
        const playerONameElement = document.getElementById('playerOName');
        
        if (playerXNameElement) playerXNameElement.textContent = this.localPlayerXName;
        if (playerONameElement) playerONameElement.textContent = this.localPlayerOName;
        
        // تحديث النص الحالي للاعب في حالة اللعب المحلي
        if (this.gameState === 'local' || this.gameState === 'ai') {
            this.updateLocalCurrentPlayerDisplay();
        }
    }
    
    updateLocalCurrentPlayerDisplay() {
        const currentPlayerText = document.getElementById('currentPlayerText');
        const currentPlayerSymbol = document.getElementById('currentPlayerSymbol');
        
        if (!currentPlayerSymbol || !currentPlayerText) return;
        
        const currentSymbol = currentPlayerSymbol.textContent;
        
        if (currentSymbol === 'X') {
            currentPlayerText.textContent = `دور ${this.localPlayerXName}`;
        } else if (currentSymbol === 'O') {
            currentPlayerText.textContent = `دور ${this.localPlayerOName}`;
        }
    }
    
    saveLocalPlayersNames() {
        try {
            const playersData = {
                playerXName: this.localPlayerXName,
                playerOName: this.localPlayerOName,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('localPlayersNames', JSON.stringify(playersData));
            console.log('💾 Players names saved to localStorage');
        } catch (error) {
            console.warn('⚠️ Could not save players names to localStorage:', error);
        }
    }
    
    loadLocalPlayersNames() {
        try {
            const savedData = localStorage.getItem('localPlayersNames');
            if (savedData) {
                const playersData = JSON.parse(savedData);
                this.localPlayerXName = playersData.playerXName || 'اللاعب X';
                this.localPlayerOName = playersData.playerOName || 'اللاعب O';
                console.log('📂 Players names loaded from localStorage');
            }
        } catch (error) {
            console.warn('⚠️ Could not load players names from localStorage:', error);
            this.localPlayerXName = 'اللاعب X';
            this.localPlayerOName = 'اللاعب O';
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
        this.hidePlayersSettingsButton(); // إخفاء زر الإعدادات في اللعب الأونلاين
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
        console.log('🚀 startGame called');
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
            if (this.gameState === 'local' || this.gameState === 'ai') {
                // تحديث محسن للعب المحلي
                if (currentPlayer === 'X') {
                    currentPlayerText.textContent = `دور ${this.localPlayerXName}`;
                } else {
                    currentPlayerText.textContent = `دور ${this.localPlayerOName}`;
                }
                currentPlayerText.style.color = '#2ecc71';
            } else if (this.currentRoom) {
                // تحديث للعب الأونلاين
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
        console.log('🚪 leaveRoom called');
        this.socket.emit('leaveRoom');
        this.gameState = 'menu';
        this.roomId = '';
        this.showMainMenu();
        this.showNotification('غادرت الغرفة', 'info');
    }
    
    backToMenu() {
        console.log('🏠 backToMenu called');
        if (this.gameState === 'playing' || this.gameState === 'waiting') {
            this.leaveRoom();
        } else {
            this.gameState = 'menu';
            this.showMainMenu();
        }
    }
    
    // دوال نسخ الأزرار
    copyRoomCodeOnly() {
        console.log('📋 copyRoomCodeOnly called');
        
        if (!this.roomId) {
            this.showNotification('لا يوجد رمز غرفة للنسخ', 'error');
            return;
        }
        
        navigator.clipboard.writeText(this.roomId).then(() => {
            this.showNotification(`✅ تم نسخ رمز الغرفة: ${this.roomId}`, 'success');
        }).catch(() => {
            this.showNotification('❌ فشل في نسخ رمز الغرفة', 'error');
        });
    }
    
    copyRoomCodeWithLink() {
        console.log('🔗 copyRoomCodeWithLink called');
        
        if (!this.roomId) {
            this.showNotification('لا يوجد رمز غرفة للنسخ', 'error');
            return;
        }
        
        const currentDate = new Date().toLocaleDateString('ar-SA');
        const currentTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        
        const message = `🎮 انضم للعب معي في لعبة X O الآن!

🏠 رمز الغرفة: ${this.roomId}
🔗 الرابط المباشر: ${window.location.origin}
📅 تاريخ الدعوة: ${currentDate} - ${currentTime}

📋 خطوات الانضمام:
1️⃣ افتح الرابط المرفق
2️⃣ أدخل اسمك في المربع  
3️⃣ اختر "الانضمام لغرفة"
4️⃣ أدخل رمز الغرفة: ${this.roomId}
5️⃣ ابدأ اللعب واستمتع! 🚀

⚡ ملاحظة: الغرفة متاحة الآن - انضم بسرعة!`;
        
        navigator.clipboard.writeText(message).then(() => {
            this.showNotification('🎉 تم نسخ الرابط والتعليمات كاملة!\nأرسله لصديقك الآن 📤', 'success');
        }).catch(() => {
            // في حالة فشل النسخ، انسخ الرمز فقط
            navigator.clipboard.writeText(this.roomId).then(() => {
                this.showNotification('✅ تم نسخ رمز الغرفة فقط', 'success');
            }).catch(() => {
                this.showNotification('❌ فشل في نسخ المعلومات', 'error');
            });
        });
    }
    
    // UI Management
    showPlayerSetup() {
        console.log('🔧 showPlayerSetup called');
        this.hideAllScreens();
        const playerSetup = document.getElementById('playerSetup');
        if (playerSetup) {
            playerSetup.style.display = 'block';
            console.log('✅ Player setup screen shown');
        } else {
            console.error('❌ playerSetup element not found');
        }
        
        const nameLoading = document.getElementById('nameLoading');
        const setNameBtn = document.getElementById('setNameBtn');
        if (nameLoading) nameLoading.style.display = 'none';
        if (setNameBtn) setNameBtn.disabled = false;
    }
    
    showMainMenu() {
        console.log('🏠 showMainMenu called');
        this.hideAllScreens();
        const mainMenu = document.getElementById('mainMenu');
        if (mainMenu) {
            mainMenu.style.display = 'block';
            console.log('✅ Main menu screen shown');
        } else {
            console.error('❌ mainMenu element not found');
        }
        
        const currentPlayerName = document.getElementById('currentPlayerName');
        if (currentPlayerName) currentPlayerName.textContent = this.playerName;
    }
    
    showGameArea() {
        console.log('🎮 showGameArea called');
        this.hideAllScreens();
        const gameArea = document.getElementById('gameArea');
        if (gameArea) {
            gameArea.style.display = 'block';
            console.log('✅ Game area screen shown');
        } else {
            console.error('❌ gameArea element not found');
        }
    }
    
    hideAllScreens() {
        const screens = ['playerSetup', 'mainMenu', 'roomSetup', 'gameArea'];
        screens.forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) {
                screen.style.display = 'none';
            } else {
                console.warn(`⚠️ Screen ${screenId} not found`);
            }
        });
        
        const roomLoading = document.getElementById('roomLoading');
        const joinRoomConfirmBtn = document.getElementById('joinRoomConfirmBtn');
        if (roomLoading) roomLoading.style.display = 'none';
        if (joinRoomConfirmBtn) joinRoomConfirmBtn.disabled = false;
    }
    
    showOnlineElements() {
        const onlineElements = ['roomInfo', 'onlineStatus', 'chatSection', 'leaveRoomBtn'];
        onlineElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) element.style.display = element.tagName === 'DIV' ? 'block' : 'inline-flex';
        });
    }
    
    hideOnlineElements() {
        const onlineElements = ['roomInfo', 'onlineStatus', 'chatSection', 'leaveRoomBtn'];
        onlineElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) element.style.display = 'none';
        });
    }
    
    showLocalElements() {
        const localGameModes = document.getElementById('localGameModes');
        const difficultySelector = document.getElementById('difficultySelector');
        
        if (localGameModes) {
            localGameModes.style.display = 'none';
        }
        
        if (difficultySelector) {
            difficultySelector.style.display = this.gameState === 'ai' ? 'block' : 'none';
        }
    }
    
    hideLocalElements() {
        const localElements = ['localGameModes', 'difficultySelector'];
        localElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) element.style.display = 'none';
        });
    }
    
    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    playMoveSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            console.warn('Could not play sound');
        }
    }
    
    playSound(type) {
        const frequencies = {
            win: 1000,
            lose: 400,
            tie: 600
        };
        
        if (!frequencies[type]) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.warn('Could not play sound');
        }
    }
    
    showNotification(message, type = 'info') {
        const notificationsContainer = document.getElementById('notifications');
        if (!notificationsContainer) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = message.replace(/\n/g, '<br>');
        
        notificationsContainer.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 4000);
    }
}

// Initialize online game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing online game...');
    console.log('📅 Current Date:', new Date().toLocaleDateString('ar-SA'));
    console.log('🕐 Current Time:', new Date().toLocaleTimeString('ar-SA'));
    
    // إزالة أي تهيئة سابقة
    if (window.onlineGame) {
        delete window.onlineGame;
    }
    
    // تأخير قصير للتأكد من تحميل جميع العناصر
    setTimeout(() => {
        window.onlineGame = new OnlineGame();
        console.log('✅ Online game initialized successfully');
    }, 200);
});
