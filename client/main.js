const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = {
    id: null,
    x: 100,
    y: 100,
    color: '#' + Math.floor(Math.random() * 16777215).toString(16)
};

const players = {};
const keys = {};
let items = [];
let bullets = [];
let safeZone = { x: 150, y: 100, width: 500, height: 400 };
let winner = null;

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - (player.x + 15);
    const dy = my - (player.y + 15);
    const len = Math.sqrt(dx * dx + dy * dy);
    socket.emit('shoot', { x: dx / len, y: dy / len });
});

socket.on('connect', () => {
    player.id = socket.id;
    socket.emit('newPlayer', player);
});

socket.on('updatePlayers', (serverPlayers) => {
    Object.assign(players, serverPlayers);
});

socket.on('removePlayer', (id) => {
    delete players[id];
});

socket.on('initItems', (serverItems) => {
    items = serverItems;
});

socket.on('removeItem', (id) => {
    items = items.filter(item => item.id !== id);
});

socket.on('updateBullets', (serverBullets) => {
    bullets = serverBullets;
});

socket.on('initZone', (zone) => {
    safeZone = zone;
});

socket.on('updateZone', (zone) => {
    safeZone = zone;
});

socket.on('gameOver', (id) => {
    winner = id;
    if (id === player.id) alert("你是最後的生存者！");
    else alert("你已被淘汰！");
});

function update() {
    if (!winner) {
        let speed = 2;
        if (keys['w']) player.y -= speed;
        if (keys['s']) player.y += speed;
        if (keys['a']) player.x -= speed;
        if (keys['d']) player.x += speed;

        socket.emit('move', { x: player.x, y: player.y });
    }
}

function checkPickup() {
    for (let item of items) {
        let dx = player.x - item.x;
        let dy = player.y - item.y;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
            socket.emit('pickupItem', item.id);
        }
    }
}

function drawItems() {
    for (let item of items) {
        ctx.fillStyle = item.type === 'medkit' ? 'red' :
                        item.type === 'ammo' ? 'yellow' : 'blue';
        ctx.fillRect(item.x, item.y, 15, 15);
    }
}

function drawBullets() {
    for (let b of bullets) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawSafeZone() {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(safeZone.x, safeZone.y, safeZone.width, safeZone.height);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSafeZone();
    drawItems();
    drawBullets();
    for (let id in players) {
        const p = players[id];
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 30, 30);

        ctx.fillStyle = 'white';
        ctx.font = '12px sans-serif';
        ctx.fillText(`HP:${Math.floor(p.hp)}`, p.x, p.y - 5);
    }

    requestAnimationFrame(() => {
        update();
        checkPickup();
        draw();
    });
}

draw();
