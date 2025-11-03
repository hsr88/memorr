// Łączymy się z serwerem Socket.IO
const socket = io();

// ===== ZMIANA: NOWA LISTA EMOJI PASUJĄCA DO PIXEL ART =====
const allEmojis = [
    '👾', '🤖', '👽', '👻', '💀', '🎃', '💎', '🍄', '🚀', '🛸', 
    '☄️', '🪐', '🕹️', '💾', '💿', '📼', '📞', '📺', '💰', '💣', 
    '⚔️', '🛡️', '🔑', '🎁', '🍕', '🍔', '🍟', '🧱', '🧭', '🔋'
];
// ========================================================

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

    // --- Pobranie elementów DOM (Lobby) ---
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const modeSelection = document.getElementById('mode-selection');
    const soloOptions = document.getElementById('solo-options');
    const multiOptions = document.getElementById('multi-options');
    const multiCreateJoin = document.getElementById('multi-create-join');
    const multiCreateDetails = document.getElementById('multi-create-details');
    const multiJoinDetails = document.getElementById('multi-join-details');

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

    // --- Pobranie elementów DOM (Modal) ---
    const winModal = document.getElementById('win-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalRecordMessage = document.getElementById('modal-record-message');
    const modalPlayAgainBtn = document.getElementById('modal-play-again');

    // ================================================================
    // ===== LOGIKA LOBBY I NAWIGACJI =================================
    // ================================================================

    function showModeSelection() {
        modeSelection.classList.remove('hidden');
        soloOptions.classList.add('hidden');
        multiOptions.classList.add('hidden');
        lobbyMessage.textContent = '';
        gameIdContainer.classList.add('hidden');
        gameIdInput.value = '';
    }

    function showSoloOptions() {
        modeSelection.classList.add('hidden');
        soloOptions.classList.remove('hidden');
        lobbyMessage.textContent = '';
    }

    function showMultiOptions() {
        modeSelection.classList.add('hidden');
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
        multiCreateDetails.classList.remove('hidden');
        lobbyMessage.textContent = '';
        gameIdContainer.classList.add('hidden');
    }

    function showMultiJoinDetails() {
        multiCreateJoin.classList.add('hidden');
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

    // Przyciski "Powrót do Lobby"
    btnRestart.addEventListener('click', () => window.location.reload());
    modalPlayAgainBtn.addEventListener('click', () => window.location.reload());

    function createMultiGame(rows, cols) {
        lobbyMessage.textContent = 'Tworzenie gry...';
        socket.emit('createGame', { rows, cols });
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
    
    socket.on('gameStarted', (data) => startMultiplayerGame(data));
    
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
    
    socket.on('opponentDisconnected', () => {
        stopTimer();
        modalTitle.textContent = 'Koniec Gry';
        modalMessage.textContent = 'Przeciwnik się rozłączył. Wygrałeś!';
        modalRecordMessage.classList.add('hidden');
        winModal.classList.remove('hidden');
    });
    
    socket.on('error', (message) => {
        lobbyMessage.textContent = message;
        if (multiCreateDetails.classList.contains('hidden') === false) {
             setTimeout(showMultiOptions, 2000);
        }
    });

    // ================================================================
    // ===== LOGIKA GRY (KOMPLETNA) ===================================
    // ================================================================

    function startSoloGame(rows, cols) {
        isSoloMode = true;
        currentRows = rows;
        currentCols = cols;
        totalPairs = (rows * cols) / 2;
        resetGameState();
        loadBestScore();
        gameScreen.classList.add('solo-mode'); // Ta linia ukrywa panel przeciwnika
        totalPairsSpan.textContent = totalPairs;
        const emojisForGame = allEmojis.slice(0, totalPairs);
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
        gameScreen.classList.remove('solo-mode'); // Ta linia pokazuje panel przeciwnika
        totalPairsSpan.textContent = totalPairs;
        opponentTotalPairsSpan.textContent = totalPairs;
        buildBoard(data.board, data.rows, data.cols);
        showGameUI();
    }

    function buildBoard(cardValues, rows, cols) {
        gameBoard.style.gridTemplateColumns = `repeat(${cols}, 80px)`;
        gameBoard.style.gridTemplateRows = `repeat(${rows}, 80px)`;
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
        timerSpan.textContent = '0';
        moveCounterSpan.textContent = '0';
        pairsFoundSpan.textContent = '0';
        opponentPairsSpan.textContent = '0';
        bestScoreSpan.textContent = '--';
    }
    
    function startTimer() {
        if (timerInterval) return;
        timerInterval = setInterval(() => {
            seconds++;
            timerSpan.textContent = seconds;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function handleCardClick() {
        if (lockBoard || this.classList.contains('matched') || this === firstCard) return;
        startTimer();
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
                const isNewRecord = checkAndSaveBestScore();
                showWinModal(true, true, isNewRecord);
            }
        } else {
            socket.emit('foundMatch');
            if (pairsFound === totalPairs) {
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

    function getStorageKey() {
        return `memoryBestTime_${currentRows}x${currentCols}`;
    }


    function loadBestScore() {
        if (currentRows === 0 || currentCols === 0) return;
        const bestTime = localStorage.getItem(getStorageKey());
        if (bestTime) {
            bestScoreSpan.textContent = `${bestTime}s`;
        } else {
            bestScoreSpan.textContent = '--';
        }
    }

    function checkAndSaveBestScore() {
        const storageKey = getStorageKey();
        const bestTime = localStorage.getItem(storageKey);
        let newRecord = false;
        if (!bestTime || seconds < parseInt(bestTime)) {
            localStorage.setItem(storageKey, seconds);
            bestScoreSpan.textContent = `${seconds}s`;
            newRecord = true;
        }
        return newRecord;
    }

    function showWinModal(didPlayerWin, soloMode, isNewRecord = false) {
        if (soloMode) {
            modalTitle.textContent = 'Gratulacje!';
            modalMessage.textContent = `Ukończyłeś grę w ${seconds}s i ${moves} ruchach!`;
            if (isNewRecord) {
                modalRecordMessage.classList.remove('hidden');
            } else {
                modalRecordMessage.classList.add('hidden');
            }
        } else {
            modalRecordMessage.classList.add('hidden');
            if (didPlayerWin) {
                modalTitle.textContent = 'Gratulacje!';
                modalMessage.textContent = `Wygrałeś w ${seconds}s i ${moves} ruchach!`;
            } else {
                modalTitle.textContent = 'Niestety!';
                modalMessage.textContent = 'Przeciwnik był szybszy. Spróbuj jeszcze raz!';
            }
        }
        winModal.classList.remove('hidden');
    }

    // Domyślnie pokaż lobby na starcie
    showLobbyUI();
});