'use strict';

const ASSET_PATHS = {
    tingting_normal: 'assets/sprites_png/tingting_normal.png',
    tingting_happy: 'assets/sprites_png/tingting_happy.png',
    tingting_dizzy: 'assets/sprites_png/tingting_dizzy.png',
    item_macaron: 'assets/sprites_png/item_macaron.png',
    item_donut: 'assets/sprites_png/item_donut.png',
    item_cake: 'assets/sprites_png/item_cake.png',
    item_lollipop: 'assets/sprites_png/item_lollipop.png',
    item_heart_gummy: 'assets/sprites_png/item_heart_gummy.png',
    item_chocolate_bomb: 'assets/sprites_png/item_chocolate_bomb.png',
    bg_cover_3d: 'assets/backgrounds/bg_cover_3d.png',
    bg_garden_3d: 'assets/backgrounds/bg_garden_3d.png'
};
const images = {};

function readHighScore() {
    try { return Math.max(0, parseInt(localStorage.getItem('tingting_3d_best') || '0', 10) || 0); }
    catch { return 0; }
}

function drawBackground(ctx, image, width, height, fit) {
    const scale = Math[fit === 'cover' ? 'max' : 'min'](width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

async function loadAssets() {
    await Promise.all(Object.entries(ASSET_PATHS).map(([key, path]) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => { images[key] = image; resolve(); };
        image.onerror = () => reject(new Error(path));
        image.src = path;
    })));
}

    class CandySoundSystem {
        constructor() {
            this.ctx = null;
            this.enabled = true;
            this.bgmTimer = null;
            this.noteIndex = 0;
            this.melody = [
                523.25, 659.25, 783.99, 1046.50,
                880.00, 783.99, 659.25, 587.33,
                523.25, 587.33, 659.25, 783.99,
                659.25, 587.33, 523.25, 392.00
            ];
        }

        ensureContext() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        toggle() {
            this.enabled = !this.enabled;
            if (!this.enabled) {
                this.stopBGM();
            } else if (game && game.state === 'PLAYING') {
                this.startBGM();
            }
            return this.enabled;
        }

        playTone(freq, duration = 0.12, type = 'sine', volume = 0.14, slideFreq = null) {
            if (!this.enabled) return;
            this.ensureContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (slideFreq) {
                osc.frequency.exponentialRampToValueAtTime(slideFreq, now + duration);
            }
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
        }

        playCatchSweet(isBonus = false) {
            if (isBonus) {
                this.playTone(587.33, 0.09, 'triangle', 0.18, 880);
                setTimeout(() => this.playTone(880, 0.14, 'triangle', 0.18, 1174.66), 70);
            } else {
                this.playTone(659.25, 0.11, 'sine', 0.16, 987.77);
            }
        }

        playFeverStart() {
            [523.25, 659.25, 783.99, 1046.50].forEach((n, idx) => {
                setTimeout(() => this.playTone(n, 0.16, 'triangle', 0.2, n * 1.15), idx * 75);
            });
        }

        playDamage() {
            this.playTone(220, 0.22, 'sawtooth', 0.18, 110);
            setTimeout(() => this.playTone(150, 0.28, 'sawtooth', 0.18, 85), 110);
        }

        playGameOver() {
            [783.99, 659.25, 587.33, 523.25, 659.25, 1046.50].forEach((n, idx) => {
                setTimeout(() => this.playTone(n, 0.18, 'triangle', 0.16), idx * 110);
            });
        }

        startBGM() {
            this.stopBGM();
            if (!this.enabled) return;
            this.ensureContext();
            const tempoMs = game && game.feverTime > 0 ? 180 : 235;
            this.bgmTimer = setInterval(() => {
                if (!this.enabled || !game || game.state !== 'PLAYING') return;
                const freq = this.melody[this.noteIndex % this.melody.length];
                this.noteIndex++;
                this.playTone(freq, 0.14, 'sine', 0.05);
            }, tempoMs);
        }

        stopBGM() {
            if (this.bgmTimer) {
                clearInterval(this.bgmTimer);
                this.bgmTimer = null;
            }
        }
    }

    const sound = new CandySoundSystem();

    const ITEM_TYPES = [
        { id: 'item_macaron', score: 10, weight: 38, speedMin: 230, speedMax: 340, radius: 42, isHazard: false, label: '+10 馬卡龍!' },
        { id: 'item_donut', score: 20, weight: 25, speedMin: 260, speedMax: 380, radius: 44, isHazard: false, label: '+20 草莓甜甜圈!' },
        { id: 'item_cake', score: 35, weight: 16, speedMin: 300, speedMax: 430, radius: 46, isHazard: false, label: '+35 皇家草莓蛋糕!' },
        { id: 'item_lollipop', score: 50, weight: 5, speedMin: 280, speedMax: 380, radius: 46, isHazard: false, isFever: true, label: '🌈 SUGAR RUSH!' },
        { id: 'item_heart_gummy', score: 15, weight: 4, speedMin: 250, speedMax: 340, radius: 42, isHazard: false, isHeal: true, label: '💖 +1 生命值!' },
        { id: 'item_chocolate_bomb', score: 0, weight: 18, speedMin: 280, speedMax: 420, radius: 40, isHazard: true, label: '⚠️ 黑朱古力 -1♥' }
    ];

    class CandyGarden3DGame {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.width = 1280;
            this.height = 720;

            this.state = 'TITLE';
            this.score = 0;
            this.highScore = readHighScore();
            this.lives = 3;
            this.maxLives = 3;
            this.timeLeft = 60;
            this.combo = 0;
            this.maxCombo = 0;
            this.feverTime = 0;
            this.shakeTime = 0;

            this.player = {
                x: this.width / 2,
                targetX: this.width / 2,
                y: 550,
                width: 245,
                height: 245,
                speed: 820,
                mood: 'normal',
                moodTimer: 0,
                bobPhase: 0,
                scalePop: 1
            };

            this.keys = { left: false, right: false };
            this.pointerActive = false;
            this.fallingItems = [];
            this.particles = [];
            this.floatingTexts = [];
            this.spawnTimer = 0;
            this.lastTimestamp = performance.now();

            this.resize();
            window.addEventListener('resize', () => this.resize());
            this.bindControls();
            this.updateTitleHighScore();
        }

        updateTitleHighScore() {
            document.getElementById('titleHighScore').textContent = this.highScore;
        }

        resize() {
            const rect = this.canvas.getBoundingClientRect();
            const aspect = rect.width / Math.max(1, rect.height);
            const oldWidth = this.width;
            const oldHeight = this.height;
            this.height = Math.round(Math.max(720, 720 / aspect));
            this.width = Math.round(this.height * aspect);
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.player.x *= this.width / oldWidth;
            this.player.targetX *= this.width / oldWidth;
            this.player.y = this.height - 170;
            for (const item of this.fallingItems) {
                item.x *= this.width / oldWidth;
                item.y *= this.height / oldHeight;
                item.vy *= this.height / oldHeight;
            }
        }

        bindControls() {
            window.addEventListener('keydown', e => {
                if (['ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    this.keys.left = true;
                    this.pointerActive = false;
                }
                if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    this.keys.right = true;
                    this.pointerActive = false;
                }
            });

            window.addEventListener('blur', () => { this.keys.left = this.keys.right = false; });
            window.addEventListener('keyup', e => {
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
                if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
            });

            const updatePointerX = clientX => {
                const rect = this.canvas.getBoundingClientRect();
                const relX = ((clientX - rect.left) / rect.width) * this.width;
                this.player.targetX = Math.max(125, Math.min(this.width - 125, relX));
                this.pointerActive = true;
            };

            this.canvas.addEventListener('mousemove', e => {
                if (this.state === 'PLAYING') updatePointerX(e.clientX);
            });

            this.canvas.addEventListener('touchstart', e => {
                if (e.touches.length > 0 && this.state === 'PLAYING') {
                    updatePointerX(e.touches[0].clientX);
                }
            }, { passive: true });

            this.canvas.addEventListener('touchmove', e => {
                if (e.touches.length > 0 && this.state === 'PLAYING') {
                    updatePointerX(e.touches[0].clientX);
                }
            }, { passive: true });
        }

        startNewGame() {
            this.state = 'PLAYING';
            this.score = 0;
            this.lives = 3;
            this.timeLeft = 60;
            this.combo = 0;
            this.maxCombo = 0;
            this.feverTime = 0;
            this.shakeTime = 0;
            this.fallingItems = [];
            this.particles = [];
            this.floatingTexts = [];
            this.spawnTimer = 0.15;

            this.player.x = this.width / 2;
            this.player.targetX = this.width / 2;
            this.player.mood = 'normal';
            this.player.moodTimer = 0;
            this.player.scalePop = 1;
            document.getElementById('hudAvatarImg').src = ASSET_PATHS.tingting_normal;

            document.getElementById('titleOverlay').classList.add('hidden');
            document.getElementById('gameOverOverlay').classList.add('hidden');
            document.getElementById('hudOverlay').classList.remove('hidden');

            this.refreshHUD();
            sound.startBGM();
        }

        backToTitle() {
            this.state = 'TITLE';
            this.shakeTime = 0;
            sound.stopBGM();
            document.getElementById('hudOverlay').classList.add('hidden');
            document.getElementById('gameOverOverlay').classList.add('hidden');
            document.getElementById('titleOverlay').classList.remove('hidden');
            this.updateTitleHighScore();
        }

        endGame(reason = '⏰ TIME UP! 點心時間結束') {
            this.state = 'GAMEOVER';
            sound.stopBGM();
            sound.playGameOver();

            if (this.score > this.highScore) {
                this.highScore = this.score;
                try { localStorage.setItem('tingting_3d_best', String(this.highScore)); } catch {}
            }

            let rankTitle = '🐾 糖果花園見習貪吃鬼';
            let headline = '婷婷吃得好開心！';
            if (this.score >= 1200) {
                rankTitle = '👑 傳說中的皇家點心大胃王';
                headline = '太神啦！整個糖果花園都被婷婷吃光光！';
            } else if (this.score >= 700) {
                rankTitle = '🎂 婷婷點心屋金牌店長';
                headline = '甜點推車大豐收！';
            } else if (this.score >= 350) {
                rankTitle = '🧁 快樂甜點收藏家';
                headline = '接到了好多美味點心！';
            }

            document.getElementById('goBadge').textContent = reason;
            document.getElementById('goTitle').textContent = headline;
            document.getElementById('goRankTitle').textContent = `稱號：${rankTitle}`;
            document.getElementById('goFinalScore').textContent = this.score;
            document.getElementById('goMaxCombo').textContent = this.maxCombo;
            document.getElementById('goBestScore').textContent = this.highScore;
            document.getElementById('goAvatarImg').src =
                this.lives > 0 ? ASSET_PATHS.tingting_happy : ASSET_PATHS.tingting_dizzy;

            document.getElementById('hudOverlay').classList.add('hidden');
            document.getElementById('gameOverOverlay').classList.remove('hidden');
            this.updateTitleHighScore();
        }

        spawnFallingItem() {
            const elapsed = 60 - this.timeLeft;
            const speedMultiplier = 1 + (elapsed / 60) * 0.48;

            let pool = ITEM_TYPES;
            if (this.feverTime > 0) {
                pool = ITEM_TYPES.filter(i => !i.isHazard && !i.isFever);
            }

            const totalWeight = pool.reduce((acc, item) => acc + item.weight, 0);
            let roll = Math.random() * totalWeight;
            let chosen = pool[0];
            for (const item of pool) {
                if (roll < item.weight) {
                    chosen = item;
                    break;
                }
                roll -= item.weight;
            }

            const speed = (chosen.speedMin + Math.random() * (chosen.speedMax - chosen.speedMin)) * speedMultiplier * (this.height / 720);
            this.fallingItems.push({
                type: chosen,
                x: 110 + Math.random() * (this.width - 220),
                y: -60,
                vy: speed,
                vx: (Math.random() - 0.5) * 45,
                rot: (Math.random() - 0.5) * 0.25,
                vRot: (Math.random() - 0.5) * 1.6
            });
        }

        createBurstParticles(x, y, colors) {
            for (let i = 0; i < 18; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 90 + Math.random() * 250;
                this.particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 70,
                    radius: 4.5 + Math.random() * 6,
                    color: colors[i % colors.length],
                    life: 0.55 + Math.random() * 0.3,
                    maxLife: 0.85
                });
            }
        }

        addFloatingText(x, y, text, color = '#fef08a', scale = 1) {
            this.floatingTexts.push({ x, y, text, color, scale, life: 0.95 });
        }

        refreshHUD() {
            let heartsHtml = '';
            for (let i = 0; i < this.maxLives; i++) {
                heartsHtml += i < this.lives ? '<span>❤️</span>' : '<span class="lost-life">🖤</span>';
            }
            document.getElementById('hudLives').innerHTML = heartsHtml;
            document.getElementById('hudTimer').textContent = Math.ceil(this.timeLeft);
            document.getElementById('hudScore').textContent = this.score;

            const comboEl = document.getElementById('hudComboBadge');
            if (this.combo >= 2) {
                comboEl.classList.remove('hidden');
                comboEl.textContent = `${this.combo} COMBO`;
            } else {
                comboEl.classList.add('hidden');
            }

            const feverBadge = document.getElementById('hudFeverBadge');
            if (this.feverTime > 0) {
                feverBadge.classList.remove('hidden');
            } else {
                feverBadge.classList.add('hidden');
            }
        }

        update(dt) {
            if (this.state !== 'PLAYING') {
                this.player.bobPhase += dt * 3;
                return;
            }

            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.refreshHUD();
                this.endGame('⏰ TIME UP! 點心時間結束');
                return;
            }

            if (this.feverTime > 0) {
                this.feverTime -= dt;
                if (this.feverTime <= 0) {
                    this.feverTime = 0;
                    sound.startBGM();
                }
            }

            if (this.shakeTime > 0) {
                this.shakeTime = Math.max(0, this.shakeTime - dt);
            }

            // Smooth scale pop recovery
            this.player.scalePop += (1 - this.player.scalePop) * Math.min(1, dt * 14);

            if (this.player.moodTimer > 0) {
                this.player.moodTimer -= dt;
                if (this.player.moodTimer <= 0) {
                    this.player.mood = this.feverTime > 0 ? 'happy' : 'normal';
                    document.getElementById('hudAvatarImg').src = ASSET_PATHS['tingting_' + this.player.mood];
                }
            }

            const moveSpeed = this.feverTime > 0 ? this.player.speed * 1.25 : this.player.speed;
            if (this.keys.left) {
                this.player.x -= moveSpeed * dt;
                this.player.targetX = this.player.x;
            } else if (this.keys.right) {
                this.player.x += moveSpeed * dt;
                this.player.targetX = this.player.x;
            } else if (this.pointerActive) {
                const diff = this.player.targetX - this.player.x;
                this.player.x += diff * Math.min(1, dt * 16);
            }
            this.player.x = Math.max(125, Math.min(this.width - 125, this.player.x));
            this.player.bobPhase += dt * 9.5;

            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnFallingItem();
                const progress = (60 - this.timeLeft) / 60;
                const baseInterval = this.feverTime > 0 ? 0.21 : Math.max(0.30, 0.70 - progress * 0.36);
                this.spawnTimer = baseInterval;
            }

            const catchBoxY = this.player.y - 12;
            const catchHalfW = 104;

            for (let i = this.fallingItems.length - 1; i >= 0; i--) {
                const it = this.fallingItems[i];

                if (this.feverTime > 0 && !it.type.isHazard && it.y > 120) {
                    const dx = this.player.x - it.x;
                    const dy = catchBoxY - it.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 400) {
                        it.x += (dx / Math.max(1, dist)) * 560 * dt;
                        it.y += (dy / Math.max(1, dist)) * 240 * dt;
                    }
                }

                it.x += it.vx * dt;
                it.y += it.vy * dt;
                it.rot += it.vRot * dt;

                if (it.x < 70 || it.x > this.width - 70) it.vx *= -1;

                const dx = Math.abs(it.x - this.player.x);
                const dy = Math.abs(it.y - catchBoxY);

                if (dx < catchHalfW && dy < 60) {
                    this.handleCatchItem(it);
                    this.fallingItems.splice(i, 1);
                    continue;
                }

                if (it.y > this.height + 65) {
                    if (!it.type.isHazard && this.feverTime <= 0) {
                        this.combo = 0;
                    }
                    this.fallingItems.splice(i, 1);
                }
            }

            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 490 * dt;
                p.life -= dt;
                if (p.life <= 0) this.particles.splice(i, 1);
            }

            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.y -= 68 * dt;
                ft.life -= dt;
                if (ft.life <= 0) this.floatingTexts.splice(i, 1);
            }

            this.refreshHUD();
        }

        handleCatchItem(it) {
            const t = it.type;
            this.player.scalePop = 1.12;

            if (t.isHazard) {
                if (this.feverTime > 0) {
                    this.score += 25;
                    this.createBurstParticles(it.x, it.y, ['#fde047', '#f472b6', '#38bdf8']);
                    this.addFloatingText(it.x, it.y - 20, '🛡️ 無敵彈開 +25!', '#38bdf8', 1.15);
                    sound.playCatchSweet(true);
                    return;
                }

                this.lives--;
                this.combo = 0;
                this.shakeTime = 0.36;
                this.player.mood = 'dizzy';
                this.player.moodTimer = 1.15;
                document.getElementById('hudAvatarImg').src = ASSET_PATHS.tingting_dizzy;
                sound.playDamage();
                this.createBurstParticles(it.x, it.y, ['#581c87', '#a855f7', '#ef4444']);
                this.addFloatingText(it.x, it.y - 20, t.label, '#f87171', 1.25);

                if (this.lives <= 0) {
                    this.refreshHUD();
                    this.endGame('🍫 婷婷誤食太多黑朱古力暈倒了！');
                }
                return;
            }

            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            let multiplier = 1;
            if (this.combo >= 10) multiplier = 1.5;
            if (this.feverTime > 0) multiplier *= 2;

            const earned = Math.round(t.score * multiplier);
            this.score += earned;

            this.player.mood = 'happy';
            this.player.moodTimer = 0.65;
            document.getElementById('hudAvatarImg').src = ASSET_PATHS.tingting_happy;

            if (t.isFever) {
                this.feverTime = 5.5;
                sound.playFeverStart();
                sound.startBGM();
                this.createBurstParticles(it.x, it.y, ['#ff6b9d', '#fde047', '#4ade80', '#38bdf8', '#c084fc']);
                this.addFloatingText(it.x, it.y - 25, '🌈 SUGAR RUSH FEVER! 2X得分!', '#fde047', 1.35);
            } else if (t.isHeal) {
                if (this.lives < this.maxLives) this.lives++;
                sound.playCatchSweet(true);
                this.createBurstParticles(it.x, it.y, ['#ff6b9d', '#fbcfe8', '#ffffff']);
                this.addFloatingText(it.x, it.y - 20, '💖 恢復生命 +1♥', '#f472b6', 1.2);
            } else {
                sound.playCatchSweet(this.combo % 10 === 0 || t.score >= 30);
                this.createBurstParticles(it.x, it.y, ['#ff85ad', '#fde047', '#6ee7b7', '#ffffff']);
                const comboTag = this.combo >= 10 ? `🔥+${earned} (COMBO!)` : `+${earned}`;
                this.addFloatingText(it.x, it.y - 18, comboTag, '#fef08a', t.score >= 30 ? 1.2 : 1.0);
            }
        }

        render() {
            const ctx = this.ctx;
            ctx.fillStyle = '#211025';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.save();

            if (this.shakeTime > 0) {
                const mag = this.shakeTime * 22;
                ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
            }

            // Title Screen shows the full 1280x720 3D Cover Image
            if (this.state === 'TITLE' && images.bg_cover_3d) {
                drawBackground(ctx, images.bg_cover_3d, this.width, this.height, 'contain');
                ctx.restore();
                return;
            }

            // Gameplay shows the 1280x720 3D Candy Garden Stage
            if (images.bg_garden_3d) {
                drawBackground(ctx, images.bg_garden_3d, this.width, this.height, 'cover');
            }

            if (this.feverTime > 0) {
                ctx.save();
                const fg = ctx.createLinearGradient(0, 0, this.width, 0);
                fg.addColorStop(0, 'rgba(244, 114, 182, 0.24)');
                fg.addColorStop(0.5, 'rgba(250, 204, 21, 0.24)');
                fg.addColorStop(1, 'rgba(56, 189, 248, 0.24)');
                ctx.fillStyle = fg;
                ctx.fillRect(0, 0, this.width, this.height);
                ctx.restore();
            }

            // Draw 3D Fluffy Protagonist TingTing & Cart
            const bobOffset = Math.sin(this.player.bobPhase) * 4.5;
            const spriteKey =
                this.player.mood === 'dizzy'
                    ? 'tingting_dizzy'
                    : this.player.mood === 'happy' || this.feverTime > 0
                    ? 'tingting_happy'
                    : 'tingting_normal';

            const playerImg = images[spriteKey];
            if (playerImg) {
                ctx.save();
                ctx.translate(this.player.x, this.player.y + bobOffset);
                ctx.scale(this.player.scalePop, this.player.scalePop);
                if (this.feverTime > 0) {
                    const glowG = ctx.createRadialGradient(0, 10, 20, 0, 10, 130);
                    glowG.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
                    glowG.addColorStop(1, 'rgba(253, 224, 71, 0)');
                    ctx.fillStyle = glowG;
                    ctx.beginPath();
                    ctx.arc(0, 10, 130, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.drawImage(
                    playerImg,
                    -this.player.width / 2,
                    -this.player.height / 2,
                    this.player.width,
                    this.player.height
                );
                ctx.restore();
            }

            // Draw 3D Falling Items
            for (const it of this.fallingItems) {
                const img = images[it.type.id];
                if (!img) continue;
                ctx.save();
                ctx.translate(it.x, it.y);
                ctx.rotate(it.rot);
                const size = it.type.radius * 2.25;
                ctx.drawImage(img, -size / 2, -size / 2, size, size);
                ctx.restore();
            }

            // Draw Particles
            for (const p of this.particles) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Draw Floating Score Popups
            for (const ft of this.floatingTexts) {
                ctx.save();
                ctx.globalAlpha = Math.min(1, ft.life * 1.4);
                ctx.font = `900 ${Math.round(29 * ft.scale)}px "M PLUS Rounded 1c", "Noto Sans TC", sans-serif`;
                ctx.textAlign = 'center';
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#451a03';
                ctx.strokeText(ft.text, ft.x, ft.y);
                ctx.fillStyle = ft.color;
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.restore();
            }

            ctx.restore();
        }

        loop(now) {
            const dt = Math.min(0.05, (now - this.lastTimestamp) / 1000);
            this.lastTimestamp = now;
            this.update(dt);
            this.render();
            requestAnimationFrame(ts => this.loop(ts));
        }
    }

let game = null;

function isFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

async function enterFullscreen() {
    if (isFullscreen()) return;
    const stage = document.getElementById('stageWrapper');
    const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (request) {
        try { await request.call(stage); } catch { /* Keep playing in the full-window layout. */ }
    }
}

function updateFullscreenButton() {
    const button = document.getElementById('btnFullscreen');
    button.textContent = isFullscreen() ? '退出全螢幕' : '全螢幕';
    button.setAttribute('aria-pressed', String(isFullscreen()));
}

async function init() {
    const fullscreenButton = document.getElementById('btnFullscreen');
    fullscreenButton.addEventListener('click', async () => {
        if (isFullscreen()) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) { try { await exit.call(document); } catch {} }
        } else { await enterFullscreen(); }
        updateFullscreenButton();
    });
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    updateFullscreenButton();

    try {
        await loadAssets();
        game = new CandyGarden3DGame(document.getElementById('gameCanvas'));
        document.getElementById('loadingOverlay').classList.add('hidden');
        document.getElementById('titleOverlay').classList.remove('hidden');
        requestAnimationFrame(ts => game.loop(ts));
    } catch (error) {
        console.error(error);
        document.getElementById('loadingText').textContent = '圖片載入失敗，請確認 assets 資料夾與 index.html 放在一起，再重新整理。';
        return;
    }

    const startGame = () => {
        void enterFullscreen();
        sound.ensureContext();
        game.startNewGame();
    };
    document.getElementById('btnStartGame').addEventListener('click', startGame);
    document.getElementById('btnPlayAgain').addEventListener('click', startGame);
    document.getElementById('btnBackToTitle').addEventListener('click', () => game.backToTitle());
    document.getElementById('btnPauseGame').addEventListener('click', () => game.backToTitle());
    document.getElementById('btnToggleAudio').addEventListener('click', () => {
        const enabled = sound.toggle();
        document.getElementById('btnToggleAudio').textContent = enabled ? '音效：開啟' : '音效：關閉';
        document.getElementById('btnToggleAudio').setAttribute('aria-pressed', String(enabled));
    });
}

void init();
