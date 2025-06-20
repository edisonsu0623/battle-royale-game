const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/../client'));

const players = {};
let gameStarted = false;
const items = [];
const bullets = [];

let safeZone = {
    x: 150, y: 100,
    width: 500, height: 400
};

function spawnItems() {
    const itemTypes = ['medkit', 'ammo', 'gun'];
    for (let i = 0; i < 10; i++) {
        items.push({
            id: i,
            type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50
        });
    }
}

spawnItems();

io.on('connection', (socket) => {
    console.log('玩家連線：' + socket.id);

    socket.on('newPlayer', (playerData) => {
        if (!gameStarted && Object.keys(players).length >= 2) gameStarted = true;
        playerData.inventory = [];
        playerData.hp = 100;
        players[socket.id] = playerData;
        socket.emit('initItems', items);
        socket.emit('initZone', safeZone);
        io.emit('updatePlayers', players);
    });

    socket.on('move', (position) => {
        if (players[socket.id]) {
            players[socket.id].x = position.x;
            players[socket.id].y = position.y;
            io.emit('updatePlayers', players);
        }
    });

    socket.on('pickupItem', (itemId) => {
        const itemIndex = items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1 && players[socket.id]) {
            const item = items[itemIndex];
            players[socket.id].inventory.push(item.type);
            items.splice(itemIndex, 1);
            io.emit('removeItem', itemId);
        }
    });

    socket.on('shoot', (dir) => {
        if (!players[socket.id]) return;
        const shooter = players[socket.id];
        bullets.push({
            id: Date.now() + Math.random(),
            x: shooter.x + 15,
            y: shooter.y + 15,
            dx: dir.x * 5,
            dy: dir.y * 5,
            owner: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('玩家離線：' + socket.id);
        delete players[socket.id];
        io.emit('removePlayer', socket.id);
    });
});

// 遊戲邏輯更新
setInterval(() => {
    // 子彈移動與命中檢查
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.dx;
        b.y += b.dy;

        for (let id in players) {
            if (id !== b.owner) {
                const p = players[id];
                if (Math.abs(p.x - b.x) < 15 && Math.abs(p.y - b.y) < 15) {
                    p.hp -= 20;
                    if (p.hp <= 0) {
                        delete players[id];
                        io.emit('removePlayer', id);
                    }
                    bullets.splice(i, 1);
                    break;
                }
            }
        }

        if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
            bullets.splice(i, 1);
        }
    }

    // 縮圈邏輯
    safeZone.x += 0.1;
    safeZone.y += 0.1;
    safeZone.width -= 0.2;
    safeZone.height -= 0.2;

    for (let id in players) {
        const p = players[id];
        if (
            p.x < safeZone.x ||
            p.x > safeZone.x + safeZone.width ||
            p.y < safeZone.y ||
            p.y > safeZone.y + safeZone.height
        ) {
            p.hp -= 0.5;
            if (p.hp <= 0) {
                delete players[id];
                io.emit('removePlayer', id);
            }
        }
    }

    // 勝利者判定
    const alive = Object.keys(players);
    if (alive.length === 1 && gameStarted) {
        io.emit('gameOver', alive[0]);
    }

    io.emit('updatePlayers', players);
    io.emit('updateBullets', bullets);
    io.emit('updateZone', safeZone);
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`伺服器啟動於 http://localhost:${PORT}`);
});
