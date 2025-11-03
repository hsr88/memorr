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
                board: null
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

    socket.on('gameFinished', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID) {
            socket.emit('youWon');
            socket.broadcast.to(gameID).emit('youLost');
            delete games[gameID];
        }
    });

    // --- Rozłączenie ---
    socket.on('disconnect', () => {
        console.log(`Użytkownik rozłączony: ${socket.id}`);
        const gameID = getGameIDBySocket(socket);
        if (gameID) {
            socket.broadcast.to(gameID).emit('opponentDisconnected');
            delete games[gameID];
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
