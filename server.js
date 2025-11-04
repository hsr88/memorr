// 1. Załaduj moduły
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// 2. Skonfiguruj serwer
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 3. Ustaw Expressa, aby serwował pliki statyczne
app.use(express.static(__dirname));

const themes = {
    default: ['💎', '🤖', '👽', '👻', '💀', '🎃', '🚀', '🍄', '🛸', '☄️', '🪐', '🕹️', '💾', '💿', '📼', '📞', '📺', '💰', '💣', '⚔️', '🛡️', '🔑', '🎁', '🧱', '🧭', '🔋', '🧪', '🧬', '🔭', '💡'],
    nature: ['🌳', '🌲', '🍁', '🍂', '🌿', '🌸', '🌻', '🌊', '⛰️', '🌋', '🌾', '🐚', '🕸️', '🐞', '🦋', '🏞️', '🌅', '🌌'],
    food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🥐', '🍞', '🥨', '🧀', '🥞', '🧇', '🍗', '🍣', '🍤', '🍩', '🍪', '🍰', '🧁'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦']
};

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

let games = {};

// 4. Główna logika Socket.IO
io.on('connection', (socket) => {
    console.log(`Użytkownik połączony: ${socket.id}`);

    // --- Tworzenie Gry ---
    socket.on('createGame', (data) => {
        try {
            let gameID;
            do {
                gameID = Math.floor(1000 + Math.random() * 9000).toString();
            } while (games[gameID]);
            
            games[gameID] = {
                players: [socket.id],
                rows: data.rows,
                cols: data.cols,
                theme: data.theme || 'default',
                gameMode: data.gameMode || 'race', // NOWY TRYB GRY
                board: null,
                rematch: [],
                // Logika dla trybu klasycznego
                turn: null, 
                scores: {},
                classicState: {
                    firstCard: null,
                    secondCard: null,
                    lockBoard: false
                }
            };

            socket.join(gameID);
            console.log(`Gracz ${socket.id} stworzył grę ${gameID} (Tryb: ${games[gameID].gameMode})`);
            socket.emit('gameCreated', { gameID });

        } catch (e) {
            console.error(e);
            socket.emit('error', 'Nie udało się stworzyć gry.');
        }
    });

    // --- Dołączanie do Gry ---
    socket.on('joinGame', (data) => {
        try {
            const gameID = data.gameID;
            const game = games[gameID];

            if (!game) {
                socket.emit('error', 'Gra o tym ID nie istnieje.');
                return;
            }
            if (game.players.length >= 2) {
                socket.emit('error', 'Ten pokój jest już pełny.');
                return;
            }

            socket.join(gameID);
            game.players.push(socket.id);
            console.log(`Gracz ${socket.id} dołączył do gry ${gameID}`);

            game.rematch = [];
            
            const { rows, cols, theme, gameMode } = game;
            const themeEmojis = themes[theme] || themes['default'];
            const totalPairs = (rows * cols) / 2;
            const emojisForGame = themeEmojis.slice(0, totalPairs);
            
            const cardValues = [...emojisForGame, ...emojisForGame];
            shuffle(cardValues);
            game.board = cardValues;

            // Logika startowa dla trybu klasycznego
            if (gameMode === 'classic') {
                game.turn = game.players[0]; // Gracz 1 zaczyna
                game.scores = {
                    [game.players[0]]: 0,
                    [game.players[1]]: 0
                };
                game.classicState = { firstCard: null, secondCard: null, lockBoard: false };
                
                // Wyślij stan początkowy
                io.to(gameID).emit('classic:scoreUpdate', game.scores);
                io.to(game.players[0]).emit('classic:turnUpdate', true);
                io.to(game.players[1]).emit('classic:turnUpdate', false);
            }

            io.to(gameID).emit('gameStarted', {
                board: cardValues,
                rows: rows,
                cols: cols,
                totalPairs: totalPairs,
                gameMode: gameMode // Wyślij tryb gry do klientów
            });

        } catch (e) {
            console.error(e);
            socket.emit('error', 'Nie udało się dołączyć do gry.');
        }
    });

    // --- Logika w trakcie gry (TRYB WYŚCIGU) ---
    socket.on('foundMatch', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID && games[gameID].gameMode === 'race') {
            socket.broadcast.to(gameID).emit('opponentFoundMatch');
        }
    });

    // --- Zakończenie gry (TRYB WYŚCIGU) ---
    socket.on('gameFinished', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID && games[gameID] && games[gameID].gameMode === 'race') {
            games[gameID].rematch = []; 
            socket.emit('youWon');
            socket.broadcast.to(gameID).emit('youLost');
        }
    });

    // ===== NOWA LOGIKA: TRYB KLASYCZNY (TUROWY) =====
    socket.on('classic:flip', (data) => {
        const gameID = getGameIDBySocket(socket);
        const game = games[gameID];
        if (!game || game.gameMode !== 'classic' || game.classicState.lockBoard) {
            return;
        }

        // Sprawdź, czy to tura tego gracza
        if (socket.id !== game.turn) {
            return; // Nie twoja tura
        }

        const cardIndex = data.cardIndex;
        // Poinformuj obu graczy, aby odwrócili kartę
        io.to(gameID).emit('classic:boardUpdate', { type: 'flip', cardIndex });

        const state = game.classicState;

        if (!state.firstCard) {
            // Pierwsza karta w turze
            state.firstCard = { index: cardIndex, value: game.board[cardIndex] };
        } else {
            // Druga karta w turze
            state.secondCard = { index: cardIndex, value: game.board[cardIndex] };
            state.lockBoard = true; // Zablokuj planszę na czas sprawdzania

            if (state.firstCard.value === state.secondCard.value) {
                // PARA ZNALEZIONA
                game.scores[socket.id]++;
                io.to(gameID).emit('classic:scoreUpdate', game.scores);
                io.to(gameID).emit('classic:boardUpdate', {
                    type: 'match',
                    cardIndex1: state.firstCard.index,
                    cardIndex2: state.secondCard.index
                });

                // Sprawdź warunek zwycięstwa (suma punktów = wszystkie pary)
                const totalScore = Object.values(game.scores).reduce((a, b) => a + b, 0);
                if (totalScore === game.board.length / 2) {
                    // KONIEC GRY
                    const winner = game.scores[game.players[0]] > game.scores[game.players[1]] ? game.players[0] : game.players[1];
                    const loser = winner === game.players[0] ? game.players[1] : game.players[0];
                    // Obsługa remisu
                    if(game.scores[game.players[0]] === game.scores[game.players[1]]) {
                        io.to(gameID).emit('classic:gameTied');
                    } else {
                        io.to(winner).emit('youWon');
                        io.to(loser).emit('youLost');
                    }
                    games[gameID].rematch = []; // Zresetuj rewanż
                }

                // Gracz kontynuuje turę
                state.firstCard = null;
                state.secondCard = null;
                state.lockBoard = false;

            } else {
                // PUDŁO
                const otherPlayer = game.players.find(id => id !== socket.id);
                game.turn = otherPlayer; // Zmień turę

                setTimeout(() => {
                    io.to(gameID).emit('classic:boardUpdate', {
                        type: 'unflip',
                        cardIndex1: state.firstCard.index,
                        cardIndex2: state.secondCard.index
                    });
                    
                    state.firstCard = null;
                    state.secondCard = null;
                    state.lockBoard = false;
                    
                    // Poinformuj graczy o zmianie tury
                    io.to(otherPlayer).emit('classic:turnUpdate', true);
                    socket.emit('classic:turnUpdate', false);

                }, 1000); // 1 sekunda na zapamiętanie
            }
        }
    });
    // ===============================================

    // --- Logika Rewanżu ---
    socket.on('requestRematch', () => {
        const gameID = getGameIDBySocket(socket);
        if (!gameID || !games[gameID]) return;

        const game = games[gameID];
        
        if (!game.rematch.includes(socket.id)) {
            game.rematch.push(socket.id);
        }

        socket.broadcast.to(gameID).emit('rematchOffered', socket.id);

        if (game.rematch.length === 2) {
            game.rematch = [];
            
            const { rows, cols, theme, gameMode } = game;
            const themeEmojis = themes[theme] || themes['default'];
            const totalPairs = (rows * cols) / 2;
            const emojisForGame = themeEmojis.slice(0, totalPairs);

            const cardValues = [...emojisForGame, ...emojisForGame];
            shuffle(cardValues);
            game.board = cardValues;

            // Zresetuj stan dla trybu klasycznego
            if (gameMode === 'classic') {
                game.turn = game.players[0]; // Gracz 1 zaczyna ponownie
                game.scores = {
                    [game.players[0]]: 0,
                    [game.players[1]]: 0
                };
                game.classicState = { firstCard: null, secondCard: null, lockBoard: false };
                
                io.to(gameID).emit('classic:scoreUpdate', game.scores);
                io.to(game.players[0]).emit('classic:turnUpdate', true);
                io.to(game.players[1]).emit('classic:turnUpdate', false);
            }

            io.to(gameID).emit('gameStarted', {
                board: cardValues,
                rows: rows,
                cols: cols,
                totalPairs: totalPairs,
                gameMode: gameMode
            });
        }
    });

    // --- Rozłączenie ---
    socket.on('disconnect', () => {
        console.log(`Użytkownik rozłączony: ${socket.id}`);
        const gameID = getGameIDBySocket(socket);
        
        if (gameID && games[gameID]) {
            socket.broadcast.to(gameID).emit('opponentDisconnected');
            delete games[gameID];
            console.log(`Gra ${gameID} została usunięta.`);
        }
    });
});

function getGameIDBySocket(socket) {
    for (const gameID in games) {
        if (games[gameID].players.includes(socket.id)) {
            return gameID;
        }
    }
    return null;
}

// 5. Uruchom serwer
server.listen(PORT, () => {
    console.log(`Serwer nasłuchuje na porcie ${PORT}`);
    console.log(`Otwórz http://localhost:${PORT} w przeglądarce`);
});