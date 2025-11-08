// 1. Załaduj moduły
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');
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
    achievements: { type: [String], default: [] },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    totalGamesPlayed: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    soloBestTimeEasy: { type: Number, default: 9999 },
    soloBestTimeMedium: { type: Number, default: 9999 },
    soloBestTimeHard: { type: Number, default: 9999 }
});
const User = mongoose.model('User', UserSchema);
// ============================================

// 3. Ustaw Expressa
app.use((req, res, next) => {
    if (req.url === '/blog') {
        res.redirect(301, '/blog/');
        return;
    }
    if (req.url === '/index.html') {
        res.redirect(301, '/');
        return;
    }
    next();
});

// Trasa dla artykułów bloga (SEO)
app.get('/blog/:slug', (req, res, next) => {
    const slug = req.params.slug;
    if (!slug || slug.includes('..') || slug.includes('/')) {
        return next(); 
    }
    const filePath = path.join(__dirname, 'blog', `${slug}.html`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.warn(`Nie znaleziono pliku dla sluga: ${slug}`);
            next(); // Przekaż do obsługi 404
        }
    });
});

app.use(express.json());
app.use(express.static(__dirname)); // Serwowanie plików statycznych (jak /blog/index.html)

// ===== API (Rejestracja, Logowanie...) =====
// ... (Wszystkie app.post i app.get dla /api/... pozostają bez zmian) ...
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
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Wprowadź nazwę użytkownika i hasło.' });
        }
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
        }
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1d' } 
        );
        res.status(200).json({
            message: 'Zalogowano pomyślnie!',
            token: token,
            user: {
                username: user.username,
                achievements: user.achievements,
                totalGamesPlayed: user.totalGamesPlayed,
                totalWins: user.totalWins,
                soloBestTimeEasy: user.soloBestTimeEasy,
                soloBestTimeMedium: user.soloBestTimeMedium,
                soloBestTimeHard: user.soloBestTimeHard
            }
        });
    } catch (error) {
        console.error('Błąd logowania:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
app.get('/api/verify-token', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        }
        res.status(200).json({
            message: 'Token jest ważny.',
            user: {
                username: user.username,
                achievements: user.achievements,
                totalGamesPlayed: user.totalGamesPlayed,
                totalWins: user.totalWins,
                soloBestTimeEasy: user.soloBestTimeEasy,
                soloBestTimeMedium: user.soloBestTimeMedium,
                soloBestTimeHard: user.soloBestTimeHard
            }
        });
    } catch (error) {
        console.error('Błąd weryfikacji tokenu:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});
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
const transporter = nodemailer.createTransport({
    host: process.env.BREVO_HOST,
    port: process.env.BREVO_PORT,
    secure: false, 
    auth: {
        user: process.env.BREVO_LOGIN, 
        pass: process.env.BREVO_PASS, 
    },
});
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(200).json({ message: 'Jeśli ten e-mail istnieje w naszej bazie, wysłaliśmy na niego link.' });
        }
        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();
        const resetLink = `https://memorr.top/reset.html?token=${token}`;
        const mailOptions = {
            from: `"Memorr" <${process.env.BREVO_SENDER}>`,
            to: user.email,
            subject: 'Memorr - Reset hasła',
            html: `<p>Witaj,</p>
                   <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w grze Memorr.</p>
                   <p>Kliknij w poniższy link, aby ustawić nowe hasło:</p>
                   <a href="${resetLink}" style="padding: 10px 15px; background-color: #6D9886; color: white; text-decoration: none; border-radius: 5px;">Resetuj Hasło</a>
                   <p>Jeśli to nie Ty prosiłeś o reset, zignoruj tę wiadomość.</p>
                   <p>Link wygaśnie za 1 godzinę.</p>`
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Jeśli ten e-mail istnieje w naszej bazie, wysłaliśmy na niego link.' });
    } catch (error) {
        console.error("Błąd /api/forgot-password:", error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Nieprawidłowe dane lub hasło jest za krótkie.' });
        }
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ message: 'Token jest nieprawidłowy lub wygasł. Spróbuj ponownie.' });
        }
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(200).json({ message: 'Hasło zostało pomyślnie zresetowane!' });
    } catch (error) {
        console.error("Błąd /api/reset-password:", error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});
