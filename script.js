// Łączymy się z serwerem Socket.IO
const socket = io();

// ===== DŹWIĘKI =====
const flipSound = new Audio('flip.mp3');
const winSound = new Audio('win.mp3');
flipSound.volume = 0.5;
winSound.volume = 0.3;

// ===== OBIEKT MOTYWÓW =====
const themes = {
    default: ['💎', '🤖', '👽', '👻', '💀', '🎃', '🚀', '🍄', '🛸', '☄️', '🪐', '🕹️', '💾', '💿', '📼', '📞', '📺', '💰', '💣', '⚔️', '🛡️', '🔑', '🎁', '🧱', '🧭', '🔋', '🧪', '🧬', '🔭', '💡'],
    nature: ['🌳', '🌲', '🍁', '🍂', '🌿', '🌸', '🌻', '🌊', '⛰️', '🌋', '🌾', '🐚', '🕸️', '🐞', '🦋', '🏞️', '🌅', '🌌'],
    food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🥐', '🍞', '🥨', '🧀', '🥞', '🧇', '🍗', '🍣', '🍤', '🍩', '🍪', '🍰', '🧁'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦']
};

// ===== DEFINICJA OSIĄGNIĘĆ (ZAKTUALIZOWANA) =====
const allAchievements = {
    'first_solo_game': { icon: '🌱', title: 'Pierwsze Kroki', description: 'Ukończ swoją pierwszą grę solo.' },
    'fast_win_easy':   { icon: '⚡', title: 'Szybki jak Błyskawica', description: 'Ukończ grę 4x4 w mniej niż 30 sekund.' },
    'perfect_game':    { icon: '🎯', title: 'Perfekcjonista', description: 'Ukończ grę solo bez ani jednej pomyłki.' },
    'master_mind':     { icon: '🧠', title: 'Geniusz Pamięci', description: 'Ukończ grę na poziomie 6x6.' },
    'first_multi_win': { icon: '⚔️', title: 'Pierwsze Zwycięstwo', description: 'Wygraj swój pierwszy pojedynek multiplayer.' },
    
    // NOWE OSIĄGNIĘCIA
    'no_powerups_hard': { icon: '🧘', title: 'Czysty Umysł', description: 'Ukończ grę 6x6 bez użycia power-upów.' },
    'win_streak_3':     { icon: '🔥', title: 'W Gazie!', description: 'Wygraj 3 gry multiplayer z rzędu.' },
    'connoisseur':      { icon: '🎨', title: 'Koneser', description: 'Zagraj grę każdym z 4 motywów.' }
};
let unlockedAchievements = new Set();
// ===================================

