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
    const pairsFoundSpan = document.getElementById('pairs-found');
    const totalPairsSpan = document.getElementById('total-pairs');
    const moveCounterSpan = document.getElementById('move-counter');
    const timerSpan = document.getElementById('timer');
    const btnRestart = document.getElementById('btn-restart');
    const opponentPairsSpan = document.getElementById('opponent-pairs-found');
    const opponentTotalPairsSpan = document.getElementById('opponent-total-pairs');
    const bestScoreContainer = document.getElementById('best-score-container');
    const bestScoreSpan = document.getElementById('best-score');
    const gamesPlayedContainer = document.getElementById('games-played-container');
    const gamesPlayedSpan = document.getElementById('games-played');

    // --- Pobranie elementów DOM (Modal) ---
    const winModal = document.getElementById('win-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalRecordMessage = document.getElementById('modal-record-message');
    const modalPlayAgainBtn = document.getElementById('modal-play-again');
    const modalRematchBtn = document.getElementById('modal-rematch');
    const modalRematchStatus = document.getElementById('modal-rematch-status');

    // --- Pobranie elementów DOM (Osiągnięcia) ---
    const achievementsBtn = document.getElementById('achievements-btn');
    const achievementsModal = document.getElementById('achievements-modal');
    const achievementsList = document.getElementById('achievements-list');
    const achievementsCloseBtn = document.getElementById('achievements-close-btn');
    const toastNotification = document.getElementById('toast-notification');

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
        
        themeSelectionMultiContainer.appendChild(themeSelection);
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

    // Nasłuchiwacze dla przycisków nawigacji w lobby
    btnSelectSolo.addEventListener('click', showSoloOptions);
    btnSelectMulti.addEventListener('click', showMultiOptions);
    
    btnBackToMode.addEventListener('click', showModeSelection);
    btnBackToModeMulti.addEventListener('click', showModeSelection);
    btnShowCreateGame.addEventListener('click', showMultiCreateDetails);
    btnShowJoinGame.addEventListener('click', showMultiJoinDetails);
    btnBackToMultiOptionsFromCreate.addEventListener('click', showMultiOptions);
    btnBackToMultiOptionsFromJoin.addEventListener('click', showMultiOptions);

    // Logika wyboru motywu
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentTheme = btn.dataset.theme;
        });
    });

    // Nasłuchiwacze dla Trybu Solo
    btnSoloEasy.addEventListener('click', () => startSoloGame(4, 4));
    btnSoloMedium.addEventListener('click', () => startSoloGame(6, 4));
    btnSoloHard.addEventListener('click', () => startSoloGame(6, 6));

    // Nasłuchiwacze dla Trybu Multi
    btnMultiEasy.addEventListener('click', () => createMultiGame(4, 4));
    btnMultiMedium.addEventListener('click', () => createMultiGame(6, 4));
    btnMultiHard.addEventListener('click', () => createMultiGame(6, 6));

    btnJoinGame.addEventListener('click', () => {
        const gameID = gameIdInput.value.trim();
        if (gameID) {
            socket.emit('joinGame', { gameID });
            lobbyMessage.textContent = 'Próbuję dołączyć do gry...';
        } else {
            lobbyMessage.textContent = 'Proszę wpisać ID gry.';
        }
    });

    // Funkcja kopiowania
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

    // Przyciski "Powrót do Lobby" i "Rewanż"
    btnRestart.addEventListener('click', () => window.location.reload());
    modalPlayAgainBtn.addEventListener('click', () => window.location.reload());

    modalRematchBtn.addEventListener('click', () => {
        socket.emit('requestRematch');
        modalRematchStatus.textContent = 'Wysłano prośbę o rewanż... Czekam...';
        modalRematchBtn.classList.add('hidden');
    });

    function createMultiGame(rows, cols) {
        lobbyMessage.textContent = 'Tworzenie gry...';
        socket.emit('createGame', { rows, cols, theme: currentTheme });
    }

    function showLobbyUI() {
        lobbyScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        winModal.classList.add('hidden');
        showModeSelection();
    }

    function showGameUI() {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        winModal.classList.add('hidden');
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
        startMultiplayerGame(data);
    });
    
    socket.on('opponentFoundMatch', () => {
        opponentPairsFound++;
        opponentPairsSpan.textContent = opponentPairsFound;
    });
    
    socket.on('youWon', () => {
        stopTimer();
        showWinModal(true, false);
    });
    
    socket.on('youLost', () => {
        stopTimer();
        showWinModal(false, false);
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
            showLobbyUI();
            lobbyMessage.textContent = "Przeciwnik się rozłączył.";
        }
    });
    
    socket.on('error', (message) => {
        lobbyMessage.textContent = message;
        if (multiCreateDetails.classList.contains('hidden') === false) {
             setTimeout(showMultiOptions, 2000);
        }
    });

    // ================================================================
    // ===== LOGIKA OSIĄGNIĘĆ ========================================
    // ================================================================

    function loadAchievements() {
        const data = localStorage.getItem('memorr_achievements');
        unlockedAchievements = new Set(JSON.parse(data) || []);
    }

    function saveAchievements() {
        localStorage.setItem('memorr_achievements', JSON.stringify([...unlockedAchievements]));
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
            saveAchievements();
            showAchievementToast(allAchievements[id]);
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
    
    achievementsBtn.addEventListener('click', showAchievementsModal);
    achievementsCloseBtn.addEventListener('click', () => achievementsModal.classList.add('hidden'));
    achievementsModal.addEventListener('click', (e) => {
        if (e.target === achievementsModal) {
            achievementsModal.classList.add('hidden');
        }
    });


    // ================================================================
    // ===== LOGIKA GRY (ZAKTUALIZOWANA O RWD) ========================
    // ================================================================

    function startSoloGame(rows, cols) {
        isSoloMode = true;
        currentRows = rows;
        currentCols = cols;
        totalPairs = (rows * cols) / 2;
        
        resetGameState();
        loadSoloStats();
        
        gameScreen.classList.add('solo-mode');
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
        totalPairs = data.totalPairs;
        opponentPairsFound = 0;
        
        resetGameState();
        
        gameScreen.classList.remove('solo-mode');
        totalPairsSpan.textContent = totalPairs;
        opponentTotalPairsSpan.textContent = totalPairs;
        buildBoard(data.board, data.rows, data.cols);
        showGameUI();
    }

    // ===== POPRAWIONA FUNKCJA BUILDBOARD (RWD) =====
    function buildBoard(cardValues, rows, cols) {
        // Zamiast sztywnego 80px, ustawiamy siatkę na elastyczne '1fr'
        gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        // Usuwamy sztywną wysokość wierszy
        gameBoard.style.gridTemplateRows = `repeat(${rows}, auto)`;
        
        // Ustawiamy maksymalną szerokość planszy, aby nie była za duża na desktopie
        // (Szerokość karty * kolumny) + (odstępy * (kolumny - 1))
        // Dla 80px karty i 12px odstępu:
        if (cols === 6) {
            gameBoard.style.maxWidth = `${(80*6) + (12*5)}px`; // 540px
        } else { // cols === 4
            gameBoard.style.maxWidth = `${(80*4) + (12*3)}px`; // 356px
        }

        // Reszta funkcji bez zmian
        cardValues.forEach(value => {
            const card = document.createElement('div');
            card.classList.add('card');
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
        gameBoard.innerHTML = '';
        
        if (timerSpan) timerSpan.textContent = '0';
        if (moveCounterSpan) moveCounterSpan.textContent = '0';
        if (pairsFoundSpan) pairsFoundSpan.textContent = '0';
        if (opponentPairsSpan) opponentPairsSpan.textContent = '0';
        if (bestScoreSpan) bestScoreSpan.textContent = '--';
        if (gamesPlayedSpan) gamesPlayedSpan.textContent = '0';
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
        if (lockBoard || this.classList.contains('matched') || this === firstCard) return;
        
        startTimer();
        
        try {
            flipSound.currentTime = 0;
            flipSound.play();
        } catch (e) {}

        this.classList.add('flipped');
        if (!firstCard) {
            firstCard = this;
            return;
        }
        secondCard = this;
        lockBoard = true;
        moves++;
        moveCounterSpan.textContent = moves;
        checkForMatch();
    }

    function checkForMatch() {
        const isMatch = firstCard.dataset.value === secondCard.dataset.value;
        isMatch ? disableCards() : unflipCards();
    }

    function disableCards() {
        firstCard.classList.add('matched');
        secondCard.classList.add('matched');
        pairsFound++;
        pairsFoundSpan.textContent = pairsFound;
        
        if (isSoloMode) {
            if (pairsFound === totalPairs) {
                stopTimer();
                const stats = updateSoloStats();
                checkSoloAchievements(stats);
                showWinModal(true, true, stats.newRecord);
            }
        } else {
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

    // Funkcje statystyk solo
    function getTimeStorageKey() {
        if (currentRows === 0 || currentCols === 0) return null;
        return `memoryBestTime_${currentTheme}_${currentRows}x${currentCols}`;
    }
    function getStatsStorageKey() {
        if (currentRows === 0 || currentCols === 0) return null;
        return `memoryGamesPlayed_${currentTheme}_${currentRows}x${currentCols}`;
    }
    function loadSoloStats() {
        const timeKey = getTimeStorageKey();
        const statsKey = getStatsStorageKey();
        if (!timeKey || !statsKey) return;

        const bestTime = localStorage.getItem(timeKey);
        const gamesPlayed = localStorage.getItem(statsKey) || '0';

        if (bestTime) {
            bestScoreSpan.textContent = `${bestTime}s`;
        } else {
            bestScoreSpan.textContent = '--';
        }
        gamesPlayedSpan.textContent = gamesPlayed;
    }

    function updateSoloStats() {
        const timeKey = getTimeStorageKey();
        const statsKey = getStatsStorageKey();
        if (!timeKey || !statsKey) return { newRecord: false, gamesPlayed: 0 };
        
        let gamesPlayed = parseInt(localStorage.getItem(statsKey) || '0');
        gamesPlayed++;
        localStorage.setItem(statsKey, gamesPlayed.toString());
        gamesPlayedSpan.textContent = gamesPlayed.toString();

        const bestTime = localStorage.getItem(timeKey);
        let newRecord = false;
        if (!bestTime || seconds < parseInt(bestTime)) {
            localStorage.setItem(timeKey, seconds);
            bestScoreSpan.textContent = `${seconds}s`;
            newRecord = true;
        }
        return { newRecord, gamesPlayed };
    }
    
    // ZAKTUALIZOWANE: Sprawdzanie osiągnięć
    function checkSoloAchievements(stats) {
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
    }
    
    function showWinModal(didPlayerWin, soloMode, isNewRecord = false) {
        
        modalPlayAgainBtn.classList.add('hidden');
        modalRematchBtn.classList.add('hidden');
        modalRematchStatus.textContent = '';
        modalRecordMessage.classList.add('hidden');
        
        if (soloMode) {
            modalTitle.textContent = 'Gratulacje!';
            modalMessage.textContent = `Ukończyłeś grę w ${seconds}s i ${moves} ruchach!`;
            modalPlayAgainBtn.classList.remove('hidden');
            
            if (isNewRecord) {
                modalRecordMessage.classList.remove('hidden');
            }
            
            if(didPlayerWin) {
                 try { winSound.play(); } catch(e) {}
            }

        } else {
            modalRematchBtn.classList.remove('hidden');
            
            if (didPlayerWin) {
                modalTitle.textContent = 'Gratulacje!';
                modalMessage.textContent = `Wygrałeś w ${seconds}s i ${moves} ruchach!`;
                try { winSound.play(); } catch(e) {}
                unlockAchievement('first_multi_win'); 
            } else {
                modalTitle.textContent = 'Niestety!';
                modalMessage.textContent = 'Przeciwnik był szybszy. Spróbuj jeszcze raz!';
            }
        }
        winModal.classList.remove('hidden');
    }

    // Domyślnie pokaż lobby na starcie
    loadAchievements();
    showLobbyUI();
});