app.post('/api/save-solo-stats', authenticateToken, async (req, res) => {
    try {
        const { difficulty, time } = req.body;
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        }
        let updateQuery = { $inc: { totalGamesPlayed: 1 } };
        let newRecord = false;
        if (difficulty === 'easy' && time < user.soloBestTimeEasy) {
            updateQuery.soloBestTimeEasy = time;
            newRecord = true;
        } else if (difficulty === 'medium' && time < user.soloBestTimeMedium) {
            updateQuery.soloBestTimeMedium = time;
            newRecord = true;
        } else if (difficulty === 'hard' && time < user.soloBestTimeHard) {
            updateQuery.soloBestTimeHard = time;
            newRecord = true;
        }
        await User.updateOne({ _id: userId }, updateQuery);
        const updatedUser = await User.findById(userId);
        res.status(200).json({ 
            message: 'Statystyki zapisane.', 
            newRecord: newRecord,
            updatedStats: {
                totalGamesPlayed: updatedUser.totalGamesPlayed,
                totalWins: updatedUser.totalWins,
                soloBestTimeEasy: updatedUser.soloBestTimeEasy,
                soloBestTimeMedium: updatedUser.soloBestTimeMedium,
                soloBestTimeHard: updatedUser.soloBestTimeHard
            }
        });
    } catch (error) {
        console.error('Błąd zapisu statystyk solo:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});
app.get('/api/leaderboard-time', async (req, res) => {
    try {
        const topPlayers = await User.find({ soloBestTimeHard: { $lt: 9999 } })
            .sort({ soloBestTimeHard: 1 })
            .limit(10)
            .select('username soloBestTimeHard');
        res.status(200).json(topPlayers);
    } catch (error) {
        console.error('Błąd pobierania rankingu (czas):', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});
app.get('/api/leaderboard-wins', async (req, res) => {
    try {
        const topPlayers = await User.find({ totalWins: { $gt: 0 } })
            .sort({ totalWins: -1 })
            .limit(10)
            .select('username totalWins');
        res.status(200).json(topPlayers);
    } catch (error) {
        console.error('Błąd pobierania rankingu (wygrane):', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});


// ===== LOGIKA GRY (Socket.IO) =====
// ... (CAŁA LOGIKA SOCKET.IO POZOSTAJE BEZ ZMIAN) ...
const themes = {
    default: ['💎', '🤖', '👽', '👻', '💀', '🎃', '🚀', '🍄', '🛸', '☄️', '🪐', '🕹️', '💾', '💿', '📼', '📞', '📺', '💰', '💣', '⚔️', '🛡️', '🔑', '🎁', '🧱', '🧭', '🔋', '🧪', '🧬', '🔭', '💡'],
    nature: ['🌳', '🌲', '🍁', '🍂', '🌿', '🌸', '🌻', '🌊', '⛰️', '🌋', '🌾', '🐚', '🕸️', '🐞', '🦋', '🏞️', '🌅', '🌌'],
    food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🥐', '🍞', '🥨', '🧀', '🥞', '🧇', '🍗', '🍣', '🍤', '🍩', '🍪', '🍰', '🧁'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦']
};
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
let games = {};
async function awardWin(userId) {
    if (!userId) return; 
    try {
        await User.updateOne({ _id: userId }, { $inc: { totalWins: 1, totalGamesPlayed: 1 } });
        console.log(`Przyznano wygraną dla użytkownika: ${userId}`);
    } catch (error) {
        console.error('Błąd przyznawania wygranej:', error);
    }
}
async function awardLoss(userId) {
    if (!userId) return;
    try {
        await User.updateOne({ _id: userId }, { $inc: { totalGamesPlayed: 1 } });
        console.log(`Zapisano grę dla użytkownika: ${userId}`);
    } catch (error) {
        console.error('Błąd zapisywania gry:', error);
    }
}
function getUserIdFromToken(token) {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.userId;
    } catch (error) {
        return null;
    }
}
io.on('connection', (socket) => {
    console.log(`Użytkownik połączony: ${socket.id}`);
    socket.on('createGame', (data) => {
        try {
            let gameID;
            do { gameID = Math.floor(1000 + Math.random() * 9000).toString(); } while (games[gameID]);
            const userId = getUserIdFromToken(data.token);
            games[gameID] = {
                players: [{ socketId: socket.id, userId: userId }],
                rows: data.rows, cols: data.cols, theme: data.theme || 'default', gameMode: data.gameMode || 'race', board: null, rematch: [], turn: null, scores: {}, classicState: { firstCard: null, secondCard: null, lockBoard: false, matchedIndices: [] }, powerUpsUsed: { [socket.id]: [] }
            };
            socket.join(gameID);
            console.log(`Gracz ${socket.id} (User: ${userId}) stworzył grę ${gameID}`);
            socket.emit('gameCreated', { gameID });
        } catch (e) { console.error(e); socket.emit('error', 'Nie udało się stworzyć gry.'); }
    });
    socket.on('joinGame', (data) => {
        try {
            const gameID = data.gameID; const game = games[gameID];
            if (!game) { socket.emit('error', 'Gra o tym ID nie istnieje.'); return; }
            if (game.players.length >= 2) { socket.emit('error', 'Ten pokój jest już pełny.'); return; }
            const userId = getUserIdFromToken(data.token);
            socket.join(gameID); 
            game.players.push({ socketId: socket.id, userId: userId });
            console.log(`Gracz ${socket.id} (User: ${userId}) dołączył do gry ${gameID}`);
            game.rematch = [];
            game.powerUpsUsed = {
                [game.players[0].socketId]: [],
                [game.players[1].socketId]: []
            };
            const { rows, cols, theme, gameMode } = game;
            const themeEmojis = themes[theme] || themes['default'];
            const totalPairs = (rows * cols) / 2;
            const emojisForGame = themeEmojis.slice(0, totalPairs);
            const cardValues = [...emojisForGame, ...emojisForGame]; shuffle(cardValues); game.board = cardValues;
            if (gameMode === 'classic') {
                game.turn = game.players[0].socketId;
                game.scores = {
                    [game.players[0].socketId]: 0,
                    [game.players[1].socketId]: 0
                };
                game.classicState = { firstCard: null, secondCard: null, lockBoard: false, matchedIndices: [] };
                io.to(gameID).emit('classic:scoreUpdate', game.scores);
            }
            io.to(gameID).emit('gameStarted', {
                board: cardValues, rows: rows, cols: cols, totalPairs: totalPairs, gameMode: gameMode, turn: game.turn
            });
        } catch (e) { console.error(e); socket.emit('error', 'Nie udało się dołączyć do gry.'); }
    });
    socket.on('usePowerUp', (powerUpType) => {
        const gameID = getGameIDBySocket(socket); const game = games[gameID]; if (!game) return;
        if (game.powerUpsUsed[socket.id] && game.powerUpsUsed[socket.id].includes(powerUpType)) { return; }
        if (!game.powerUpsUsed[socket.id]) game.powerUpsUsed[socket.id] = [];
        game.powerUpsUsed[socket.id].push(powerUpType);
        socket.emit('powerUp:used', powerUpType);
        if (game.gameMode === 'classic') {
            if (game.turn !== socket.id) return; 
            if (powerUpType === 'peek') {
                io.to(gameID).emit('powerUp:peek');
            } else if (powerUpType === 'autoPair') {
                let pairFound = false;
                for (let i = 0; i < game.board.length; i++) {
                    if (game.classicState.matchedIndices.includes(i)) continue; const val1 = game.board[i];
                    for (let j = i + 1; j < game.board.length; j++) {
                        if (game.classicState.matchedIndices.includes(j)) continue; const val2 = game.board[j];
                        if (val1 === val2) {
                            pairFound = true; game.classicState.matchedIndices.push(i, j); game.scores[socket.id]++;
                            io.to(gameID).emit('classic:scoreUpdate', game.scores);
                            io.to(gameID).emit('classic:boardUpdate', { type: 'match', cardIndex1: i, cardIndex2: j });
                            const totalScore = Object.values(game.scores).reduce((a, b) => a + b, 0);
                            if (totalScore === game.board.length / 2) {
                                const p1 = game.players[0]; const p2 = game.players[1];
                                if(game.scores[p1.socketId] === game.scores[p2.socketId]) {
                                    io.to(gameID).emit('classic:gameTied');
                                    awardLoss(p1.userId); awardLoss(p2.userId);
                                } else if (game.scores[p1.socketId] > game.scores[p2.socketId]) {
                                    io.to(p1.socketId).emit('youWon'); io.to(p2.socketId).emit('youLost');
                                    awardWin(p1.userId); awardLoss(p2.userId);
                                } else {
                                    io.to(p2.socketId).emit('youWon'); io.to(p1.socketId).emit('youLost');
                                    awardWin(p2.userId); awardLoss(p1.userId);
                                }
                                games[gameID].rematch = [];
                            }
                            socket.emit('classic:turnUpdate', true); break;
                        }
                    } if (pairFound) break;
                }
            }
        }
    });
    socket.on('foundMatch', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID && games[gameID] && games[gameID].gameMode === 'race') { socket.broadcast.to(gameID).emit('opponentFoundMatch'); }
    });
    socket.on('gameFinished', () => {
        const gameID = getGameIDBySocket(socket);
        if (gameID && games[gameID] && games[gameID].gameMode === 'race') {
            games[gameID].rematch = []; 
            socket.emit('youWon');
            socket.broadcast.to(gameID).emit('youLost');
            const winner = game.players.find(p => p.socketId === socket.id);
            const loser = game.players.find(p => p.socketId !== socket.id);
            if (winner) awardWin(winner.userId);
            if (loser) awardLoss(loser.userId);
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
                game.scores[socket.id]++; game.classicState.matchedIndices.push(state.firstCard.index, state.secondCard.index);
                io.to(gameID).emit('classic:scoreUpdate', game.scores);
                io.to(gameID).emit('classic:boardUpdate', { type: 'match', cardIndex1: state.firstCard.index, cardIndex2: state.secondCard.index });
                const totalScore = Object.values(game.scores).reduce((a, b) => a + b, 0);
                if (totalScore === game.board.length / 2) {
                    const p1 = game.players[0]; const p2 = game.players[1];
                    if(game.scores[p1.socketId] === game.scores[p2.socketId]) {
                        io.to(gameID).emit('classic:gameTied');
                        awardLoss(p1.userId); awardLoss(p2.userId);
                    } else if (game.scores[p1.socketId] > game.scores[p2.socketId]) {
                        io.to(p1.socketId).emit('youWon'); io.to(p2.socketId).emit('youLost');
                        awardWin(p1.userId); awardLoss(p2.userId);
                    } else {
                        io.to(p2.socketId).emit('youWon'); io.to(p1.socketId).emit('youLost');
                        awardWin(p2.userId); awardLoss(p1.userId);
                    }
                    games[gameID].rematch = [];
                }
                state.firstCard = null; state.secondCard = null; state.lockBoard = false; socket.emit('classic:turnUpdate', true);
            } else {
                const otherPlayer = game.players.find(p => p.socketId !== socket.id).socketId;
                game.turn = otherPlayer;
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
            game.powerUpsUsed = {
                [game.players[0].socketId]: [],
                [game.players[1].socketId]: []
            };
            if (gameMode === 'classic') {
                game.turn = game.players[0].socketId;
                game.scores = {
                    [game.players[0].socketId]: 0,
                    [game.players[1].socketId]: 0
                };
                game.classicState = { firstCard: null, secondCard: null, lockBoard: false, matchedIndices: [] };
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
            const remainingPlayer = games[gameID].players.find(p => p.socketId !== socket.id);
            if (remainingPlayer) {
                awardWin(remainingPlayer.userId);
                io.to(remainingPlayer.socketId).emit('opponentDisconnected');
            }
            delete games[gameID];
            console.log(`Gra ${gameID} została usunięta.`);
        }
    });
});
function getGameIDBySocket(socket) {
    for (const gameID in games) {
        if (games[gameID].players.some(p => p.socketId === socket.id)) {
            return gameID;
        }
    }
    return null;
}
// ============================================

// 4. OBSŁUGA BŁĘDÓW 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});
// ============================================

// 5. Uruchom serwer
server.listen(PORT, () => {
    console.log(`Serwer nasłuchuje na porcie ${PORT}`);
    console.log(`Otwórz http://localhost:${PORT} w przeglądarce`);
});