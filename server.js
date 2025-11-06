// 1. Załaduj moduły
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 2. Skonfiguruj serwer
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bardzo-tajny-klucz-do-tokenow';

// ===== POŁĄCZENIE Z BAZĄ DANYCH =====
const dbUrl = process.env.DATABASE_URL;
mongoose.connect(dbUrl)
    .then(() => console.log('Połączono z bazą danych MongoDB Atlas!'))
    .catch((err) => console.error('BŁĄD POŁĄCZENIA Z BAZĄ DANYCH:', err));

// ===== MODEL (SCHEMAT) UŻYTKOWNIKA =====
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, minlength: 3, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    achievements: { type: [String], default: [] }
});
const User = mongoose.model('User', UserSchema);
// ============================================

// 3. Ustaw Expressa
app.use((req, res, next) => {
    if (req.url === '/index.html') {
        res.redirect(301, '/');
    } else {
        next();
    }
});
app.use(express.json());
app.use(express.static(__dirname));

// ===== API DO REJESTRACJI =====
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password || password.length < 6 || username.length < 3) {
            return res.status(400).json({ message: 'Nieprawidłowe dane. Sprawdź pola formularza.' });
        }
        
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'Użytkownik o tej nazwie już istnieje.' });
        }
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(400).json({ message: 'Ten adres e-mail jest już zajęty.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ message: 'Rejestracja pomyślna! Możesz się teraz zalogować.' });

    } catch (error) {
        console.error('Błąd rejestracji:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});

// ===== API DO LOGOWANIA (POPRAWIONE) =====
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Wprowadź nazwę użytkownika i hasło.' });
        }

        // 1. Znajdź użytkownika
        const user = await User.findOne({ username: username.toLowerCase() });
        
        // POPRAWKA: Jeśli użytkownik NIE istnieje, 'user' będzie 'null'.
        // Dalsza próba 'bcrypt.compare(password, user.password)' spowoduje błąd 500.
        // Dlatego najpierw sprawdzamy, czy użytkownik istnieje.
        if (!user) {
            return res.status(400).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
        }

        // 2. Porównaj hasła
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
        }

        // 3. Stwórz Token (Bilet)
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1d' } 
        );

        // 4. Wyślij Token i dane użytkownika z powrotem
        res.status(200).json({
            message: 'Zalogowano pomyślnie!',
            token: token,
            user: {
                username: user.username,
                achievements: user.achievements
            }
        });

    } catch (error) {
        console.error('Błąd logowania:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});
// ===============================

// ===== MIDDLEWARE: "Strażnik" do sprawdzania tokenu =====
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ===== API: Odblokowanie Osiągnięcia =====
app.post('/api/unlock-achievement', authenticateToken, async (req, res) => {
    try {
        const { achievementId } = req.body;
        const userId = req.user.userId;

        await User.updateOne(
            { _id: userId },
            { $addToSet: { achievements: achievementId } }
        );
        
        res.status(200).json({ message: 'Osiągnięcie zapisane.' });
    } catch (error) {
        console.error('Błąd zapisu osiągnięcia:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});

// ===== LOGIKA GRY (Socket.IO) - BEZ ZMIAN =====
const themes = {
    default: ['💎', '🤖', '👽', '👻', '💀', '🎃', '🚀', '🍄', '🛸', '☄️', '🪐', '🕹️', '💾', '💿', '📼', '📞', '📺', '💰', '💣', '⚔️', '🛡️', '🔑', '🎁', '🧱', '🧭', '🔋', '🧪', '🧬', '🔭', '💡'],
    nature: ['🌳', '🌲', '🍁', '🍂', '🌿', '🌸', '🌻', '🌊', '⛰️', '🌋', '🌾', '🐚', '🕸️', '🐞', '🦋', '🏞️', '🌅', '🌌'],
    food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🥐', '🍞', '🥨', '🧀', '🥞', '🧇', '🍗', '🍣', '🍤', '🍩', '🍪', '🍰', '🧁'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦']
};
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
let games = {};
io.on('connection', (socket) => {
    console.log(`Użytkownik połączony: ${socket.id}`);
    socket.on('createGame', (data) => {
        try {
            let gameID;
            do { gameID = Math.floor(1000 + Math.random() * 9000).toString(); } while (games[gameID]);
            games[gameID] = {
                players: [socket.id], rows: data.rows, cols: data.cols, theme: data.theme || 'default', gameMode: data.gameMode || 'race', board: null, rematch: [], turn: null, scores: {}, classicState: { firstCard: null, secondCard: null, lockBoard: false }
            };
            socket.join(gameID);
            console.log(`Gracz ${socket.id} stworzył grę ${gameID} (Tryb: ${games[gameID].gameMode})`);
            socket.emit('gameCreated', { gameID });
        } catch (e) { console.error(e); socket.emit('error', 'Nie udało się stworzyć gry.'); }
    });
    socket.on('joinGame', (data) => {
        try {
            const gameID = data.gameID; const game = games[gameID];
            if (!game) { socket.emit('error', 'Gra o tym ID nie istnieje.'); return; }
            if (game.players.length >= 2) { socket.emit('error', 'Ten pokój jest już pełny.'); return; }
            socket.join(gameID); game.players.push(socket.id); console.log(`Gracz ${socket.id} dołączył do gry ${gameID}`);
            game.rematch = [];
            const { rows, cols, theme, gameMode } = game;
            const themeEmojis = themes[theme] || themes['default'];
            const totalPairs = (rows * cols) / 2;
            const emojisForGame = themeEmojis.slice(0, totalPairs);
            const cardValues = [...emojisForGame, ...emojisForGame]; shuffle(cardValues); game.board = cardValues;
            if (gameMode === 'classic') {
                game.turn = game.players[0]; game.scores = { [game.players[0]]: 0, [game.players[1]]: 0 };
                game.classicState = { firstCard: null, secondCard: null, lockBoard: false };
                io.to(gameID).emit('classic:scoreUpdate', game.scores);
            }
            io.to(gameID).emit('gameStarted', {
                board: cardValues, rows: rows, cols: cols, totalPairs: totalPairs, gameMode: gameMode, turn: game.turn
            });
        } catch (e) { console.error(e); socket.emit('error', 'Nie udało się dołączyć do gry.'); }
    });
    socket.on('foundMatch', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID && games[gameID].gameMode === 'race') { socket.broadcast.to(gameID).emit('opponentFoundMatch'); }
    });
    socket.on('gameFinished', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID && games[gameID] && games[gameID].gameMode === 'race') {
            games[gameID].rematch = []; socket.emit('youWon'); socket.broadcast.to(gameID).emit('youLost');
        }
    });
    socket.on('classic:flip', (data) => {
        const gameID = getGameIDBySocket(socket); const game = games[gameID];
        if (!game || game.gameMode !== 'classic' || game.classicState.lockBoard) { return; }
        if (socket.id !== game.turn) { return; }
        const cardIndex = data.cardIndex; io.to(gameID).emit('classic:boardUpdate', { type: 'flip', cardIndex });
        const state = game.classicState;
        if (!state.firstCard) {
            state.firstCard = { index: cardIndex, value: game.board[cardIndex] }; socket.emit('classic:turnUpdate', true);
        } else {
            state.secondCard = { index: cardIndex, value: game.board[cardIndex] }; state.lockBoard = true;
            if (state.firstCard.value === state.secondCard.value) {
                game.scores[socket.id]++; io.to(gameID).emit('classic:scoreUpdate', game.scores);
                io.to(gameID).emit('classic:boardUpdate', { type: 'match', cardIndex1: state.firstCard.index, cardIndex2: state.secondCard.index });
                const totalScore = Object.values(game.scores).reduce((a, b) => a + b, 0);
                if (totalScore === game.board.length / 2) {
                    const winner = game.scores[game.players[0]] > game.scores[game.players[1]] ? game.players[0] : game.players[1];
                    const loser = winner === game.players[0] ? game.players[1] : game.players[0];
                    if(game.scores[game.players[0]] === game.scores[game.players[1]]) {
                        io.to(gameID).emit('classic:gameTied');
                    } else { io.to(winner).emit('youWon'); io.to(loser).emit('youLost'); }
                    games[gameID].rematch = [];
                }
                state.firstCard = null; state.secondCard = null; state.lockBoard = false; socket.emit('classic:turnUpdate', true);
            } else {
                const otherPlayer = game.players.find(id => id !== socket.id); game.turn = otherPlayer;
                setTimeout(() => {
                    io.to(gameID).emit('classic:boardUpdate', { type: 'unflip', cardIndex1: state.firstCard.index, cardIndex2: state.secondCard.index });
                    state.firstCard = null; state.secondCard = null; state.lockBoard = false;
                    io.to(otherPlayer).emit('classic:turnUpdate', true); socket.emit('classic:turnUpdate', false);
                }, 1000);
            }
        }
    });
    socket.on('requestRematch', () => {
        const gameID = getGameIDBySocket(socket); if (!gameID || !games[gameID]) return;
        const game = games[gameID];
        if (!game.rematch.includes(socket.id)) { game.rematch.push(socket.id); }
        socket.broadcast.to(gameID).emit('rematchOffered', socket.id);
        if (game.rematch.length === 2) {
            game.rematch = [];
            const { rows, cols, theme, gameMode } = game;
            const themeEmojis = themes[theme] || themes['default'];
            const totalPairs = (rows * cols) / 2;
            const emojisForGame = themeEmojis.slice(0, totalPairs);
            const cardValues = [...emojisForGame, ...emojisForGame]; shuffle(cardValues); game.board = cardValues;
            if (gameMode === 'classic') {
                game.turn = game.players[0]; game.scores = { [game.players[0]]: 0, [game.players[1]]: 0 };
                game.classicState = { firstCard: null, secondCard: null, lockBoard: false };
                io.to(gameID).emit('classic:scoreUpdate', game.scores);
            }
            io.to(gameID).emit('gameStarted', {
                board: cardValues, rows: rows, cols: cols, totalPairs: totalPairs, gameMode: gameMode, turn: game.turn
            });
        }
    });
    socket.on('disconnect', () => {
        console.log(`Użytkownik rozłączony: ${socket.id}`);
        const gameID = getGameIDBySocket(socket);
        if (gameID && games[gameID]) {
            socket.broadcast.to(gameID).emit('opponentDisconnected'); delete games[gameID]; console.log(`Gra ${gameID} została usunięta.`);
        }
    });
});
function getGameIDBySocket(socket) {
    for (const gameID in games) { if (games[gameID].players.includes(socket.id)) { return gameID; } } return null;
}
// ============================================

// 5. Uruchom serwer
server.listen(PORT, () => {
    console.log(`Serwer nasłuchuje na porcie ${PORT}`);
    console.log(`Otwórz http://localhost:${PORT} w przeglądarce`);
});