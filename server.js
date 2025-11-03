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

// --- Logika Gry ---
const allEmojis = [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', 
    '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦋', 
    '🐞', '🐢', '🐍', '🐠', '🐙', '🐬', '🐳', '🦀', '🦄', '🦖'
];

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
                board: null,
                rematch: [] // NOWA WŁAŚCIWOŚĆ DO ŚLEDZENIA REWANŻU
            };

            socket.join(gameID);
            console.log(`Gracz ${socket.id} stworzył grę ${gameID}`);
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

            // Resetuj stan rewanżu na start gry
            game.rematch = [];
            
            const { rows, cols } = game;
            const totalPairs = (rows * cols) / 2;
            const emojisForGame = allEmojis.slice(0, totalPairs);
            const cardValues = [...emojisForGame, ...emojisForGame];
            shuffle(cardValues);
            game.board = cardValues;

            io.to(gameID).emit('gameStarted', {
                board: cardValues,
                rows: rows,
                cols: cols,
                totalPairs: totalPairs
            });

        } catch (e) {
            console.error(e);
            socket.emit('error', 'Nie udało się dołączyć do gry.');
        }
    });

    // --- Logika w trakcie gry ---
    socket.on('foundMatch', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID) {
            socket.broadcast.to(gameID).emit('opponentFoundMatch');
        }
    });

    // --- Zakończenie gry ---
    socket.on('gameFinished', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID) {
            // Zresetuj stan rewanżu na koniec gry
            games[gameID].rematch = []; 
            
            socket.emit('youWon');
            socket.broadcast.to(gameID).emit('youLost');
            
            // KRYTYCZNA ZMIANA: Już nie usuwamy gry po zakończeniu!
            // Pozwalamy jej istnieć, aby umożliwić rewanż.
            // delete games[gameID]; // <--- USUNIĘTE
        }
    });

    // ===== NOWA LOGIKA REWANŻU =====
    socket.on('requestRematch', () => {
        const gameID = getGameIDBySocket(socket);
        if (!gameID || !games[gameID]) return;

        const game = games[gameID];
        
        // Dodaj gracza do listy chętnych na rewanż
        if (!game.rematch.includes(socket.id)) {
            game.rematch.push(socket.id);
        }

        // Poinformuj drugiego gracza, że ten chce rewanżu
        socket.broadcast.to(gameID).emit('rematchOffered', socket.id);

        // Sprawdź, czy OBAJ gracze chcą rewanżu
        if (game.rematch.length === 2) {
            // TAK! Zresetuj stan i uruchom nową grę
            game.rematch = []; // Wyczyść listę
            
            // Wygeneruj nową planszę (ten sam kod co w 'joinGame')
            const { rows, cols } = game;
            const totalPairs = (rows * cols) / 2;
            const emojisForGame = allEmojis.slice(0, totalPairs);
            const cardValues = [...emojisForGame, ...emojisForGame];
            shuffle(cardValues);
            game.board = cardValues;

            // Wyślij 'gameStarted' do obu graczy
            io.to(gameID).emit('gameStarted', {
                board: cardValues,
                rows: rows,
                cols: cols,
                totalPairs: totalPairs
            });
        }
    });
    // ===============================

    // --- Rozłączenie ---
    socket.on('disconnect', () => {
        console.log(`Użytkownik rozłączony: ${socket.id}`);
        const gameID = getGameIDBySocket(socket);
        
        // ZAKTUALIZOWANE: Jeśli gra istnieje, powiadom drugiego gracza i USUŃ grę
        if (gameID && games[gameID]) {
            socket.broadcast.to(gameID).emit('opponentDisconnected');
            delete games[gameID];
            console.log(`Gra ${gameID} została usunięta.`);
        }
    });
});

// Funkcja pomocnicza
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