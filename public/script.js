class TicTacToe {
    constructor() {
        this.board = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.gameMode = 'pvp'; // 'pvp' or 'pvc'
        this.difficulty = 'medium';
        this.isGameActive = true;
        this.scores = {
            X: 0,
            O: 0,
            tie: 0
        };
        
        this.winningConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];
        
        this.sounds = {
            move: this.createSound(800, 0.1),
            win: this.createSound(1000, 0.3),
            lose: this.createSound(400, 0.3),
            tie: this.createSound(600, 0.2)
        };
        
        this.initializeGame();
        this.createParticles();
    }
    
    initializeGame() {
        this.bindEvents();
        this.updateScoreDisplay();
        this.updateCurrentPlayerDisplay();
        this.loadSavedScores();
        this.showWelcomeMessage();
    }
    
    showWelcomeMessage() {
        setTimeout(() => {
            this.showNotification('مرحباً! اللعبة جاهزة للعب 🎮', 'success');
        }, 500);
    }
    
    bindEvents() {
        // Game mode buttons
        const pvpMode = document.getElementById('pvpMode');
        const pvcMode = document.getElementById('pvcMode');
        
        if (pvpMode && pvcMode) {
            pvpMode.addEventListener('click', () => this.setGameMode('pvp'));
            pvcMode.addEventListener('click', () => this.setGameMode('pvc'));
        }
        
        // Difficulty selector
        const difficultySelect = document.getElementById('difficulty');
        if (difficultySelect) {
            difficultySelect.addEventListener('change', (e) => {
                this.difficulty = e.target.value;
                this.showNotification(`تم تغيير الصعوبة إلى: ${this.getDifficultyText(e.target.value)}`, 'info');
            });
        }
        
        // Game board cells
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });
        
        // Control buttons
        const resetBtn = document.getElementById('resetBtn');
        const playAgainBtn = document.getElementById('playAgainBtn');
        const newGameBtn = document.getElementById('newGameBtn');
        
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetGame());
        if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.playAgain());
        if (newGameBtn) newGameBtn.addEventListener('click', () => this.newGame());
    }
    
    getDifficultyText(difficulty) {
        const texts = {
            'easy': 'سهل',
            'medium': 'متوسط', 
            'hard': 'صعب'
        };
        return texts[difficulty] || 'متوسط';
    }
    
    setGameMode(mode) {
        this.gameMode = mode;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(mode === 'pvp' ? 'pvpMode' : 'pvcMode');
        if (activeBtn) activeBtn.classList.add('active');
        
        // Show/hide difficulty selector
        const difficultySelector = document.getElementById('difficultySelector');
        if (difficultySelector) {
            difficultySelector.style.display = mode === 'pvc' ? 'block' : 'none';
        }
        
        this.resetGame();
        
        if (mode === 'pvc') {
            this.showNotification('تم تفعيل وضع اللعب ضد الكمبيوتر 🤖', 'success');
        } else {
            this.showNotification('تم تفعيل وضع اللعب بين لاعبين 👥', 'success');
        }
    }
    
    handleCellClick(event) {
        const cellIndex = parseInt(event.target.getAttribute('data-index'));
        
        if (this.board[cellIndex] !== '' || !this.isGameActive) {
            return;
        }
        
        this.makeMove(cellIndex, this.currentPlayer);
        
        if (this.gameMode === 'pvc' && this.currentPlayer === 'O' && this.isGameActive) {
            // Add thinking delay for AI
            this.showThinking();
            setTimeout(() => {
                this.hideThinking();
                this.makeComputerMove();
            }, Math.random() * 1500 + 500);
        }
    }
    
    showThinking() {
        const currentPlayerText = document.getElementById('currentPlayerText');
        const currentPlayerSymbol = document.getElementById('currentPlayerSymbol');
        
        if (currentPlayerText) currentPlayerText.textContent = 'الكمبيوتر يفكر...';
        if (currentPlayerSymbol) currentPlayerSymbol.style.animation = 'pulse 0.5s infinite';
    }
    
    hideThinking() {
        const currentPlayerText = document.getElementById('currentPlayerText');
        const currentPlayerSymbol = document.getElementById('currentPlayerSymbol');
        
        if (currentPlayerText) {
            currentPlayerText.textContent = this.gameMode === 'pvc' ? 
                (this.currentPlayer === 'X' ? 'دورك' : 'دور الكمبيوتر') : 'دور اللاعب';
        }
        if (currentPlayerSymbol) currentPlayerSymbol.style.animation = 'pulse 2s infinite';
    }
    
    makeMove(cellIndex, player) {
        this.board[cellIndex] = player;
        const cell = document.querySelector(`[data-index="${cellIndex}"]`);
        if (cell) {
            cell.textContent = player;
            cell.classList.add(player.toLowerCase());
            
            // Add animation effect
            cell.style.animation = 'cellPop 0.5s ease';
        }
        
        // Play sound effect
        this.playSound('move');
        
        if (this.checkWinner()) {
            this.endGame(player);
        } else if (this.board.every(cell => cell !== '')) {
            this.endGame('tie');
        } else {
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            this.updateCurrentPlayerDisplay();
        }
    }
    
    makeComputerMove() {
        let move;
        
        switch (this.difficulty) {
            case 'easy':
                move = this.getRandomMove();
                break;
            case 'medium':
                move = this.getMediumMove();
                break;
            case 'hard':
                move = this.getBestMove();
                break;
            default:
                move = this.getRandomMove();
        }
        
        if (move !== -1) {
            this.makeMove(move, 'O');
        }
    }
    
    getRandomMove() {
        const availableMoves = this.board
            .map((cell, index) => cell === '' ? index : null)
            .filter(val => val !== null);
        
        return availableMoves.length > 0 
            ? availableMoves[Math.floor(Math.random() * availableMoves.length)]
            : -1;
    }
    
    getMediumMove() {
        // Try to win first
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = 'O';
                if (this.checkWinnerForPlayer('O')) {
                    this.board[i] = '';
                    return i;
                }
                this.board[i] = '';
            }
        }
        
        // Try to block player from winning
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = 'X';
                if (this.checkWinnerForPlayer('X')) {
                    this.board[i] = '';
                    return i;
                }
                this.board[i] = '';
            }
        }
        
        // Prefer center and corners
        const preferredMoves = [4, 0, 2, 6, 8, 1, 3, 5, 7];
        for (let move of preferredMoves) {
            if (this.board[move] === '') {
                return move;
            }
        }
        
        return this.getRandomMove();
    }
    
    getBestMove() {
        let bestScore = -Infinity;
        let bestMove = -1;
        
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = 'O';
                let score = this.minimax(this.board, 0, false);
                this.board[i] = '';
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }
        
        return bestMove;
    }
    
    minimax(board, depth, isMaximizing) {
        if (this.checkWinnerForPlayer('O')) return 10 - depth;
        if (this.checkWinnerForPlayer('X')) return depth - 10;
        if (board.every(cell => cell !== '')) return 0;
        
        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = 'O';
                    let score = this.minimax(board, depth + 1, false);
                    board[i] = '';
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = 'X';
                    let score = this.minimax(board, depth + 1, true);
                    board[i] = '';
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }
    
    checkWinner() {
        return this.winningConditions.some(condition => {
            const [a, b, c] = condition;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                this.highlightWinningCells(condition);
                return true;
            }
            return false;
        });
    }
    
    checkWinnerForPlayer(player) {
        return this.winningConditions.some(condition => {
            const [a, b, c] = condition;
            return this.board[a] === player && this.board[b] === player && this.board[c] === player;
        });
    }
    
    highlightWinningCells(winningCondition) {
        winningCondition.forEach(index => {
            const cell = document.querySelector(`[data-index="${index}"]`);
            if (cell) cell.classList.add('winning');
        });
    }
    
    endGame(winner) {
        this.isGameActive = false;
        
        if (winner === 'tie') {
            this.scores.tie++;
            this.showResult('🤝', 'تعادل!', '#f39c12');
            this.playSound('tie');
        } else {
            this.scores[winner]++;
            const winnerText = winner === 'X' ? 'اللاعب X فاز!' : (this.gameMode === 'pvc' ? 'الكمبيوتر فاز!' : 'اللاعب O فاز!');
            const winnerColor = winner === 'X' ? '#e74c3c' : '#3498db';
            this.showResult('🎉', winnerText, winnerColor);
            
            if (this.gameMode === 'pvc') {
                this.playSound(winner === 'X' ? 'win' : 'lose');
            } else {
                this.playSound('win');
            }
        }
        
        this.updateScoreDisplay();
        this.saveScores();
        this.addFireworks();
    }
    
    showResult(icon, text, color) {
        const resultModal = document.getElementById('gameResult');
        const resultIcon = document.getElementById('resultIcon');
        const resultText = document.getElementById('resultText');
        
        if (resultIcon) resultIcon.textContent = icon;
        if (resultText) {
            resultText.textContent = text;
            resultText.style.color = color;
        }
        if (resultModal) resultModal.style.display = 'flex';
    }
    
    hideResult() {
        const resultModal = document.getElementById('gameResult');
        if (resultModal) resultModal.style.display = 'none';
    }
    
    updateScoreDisplay() {
        const scoreX = document.getElementById('scoreX');
        const scoreO = document.getElementById('scoreO');
        const scoreTie = document.getElementById('scoreTie');
        
        if (scoreX) scoreX.textContent = this.scores.X;
        if (scoreO) scoreO.textContent = this.scores.O;
        if (scoreTie) scoreTie.textContent = this.scores.tie;
    }
    
    updateCurrentPlayerDisplay() {
        const currentPlayerSymbol = document.getElementById('currentPlayerSymbol');
        const currentPlayerText = document.getElementById('currentPlayerText');
        
        if (currentPlayerSymbol) {
            currentPlayerSymbol.textContent = this.currentPlayer;
            currentPlayerSymbol.style.color = this.currentPlayer === 'X' ? '#e74c3c' : '#3498db';
        }
        
        if (currentPlayerText) {
            if (this.gameMode === 'pvc') {
                currentPlayerText.textContent = this.currentPlayer === 'X' ? 'دورك' : 'دور الكمبيوتر';
            } else {
                currentPlayerText.textContent = 'دور اللاعب';
            }
        }
    }
    
    resetGame() {
        this.board = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.isGameActive = true;
        
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'winning');
            cell.style.animation = '';
        });
        
        this.hideResult();
        this.updateCurrentPlayerDisplay();
        this.showNotification('تم إعادة تشغيل اللعبة 🔄', 'info');
    }
    
    playAgain() {
        this.resetGame();
    }
    
    newGame() {
        this.resetGame();
        this.scores = { X: 0, O: 0, tie: 0 };
        this.updateScoreDisplay();
        this.saveScores();
        this.showNotification('تم بدء لعبة جديدة 🎮', 'success');
    }
    
    saveScores() {
        try {
            localStorage.setItem('ticTacToeScores', JSON.stringify(this.scores));
        } catch (e) {
            console.warn('Could not save scores to localStorage');
        }
    }
    
    loadSavedScores() {
        try {
            const savedScores = localStorage.getItem('ticTacToeScores');
            if (savedScores) {
                this.scores = { ...this.scores, ...JSON.parse(savedScores) };
                this.updateScoreDisplay();
            }
        } catch (e) {
            console.warn('Could not load scores from localStorage');
        }
    }
    
    createSound(frequency, duration) {
        return { frequency, duration };
    }
    
    playSound(type) {
        if (!this.sounds[type]) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(this.sounds[type].frequency, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + this.sounds[type].duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + this.sounds[type].duration);
        } catch (e) {
            console.warn('Could not play sound');
        }
    }
    
    createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;
        
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
            particlesContainer.appendChild(particle);
        }
    }
    
    addFireworks() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;
        
        // Create temporary fireworks
        for (let i = 0; i < 20; i++) {
            const firework = document.createElement('div');
            firework.className = 'particle';
            firework.style.left = Math.random() * 100 + '%';
            firework.style.top = Math.random() * 100 + '%';
            firework.style.background = `hsl(${Math.random() * 360}, 70%, 60%)`;
            firework.style.animation = 'firework 1s ease-out forwards';
            particlesContainer.appendChild(firework);
            
            // Remove after animation
            setTimeout(() => {
                if (firework.parentNode) {
                    firework.parentNode.removeChild(firework);
                }
            }, 1000);
        }
    }
    
    showNotification(message, type = 'info') {
        const notificationsContainer = document.getElementById('notifications');
        if (!notificationsContainer) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notificationsContainer.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }
}

// Add firework animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes firework {
        0% { transform: scale(0) rotate(0deg); opacity: 1; }
        100% { transform: scale(3) rotate(360deg); opacity: 0; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize local game if not in online mode
    if (!window.onlineGame) {
        window.localGame = new TicTacToe();
    }
});