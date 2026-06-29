/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

interface Weapon {
  maxAmmo: number;
  fireRate: number;
  type: string;
  dmg: number;
  dropReserveRefill: number;
}

interface Bullet {
  x: number;
  y: number;
  dx: number;
  dy: number;
  isEnemy?: boolean;
  type: string;
  dmg: number;
  rangeTimer?: number;
  rad?: number;
  timer?: number;
  radius?: number;
}

interface Enemy {
  x: number;
  y: number;
  radius: number;
  speed: number;
  hp: number;
  color: string;
  type: string;
  angle: number;
  lastShot: number;
  lastMeleeAttack: number;
  walkCycle: number;
}

interface Drop {
  x: number;
  y: number;
  type: string;
  color: string;
  label: string;
  spawnedAt: number;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TntBarrel {
  x: number;
  y: number;
  radius: number;
  hp: number;
}

interface Player {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  score: number;
  walkCycle: number;
  inventory: string[];
  currentWeapon: string;
  isBlocking: boolean;
  weaponAmmo: {
    [key: string]: {
      ammo: number;
      reserveAmmo: number;
    }
  };
  damageMultiplier: number;
}

interface Upgrade {
  id: string;
  title: string;
  desc: string;
  action: () => void;
}

export default function App() {
  useEffect(() => {
    const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const MAP_WIDTH = 2000;
    const MAP_HEIGHT = 1500;
    const VIEW_WIDTH = 800;
    const VIEW_HEIGHT = 600;

    let gameState = "MENU"; 
    let player: Player;
    let keys: { [key: string]: boolean } = {};
    let mouse = { screenX: 0, screenY: 0, worldX: 0, worldY: 0, isDown: false };
    let bullets: Bullet[] = [];
    let enemies: Enemy[] = [];
    let drops: Drop[] = [];
    let obstacles: Obstacle[] = [];
    let tntBarrels: TntBarrel[] = [];
    let camera = { x: 0, y: 0 };
    let lastShotTime = 0;
    let lastMeleeTime = 0;
    let lastFootstepTime = 0;
    let spawnInterval: any;
    let globalAnimFrame = 0;

    let zoom = 1.0;
    let currentLevel = 1;
    const maxEnemiesBase = 12;
    let lastMilestoneClaimed = 0; // Tracks every 2500 increments

    let floorPattern: CanvasPattern | null = null;
    let wallPattern: CanvasPattern | null = null;

    let highscore = parseInt(localStorage.getItem("shooter_man_highscore") || "0") || 0;
    const highscoreDisplay = document.getElementById("highscoreDisplay");
    if (highscoreDisplay) {
      highscoreDisplay.innerText = `ALL-TIME BEST: ${highscore}`;
    }

    let audioCtx: AudioContext | null = null;
    let musicInterval: any = null;
    let isMuted = false;

    function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        startMusicLoop();
    }

    function playSoundShoot(type: string) {
        if (!audioCtx || isMuted) return;
        const now = audioCtx.currentTime;
        
        if (type === 'Laser') {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.12);
        } 
        else if (type === 'Flamethrower') {
            let bufferSize = audioCtx.sampleRate * 0.1;
            let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            let data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
            let noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            let filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now);
            let gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            noise.start(now); noise.stop(now + 0.1);
        } 
        else if (type === 'Bazooka') {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.3);
        } 
        else if (type === 'Minigun') {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(380, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.06);
        }
        else if (type === 'Sniper') {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.25);
        }
        else { 
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(type === 'Shotgun' ? 320 : 450, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.1);
        }
    }

    function playSoundFootstep() {
        if (!audioCtx || isMuted) return;
        const now = audioCtx.currentTime;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(75, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.09);
    }

    function startMusicLoop() {
        if (musicInterval) clearInterval(musicInterval);
        let step = 0;
        const notes = [55, 55, 65, 55, 48, 48, 50, 55]; 
        musicInterval = setInterval(() => {
            if (gameState !== "PLAYING" || isMuted || !audioCtx) return;
            const now = audioCtx.currentTime;
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            let freq = notes[step % notes.length];
            osc.frequency.setValueAtTime(freq, now);
            let filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(280, now);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.25);
            step++;
        }, 220);
    }

    const WEAPONS: { [key: string]: Weapon } = {
        Pistol: { maxAmmo: 30, fireRate: 200, type: 'normal', dmg: 15, dropReserveRefill: 120 },
        AK47: { maxAmmo: 40, fireRate: 100, type: 'normal', dmg: 20, dropReserveRefill: 80 },
        Minigun: { maxAmmo: 200, fireRate: 40, type: 'normal', dmg: 8, dropReserveRefill: 200 },
        Shotgun: { maxAmmo: 8, fireRate: 600, type: 'spread', dmg: 15, dropReserveRefill: 16 },
        Sniper: { maxAmmo: 5, fireRate: 1200, type: 'sniper', dmg: 110, dropReserveRefill: 10 },
        Laser: { maxAmmo: 100, fireRate: 40, type: 'laser', dmg: 6, dropReserveRefill: 150 },
        Flamethrower: { maxAmmo: 150, fireRate: 25, type: 'fire', dmg: 2, dropReserveRefill: 150 },
        Bazooka: { maxAmmo: 5, fireRate: 1000, type: 'explosive', dmg: 80, dropReserveRefill: 8 }
    };
    const TOTAL_GUNS_COUNT = Object.keys(WEAPONS).length;

    const ENEMY_CAPS = { tank: 2, flamer: 3 };

    // UPGRADES POOL DEFINITION
    const UPGRADE_POOL: Upgrade[] = [
        { id: 'max_hp', title: 'JUGGERNAUT CORE', desc: 'Increases Maximum Health Cap by +20 permanently. Instantly applies a full heal injection.', action: () => { player.maxHp += 20; player.hp = player.maxHp; } },
        { id: 'max_armor', title: 'REINFORCED PLATING', desc: 'Increases Maximum Structural Armor Cap by +25 permanently and restores armor back to max status.', action: () => { player.maxArmor += 25; player.armor = player.maxArmor; } },
        { id: 'speed_boost', title: 'HYPER-DRIVE SERVO', desc: 'Increases overall walking and tactical movement speed by +12% scaling factor.', action: () => { player.speed *= 1.12; } },
        { id: 'damage_boost', title: 'HOLLOW POINT ROUNDS', desc: 'Weapon optimization module. Grants all gunfire ammunition and melee kicks a stacked flat +15% damage amplification.', action: () => { player.damageMultiplier += 0.15; } },
        { id: 'heavy_caliber', title: 'OVERCHARGE BARREL', desc: 'Boosts overall projectile damage output by +35% at the penalty of dropping movement speed down by -4%.', action: () => { player.damageMultiplier += 0.35; player.speed *= 0.96; } }
    ];

    function createProceduralTextures() {
        const fCanvas = document.createElement('canvas');
        fCanvas.width = 64; fCanvas.height = 64;
        const fCtx = fCanvas.getContext('2d')!;
        fCtx.fillStyle = '#2d3528'; fCtx.fillRect(0,0,64,64);
        fCtx.fillStyle = '#242a20';
        for(let i=0; i<4; i++){ fCtx.fillRect(Math.random()*64, Math.random()*64, 16, 16); }
        fCtx.strokeStyle = '#1e241a'; fCtx.lineWidth = 1;
        for(let x=0; x<=64; x+=16) {
            fCtx.beginPath(); fCtx.moveTo(x, 0); fCtx.lineTo(x, 64); fCtx.stroke();
            fCtx.beginPath(); fCtx.moveTo(0, x); fCtx.lineTo(64, x); fCtx.stroke();
        }
        floorPattern = ctx.createPattern(fCanvas, 'repeat');

        const wCanvas = document.createElement('canvas');
        wCanvas.width = 32; wCanvas.height = 32;
        const wCtx = wCanvas.getContext('2d')!;
        wCtx.fillStyle = '#444444'; wCtx.fillRect(0,0,32,32);
        wCtx.fillStyle = '#555555'; wCtx.fillRect(0,0,16,16); wCtx.fillRect(16,16,16,16);
        wCtx.fillStyle = '#333333';
        for(let i=0; i<30; i++) { wCtx.fillRect(Math.random()*32, Math.random()*32, 2, 2); }
        wallPattern = ctx.createPattern(wCanvas, 'repeat');
    }
    createProceduralTextures();

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (gameState === "PLAYING" || gameState === "PAUSED") togglePause();
            return;
        }
        keys[e.key.toLowerCase()] = true;
        if (gameState === "PLAYING") {
            if (e.key.toLowerCase() === 'q') cycleWeapon(-1);
            if (e.key.toLowerCase() === 'e') cycleWeapon(1);
            if (e.key.toLowerCase() === 'f') triggerPlayerMelee();
            if (e.key.toLowerCase() === 'm') isMuted = !isMuted;
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouse.screenX = e.clientX - rect.left;
        mouse.screenY = e.clientY - rect.top;
    };

    const handleMouseDown = () => {
        mouse.isDown = true;
    };

    const handleMouseUp = () => {
        mouse.isDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    function togglePause() {
        const pauseMenu = document.getElementById("pauseMenu");
        if (!pauseMenu) return;

        if (gameState === "PLAYING") {
            gameState = "PAUSED";
            pauseMenu.style.display = "flex";
        } else if (gameState === "PAUSED") {
            gameState = "PLAYING";
            pauseMenu.style.display = "none";
        }
    }

    function openUpgradeSelection() {
        gameState = "UPGRADING";
        const upgradeMenu = document.getElementById("upgradeMenu");
        if (upgradeMenu) upgradeMenu.style.display = "flex";
        
        // Pick 3 random distinct upgrades from the pool
        let shuffled = [...UPGRADE_POOL].sort(() => 0.5 - Math.random());
        let selection = shuffled.slice(0, 3);
        
        let container = document.getElementById("upgradeOptionsContainer");
        if (container) {
            container.innerHTML = ""; // Wipe older card nodes
            
            selection.forEach(mod => {
                let card = document.createElement("div");
                card.className = "upgrade-card";
                card.onclick = () => applyUpgrade(mod);
                
                card.innerHTML = `
                    <div>
                        <div class="upgrade-title">${mod.title}</div>
                        <div class="upgrade-desc">${mod.desc}</div>
                    </div>
                    <button class="upgrade-btn">INTEGRATE MODULE</button>
                `;
                container.appendChild(card);
            });
        }
    }

    function applyUpgrade(mod: Upgrade) {
        mod.action(); // Execute perk formula modifications
        const upgradeMenu = document.getElementById("upgradeMenu");
        if (upgradeMenu) upgradeMenu.style.display = "none";
        gameState = "PLAYING";
    }

    function damagePlayer(amount: number) {
        let rawDamage = amount;
        if (player.isBlocking) {
            rawDamage *= 0.3; 
        }

        if (player.armor > 0) {
            let absorbed = rawDamage * 0.60; 
            let direct = rawDamage - absorbed;
            
            player.armor -= absorbed;
            if (player.armor < 0) {
                direct += Math.abs(player.armor); 
                player.armor = 0;
            }
            player.hp -= direct;
        } else {
            player.hp -= rawDamage;
        }
        checkGameOver();
    }

    function cycleWeapon(dir: number) {
        if (!player || !player.inventory) return;
        let idx = player.inventory.indexOf(player.currentWeapon);
        idx += dir;
        if (idx < 0) idx = player.inventory.length - 1;
        if (idx >= player.inventory.length) idx = 0;
        player.currentWeapon = player.inventory[idx];
    }

    function generateMapAssets() {
        obstacles = []; tntBarrels = [];
        for (let i = 0; i < 20; i++) {
            obstacles.push({
                x: Math.random() * (MAP_WIDTH - 400) + 100,
                y: Math.random() * (MAP_HEIGHT - 400) + 100,
                w: Math.random() * 100 + 60,
                h: Math.random() * 100 + 60
            });
        }
        for (let i = 0; i < 15; i++) {
            let bx = 0, by = 0, valid = false;
            while(!valid) {
                bx = Math.random() * (MAP_WIDTH - 200) + 100;
                by = Math.random() * (MAP_HEIGHT - 200) + 100;
                valid = !checkWallCollision({ radius: 12 }, bx, by);
            }
            tntBarrels.push({ x: bx, y: by, radius: 13, hp: 1 });
        }
    }

    function checkWallCollision(entity: { radius?: number }, nextX: number, nextY: number) {
        let r = entity.radius || 0;
        if (nextX - r < 0 || nextX + r > MAP_WIDTH || nextY - r < 0 || nextY + r > MAP_HEIGHT) return true;
        for (let wall of obstacles) {
            let closestX = Math.max(wall.x, Math.min(nextX, wall.x + wall.w));
            let closestY = Math.max(wall.y, Math.min(nextY, wall.y + wall.h));
            if (((nextX - closestX)**2 + (nextY - closestY)**2) < (r * r)) return true;
        }
        return false;
    }

    function initGame() {
        currentLevel = 1;
        lastMilestoneClaimed = 0;
        generateMapAssets();
        let px = MAP_WIDTH / 2, py = MAP_HEIGHT / 2, safeSpawnFound = false;
        while (!safeSpawnFound) {
            if (!checkWallCollision({ radius: 15 }, px, py)) safeSpawnFound = true;
            else { px = Math.random() * (MAP_WIDTH - 300) + 150; py = Math.random() * (MAP_HEIGHT - 300) + 150; }
        }
        
        let weaponAmmoStates: { [key: string]: { ammo: number; reserveAmmo: number } } = {};
        Object.keys(WEAPONS).forEach(key => {
            weaponAmmoStates[key] = {
                ammo: WEAPONS[key].maxAmmo,
                reserveAmmo: key === 'Pistol' ? 180 : 0 
            };
        });

        player = {
            x: px, y: py, radius: 15, speed: 4.2, angle: 0,
            hp: 100, maxHp: 100, armor: 50, maxArmor: 100, score: 0, walkCycle: 0,
            inventory: ['Pistol'], currentWeapon: 'Pistol', isBlocking: false,
            weaponAmmo: weaponAmmoStates, damageMultiplier: 1.0 // Multiplier stat for stacked perks
        };
        bullets = []; enemies = []; drops = []; keys = {};
    }

    function startGame() {
        initAudio();
        initGame();
        
        const menu = document.getElementById("menu");
        if (menu) menu.style.display = "none";
        
        const pauseMenu = document.getElementById("pauseMenu");
        if (pauseMenu) pauseMenu.style.display = "none";
        
        const upgradeMenu = document.getElementById("upgradeMenu");
        if (upgradeMenu) upgradeMenu.style.display = "none";
        
        const ui = document.getElementById("ui");
        if (ui) ui.style.display = "block";

        const deathTip = document.getElementById("deathTip");
        if (deathTip) deathTip.style.display = "none";
        
        gameState = "PLAYING";
        clearInterval(spawnInterval);
        spawnInterval = setInterval(spawnEnemy, 2000); 
    }

    function spawnEnemy() {
        if (gameState !== "PLAYING") return;
        let levelMaxEnemies = maxEnemiesBase + (currentLevel - 1) * 2;
        if (enemies.length >= levelMaxEnemies) return;
        
        let currentTanks = enemies.filter(e => e.type === 'tank').length;
        let currentFlamers = enemies.filter(e => e.type === 'flamer').length;

        const rand = Math.random();
        let enemyType = 'ranged';
        let radius = 14, speed = 2.0, hp = 30, color = '#ff3333';

        if (rand < 0.25) {
            enemyType = 'melee'; speed = 3.4; hp = 40; color = '#ff33aa';
        } else if (rand >= 0.25 && rand < 0.45) {
            if (currentFlamers < ENEMY_CAPS.flamer) {
                enemyType = 'flamer'; speed = 2.5; hp = 65; color = '#ff6600';
            } else {
                enemyType = 'melee'; speed = 3.4; hp = 40; color = '#ff33aa';
            }
        } else if (rand > 0.82) {
            if (currentTanks < ENEMY_CAPS.tank) {
                enemyType = 'tank'; radius = 22; speed = 0.9; hp = 160; color = '#7f8c8d';
            } else {
                enemyType = 'ranged';
            }
        }

        speed *= (1 + (currentLevel - 1) * 0.08);
        hp *= (1 + (currentLevel - 1) * 0.15);

        let spawnX = 0, spawnY = 0, safeSpawn = false, attempts = 0;
        while (!safeSpawn && attempts < 150) {
            spawnX = Math.random() * (MAP_WIDTH - 120) + 60;
            spawnY = Math.random() * (MAP_HEIGHT - 120) + 60;
            attempts++;
            if (!checkWallCollision({ radius: radius }, spawnX, spawnY) && Math.hypot(player.x - spawnX, player.y - spawnY) > 420) {
                safeSpawn = true;
            }
        }
        if (safeSpawn) {
            enemies.push({ x: spawnX, y: spawnY, radius, speed, hp, color, type: enemyType, angle: 0, lastShot: 0, lastMeleeAttack: 0, walkCycle: Math.random() * 100 });
        }
    }

    function triggerPlayerMelee() {
        const now = Date.now();
        if (now - lastMeleeTime < 380) return; 
        lastMeleeTime = now;
        bullets.push({ x: player.x, y: player.y, dx: 0, dy: 0, type: 'visual_melee', radius: 65, timer: 7, dmg: 0 });
        enemies.forEach((enemy) => {
            if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 70) {
                enemy.hp -= (45 * player.damageMultiplier); 
                if (enemy.hp <= 0) {
                    setTimeout(() => {
                        const idx = enemies.indexOf(enemy);
                        if (idx > -1) { handleEnemyDeath(enemy); enemies.splice(idx, 1); }
                    }, 0);
                }
            }
        });
    }

    function update() {
        if (gameState !== "PLAYING") return;
        globalAnimFrame++;

        let calculatedLevel = Math.floor(player.score / 1000) + 1;
        if (calculatedLevel !== currentLevel) {
            currentLevel = calculatedLevel;
            clearInterval(spawnInterval);
            spawnInterval = setInterval(spawnEnemy, Math.max(900, 2000 - (currentLevel * 150)));
        }

        // INTERMISSION TRIGGERS EVERY 2500 SCORE
        if (player.score - lastMilestoneClaimed >= 2500) {
            lastMilestoneClaimed += 2500;
            openUpgradeSelection();
            return; 
        }

        if (keys['z']) {
            zoom = Math.max(0.55, zoom - 0.04);
        } else {
            zoom = Math.min(1.0, zoom + 0.04);
        }

        let currentViewWidth = VIEW_WIDTH / zoom;
        let currentViewHeight = VIEW_HEIGHT / zoom;
        camera.x = Math.max(0, Math.min(player.x - currentViewWidth / 2, MAP_WIDTH - currentViewWidth));
        camera.y = Math.max(0, Math.min(player.y - currentViewHeight / 2, MAP_HEIGHT - currentViewHeight));

        mouse.worldX = (mouse.screenX / zoom) + camera.x;
        mouse.worldY = (mouse.screenY / zoom) + camera.y;
        player.angle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);

        player.isBlocking = !!keys['shift'];
        let activeSpeed = player.isBlocking ? player.speed * 0.35 : player.speed;

        let moveX = 0, moveY = 0;
        if (keys['w']) moveY -= activeSpeed;
        if (keys['s']) moveY += activeSpeed;
        if (keys['a']) moveX -= activeSpeed;
        if (keys['d']) moveX += activeSpeed;

        const now = Date.now();

        if (moveX !== 0 || moveY !== 0) {
            player.walkCycle += 0.25;
            if (now - lastFootstepTime > 320) {
                playSoundFootstep();
                lastFootstepTime = now;
            }
        }

        if (moveX !== 0 && !checkWallCollision(player, player.x + moveX, player.y)) player.x += moveX;
        if (moveY !== 0 && !checkWallCollision(player, player.x, player.y + moveY)) player.y += moveY;

        const wpnName = player.currentWeapon;
        const wpn = WEAPONS[wpnName];
        let currentAmmoState = player.weaponAmmo[wpnName];

        if (mouse.isDown && !player.isBlocking && now - lastShotTime > wpn.fireRate && currentAmmoState.ammo > 0) {
            playSoundShoot(wpnName);
            let finalDmg = wpn.dmg * player.damageMultiplier;

            if (wpn.type === 'normal' || wpn.type === 'laser') {
                bullets.push({ x: player.x, y: player.y, dx: Math.cos(player.angle) * (wpn.type === 'laser' ? 17 : 13), dy: Math.sin(player.angle) * (wpn.type === 'laser' ? 17 : 13), isEnemy: false, type: 'bullet', dmg: finalDmg });
            } else if (wpn.type === 'sniper') {
                bullets.push({ x: player.x, y: player.y, dx: Math.cos(player.angle) * 32, dy: Math.sin(player.angle) * 32, isEnemy: false, type: 'bullet', dmg: finalDmg });
            } else if (wpn.type === 'spread') {
                for (let i = -1; i <= 1; i++) {
                    bullets.push({ x: player.x, y: player.y, dx: Math.cos(player.angle + i*0.16) * 11, dy: Math.sin(player.angle + i*0.16) * 11, isEnemy: false, type: 'bullet', dmg: finalDmg });
                }
            } else if (wpn.type === 'explosive') {
                bullets.push({ x: player.x, y: player.y, dx: Math.cos(player.angle) * 8.5, dy: Math.sin(player.angle) * 8.5, isEnemy: false, type: 'rocket', dmg: finalDmg });
            } else if (wpn.type === 'fire') {
                let spread = player.angle + (Math.random() - 0.5) * 0.35;
                let fireSpeed = 6 + Math.random() * 4;
                bullets.push({ x: player.x, y: player.y, dx: Math.cos(spread) * fireSpeed, dy: Math.sin(spread) * fireSpeed, isEnemy: false, type: 'fire', dmg: finalDmg, rangeTimer: 25 });
            }
            
            currentAmmoState.ammo--; 
            lastShotTime = now;
            
            if (currentAmmoState.ammo === 0 && currentAmmoState.reserveAmmo > 0) {
                setTimeout(() => {
                    let targetState = player.weaponAmmo[wpnName];
                    const toReload = Math.min(WEAPONS[wpnName].maxAmmo - targetState.ammo, targetState.reserveAmmo);
                    targetState.ammo += toReload; 
                    targetState.reserveAmmo -= toReload;
                }, 600);
            }
        }

        enemies.forEach((enemy) => {
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            enemy.angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            
            let targetX = enemy.x, targetY = enemy.y;

            if (enemy.type === 'ranged' || enemy.type === 'tank') {
                let idealZone = enemy.type === 'tank' ? 220 : 320;
                if (dist < idealZone - 50) {
                    targetX -= Math.cos(enemy.angle) * enemy.speed; targetY -= Math.sin(enemy.angle) * enemy.speed;
                } else if (dist > idealZone + 50) {
                    targetX += Math.cos(enemy.angle) * enemy.speed; targetY += Math.sin(enemy.angle) * enemy.speed;
                } else {
                    targetX += Math.cos(enemy.angle + Math.PI/2) * (enemy.speed * 0.75);
                    targetY += Math.sin(enemy.angle + Math.PI/2) * (enemy.speed * 0.75);
                }
            } else if (enemy.type === 'melee' || enemy.type === 'flamer') {
                targetX += Math.cos(enemy.angle) * enemy.speed; targetY += Math.sin(enemy.angle) * enemy.speed;
            }

            if (enemy.x !== targetX || enemy.y !== targetY) {
                enemy.walkCycle += 0.2;
            }

            if (enemy.x !== targetX && !checkWallCollision(enemy, targetX, enemy.y)) enemy.x = targetX;
            if (enemy.y !== targetY && !checkWallCollision(enemy, enemy.x, targetY)) enemy.y = targetY;

            let aiRateReduction = Math.max(400, (currentLevel - 1) * 75);
            if (enemy.type === 'ranged' && now - enemy.lastShot > (1200 - aiRateReduction)) {
                bullets.push({ x: enemy.x, y: enemy.y, dx: Math.cos(enemy.angle) * 5.5, dy: Math.sin(enemy.angle) * 5.5, isEnemy: true, type: 'bullet', dmg: 10 });
                enemy.lastShot = now;
            } else if (enemy.type === 'tank' && now - enemy.lastShot > (1600 - aiRateReduction)) {
                bullets.push({ x: enemy.x, y: enemy.y, dx: Math.cos(enemy.angle) * 4.5, dy: Math.sin(enemy.angle) * 4.5, isEnemy: true, type: 'heavy_bullet', dmg: 30 });
                enemy.lastShot = now;
            } 
            else if (enemy.type === 'flamer' && dist < 150 && now - enemy.lastShot > 600) {
                let enemySpread = enemy.angle + (Math.random() - 0.5) * 0.3;
                bullets.push({ x: enemy.x, y: enemy.y, dx: Math.cos(enemySpread) * 6, dy: Math.sin(enemySpread) * 6, isEnemy: true, type: 'fire', dmg: 1.5, rangeTimer: 15 });
                enemy.lastShot = now;
            } else if (enemy.type === 'melee' && dist < player.radius + enemy.radius && now - enemy.lastMeleeAttack > 500) {
                damagePlayer(15); enemy.lastMeleeAttack = now;
            }
        });

        for (let dIndex = drops.length - 1; dIndex >= 0; dIndex--) {
            if (now - drops[dIndex].spawnedAt > 30000) { drops.splice(dIndex, 1); continue; }
            const drop = drops[dIndex];
            if (Math.hypot(player.x - drop.x, player.y - drop.y) < player.radius + 12) {
                if (drop.type === 'ammo') {
                    player.inventory.forEach(invWeapon => {
                        let refAmt = WEAPONS[invWeapon].dropReserveRefill || 40;
                        player.weaponAmmo[invWeapon].reserveAmmo += refAmt;
                    });
                }
                else if (drop.type === 'medkit') player.hp = Math.min(player.maxHp, player.hp + 40);
                else if (drop.type === 'armor') player.armor = Math.min(player.maxArmor, player.armor + 30);
                else {
                    if (!player.inventory.includes(drop.type)) {
                        player.inventory.push(drop.type);
                    }
                    player.currentWeapon = drop.type;
                    player.weaponAmmo[drop.type].ammo = WEAPONS[drop.type].maxAmmo;
                    player.weaponAmmo[drop.type].reserveAmmo = WEAPONS[drop.type].dropReserveRefill * 2;
                }
                drops.splice(dIndex, 1);
            }
        }

        for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
            const bullet = bullets[bIndex];
            if (bullet.type === 'fire') {
                if (bullet.rangeTimer !== undefined) {
                    bullet.rangeTimer--; 
                    if (bullet.rangeTimer <= 0) { bullets.splice(bIndex, 1); continue; }
                }
            }
            if (bullet.type !== 'visual_exp' && bullet.type !== 'visual_melee') { bullet.x += bullet.dx; bullet.y += bullet.dy; }
            
            let outOfBounds = bullet.x < 0 || bullet.x > MAP_WIDTH || bullet.y < 0 || bullet.y > MAP_HEIGHT;
            let hitWall = false;
            if (!outOfBounds) {
                for (let wall of obstacles) {
                    if (bullet.x >= wall.x && bullet.x <= wall.x + wall.w && bullet.y >= wall.y && bullet.y <= wall.y + wall.h) { hitWall = true; break; }
                }
            }
            if (hitWall || outOfBounds) {
                if (bullet.type === 'rocket') triggerExplosion(bullet.x, bullet.y, bullet.dmg, 95);
                bullets.splice(bIndex, 1); continue;
            }
            for (let tIndex = tntBarrels.length - 1; tIndex >= 0; tIndex--) {
                let barrel = tntBarrels[tIndex];
                if (Math.hypot(barrel.x - bullet.x, barrel.y - bullet.y) < barrel.radius) {
                    triggerExplosion(barrel.x, barrel.y, 120 * player.damageMultiplier, 160); tntBarrels.splice(tIndex, 1); bullets.splice(bIndex, 1); break;
                }
            }
            if (hitWall) continue;

            if (bullet.isEnemy) {
                if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < player.radius) {
                    damagePlayer(bullet.dmg);
                    if (bullet.type !== 'fire') bullets.splice(bIndex, 1);
                }
            } else if (!bullet.isEnemy && bullet.type !== 'visual_exp' && bullet.type !== 'visual_melee') {
                for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
                    const enemy = enemies[eIndex];
                    if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius) {
                        if (bullet.type === 'rocket') { triggerExplosion(bullet.x, bullet.y, bullet.dmg, 95); bullets.splice(bIndex, 1); }
                        else if (bullet.type === 'fire') { enemy.hp -= bullet.dmg; }
                        else { enemy.hp -= bullet.dmg; bullets.splice(bIndex, 1); }
                        if (enemy.hp <= 0) { handleEnemyDeath(enemy); enemies.splice(eIndex, 1); }
                        break;
                    }
                }
            }
        }

        const levelText = document.getElementById("level");
        if (levelText) levelText.innerText = `STAGE ${currentLevel}`;

        const hpText = document.getElementById("hp");
        if (hpText) {
          hpText.innerText = `${Math.round(player.hp)} / ${player.maxHp}`;
          hpText.style.color = player.isBlocking ? '#00bfff' : (player.hp < (player.maxHp * 0.35) ? '#ff3333' : '#00ff55');
        }

        const hpBar = document.getElementById("hpBar");
        if (hpBar) {
          hpBar.style.width = `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%`;
          if (player.hp < (player.maxHp * 0.35)) {
            hpBar.style.background = '#ff3333';
          } else {
            hpBar.style.background = 'linear-gradient(90deg, #ff3333, #00ff55)';
          }
        }

        const armorText = document.getElementById("armor");
        if (armorText) armorText.innerText = `${Math.round(player.armor)} / ${player.maxArmor}`;

        const armorBar = document.getElementById("armorBar");
        if (armorBar) {
          armorBar.style.width = `${Math.max(0, Math.min(100, (player.armor / player.maxArmor) * 100))}%`;
        }

        const weaponText = document.getElementById("weapon");
        if (weaponText) weaponText.innerText = player.currentWeapon;
        
        const ammoText = document.getElementById("ammo");
        if (ammoText) {
          let displayWpnState = player.weaponAmmo[player.currentWeapon];
          ammoText.innerText = `${displayWpnState.ammo} / ${displayWpnState.reserveAmmo}`;
        }
        
        const scoreText = document.getElementById("score");
        if (scoreText) scoreText.innerText = `${player.score}`;
    }

    function triggerExplosion(ex: number, ey: number, damage: number, radius: number) {
        bullets.push({ x: ex, y: ey, dx: 0, dy: 0, type: 'visual_exp', rad: radius, timer: 12, dmg: 0 });
        if (Math.hypot(player.x - ex, player.y - ey) < radius) {
            damagePlayer(damage / 2);
        }
        enemies.forEach(enemy => {
            if (Math.hypot(enemy.x - ex, enemy.y - ey) < radius) {
                enemy.hp -= damage;
                if (enemy.hp <= 0) {
                    setTimeout(() => { const idx = enemies.indexOf(enemy); if (idx > -1) { handleEnemyDeath(enemy); enemies.splice(idx, 1); } }, 0);
                }
            }
        });
    }

    function handleEnemyDeath(enemy: Enemy) {
        player.score += enemy.type === 'tank' ? 300 : (enemy.type === 'flamer' ? 200 : 100);
        const rand = Math.random(); const timestamp = Date.now();
        let hasAllWeapons = player.inventory.length >= TOTAL_GUNS_COUNT;

        if (hasAllWeapons) {
            if (rand < 0.35) drops.push({ x: enemy.x, y: enemy.y, type: 'medkit', color: '#ffffff', label: '+', spawnedAt: timestamp });
            else if (rand < 0.70) drops.push({ x: enemy.x, y: enemy.y, type: 'armor', color: '#00aaff', label: 'AR', spawnedAt: timestamp });
            else drops.push({ x: enemy.x, y: enemy.y, type: 'ammo', color: '#ffcc00', label: 'A', spawnedAt: timestamp });
        } else {
            if (rand < 0.15) drops.push({ x: enemy.x, y: enemy.y, type: 'medkit', color: '#ffffff', label: '+', spawnedAt: timestamp });
            else if (rand < 0.30) drops.push({ x: enemy.x, y: enemy.y, type: 'armor', color: '#00aaff', label: 'AR', spawnedAt: timestamp });
            else if (rand < 0.45) drops.push({ x: enemy.x, y: enemy.y, type: 'ammo', color: '#ffcc00', label: 'A', spawnedAt: timestamp });
            else {
                let missingWeapons = Object.keys(WEAPONS).filter(w => !player.inventory.includes(w));
                if (missingWeapons.length > 0) {
                    let weaponChoice = missingWeapons[Math.floor(Math.random() * missingWeapons.length)];
                    let labels: { [key: string]: string } = { AK47: 'AK', Minigun: 'MG', Shotgun: 'SG', Sniper: 'SR', Laser: 'LZ', Flamethrower: 'FT', Bazooka: 'BZ' };
                    let colors: { [key: string]: string } = { AK47: '#e67e22', Minigun: '#f1c40f', Shotgun: '#00aaff', Sniper: '#1abc9c', Laser: '#9b59b6', Flamethrower: '#ff5500', Bazooka: '#ff0055' };
                    drops.push({ x: enemy.x, y: enemy.y, type: weaponChoice, color: colors[weaponChoice], label: labels[weaponChoice], spawnedAt: timestamp });
                } else {
                    drops.push({ x: enemy.x, y: enemy.y, type: 'ammo', color: '#ffcc00', label: 'A', spawnedAt: timestamp });
                }
            }
        }
    }

    function checkGameOver() {
        if (player.hp <= 0) {
            gameState = "MENU"; clearInterval(spawnInterval);
            
            const ui = document.getElementById("ui");
            if (ui) ui.style.display = "none";
            
            let isNewRecord = false;
            if (player.score > highscore) {
                highscore = player.score;
                localStorage.setItem("shooter_man_highscore", highscore.toString());
                isNewRecord = true;
            }

            const menuTitle = document.getElementById("menuTitle");
            if (menuTitle) {
              menuTitle.innerText = isNewRecord ? "NEW RECORD!" : "MISSION FAILED";
              menuTitle.style.color = isNewRecord ? "#ffcc00" : "#ff3333";
            }

            const menuSub = document.getElementById("menuSub");
            if (menuSub) menuSub.innerText = `Shooter Man Expired at Stage ${currentLevel}.\nFinal Score: ${player.score}`;

            const TIPS = [
              "USE SHIELD: Hold [Shift] to deploy an electromagnetic shield that blocks 70% of all incoming damage!",
              "EXPLOSIVE BARRELS: Detonate bright red TNT barrels to trigger huge explosions that wipe out swarms of enemies!",
              "TACTICAL ZOOM: Hold [Z] to scale the zoom level out, expanding your peripheral field of view to locate long-range snipers!",
              "MELEE KICK: Press [F] to unleash a devastating physical kick that inflicts massive damage and shoves enemies back!",
              "AMMO RESTORE: Grabbing an Ammo Cache completely replenishes ammunition reserves for ALL weapons simultaneously!",
              "WEAPON ARSENAL: Toggle between firearms with [Q] and [E] to adapt to long-range snipers or short-range swarmers!",
              "JUGGERNAUT UPGRADES: Reaching 2500 score milestones launches a tactical upgrade prompt. These modifications stack indefinitely!",
              "HEAVY TANKS: Gray Tank enemies are heavily armored. Use Sniper rifles or Bazookas to bring them down safely from distance.",
              "PYRO FLAMERS: Crimson-coated Flamethrower enemies spray wide flames. Eliminate them from a distance before they approach."
            ];
            const randomTip = TIPS[Math.floor(Math.random() * TIPS.length)];
            const deathTipEl = document.getElementById("deathTip");
            if (deathTipEl) {
                deathTipEl.innerText = `💡 COMBAT INTEL: ${randomTip}`;
                deathTipEl.style.display = "block";
            }

            const highscoreDisplay = document.getElementById("highscoreDisplay");
            if (highscoreDisplay) highscoreDisplay.innerText = `ALL-TIME BEST: ${highscore}`;

            const startBtn = document.getElementById("startBtn");
            if (startBtn) startBtn.innerText = "RESPAWN";

            const menu = document.getElementById("menu");
            if (menu) menu.style.display = "flex";
        }
    }

    function drawHuman(x: number, y: number, radius: number, angle: number, walkCycle: number, type: string, mainColor: string) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        let legOffset = Math.sin(walkCycle) * (radius * 0.35);

        ctx.fillStyle = '#111';
        ctx.fillRect(-3, -radius - 1 + legOffset, 5, 4);
        ctx.fillRect(-3, radius - 3 - legOffset, 5, 4);

        if(type === 'flamer') {
            ctx.fillStyle = '#d35400';
            ctx.fillRect(-radius - 1, -6, 4, 4);
            ctx.fillRect(-radius - 1, 2, 4, 4);
        }

        ctx.fillStyle = mainColor;
        ctx.beginPath();
        if(type === 'tank') {
            ctx.ellipse(-1, 0, radius * 0.9, radius * 1.2, 0, 0, Math.PI * 2);
        } else {
            ctx.ellipse(-1, 0, radius * 0.7, radius * 1.0, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();

        if (type === 'player' && player.armor > 0) {
            ctx.fillStyle = '#0066cc';
            ctx.beginPath();
            ctx.ellipse(-1, 0, radius * 0.55, radius * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = (type === 'player') ? '#004411' : '#222';
        if(type === 'flamer') ctx.fillStyle = '#ba4a00';
        ctx.fillRect(-5, -radius * 0.5, radius * 0.8, radius);

        ctx.fillStyle = (type === 'player') ? '#88ffaa' : mainColor;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#111';
        ctx.fillRect(radius * 0.2, -radius * 0.25, 3, radius * 0.5);

        ctx.restore();
    }

    function drawRadarMap() {
        const radarSize = 90; const padding = 15;
        const rx = VIEW_WIDTH - radarSize - padding, ry = padding;
        ctx.fillStyle = "rgba(10, 15, 10, 0.85)"; ctx.fillRect(rx, ry, radarSize, radarSize);
        ctx.strokeStyle = "#444"; ctx.lineWidth = 1.5; ctx.strokeRect(rx, ry, radarSize, radarSize);

        const scaleX = radarSize / MAP_WIDTH, scaleY = radarSize / MAP_HEIGHT;
        ctx.fillStyle = "rgba(70, 70, 70, 0.8)";
        obstacles.forEach(wall => ctx.fillRect(rx + wall.x * scaleX, ry + wall.y * scaleY, wall.w * scaleX, wall.h * scaleY));

        ctx.fillStyle = "#ff3333"; tntBarrels.forEach(tnt => ctx.fillRect(rx + tnt.x * scaleX - 1, ry + tnt.y * scaleY - 1, 1.5, 1.5));
        enemies.forEach(en => {
            ctx.fillStyle = en.type === 'tank' ? '#ff0000' : (en.type === 'flamer' ? '#ffaa00' : '#ff00ff');
            ctx.beginPath(); ctx.arc(rx + en.x * scaleX, ry + en.y * scaleY, 1.5, 0, Math.PI*2); ctx.fill();
        });
        ctx.fillStyle = "#00ff55"; ctx.beginPath(); ctx.arc(rx + player.x * scaleX, ry + player.y * scaleY, 2, 0, Math.PI*2); ctx.fill();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (gameState !== "PLAYING" && gameState !== "PAUSED") return;

        ctx.save();
        if (zoom !== 1.0) {
            ctx.scale(zoom, zoom);
        }
        ctx.translate(-camera.x, -camera.y);

        if (floorPattern) {
          ctx.fillStyle = floorPattern;
          ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        }
        ctx.strokeStyle = "rgba(255, 0, 0, 0.4)"; ctx.lineWidth = 6; ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

        if (wallPattern) {
          ctx.fillStyle = wallPattern;
          obstacles.forEach(wall => {
              ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
              ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
          });
        }

        tntBarrels.forEach(barrel => {
            ctx.fillStyle = '#9e3a2b'; ctx.beginPath(); ctx.arc(barrel.x, barrel.y, barrel.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke();
            ctx.strokeStyle = '#dfa63b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(barrel.x, barrel.y, barrel.radius - 3, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("TNT", barrel.x, barrel.y + 3);
        });

        drops.forEach(drop => {
            let grad = ctx.createRadialGradient(drop.x, drop.y, 2, drop.x, drop.y, 11);
            grad.addColorStop(0, '#fff'); grad.addColorStop(1, drop.color);
            ctx.fillStyle = grad; ctx.fillRect(drop.x - 9, drop.y - 9, 18, 18);
            ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.strokeRect(drop.x - 9, drop.y - 9, 18, 18);
            ctx.fillStyle = drop.type === 'medkit' ? '#ff0000' : (drop.type === 'armor' ? '#fff' : '#000');
            ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText(drop.label, drop.x, drop.y + 4);
        });

        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        ctx.lineWidth = 2; ctx.strokeStyle = '#000';
        
        if (player.currentWeapon === 'Pistol') {
            ctx.fillStyle = '#7f8c8d'; ctx.fillRect(10, 4, 8, 3); ctx.strokeRect(10, 4, 8, 3);
        } else if (player.currentWeapon === 'AK47') {
            ctx.fillStyle = '#8a4f1e'; ctx.fillRect(6, 3, 6, 5);
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(12, 4, 15, 4); ctx.strokeRect(12, 4, 15, 4);
            ctx.fillStyle = '#111'; ctx.fillRect(27, 5, 4, 2);
        } else if (player.currentWeapon === 'Minigun') {
            ctx.fillStyle = '#34495e'; ctx.fillRect(5, 2, 14, 8); ctx.strokeRect(5, 2, 14, 8);
            ctx.fillStyle = '#7f8c8d'; ctx.fillRect(19, 3, 13, 6); 
            ctx.fillStyle = '#111'; ctx.fillRect(32, 4, 2, 4);
        } else if (player.currentWeapon === 'Shotgun') {
            ctx.fillStyle = '#535c68'; ctx.fillRect(6, 3, 16, 6); ctx.strokeRect(6, 3, 16, 6);
            ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(22, 6); ctx.stroke();
        } else if (player.currentWeapon === 'Sniper') {
            ctx.fillStyle = '#2d3436'; ctx.fillRect(4, 4, 10, 4); 
            ctx.fillStyle = '#111'; ctx.fillRect(14, 5, 24, 2); ctx.strokeRect(14, 5, 24, 2); 
            ctx.fillStyle = '#636e72'; ctx.fillRect(8, 1, 6, 3); 
        } else if (player.currentWeapon === 'Laser') {
            ctx.fillStyle = '#dcdde1'; ctx.fillRect(8, 3, 15, 6); ctx.strokeRect(8, 3, 15, 6);
            ctx.fillStyle = '#9b59b6'; ctx.fillRect(12, 4, 7, 4);
        } else if (player.currentWeapon === 'Flamethrower') {
            ctx.fillStyle = '#7f8c8d'; ctx.fillRect(5, 4, 18, 5); ctx.strokeRect(5, 4, 18, 5); 
            ctx.fillStyle = '#d35400'; ctx.fillRect(10, 3, 10, 2); 
            ctx.fillStyle = '#222'; ctx.fillRect(23, 5, 5, 3); ctx.strokeRect(23, 5, 5, 3); 
            ctx.fillStyle = '#ff3300'; ctx.fillRect(28, 6, 2, 1); 
        } else if (player.currentWeapon === 'Bazooka') {
            ctx.fillStyle = '#27ae60'; ctx.fillRect(4, 2, 22, 10); ctx.strokeRect(4, 2, 22, 10);
        }
        ctx.restore();

        drawHuman(player.x, player.y, player.radius, player.angle, player.walkCycle, 'player', '#00aa33');

        if (player.isBlocking) { 
            ctx.strokeStyle = 'rgba(0, 191, 255, 0.7)'; ctx.lineWidth = 4; 
            ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 4, player.angle - 0.8, player.angle + 0.8); ctx.stroke(); 
        }

        enemies.forEach(enemy => {
            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            ctx.rotate(enemy.angle);
            ctx.fillStyle = '#333'; ctx.fillRect(8, 4, 8, 3); 
            ctx.restore();

            let enemyColor = enemy.color;
            if(enemy.type === 'melee') enemyColor = '#8e44ad';
            if(enemy.type === 'flamer') enemyColor = '#e67e22';
            if(enemy.type === 'tank') enemyColor = '#7f8c8d';

            drawHuman(enemy.x, enemy.y, enemy.radius, enemy.angle, enemy.walkCycle, enemy.type, enemyColor);
        });

        bullets.forEach((bullet, idx) => {
            if (bullet.type === 'bullet') {
                ctx.fillStyle = bullet.isEnemy ? '#ffcc00' : (player.currentWeapon === 'Laser' ? '#9b59b6' : '#00ffff');
                ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.isEnemy ? 4 : 3, 0, Math.PI * 2); ctx.fill();
            } else if (bullet.type === 'heavy_bullet') {
                ctx.fillStyle = '#ff1111'; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
            } else if (bullet.type === 'rocket') {
                ctx.fillStyle = '#ff3300'; ctx.fillRect(bullet.x - 6, bullet.y - 3, 12, 6);
            } else if (bullet.type === 'fire') {
                let size = 4 + (25 - (bullet.rangeTimer || 25)) * 0.7;
                let fireGrad = ctx.createRadialGradient(bullet.x, bullet.y, 1, bullet.x, bullet.y, size);
                fireGrad.addColorStop(0, '#fff'); fireGrad.addColorStop(0.3, '#ffcc00'); fireGrad.addColorStop(0.8, '#ff3300'); fireGrad.addColorStop(1, 'rgba(255,50,0,0)');
                ctx.fillStyle = fireGrad; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, size, 0, Math.PI * 2); ctx.fill();
            } else if (bullet.type === 'visual_exp') {
                if (bullet.rad !== undefined) {
                  ctx.fillStyle = 'rgba(255, 120, 0, 0.3)'; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.rad, 0, Math.PI * 2); ctx.fill();
                }
                if (gameState === "PLAYING" && bullet.timer !== undefined) bullet.timer--; 
                if (bullet.timer !== undefined && bullet.timer <= 0) bullets.splice(idx, 1);
            } else if (bullet.type === 'visual_melee') {
                if (bullet.radius !== undefined) {
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2); ctx.stroke();
                }
                if (gameState === "PLAYING" && bullet.timer !== undefined) bullet.timer--; 
                if (bullet.timer !== undefined && bullet.timer <= 0) bullets.splice(idx, 1);
            }
        });

        ctx.restore();
        drawRadarMap();
    }

    let animationFrameId: number;
    function loop() {
        update(); draw(); animationFrameId = requestAnimationFrame(loop);
    }

    // Set interactive handlers
    const startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.onclick = startGame;

    const resumeBtn = document.getElementById("resumeBtn");
    if (resumeBtn) resumeBtn.onclick = togglePause;

    // Start game loop
    loop();

    return () => {
        cancelAnimationFrame(animationFrameId);
        clearInterval(spawnInterval);
        clearInterval(musicInterval);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div id="gameContainer">
        <div className="scanlines"></div>
        <div id="ui" style={{ display: 'none' }}>
            <div className="hud-row">
                <span className="hud-label">Combat Stage</span>
                <span id="level" className="hud-value" style={{ color: '#ff33ff' }}>STAGE 1</span>
            </div>
            
            <div style={{ marginTop: '10px' }}>
                <div className="hud-row" style={{ marginBottom: '2px' }}>
                    <span className="hud-label">Vitality Index</span>
                    <span id="hp" className="hud-value" style={{ color: '#00ff55' }}>100 / 100</span>
                </div>
                <div className="bar-container">
                    <div id="hpBar" className="bar-fill"></div>
                </div>
            </div>

            <div>
                <div className="hud-row" style={{ marginBottom: '2px' }}>
                    <span className="hud-label">Shield Integrity</span>
                    <span id="armor" className="hud-value" style={{ color: '#00aaff' }}>50 / 50</span>
                </div>
                <div className="bar-container">
                    <div id="armorBar" className="bar-fill"></div>
                </div>
            </div>

            <div className="hud-row" style={{ marginTop: '6px' }}>
                <span className="hud-label">Active Armament</span>
                <span id="weapon" className="hud-value">Pistol</span>
            </div>

            <div className="hud-row">
                <span className="hud-label">Tactical Ammo</span>
                <span id="ammo" className="hud-value">30 / 180</span>
            </div>

            <div className="hud-row" style={{ borderTop: '1px solid rgba(0, 255, 85, 0.15)', paddingTop: '8px', marginTop: '10px' }}>
                <span className="hud-label" style={{ color: '#ffcc00' }}>Operational Score</span>
                <span id="score" className="hud-value" style={{ color: '#ffcc00' }}>0</span>
            </div>

            <div style={{ color: 'rgba(0, 255, 85, 0.4)', fontSize: '9px', marginTop: '10px', borderTop: '1px dashed rgba(0, 255, 85, 0.2)', paddingTop: '6px', textAlign: 'center', fontFamily: '"Share Tech Mono", monospace' }}>
                [ESC] PAUSE &bull; [M] MUTE AUDIO
            </div>
        </div>
        
        <div id="menu">
            <h1 id="menuTitle">SHOOTER MAN</h1>
            <p id="menuSub">
                <b>WASD</b> to Move &bull; <b>Mouse</b> to Aim & Shoot Guns<br />
                <b>[Q] / [E]</b> Swap Guns &bull; <b>[F] Melee Kick</b> &bull; <b>[Hold Shift] Shield</b> &bull; <b>[Hold Z] Zoom Out</b><br />
                <span style={{ color: '#ffcc00' }}>Ammo pick ups fill reserve bullet supplies for all weapons at once!</span>
            </p>
            <div id="highscoreDisplay">ALL-TIME BEST: 0</div>
            <div id="deathTip" style={{ color: '#ff9900', fontSize: '11px', marginTop: '10px', marginBottom: '15px', maxWidth: '550px', lineHeight: '1.4', border: '1px dashed #ff9900', padding: '10px', borderRadius: '4px', background: 'rgba(255, 153, 0, 0.05)', display: 'none', textAlign: 'center' }}></div>
            <button id="startBtn">START RUN</button>
        </div>

        <div id="pauseMenu" style={{ display: 'none' }}>
            <h1 style={{ color: '#ffcc00' }}>TACTICAL PAUSE</h1>
            <p>Game operations are currently suspended.<br />Press the button below or <b>[ESC]</b> to get back in action.</p>
            <button id="resumeBtn">RESUME OPERATIONS</button>
        </div>

        <div id="upgradeMenu" style={{ display: 'none' }}>
            <h1 style={{ color: '#ffcc00', fontSize: '36px' }}>UPGRADE DRAFT</h1>
            <p style={{ marginBottom: '5px' }}>Select a combat modification module. All buffs stack indefinitely.</p>
            <div className="upgrade-container" id="upgradeOptionsContainer">
            </div>
        </div>

        <canvas id="gameCanvas" width={800} height={600}></canvas>
    </div>
  );
}