// Funkcja tasująca
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- Stan Gry ---
    let firstCard = null;
    let secondCard = null;
    let lockBoard = false;
    let pairsFound = 0;
    let totalPairs = 0;
    let moves = 0;
    let seconds = 0;
    let timerInterval = null;
    let opponentPairsFound = 0;
    let isSoloMode = false;
    let currentRows = 0;
    let currentCols = 0;
    let currentTheme = 'default';
    let currentGameMode = 'race';
    let myTurn = false; 
    let isGuest = true;
    let authToken = null;
    let powerUpUsedThisGame = false; // NOWA FLAGA
    let themesPlayedGuest = new Set(); // NOWA FLAGA DLA GOŚCI
    
    let currentUser = {
        username: "Gość",
        achievements: [],
        totalGamesPlayed: 0,
        totalWins: 0,
        soloBestTimeEasy: 9999,
        soloBestTimeMedium: 9999,
        soloBestTimeHard: 9999,
        winStreak: 0,
        themesPlayed: []
    };

    // --- Pobranie elementów DOM (Autoryzacja) ---
    const authPanel = document.getElementById('auth-panel');
    const authBtn = document.getElementById('auth-btn'); 
    const authCloseBtn = document.getElementById('auth-close-btn'); 
    const loginTabBtn = document.getElementById('login-tab-btn');
    const registerTabBtn = document.getElementById('register-tab-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authMessage = document.getElementById('auth-message');
    const logoutBtn = document.getElementById('logout-btn');
    const welcomeMessage = document.getElementById('welcome-message');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login-link');

    // --- Pobranie elementów DOM (Lobby) ---
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const modeSelection = document.getElementById('mode-selection');
    const soloOptions = document.getElementById('solo-options');
    const multiOptions = document.getElementById('multi-options');
    const multiCreateJoin = document.getElementById('multi-create-join');
    const multiCreateDetails = document.getElementById('multi-create-details');
    const multiJoinDetails = document.getElementById('multi-join-details');
    const themeSelection = document.getElementById('theme-selection'); 
    const themeBtns = document.querySelectorAll('.theme-btn');
    const gameDescription = document.querySelector('.game-description');
    const themeSelectionSoloContainer = document.getElementById('theme-selection-solo');
    const themeSelectionMultiContainer = document.getElementById('theme-selection-multi');
    const btnSelectSolo = document.getElementById('btn-select-solo');
    const btnSelectMulti = document.getElementById('btn-select-multi');
    const btnSoloEasy = document.getElementById('btn-solo-easy');
    const btnSoloMedium = document.getElementById('btn-solo-medium');
    const btnSoloHard = document.getElementById('btn-solo-hard');
    const btnBackToMode = document.getElementById('btn-back-to-mode');
    const btnShowCreateGame = document.getElementById('btn-show-create-game');
    const btnShowJoinGame = document.getElementById('btn-show-join-game');
    const btnBackToModeMulti = document.getElementById('btn-back-to-mode-multi');
    const btnMultiEasy = document.getElementById('btn-multi-easy');
    const btnMultiMedium = document.getElementById('btn-multi-medium');
    const btnMultiHard = document.getElementById('btn-multi-hard');
    const btnBackToMultiOptionsFromCreate = document.getElementById('btn-back-to-multi-options-from-create');
    const gameIdInput = document.getElementById('game-id-input');
    const btnJoinGame = document.getElementById('btn-join-game');
    const btnBackToMultiOptionsFromJoin = document.getElementById('btn-back-to-multi-options-from-join');
    const gameIdContainer = document.getElementById('game-id-container');
    const gameIdDisplay = document.getElementById('game-id-display');
    const copyGameIdBtn = document.getElementById('copy-game-id-btn');
    const lobbyMessage = document.getElementById('lobby-message');

    // --- Pobranie elementów DOM (Gra) ---
    const gameBoard = document.getElementById('game-board');
    const turnInfo = document.getElementById('turn-info');
    const playerInfoPanel = document.getElementById('player-info');
    const opponentInfoPanel = document.getElementById('opponent-info');
    const pairsFoundSpan = document.getElementById('pairs-found');
    const totalPairsSpan = document.getElementById('total-pairs');
    const moveCounterSpan = document.getElementById('move-counter');
    const timerSpan = document.getElementById('timer');
    const btnRestart = document.getElementById('btn-restart');
    const opponentPairsSpan = document.getElementById('opponent-pairs-found');
    const opponentTotalPairsSpan = document.getElementById('opponent-total-pairs');
    const stat1Container = document.getElementById('stat1-container');
    const stat1Label = document.getElementById('stat1-label');
    const stat1Value = document.getElementById('stat1-value');
    const stat1Unit = document.getElementById('stat1-unit');
    const stat2Container = document.getElementById('stat2-container');
    const stat2Label = document.getElementById('stat2-label');
    const stat2Value = document.getElementById('stat2-value');
    const powerUpContainer = document.getElementById('powerup-container');
    const powerUpPeekBtn = document.getElementById('powerup-peek');
    const powerUpAutopairBtn = document.getElementById('powerup-autopair');

    // --- Pobranie elementów DOM (Modal) ---
    const winModal = document.getElementById('win-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalRecordMessage = document.getElementById('modal-record-message');
    const modalPlayAgainBtn = document.getElementById('modal-play-again');
    const modalRematchBtn = document.getElementById('modal-rematch');
    const modalRematchStatus = document.getElementById('modal-rematch-status');
    const soloWinModal = document.getElementById('solo-win-modal');
    const soloModalTitle = document.getElementById('solo-modal-title');
    const soloModalMessage = document.getElementById('solo-modal-message');
    const soloModalRecordMessage = document.getElementById('solo-modal-record-message');
    const soloModalPlayAgainBtn = document.getElementById('solo-modal-play-again'); 
    const soloModalReplayBtn = document.getElementById('solo-modal-replay');
    const soloModalNextLevelBtn = document.getElementById('solo-modal-next-level');

    // --- Pobranie elementów DOM (Osiągnięcia i Motyw) ---
    const achievementsBtn = document.getElementById('achievements-btn');
    const achievementsModal = document.getElementById('achievements-modal');
    const achievementsList = document.getElementById('achievements-list');
    const achievementsCloseBtn = document.getElementById('achievements-close-btn');
    const toastNotification = document.getElementById('toast-notification');
    const themeToggleBtn = document.getElementById('theme-toggle-btn'); 
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const leaderboardModal = document.getElementById('leaderboard-modal');
    const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
    const leaderboardTabTime = document.getElementById('leaderboard-tab-time');
    const leaderboardTabWins = document.getElementById('leaderboard-tab-wins');
    const leaderboardListTime = document.getElementById('leaderboard-list-time');
    const leaderboardListWins = document.getElementById('leaderboard-list-wins');
    // ==================================

    // ================================================================
    // ===== LOGIKA TRYBU CIEMNEGO =====
    // ================================================================
    
    function updateThemeButtonIcon() {
        if (document.documentElement.classList.contains('dark-mode')) {
            themeToggleBtn.textContent = '☀️';
        } else {
            themeToggleBtn.textContent = '🌙';
        }
    }
    
    updateThemeButtonIcon(); 

    themeToggleBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode'); 
        if (document.documentElement.classList.contains('dark-mode')) {
            localStorage.setItem('memorr_theme', 'dark');
        } else {
            localStorage.setItem('memorr_theme', 'light');
        }
        updateThemeButtonIcon();
    });

    // ================================================================
    // ===== LOGIKA AUTORYZACJI (LOGOWANIE/REJESTRACJA) ==========
    // ================================================================
    
    authBtn.addEventListener('click', () => {
        authPanel.classList.remove('hidden');
        loginTabBtn.click();
    });

    authCloseBtn.addEventListener('click', () => {
        authPanel.classList.add('hidden');
    });

    authPanel.addEventListener('click', (e) => {
        if (e.target === authPanel) {
            authPanel.classList.add('hidden');
        }
    });

    loginTabBtn.addEventListener('click', () => {
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        forgotPasswordForm.classList.add('hidden');
        authMessage.textContent = '';
        authMessage.style.color = "var(--accent-red)";
    });

    registerTabBtn.addEventListener('click', () => {
        loginTabBtn.classList.remove('active');
        registerTabBtn.classList.add('active');
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        forgotPasswordForm.classList.add('hidden');
        authMessage.textContent = '';
        authMessage.style.color = "var(--accent-red)";
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        forgotPasswordForm.classList.remove('hidden');
        authMessage.textContent = '';
    });
    
    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginTabBtn.click();
    });
    
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        authMessage.textContent = 'Przetwarzanie...';
        authMessage.style.color = "var(--text-secondary)";

        try {
            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (!response.ok) {
                authMessage.style.color = "var(--accent-red)";
                authMessage.textContent = data.message;
            } else {
                authMessage.style.color = "var(--accent-blue)";
                authMessage.textContent = data.message;
            }
        } catch (error) {
            authMessage.style.color = "var(--accent-red)";
            authMessage.textContent = 'Błąd połączenia. Sprawdź serwer.';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        if (password.length < 6) {
            authMessage.textContent = 'Hasło musi mieć co najmniej 6 znaków.';
            return;
        }
        if (username.length < 3) {
            authMessage.textContent = 'Nazwa użytkownika musi mieć co najmniej 3 znaki.';
            return;
        }
        authMessage.textContent = 'Przetwarzanie...';
        authMessage.style.color = "var(--text-secondary)";

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                authMessage.style.color = "var(--accent-red)";
                authMessage.textContent = data.message;
            } else {
                authMessage.style.color = "var(--accent-blue)";
                authMessage.textContent = data.message;
                loginTabBtn.click();
            }
        } catch (error) {
            console.error('Błąd Fetch:', error);
            authMessage.style.color = "var(--accent-red)";
            authMessage.textContent = 'Błąd połączenia. Sprawdź, czy serwer działa.';
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authMessage.textContent = 'Logowanie...';
        authMessage.style.color = "var(--text-secondary)";

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                authMessage.style.color = "var(--accent-red)";
                authMessage.textContent = data.message;
            } else {
                isGuest = false;
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('memorr_token', data.token); 
                loadAchievements(data.user.achievements); 
                authPanel.classList.add('hidden');
                showLobbyUI(currentUser.username, isGuest);
            }
        } catch (error) {
            console.error('Błąd Fetch:', error);
            authMessage.style.color = "var(--accent-red)";
            authMessage.textContent = 'Błąd połączenia. Sprawdź, czy serwer działa.';
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('memorr_token');
        window.location.reload();
    });


    // ================================================================
    // ===== LOGIKA LOBBY I NAWIGACJI =================================
    // ================================================================

    function showModeSelection() {
        modeSelection.classList.remove('hidden');
        gameDescription.classList.remove('hidden');
        themeSelection.classList.add('hidden');
        soloOptions.classList.add('hidden');
        multiOptions.classList.add('hidden');
        lobbyMessage.textContent = '';
        gameIdContainer.classList.add('hidden');
        gameIdInput.value = '';
    }

    function showSoloOptions() {
        isSoloMode = true;
        modeSelection.classList.add('hidden');
        gameDescription.classList.add('hidden');
        multiOptions.classList.add('hidden');
        themeSelectionSoloContainer.appendChild(themeSelection);
        themeSelection.classList.remove('hidden');
        soloOptions.classList.remove('hidden');
        lobbyMessage.textContent = '';
    }

    function showMultiOptions() {
        isSoloMode = false;
        modeSelection.classList.add('hidden');
        gameDescription.classList.add('hidden');
        soloOptions.classList.add('hidden');
        multiOptions.classList.remove('hidden');
        multiCreateJoin.classList.remove('hidden');
        multiCreateDetails.classList.add('hidden');
        multiJoinDetails.classList.add('hidden');
        lobbyMessage.textContent = '';
        gameIdContainer.classList.add('hidden');
        gameIdInput.value = '';
    }

    function showMultiCreateDetails() {
        multiCreateJoin.classList.add('hidden');
        multiCreateDetails.insertBefore(themeSelection, gameIdContainer);
        themeSelection.classList.remove('hidden');
        multiCreateDetails.classList.remove('hidden');
        lobbyMessage.textContent = '';
        gameIdContainer.classList.add('hidden');
    }

    function showMultiJoinDetails() {
        multiCreateJoin.classList.add('hidden');
        multiCreateDetails.classList.add('hidden');
        themeSelection.classList.add('hidden');
        multiJoinDetails.classList.remove('hidden');
        lobbyMessage.textContent = '';
    }

    btnSelectSolo.addEventListener('click', showSoloOptions);
    btnSelectMulti.addEventListener('click', showMultiOptions);
    btnBackToMode.addEventListener('click', showModeSelection);
    btnBackToModeMulti.addEventListener('click', showModeSelection);
    btnShowCreateGame.addEventListener('click', showMultiCreateDetails);
    btnShowJoinGame.addEventListener('click', showMultiJoinDetails);
    btnBackToMultiOptionsFromCreate.addEventListener('click', showMultiOptions);
    btnBackToMultiOptionsFromJoin.addEventListener('click', showMultiOptions);
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentTheme = btn.dataset.theme;
        });
    });
    btnSoloEasy.addEventListener('click', () => startSoloGame(4, 4));
    btnSoloMedium.addEventListener('click', () => startSoloGame(6, 4));
    btnSoloHard.addEventListener('click', () => startSoloGame(6, 6));
    btnMultiEasy.addEventListener('click', () => createMultiGame(4, 4));
    btnMultiMedium.addEventListener('click', () => createMultiGame(6, 4));
    btnMultiHard.addEventListener('click', () => createMultiGame(6, 6));
    
    btnJoinGame.addEventListener('click', () => {
        const gameID = gameIdInput.value.trim();
        if (gameID) {
            socket.emit('joinGame', { 
                gameID,
                token: localStorage.getItem('memorr_token')
            });
            lobbyMessage.textContent = 'Próbuję dołączyć do gry...';
        } else {
            lobbyMessage.textContent = 'Proszę wpisać ID gry.';
        }
    });
    
    copyGameIdBtn.addEventListener('click', () => {
        const gameID = gameIdDisplay.textContent;
        navigator.clipboard.writeText(gameID).then(() => {
            lobbyMessage.textContent = `Skopiowano kod: ${gameID}`;
            copyGameIdBtn.classList.add('copied');
            const currentMessage = lobbyMessage.textContent;
            setTimeout(() => {
                copyGameIdBtn.classList.remove('copied');
                if (lobbyMessage.textContent === currentMessage) {
                    lobbyMessage.textContent = 'Czekam na przeciwnika...';
                }
            }, 2000);
        }).catch(err => {
            lobbyMessage.textContent = 'Nie udało się skopiować.';
        });
    });
    btnRestart.addEventListener('click', () => showLobbyUI(currentUser.username, isGuest));
    modalPlayAgainBtn.addEventListener('click', () => showLobbyUI(currentUser.username, isGuest));
    soloModalPlayAgainBtn.addEventListener('click', () => showLobbyUI(currentUser.username, isGuest));
    
    soloModalReplayBtn.addEventListener('click', () => {
        soloWinModal.classList.add('hidden');
        startSoloGame(currentRows, currentCols);
    });

    soloModalNextLevelBtn.addEventListener('click', () => {
        soloWinModal.classList.add('hidden');
        if (currentRows === 4 && currentCols === 4) {
            startSoloGame(6, 4);
        } else if (currentRows === 6 && currentCols === 4) {
            startSoloGame(6, 6);
        }
    });
    
    modalRematchBtn.addEventListener('click', () => {
        socket.emit('requestRematch');
        modalRematchStatus.textContent = 'Wysłano prośbę o rewanż... Czekam...';
        modalRematchBtn.classList.add('hidden');
    });

    function createMultiGame(rows, cols) {
        lobbyMessage.textContent = 'Tworzenie gry...';
        const selectedMode = document.querySelector('input[name="gameMode"]:checked').value;
        currentGameMode = selectedMode;
        socket.emit('createGame', { 
            rows, 
            cols, 
            theme: currentTheme, 
            gameMode: currentGameMode,
            token: localStorage.getItem('memorr_token')
        });
    }

    function showLobbyUI(username, isGuest = true) {
        authPanel.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        
        welcomeMessage.textContent = `Witaj, ${username}!`;
        
        leaderboardBtn.classList.remove('hidden');
        
        if (isGuest) {
            logoutBtn.classList.add('hidden');
            authBtn.classList.remove('hidden');
        } else {
            logoutBtn.classList.remove('hidden');
            authBtn.classList.add('hidden');
        }

        gameScreen.classList.add('hidden');
        winModal.classList.add('hidden');
        soloWinModal.classList.add('hidden');
        showModeSelection();
    }

    function showGameUI() {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        winModal.classList.add('hidden');
        soloWinModal.classList.add('hidden');
    }

    // ================================================================
    // ===== OBSŁUGA ZDARZEŃ SOCKET.IO =================================
    // ================================================================
    socket.on('gameCreated', (data) => {
        gameIdDisplay.textContent = data.gameID;
        gameIdContainer.classList.remove('hidden');
        lobbyMessage.textContent = 'Stworzono grę. Czekam na przeciwnika...';
    });
    socket.on('gameStarted', (data) => {
        winModal.classList.add('hidden');
        soloWinModal.classList.add('hidden');
        currentGameMode = data.gameMode;
        startMultiplayerGame(data); 
        if (currentGameMode === 'classic') {
            myTurn = (socket.id === data.turn);
            updateTurnUI(myTurn); 
        }
    });
    socket.on('opponentFoundMatch', () => {
        if (currentGameMode === 'race') {
            opponentPairsFound++;
            opponentPairsSpan.textContent = opponentPairsFound;
        }
    });
    socket.on('youWon', () => {
        stopTimer();
        showWinModal(true, false);
    });
    socket.on('youLost', () => {
        stopTimer();
        showWinModal(false, false);
    });
    socket.on('classic:boardUpdate', (data) => {
        const allCards = document.querySelectorAll('.card');
        if (data.type === 'flip') {
            allCards[data.cardIndex].classList.add('flipped');
        } else if (data.type === 'match') {
            allCards[data.cardIndex1].classList.add('matched');
            allCards[data.cardIndex2].classList.add('matched');
        } else if (data.type === 'unflip') {
            lockBoard = true;
            setTimeout(() => {
                allCards[data.cardIndex1].classList.remove('flipped');
                allCards[data.cardIndex2].classList.remove('flipped');
                lockBoard = false;
            }, 1000);
        }
    });
    socket.on('classic:turnUpdate', (isMyTurn) => {
        myTurn = isMyTurn;
        updateTurnUI(isMyTurn);
    });
    socket.on('classic:scoreUpdate', (scores) => {
        if (!pairsFoundSpan || !opponentPairsSpan) return; 
        const myScore = scores[socket.id];
        const opponentSocketId = Object.keys(scores).find(id => id !== socket.id);
        const opponentScore = opponentSocketId ? scores[opponentSocketId] : 0;
        pairsFoundSpan.textContent = myScore;
        opponentPairsSpan.textContent = opponentScore;
    });
    socket.on('classic:gameTied', () => {
        stopTimer();
        showWinModal(false, false, true);
    });
    socket.on('rematchOffered', () => {
        if (winModal.classList.contains('hidden')) {
            showWinModal(false, false);
        }
        modalRematchStatus.textContent = 'Przeciwnik chce zagrać rewanż!';
        modalRematchBtn.classList.remove('hidden');
    });
    socket.on('opponentDisconnected', () => {
        stopTimer();
        if (gameScreen.classList.contains('hidden') === false) {
            modalTitle.textContent = 'Koniec Gry';
            modalMessage.textContent = 'Przeciwnik się rozłączył. Wygrałeś!';
            modalRecordMessage.classList.add('hidden');
            modalPlayAgainBtn.classList.remove('hidden');
            modalRematchBtn.classList.add('hidden');
            modalRematchStatus.classList.add('hidden');
            winModal.classList.remove('hidden');
        } else {
            showLobbyUI(currentUser.username, isGuest);
            lobbyMessage.textContent = "Przeciwnik się rozłączył.";
        }
    });
    socket.on('error', (message) => {
        lobbyMessage.textContent = message;
        if (multiCreateDetails.classList.contains('hidden') === false) {
             setTimeout(showMultiOptions, 2000);
        }
    });
    socket.on('powerUp:peek', () => {
        executePeek();
    });
    socket.on('powerUp:used', (powerUpType) => {
        const btn = (powerUpType === 'peek') ? powerUpPeekBtn : powerUpAutopairBtn;
        btn.disabled = true;
    });

    // ================================================================
    // ===== LOGIKA OSIĄGNIĘĆ ========================================
    // ================================================================

    function loadAchievements(achievementsFromServer = null) {
        if (isGuest) {
            const data = localStorage.getItem('memorr_achievements_guest');
            unlockedAchievements = new Set(JSON.parse(data || '[]'));
            themesPlayedGuest = new Set(JSON.parse(localStorage.getItem('memorr_themes_guest') || '[]'));
        } else {
            unlockedAchievements = new Set(achievementsFromServer || []);
        }
    }

    function saveAchievementsToLocal() {
        localStorage.setItem('memorr_achievements_guest', JSON.stringify([...unlockedAchievements]));
        localStorage.setItem('memorr_themes_guest', JSON.stringify([...themesPlayedGuest]));
    }
    
    async function saveAchievementToCloud(achievementId) {
        try {
            const token = localStorage.getItem('memorr_token');
            if (!token) return; 

            await fetch('/api/unlock-achievement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ achievementId })
            });
        } catch (error) {
            console.error('Nie udało się zapisać osiągnięcia w chmurze:', error);
        }
    }

    function showAchievementToast(achievement) {
        toastNotification.querySelector('.toast-icon').textContent = achievement.icon;
        toastNotification.querySelector('.toast-title').textContent = achievement.title;
        toastNotification.querySelector('.toast-message').textContent = achievement.description;
        toastNotification.classList.add('show');
        setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 3000);
    }

    function unlockAchievement(id) {
        if (!unlockedAchievements.has(id)) {
            unlockedAchievements.add(id);
            showAchievementToast(allAchievements[id]);
            
            if (isGuest) {
                saveAchievementsToLocal();
            } else {
                saveAchievementToCloud(id);
            }
        }
    }

    function showAchievementsModal() {
        achievementsList.innerHTML = ''; 
        for (const id in allAchievements) {
            const achievement = allAchievements[id];
            const isUnlocked = unlockedAchievements.has(id);
            
            const li = document.createElement('li');
            li.classList.add('achievement-item');
            if (isUnlocked) {
                li.classList.add('unlocked');
            }
            
            li.innerHTML = `
                <span class="achievement-icon">${achievement.icon}</span>
                <div class="achievement-details">
                    <h5>${achievement.title}</h5>
                    <p>${achievement.description}</p>
                </div>
            `;
            achievementsList.appendChild(li);
        }
        achievementsModal.classList.remove('hidden');
    }
    
    if (achievementsBtn) {
        achievementsBtn.addEventListener('click', showAchievementsModal);
    }
    if (achievementsCloseBtn) {
        achievementsCloseBtn.addEventListener('click', () => achievementsModal.classList.add('hidden'));
    }
    if (achievementsModal) {
        achievementsModal.addEventListener('click', (e) => {
            if (e.target === achievementsModal) {
                achievementsModal.classList.add('hidden');
            }
        });
    }

    // ================================================================
    // ===== LOGIKA RANKINGU =====================================
    // ================================================================

    async function loadLeaderboardTime() {
        leaderboardListTime.innerHTML = '<li>Ładowanie...</li>';
        leaderboardListWins.innerHTML = '';
        try {
            const response = await fetch('/api/leaderboard-time');
            if (!response.ok) {
                leaderboardListTime.innerHTML = '<li>Nie udało się wczytać rankingu.</li>';
                return;
            }
            const data = await response.json();
            
            if (data.length === 0) {
                leaderboardListTime.innerHTML = '<li>Nikt jeszcze nie ukończył gry na poziomie Trudnym! Bądź pierwszy.</li>';
                return;
            }

            leaderboardListTime.innerHTML = '';
            data.forEach((player, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${index + 1}. <span class="rank-name">${player.username}</span></span>
                    <span class="rank-score">${player.soloBestTimeHard}s</span>
                `;
                leaderboardListTime.appendChild(li);
            });
        } catch (error) {
            console.error('Błąd wczytywania rankingu (czas):', error);
            leaderboardListTime.innerHTML = '<li>Błąd połączenia z serwerem.</li>';
        }
    }
    
    async function loadLeaderboardWins() {
        leaderboardListWins.innerHTML = '<li>Ładowanie...</li>';
        leaderboardListTime.innerHTML = '';
        try {
            const response = await fetch('/api/leaderboard-wins');
            if (!response.ok) {
                leaderboardListWins.innerHTML = '<li>Nie udało się wczytać rankingu.</li>';
                return;
            }
            const data = await response.json();
            
            if (data.length === 0) {
                leaderboardListWins.innerHTML = '<li>Nikt jeszcze nie wygrał meczu multiplayer!</li>';
                return;
            }

            leaderboardListWins.innerHTML = '';
            data.forEach((player, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${index + 1}. <span class="rank-name">${player.username}</span></span>
                    <span class="rank-score">${player.totalWins} ${player.totalWins === 1 ? 'wygrana' : (player.totalWins > 1 && player.totalWins < 5 ? 'wygrane' : 'wygranych')}</span>
                `;
                leaderboardListWins.appendChild(li);
            });
        } catch (error) {
            console.error('Błąd wczytywania rankingu (wygrane):', error);
            leaderboardListWins.innerHTML = '<li>Błąd połączenia z serwerem.</li>';
        }
    }

    leaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.remove('hidden');
        leaderboardTabTime.click();
    });
    leaderboardCloseBtn.addEventListener('click', () => leaderboardModal.classList.add('hidden'));
    leaderboardModal.addEventListener('click', (e) => {
        if (e.target === leaderboardModal) {
            leaderboardModal.classList.add('hidden');
        }
    });
    
    leaderboardTabTime.addEventListener('click', () => {
        leaderboardTabTime.classList.add('active');
        leaderboardTabWins.classList.remove('active');
        leaderboardListTime.classList.remove('hidden');
        leaderboardListWins.classList.add('hidden');
        loadLeaderboardTime();
    });

    leaderboardTabWins.addEventListener('click', () => {
        leaderboardTabTime.classList.remove('active');
        leaderboardTabWins.classList.add('active');
        leaderboardListTime.classList.add('hidden');
        leaderboardListWins.classList.remove('hidden');
        loadLeaderboardWins();
    });

    // ================================================================
    // ===== LOGIKA POWER-UPÓW ========================================
    // ================================================================
    
    powerUpPeekBtn.addEventListener('click', () => {
        if (powerUps.peek === 0) return;
        if (currentGameMode === 'classic' && !myTurn) return; 
        
        powerUps.peek--;
        powerUpPeekBtn.disabled = true;
        powerUpUsedThisGame = true; // Zaznacz użycie
        socket.emit('usePowerUp', 'peek');

        if (isSoloMode || currentGameMode === 'race') {
            executePeek();
        }
    });

    powerUpAutopairBtn.addEventListener('click', () => {
        if (powerUps.autoPair === 0) return;
        if (currentGameMode === 'classic' && !myTurn) return;

        powerUps.autoPair--;
        powerUpAutopairBtn.disabled = true;
        powerUpUsedThisGame = true; // Zaznacz użycie
        socket.emit('usePowerUp', 'autoPair');

        if (isSoloMode || currentGameMode === 'race') {
            executeAutoPair();
        }
    });

    function executePeek() {
        const allCards = document.querySelectorAll('.card');
        const unmatchedCards = [...allCards].filter(card => !card.classList.contains('matched'));
        lockBoard = true;
        unmatchedCards.forEach(card => {
            if (!card.classList.contains('flipped')) {
                card.classList.add('flipped');
            }
        });
        setTimeout(() => {
            unmatchedCards.forEach(card => {
                if (!firstCard || card !== firstCard) {
                    card.classList.remove('flipped');
                }
            });
            if (currentGameMode !== 'classic' || myTurn) {
                lockBoard = false;
            }
        }, 2000);
    }
    
    function executeAutoPair() {
        if (currentGameMode === 'classic') return;
        const allCards = [...document.querySelectorAll('.card')];
        let card1 = null;
        let card2 = null;
        for (let i = 0; i < allCards.length; i++) {
            if (allCards[i].classList.contains('matched') || allCards[i].classList.contains('flipped')) continue;
            for (let j = i + 1; j < allCards.length; j++) {
                if (allCards[j].classList.contains('matched') || allCards[j].classList.contains('flipped')) continue;
                if (allCards[i].dataset.value === allCards[j].dataset.value) {
                    card1 = allCards[i];
                    card2 = allCards[j];
                    break;
                }
            }
            if (card1) break;
        }
        if (card1 && card2) {
            lockBoard = true;
            card1.classList.add('flipped');
            firstCard = card1;
            setTimeout(() => {
                card2.classList.add('flipped');
                secondCard = card2;
                moves++;
                moveCounterSpan.textContent = moves;
                setTimeout(() => {
                    disableCards();
                }, 500); 
            }, 300);
        } else {
            powerUps.autoPair++;
            powerUpAutopairBtn.disabled = false;
        }
    }

    // ================================================================
    // ===== LOGIKA GRY ===============================================
    // ================================================================

    function startSoloGame(rows, cols) {
        isSoloMode = true;
        currentGameMode = 'solo';
        currentRows = rows;
        currentCols = cols;
        totalPairs = (rows * cols) / 2;
        
        resetGameState();
        
        gameScreen.classList.add('solo-mode');
        turnInfo.classList.add('hidden');
        timerSpan.parentElement.classList.remove('hidden');
        moveCounterSpan.parentElement.classList.remove('hidden');

        stat1Container.classList.remove('hidden');
        stat2Container.classList.remove('hidden');
        stat1Label.textContent = "Rekord:";
        stat1Unit.textContent = "s";
        stat2Label.textContent = "Gry:";
        loadSoloStats();

        if (rows === 6 && cols === 6) {
            powerUpContainer.classList.remove('hidden');
        }

        totalPairsSpan.textContent = totalPairs;
        
        const themeEmojis = themes[currentTheme] || themes['default'];
        const emojisForGame = themeEmojis.slice(0, totalPairs);
        
        const cardValues = [...emojisForGame, ...emojisForGame];
        shuffle(cardValues);
        buildBoard(cardValues, rows, cols);
        showGameUI();
    }

    function startMultiplayerGame(data) {
        isSoloMode = false;
        currentGameMode = data.gameMode;
        totalPairs = data.totalPairs;
        opponentPairsFound = 0;
        
        resetGameState();
        
        gameScreen.classList.remove('solo-mode');
        totalPairsSpan.textContent = totalPairs;
        opponentTotalPairsSpan.textContent = totalPairs;

        stat1Container.classList.remove('hidden');
        stat2Container.classList.remove('hidden');
        stat1Label.textContent = "Wygrane:";
        stat1Unit.textContent = "";
        stat2Label.textContent = "Gry Ogółem:";
        loadMultiStats();

        if (data.rows === 6 && data.cols === 6) {
            powerUpContainer.classList.remove('hidden');
        }

        if (currentGameMode === 'classic') {
            timerSpan.parentElement.classList.add('hidden');
            moveCounterSpan.parentElement.classList.add('hidden');
            turnInfo.classList.remove('hidden');
        } else {
            timerSpan.parentElement.classList.remove('hidden');
            moveCounterSpan.parentElement.classList.remove('hidden');
            turnInfo.classList.add('hidden');
        }
        
        buildBoard(data.board, data.rows, data.cols);
        showGameUI();
    }

    function buildBoard(cardValues, rows, cols) {
        gameBoard.innerHTML = '';
        gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gameBoard.style.gridTemplateRows = `repeat(${rows}, auto)`;
        
        if (cols === 6) {
            gameBoard.style.maxWidth = `${(80*6) + (12*5)}px`;
        } else {
            gameBoard.style.maxWidth = `${(80*4) + (12*3)}px`;
        }

        cardValues.forEach((value, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.dataset.index = index;
            card.dataset.value = value;
            card.innerHTML = `
                <div class="card-face card-back"></div>
                <div class="card-face card-front">${value}</div>
            `;
            card.addEventListener('click', handleCardClick);
            gameBoard.appendChild(card);
        });
    }

    function resetGameState() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        seconds = 0;
        moves = 0;
        pairsFound = 0;
        lockBoard = false;
        firstCard = null;
        secondCard = null;
        opponentPairsFound = 0;
        myTurn = false;
        gameBoard.innerHTML = '';
        
        powerUps = { peek: 1, autoPair: 1 };
        powerUpUsedThisGame = false; // ZRESETUJ FLAGĘ
        powerUpPeekBtn.disabled = false;
        powerUpAutopairBtn.disabled = false;
        powerUpContainer.classList.add('hidden'); 

        if (timerSpan) timerSpan.parentElement.classList.remove('hidden');
        if (moveCounterSpan) moveCounterSpan.parentElement.classList.remove('hidden');
        if (turnInfo) turnInfo.classList.add('hidden');
        
        if (playerInfoPanel) playerInfoPanel.classList.remove('active-turn');
        if (opponentInfoPanel) opponentInfoPanel.classList.remove('active-turn');

        if (timerSpan) timerSpan.textContent = '0';
        if (moveCounterSpan) moveCounterSpan.textContent = '0';
        if (pairsFoundSpan) pairsFoundSpan.textContent = '0';
        if (opponentPairsSpan) opponentPairsSpan.textContent = '0';
        
        if (stat1Value) stat1Value.textContent = '--';
        if (stat1Unit) stat1Unit.textContent = '';
        if (stat2Value) stat2Value.textContent = '0';
    }
    
    function startTimer() {
        if (timerInterval) return;
        timerInterval = setInterval(() => {
            seconds++;
            if (timerSpan) timerSpan.textContent = seconds;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function handleCardClick() {
        if (isSoloMode || currentGameMode === 'race') {
            handleSoloOrRaceClick(this);
        } else if (currentGameMode === 'classic') {
            handleClassicClick(this);
        }
    }

    function handleSoloOrRaceClick(cardElement) {
        if (lockBoard || cardElement.classList.contains('matched') || cardElement === firstCard) return;
        
        startTimer();
        try { flipSound.currentTime = 0; flipSound.play(); } catch (e) {}

        cardElement.classList.add('flipped');
        if (!firstCard) {
            firstCard = cardElement;
            return;
        }
        
        secondCard = cardElement;
        lockBoard = true;
        moves++;
        moveCounterSpan.textContent = moves;
        checkForMatch();
    }

    function handleClassicClick(cardElement) {
        if (!myTurn || lockBoard || cardElement.classList.contains('matched') || cardElement.classList.contains('flipped')) {
            return;
        }
        
        try { flipSound.currentTime = 0; flipSound.play(); } catch (e) {}
        
        lockBoard = true;
        socket.emit('classic:flip', { cardIndex: cardElement.dataset.index });
    }
    
    function checkForMatch() {
        const isMatch = firstCard.dataset.value === secondCard.dataset.value;
        isMatch ? disableCards() : unflipCards();
    }

    function disableCards() {
        firstCard.classList.add('matched');
        secondCard.classList.add('matched');
        pairsFound++;
        if (pairsFoundSpan) pairsFoundSpan.textContent = pairsFound;
        
        if (isSoloMode) {
            if (pairsFound === totalPairs) {
                stopTimer();
                const statsPromise = updateSoloStats();
                checkSoloAchievements(statsPromise); 
                
                showSoloWinModal(false);
                
                statsPromise.then(stats => {
                    if (stats.newRecord) {
                        soloModalRecordMessage.classList.remove('hidden');
                    }
                });
            }
        } else { // Tryb 'race'
            socket.emit('foundMatch');
            if (pairsFound === totalPairs) {
                stopTimer();
                socket.emit('gameFinished');
            }
        }
        resetTurn();
    }

    function unflipCards() {
        setTimeout(() => {
            firstCard.classList.remove('flipped');
            secondCard.classList.remove('flipped');
            resetTurn();
        }, 1000);
    }

    function resetTurn() {
        firstCard = null;
        secondCard = null;
        lockBoard = false;
    }

    function updateTurnUI(isMyTurn) {
        if (isMyTurn) {
            turnInfo.textContent = "Twoja tura!";
            turnInfo.classList.add('my-turn');
            playerInfoPanel.classList.add('active-turn');
            opponentInfoPanel.classList.remove('active-turn');
        } else {
            turnInfo.textContent = "Tura przeciwnika...";
            turnInfo.classList.remove('my-turn');
            playerInfoPanel.classList.remove('active-turn');
            opponentInfoPanel.classList.add('active-turn');
        }
        lockBoard = false;
    }

    // Funkcje statystyk solo
    function getTimeStorageKey() {
        if (currentRows === 0 || currentCols === 0) return null;
        const keyPrefix = isGuest ? 'guest' : currentUser.username.toLowerCase();
        return `memoryBestTime_${keyPrefix}_${currentTheme}_${currentRows}x${currentCols}`;
    }
    function getStatsStorageKey() {
        if (currentRows === 0 || currentCols === 0) return null;
        const keyPrefix = isGuest ? 'guest' : currentUser.username.toLowerCase();
        return `memoryGamesPlayed_${keyPrefix}_${currentTheme}_${currentRows}x${currentCols}`;
    }
    
    function getDifficultyKey() {
        if (currentRows === 4) return 'easy';
        if (currentRows === 6 && currentCols === 4) return 'medium';
        if (currentRows === 6 && currentCols === 6) return 'hard';
        return null;
    }

    // NOWA: Wczytuje statystyki MULTI (z chmury lub 0)
    function loadMultiStats() {
        stat1Container.classList.remove('hidden');
        stat2Container.classList.remove('hidden');
        stat1Label.textContent = "Wygrane:";
        stat1Unit.textContent = "";
        stat2Label.textContent = "Gry Ogółem:";
        
        if (isGuest) {
            stat1Value.textContent = "0";
            stat2Value.textContent = "0";
        } else {
            stat1Value.textContent = currentUser.totalWins.toString();
            stat2Value.textContent = currentUser.totalGamesPlayed.toString();
        }
    }

    // ZAKTUALIZOWANE: Wczytuje staty SOLO (z chmury lub local)
    function loadSoloStats() {
        stat1Container.classList.remove('hidden');
        stat2Container.classList.remove('hidden');
        stat1Label.textContent = "Rekord:";
        stat1Unit.textContent = "s";
        stat2Label.textContent = "Gry:";
        
        let bestTime = 9999;
        let gamesPlayed = 0;
        const difficulty = getDifficultyKey();

        if (isGuest) {
            const timeKey = getTimeStorageKey();
            const statsKey = getStatsStorageKey();
            if (!timeKey || !statsKey) return;
            bestTime = localStorage.getItem(timeKey) || 9999;
            gamesPlayed = localStorage.getItem(statsKey) || 0;
        } else {
            if (difficulty === 'easy') bestTime = currentUser.soloBestTimeEasy;
            if (difficulty === 'medium') bestTime = currentUser.soloBestTimeMedium;
            if (difficulty === 'hard') bestTime = currentUser.soloBestTimeHard;
            gamesPlayed = currentUser.totalGamesPlayed;
        }

        stat1Value.textContent = (bestTime >= 9999) ? '--' : bestTime;
        stat2Value.textContent = gamesPlayed.toString();
    }
    
    async function updateSoloStats() {
        const difficulty = getDifficultyKey();
        let newRecord = false;
        let gamesPlayed = 0;

        // Śledź użyte motywy
        if (isGuest) {
            themesPlayedGuest.add(currentTheme);
            saveAchievementsToLocal(); // Zapisz motywy gościa
        }
        
        if (isGuest) {
            const timeKey = getTimeStorageKey();
            const statsKey = getStatsStorageKey();
            if (!timeKey || !statsKey) return { newRecord: false, gamesPlayed: 0 };
            
            gamesPlayed = parseInt(localStorage.getItem(statsKey) || '0') + 1;
            localStorage.setItem(statsKey, gamesPlayed.toString());
            if (stat2Value) stat2Value.textContent = gamesPlayed.toString();

            const bestTime = localStorage.getItem(timeKey) || 9999;
            if (seconds < bestTime) {
                localStorage.setItem(timeKey, seconds);
                if (stat1Value) stat1Value.textContent = seconds;
                newRecord = true;
            }
            return { newRecord, gamesPlayed };
        } else {
            // ZALOGOWANY UŻYTKOWNIK -> Wyślij do API
            try {
                const response = await fetch('/api/save-solo-stats', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('memorr_token')}`
                    },
                    body: JSON.stringify({ 
                        difficulty: difficulty, 
                        time: seconds,
                        theme: currentTheme // Wyślij motyw
                    })
                });
                const data = await response.json();
                
                currentUser = { ...currentUser, ...data.updatedStats };
                newRecord = data.newRecord;
                gamesPlayed = currentUser.totalGamesPlayed;
                
                loadSoloStats();

                return { newRecord, gamesPlayed };

            } catch(error) {
                console.error("Nie udało się zapisać statystyk solo:", error);
                return { newRecord: false, gamesPlayed: currentUser.totalGamesPlayed };
            }
        }
    }
    
    async function checkSoloAchievements(statsPromise) {
        const stats = await statsPromise; 

        if (stats.gamesPlayed === 1) {
            unlockAchievement('first_solo_game');
        }
        if (currentRows === 4 && currentCols === 4 && seconds < 30) {
            unlockAchievement('fast_win_easy');
        }
        if (moves === totalPairs) {
            unlockAchievement('perfect_game');
        }
        if (currentRows === 6 && currentCols === 6) {
            unlockAchievement('master_mind');
        }
        // NOWE OSIĄGNIĘCIE
        if (currentRows === 6 && currentCols === 6 && !powerUpUsedThisGame) {
            unlockAchievement('no_powerups_hard');
        }
        
        // NOWE OSIĄGNIĘCIE (MOTYWY)
        let themesPlayed;
        if (isGuest) {
            themesPlayed = themesPlayedGuest;
        } else {
            themesPlayed = new Set(currentUser.themesPlayed);
        }
        
        if (themesPlayed.size === Object.keys(themes).length) {
            unlockAchievement('connoisseur');
        }
    }
    
    function showSoloWinModal(isNewRecord) {
        soloModalMessage.textContent = `Ukończyłeś grę w ${seconds}s i ${moves} ruchach!`;
        
        if (currentRows === 4 || (currentRows === 6 && currentCols === 4)) {
            soloModalNextLevelBtn.classList.remove('hidden');
        } else {
            soloModalNextLevelBtn.classList.add('hidden');
        }

        if (isNewRecord) {
            soloModalRecordMessage.classList.remove('hidden');
        } else {
            soloModalRecordMessage.classList.add('hidden');
        }
        
        try { winSound.play(); } catch(e) {}
        
        soloWinModal.classList.remove('hidden');
    }

    // ZAKTUALIZOWANE: Sprawdza serię wygranych
    function showWinModal(didPlayerWin, soloMode, isTie = false) {
        
        modalPlayAgainBtn.classList.remove('hidden');
        modalRematchBtn.classList.add('hidden');
        modalRematchStatus.textContent = '';
        modalRecordMessage.classList.add('hidden');
        
        if (soloMode) {
            showSoloWinModal(isTie); 
        } else {
            modalRematchBtn.classList.remove('hidden');
            
            if (isTie) {
                modalTitle.textContent = 'Remis!';
                modalMessage.textContent = 'Niesamowita walka! Spróbujcie jeszcze raz.';
                if (!isGuest) currentUser.winStreak = 0; // Resetuj serię przy remisie
            } else if (didPlayerWin) {
                modalTitle.textContent = 'Gratulacje!';
                modalMessage.textContent = (currentGameMode === 'race') 
                    ? `Wygrałeś w ${seconds}s i ${moves} ruchach!`
                    : 'Wygrałeś! Zebrałeś więcej par.';
                try { winSound.play(); } catch(e) {}
                unlockAchievement('first_multi_win'); 

                // NOWE OSIĄGNIĘCIE (SERIA WYGRANYCH)
                if (!isGuest) {
                    // Serwer już zaktualizował winStreak, my tylko odczytujemy
                    // Musimy poczekać, aż serwer zaktualizuje i odeśle nowe dane...
                    // Prostsze rozwiązanie: śledźmy to też lokalnie.
                    currentUser.winStreak = (currentUser.winStreak || 0) + 1;
                    if (currentUser.winStreak === 3) {
                        unlockAchievement('win_streak_3');
                    }
                }
            } else {
                modalTitle.textContent = 'Niestety!';
                modalMessage.textContent = (currentGameMode === 'race')
                    ? 'Przeciwnik był szybszy. Spróbuj jeszcze raz!'
                    : 'Przeciwnik zebrał więcej par. Spróbuj jeszcze raz!';
                if (!isGuest) currentUser.winStreak = 0; // Resetuj serię przy przegranej
            }
            winModal.classList.remove('hidden');
        }
    }

    // ===== FUNKCJA SPRAWDZAJĄCA TOKEN =====
    async function checkTokenOnLoad() {
        const token = localStorage.getItem('memorr_token');
        if (!token) {
            loadAchievements(); 
            showLobbyUI("Gość", true);
            return;
        }

        try {
            const response = await fetch('/api/verify-token', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                localStorage.removeItem('memorr_token');
                loadAchievements();
                showLobbyUI("Gość", true);
            } else {
                currentUser = data.user;
                isGuest = false;
                authToken = token;
                loadAchievements(data.user.achievements); 
                showLobbyUI(currentUser.username, isGuest); 
            }
        } catch (error) {
            console.error('Błąd weryfikacji tokenu:', error);
            localStorage.removeItem('memorr_token');
            loadAchievements();
            showLobbyUI("Gość", true);
        }
    }

    // Domyślnie pokaż lobby na starcie
    checkTokenOnLoad();
});