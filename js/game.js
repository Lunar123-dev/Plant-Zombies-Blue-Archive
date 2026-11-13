(function () {
  'use strict';

  // ---------------------------------------------------------------- canvas
  var W = 1280;
  var H = 760;
  var FONT = '"Microsoft YaHei","PingFang SC","YouYuan",sans-serif';
  var TAU = Math.PI * 2;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var DPR = 1;

  function fitCanvas() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.round(W * s) + 'px';
    canvas.style.height = Math.round(H * s) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  var loadError = '';
  window.addEventListener('error', function (e) {
    loadError += (e.message || 'error') + '\n';
  });

  // ---------------------------------------------------------------- layout
  var LAWN = { x: 152, y: 104, w: 1120, h: 600, rows: 5, cols: 9 };
  LAWN.cw = LAWN.w / LAWN.cols;
  LAWN.ch = LAWN.h / LAWN.rows;
  var HUD_H = 104;
  var BOTTOM_Y = 704;

  function rowTop(r) { return LAWN.y + r * LAWN.ch; }
  function rowBase(r) { return LAWN.y + (r + 1) * LAWN.ch - 4; }
  function cellCX(c) { return LAWN.x + (c + 0.5) * LAWN.cw; }
  function cellCY(r) { return LAWN.y + (r + 0.5) * LAWN.ch; }
  function cellAt(x, y) {
    if (x < LAWN.x || x > LAWN.x + LAWN.w || y < LAWN.y || y > LAWN.y + LAWN.h) return null;
    return {
      c: Math.max(0, Math.min(LAWN.cols - 1, Math.floor((x - LAWN.x) / LAWN.cw))),
      r: Math.max(0, Math.min(LAWN.rows - 1, Math.floor((y - LAWN.y) / LAWN.ch)))
    };
  }

  // ---------------------------------------------------------------- helpers
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOutBack(t) {
    t = clamp(t, 0, 1);
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function inside(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
  function dist2(x1, y1, x2, y2) { var dx = x1 - x2, dy = y1 - y2; return dx * dx + dy * dy; }

  function rrPath(x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillRR(x, y, w, h, r, fill) {
    rrPath(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRR(x, y, w, h, r, stroke, width) {
    rrPath(x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width || 1;
    ctx.stroke();
  }

  function txt(s, x, y, size, color, opt) {
    opt = opt || {};
    ctx.save();
    ctx.font = (opt.weight || 700) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.baseline || 'alphabetic';
    if (opt.shadow) {
      ctx.shadowColor = opt.shadow;
      ctx.shadowBlur = opt.blur || 4;
      ctx.shadowOffsetY = opt.oy || 2;
    }
    if (opt.stroke) {
      ctx.lineWidth = opt.sw || 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = opt.stroke;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  function wrapText(s, maxW, size, weight) {
    ctx.save();
    ctx.font = (weight || 700) + ' ' + size + 'px ' + FONT;
    var lines = [];
    var cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      var test = cur + ch;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    ctx.restore();
    return lines;
  }

  function starPath(cx, cy, r, inner) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * inner;
      var x = cx + Math.cos(ang) * rr;
      var y = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawStar(cx, cy, r, filled) {
    ctx.save();
    starPath(cx, cy, r, 0.45);
    if (filled) {
      ctx.fillStyle = '#ffd447';
      ctx.fill();
      ctx.strokeStyle = '#a9731a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - r * 0.14, cy - r * 0.14, r * 0.22, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(90,70,40,.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,70,40,.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function ellipse(x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // ---------------------------------------------------------------- data
  var PALETTES = {
    morning: {
      paper: '#fbf8ef', cellA: '#fdfcf7', cellB: '#f6f1e4', grid: '#26231d',
      path: '#efe5cf', wall: '#fdfbf5', wall2: '#f0e6d3',
      g1: '#fbf8ef', g2: '#f6f1e4', g3: '#f2ecdd', edge: '#c8b995',
      bush: '#fbf8ef', fireflies: false, tint: 'rgba(255,248,220,0.05)'
    },
    noon: {
      paper: '#fcfcf9', cellA: '#ffffff', cellB: '#f7f3e8', grid: '#202020',
      path: '#f2e8d2', wall: '#fefcf6', wall2: '#f3e9d6',
      g1: '#fcfcf9', g2: '#f7f3e8', g3: '#f4efe2', edge: '#c9bb9c',
      bush: '#fcfcf9', fireflies: false, tint: 'rgba(255,255,235,0.06)'
    },
    dusk: {
      paper: '#fdf1dd', cellA: '#fff8ea', cellB: '#f9ead4', grid: '#3a2b1c',
      path: '#ecdcc0', wall: '#fdf2dd', wall2: '#f2e0c4',
      g1: '#fdf1dd', g2: '#f9ead4', g3: '#f6e4ca', edge: '#bfa27a',
      bush: '#fdf1dd', fireflies: true, tint: 'rgba(255,170,80,0.08)'
    }
  };

  var PLANTS = {
    sunflower: {
      name: 'Hướng Dương', key: 'sunflower_idle', produceKey: 'sunflower_produce',
      reactKey: 'sunflower_react', cost: 50, hp: 300, cooldown: 7.5,
      h: 116, portrait: 54, color: '#ffd84a', desc: 'Cứ 22 giây tạo ra 25 ánh sáng',
      first: 6, interval: 22
    },
    peashooter: {
      name: 'Cây Bắn Đậu', key: 'peashooter_idle', atkKey: 'peashooter_attack',
      ultKey: 'peashooter_ult', reactKey: 'peashooter_react',
      cost: 100, hp: 300, cooldown: 7.5,
      h: 120, portrait: 56, color: '#7ed957',
      desc: 'Bắn xu, cứ 10 phát kích hoạt đại chiêu rải tiền hình quạt',
      dmg: 20, rate: 1.4, ultShots: 10, ultDur: 2.6, ultRate: 0.36,
      ultBillDmg: 16, ultCoinDmg: 10, attackTail: 0
    },
    wallnut: {
      name: 'Hạt Dẻ', key: 'wallnut_idle', reactKey: 'wallnut_react',
      cost: 50, hp: 4000, cooldown: 30, h: 116, portrait: 54,
      color: '#d9a75c', desc: 'Hạt dẻ siêu cứng, máu càng thấp mặt càng thảm'
    },
    potatomine: {
      name: 'Mìn Khoai Tây', key: 'potato_idle', armedKey: 'potato_armed',
      boomKey: 'potato_boom', reactKey: 'potato_armed',
      cost: 25, hp: 300, cooldown: 25, h: 104, portrait: 52,
      color: '#c98b4b', desc: 'Sau 14 giây sẽ vũ trang, zombie đến gần là nổ',
      arm: 14, dmg: 1800, radius: 140
    }
  };
  var PLANT_ORDER = ['sunflower', 'peashooter', 'wallnut', 'potatomine'];

  var ZOMBIES = {
    normal: { name: 'Zombie Thường', hp: 200, speed: 26, h: 188, color: '#efe7d8' },
    cone: { name: 'Zombie Nón', hp: 570, speed: 26, h: 212, color: '#efe7d8' },
    bucket: { name: 'Zombie Xô Sắt', hp: 1300, speed: 25, h: 214, color: '#efe7d8' }
  };

  var LEVELS = [
    {
      name: 'Sáng Sớm · Sân Trước', tag: 'Màn 1', pal: 'morning', sun: 150,
      desc: 'Nắng đẹp, trồng hướng dương trước, rồi bố trí cây bắn đậu.',
      plants: ['sunflower', 'peashooter'],
      hint: 'Trồng hướng dương tích ánh sáng trước, rồi trồng cây bắn đậu bảo vệ bãi cỏ!',
      waves: [
        { at: 16, list: { normal: 1 } },
        { at: 40, list: { normal: 2 } },
        { at: 66, list: { normal: 2, cone: 1 } },
        { at: 94, list: { normal: 3, cone: 1 }, flag: true, huge: true }
      ]
    },
    {
      name: 'Buổi Chiều · Sân Trước', tag: 'Màn 2', pal: 'noon', sun: 100,
      desc: 'Zombie nón xuất hiện, dùng hạt dẻ để cầm chân chúng.',
      plants: ['sunflower', 'peashooter', 'wallnut'],
      hint: 'Đồng đội mới "Hạt Dẻ" đã mở khóa! Đặt nó ở hàng trước để chặn zombie.',
      waves: [
        { at: 16, list: { normal: 2 } },
        { at: 40, list: { normal: 2, cone: 1 } },
        { at: 64, list: { normal: 2, cone: 2 } },
        { at: 88, list: { normal: 2, cone: 1, bucket: 1 }, flag: true },
        { at: 112, list: { normal: 3, cone: 2 } },
        { at: 140, list: { normal: 3, cone: 2, bucket: 2 }, flag: true, huge: true }
      ]
    },
    {
      name: 'Hoàng Hôn · Sân Trước', tag: 'Màn 3', pal: 'dusk', sun: 100,
      desc: 'Zombie xô sắt tấn công, mìn khoai tây nên ra trận rồi.',
      plants: ['sunflower', 'peashooter', 'wallnut', 'potatomine'],
      hint: '"Mìn Khoai Tây" đã mở khóa: chôn ở hàng trước, đợi zombie đến gần là nổ!',
      waves: [
        { at: 16, list: { normal: 2, cone: 1 } },
        { at: 38, list: { normal: 3, cone: 1 } },
        { at: 60, list: { normal: 2, cone: 2, bucket: 1 }, flag: true },
        { at: 84, list: { normal: 3, cone: 2, bucket: 1 } },
        { at: 108, list: { normal: 3, cone: 3, bucket: 2 }, flag: true },
        { at: 132, list: { normal: 4, cone: 3, bucket: 2 } },
        { at: 162, list: { normal: 4, cone: 4, bucket: 3 }, flag: true, huge: true }
      ]
    }
  ];

  // ---------------------------------------------------------------- state
  var G = {
    state: 'loading',
    stateT: 0,
    uiT: 0,
    t: 0,
    level: 0,
    levelCfg: LEVELS[0],
    pal: PALETTES.morning,
    sun: 0,
    time: 0,
    plants: [],
    zombies: [],
    projectiles: [],
    hitFx: [],
    suns: [],
    particles: [],
    explosions: [],
    mineBooms: [],
    moneyFx: [],
    texts: [],
    flies: [],
    mowers: [],
    recharge: {},
    selected: null,
    hoverPlant: null,
    mouse: { x: -999, y: -999 },
    buttons: [],
    nextWave: 0,
    wavesStarted: 0,
    spawnQueue: [],
    banner: null,
    shake: 0,
    clearT: 0,
    sunTimer: 4,
    stats: { kills: 0, planted: 0, sun: 0 },
    unlocked: 1,
    stars: {},
    tooltip: null,
    cheatOpen: false,
    cheatNoCooldown: false,
    autoSun: true,
    bg: null,
    menuBg: null,
    introT: 0,
    hitSnd: 0,
    lastLane: -1,
    laneCount: 0,
    loadingP: 0,
    loadError: ''
  };

  function loadProgress() {
    try {
      var u = parseInt(localStorage.getItem('pvzq_unlocked') || '1', 10);
      if (!isNaN(u)) G.unlocked = clamp(u, 1, LEVELS.length);
      var s = JSON.parse(localStorage.getItem('pvzq_stars') || '{}');
      if (s && typeof s === 'object') G.stars = s;
    } catch (e) {}
  }

  function saveProgress() {
    try {
      localStorage.setItem('pvzq_unlocked', String(G.unlocked));
      localStorage.setItem('pvzq_stars', JSON.stringify(G.stars));
    } catch (e) {}
  }

  function setState(s) {
    G.state = s;
    G.stateT = 0;
    G.selected = null;
    G.tooltip = null;
    G.cheatOpen = false;
  }

  function starCount() {
    var used = 0;
    for (var i = 0; i < G.mowers.length; i++) if (G.mowers[i].state !== 'idle') used++;
    if (used === 0) return 3;
    if (used <= 1) return 2;
    return 1;
  }

  // ---------------------------------------------------------------- dev shortcuts
  function applyHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    if (h === 'levels') { setState('levels'); return; }
    if (h === 'help') { setState('help'); return; }
    if (h === 'demo') { demoSetup(); return; }
    if (h === 'cheat') {
      startLevel(0);
      G.introT = 100;
      G.sun = 150;
      G.time = 40;
      spawnZombie('normal', 1);
      G.zombies[G.zombies.length - 1].x = 900;
      spawnZombie('cone', 3);
      G.zombies[G.zombies.length - 1].x = 1050;
      G.cheatOpen = true;
      return;
    }
    if (h === 'hp') {
      startLevel(1);
      G.demo = true;
      G.introT = 100;
      var hpRatios = [1, 0.62, 0.4, 0.18];
      for (var hi = 0; hi < hpRatios.length; hi++) {
        var hpn = newPlant('wallnut', 1 + hi * 2, 1);
        hpn.plantT = 2;
        hpn.hp = hpn.maxHp * hpRatios[hi];
        hpn.animT = 0.8 + hi * 0.7;
        G.plants.push(hpn);
      }
      return;
    }
    if (h === 'shovel') {
      startLevel(2);
      G.demo = true;
      G.introT = 100;
      G.selected = 'shovel';
      G.sun = 325;
      G.time = 70;
      var demoPlants = [[0, 1, 'sunflower'], [2, 1, 'peashooter'], [5, 1, 'wallnut'], [6, 3, 'potatomine']];
      for (var si = 0; si < demoPlants.length; si++) {
        var sd = demoPlants[si];
        var sp = newPlant(sd[2], sd[0], sd[1]);
        sp.plantT = 2;
        sp.animT = 0.7;
        if (sd[2] === 'potatomine') sp.armed = true;
        G.plants.push(sp);
      }
      G.mouse = { x: cellCX(5), y: rowTop(1) + 60 };
      return;
    }
    if (h === 'hitfx') {
      startLevel(0);
      G.demo = true;
      G.introT = 100;
      G.time = 10;
      spawnZombie('normal', 1);
      var hz = G.zombies[G.zombies.length - 1];
      hz.x = 470;
      hz.animT = 0.4;
      damageZombie(hz, 0, 500, rowBase(1) - 70);
      hz.flash = 0.14;
      if (G.hitFx.length) G.hitFx[0].t = 0.1;
      return;
    }
    if (h === 'test') { runSelfTest(); return; }
    if (h === 'pause') { startLevel(0); setState('paused'); return; }
    if (h === 'won' || h === 'lost') {
      startLevel(0);
      G.time = h === 'won' ? 132 : 96;
      G.stats = h === 'won' ? { kills: 14, planted: 9, sun: 275 } : { kills: 6, planted: 5, sun: 150 };
      G.wavesStarted = h === 'won' ? 4 : 3;
      G.finalStats = {
        stars: h === 'won' ? 3 : 0,
        time: G.time, kills: G.stats.kills, sun: G.stats.sun, planted: G.stats.planted
      };
      G.demo = true;
      setState(h);
      return;
    }
    if (h.indexOf('play') === 0) {
      var n = parseInt(h.slice(4), 10) - 1;
      if (n >= 0 && n < LEVELS.length) startLevel(n);
    }
  }

  function demoSetup() {
    startLevel(2);
    G.demo = true;
    G.sun = 325;
    G.time = 96;
    G.introT = 100;
    G.stats = { kills: 8, planted: 11, sun: 350 };
    G.wavesStarted = 3;
    G.demoPlant = [
      [0, 0, 'sunflower'], [0, 1, 'sunflower'], [1, 1, 'sunflower'], [0, 3, 'sunflower'], [0, 4, 'sunflower'],
      [2, 0, 'peashooter'], [2, 1, 'peashooter'], [2, 2, 'peashooter'], [2, 3, 'peashooter'], [2, 4, 'peashooter'],
      [5, 1, 'wallnut'], [5, 3, 'wallnut'], [6, 2, 'potatomine']
    ];
    for (var i = 0; i < G.demoPlant.length; i++) {
      var d = G.demoPlant[i];
      var p = newPlant(d[2], d[0], d[1]);
      p.plantT = 2;
      p.animT = Math.random() * 3;
      if (d[2] === 'potatomine') { p.armed = true; p.armT = 14; }
      if (d[2] === 'peashooter') {
        p.attacking = true;
        p.attackAnimT = 0.55;
        if (d[0] === 2 && d[1] === 2) {
          p.ultActive = true;
          p.ultT = 2;
          p.attacking = true;
        }
      }
      G.plants.push(p);
    }
    spawnZombie('normal', 0);
    spawnZombie('normal', 4);
    spawnZombie('cone', 2);
    spawnZombie('bucket', 3);
    spawnZombie('normal', 1);
    var zs = G.zombies;
    zs[0].x = 1120; zs[0].animT = 1.1;
    zs[1].x = 1170; zs[1].animT = 2.2;
    zs[2].x = 1040; zs[2].animT = 0.7;
    zs[3].x = 560; zs[3].animT = 1.7;
    zs[4].x = 866; zs[4].eating = true; zs[4].eatPlant = G.plants.find(function (p) { return p.type === 'wallnut' && p.row === 1; }); zs[4].animT = 0.9;
    G.suns.push({ mode: 'idle', x: 360, y: 520, age: 3, phase: 1, landT: 2 });
    G.suns.push({ mode: 'idle', x: 720, y: 360, age: 3, phase: 3, landT: 4 });
    G.suns.push({ mode: 'sky', x: 1010, sx: 1010, y: 260, targetY: 560, age: 1, phase: 2, landT: 0 });
    G.sunTimer = 5;
    G.recharge = { sunflower: 2.4, peashooter: 0, wallnut: 21, potatomine: 0 };
    G.banner = null;
    G.selected = null;

    var dz = spawnZombie('bucket', 4);
    dz.x = 1230;
    dz.dead = true;
    dz.deadT = 0.4;
    G.mowers[1].state = 'run';
    G.mowers[1].x = 620;

    G.projectiles.push({ x: 520, y: rowBase(0) - 62, row: 0, dmg: 20, type: 'coin', spin: 0.6 });
    G.projectiles.push({ x: 640, y: rowBase(1) - 62, row: 1, dmg: 22, type: 'bill', spin: 1.2 });
    G.projectiles.push({ x: 668, y: rowBase(2) - 62, row: 2, dmg: 22, type: 'bill', spin: 2.4 });

    var binfo = Assets.meta.potato_boom;
    G.mineBooms.push({
      x: cellCX(6), y: rowBase(4),
      start: (binfo && binfo.cum) ? binfo.cum[17] : 900,
      animT: 0.12, dur: 0.6
    });
    burst(cellCX(6), rowBase(4) - 34, '#ffd35a', 18, 240, 4, 180, 1.2);
    G.texts.push({ x: cellCX(6), y: rowBase(4) - 80, text: '+25', t: 0.2, dur: 3, color: '#ffe27a', size: 24 });
  }

  // ---------------------------------------------------------------- self test
  function runSelfTest() {
    var results = [];
    function check(name, ok, extra) {
      results.push({ name: name, ok: !!ok, extra: extra ? String(extra) : '' });
    }
    function sim(sec) {
      var n = Math.round(sec * 60);
      for (var i = 0; i < n; i++) update(1 / 60);
    }

    G.silent = true;
    G.autoSun = false;
    try {
      startLevel(0);
      G.testMode = true;
      G.nextWave = G.levelCfg.waves.length;
      G.spawnQueue = [];
      G.sun = 3000;
      G.sunTimer = 9999;

      G.recharge.sunflower = 0;
      tryPlant('sunflower', 0, 1);
      var sf = G.plants[G.plants.length - 1];
      var sunBefore = G.suns.length;
      sim(9);
      check('Hướng dương tạo ánh sáng sau animation', G.suns.length > sunBefore || G.plants.indexOf(sf) === -1,
        'suns=' + G.suns.length);

      G.recharge.peashooter = 0;
      G.sun = 3000;
      tryPlant('peashooter', 1, 4);
      spawnZombie('normal', 4);
      G.zombies[G.zombies.length - 1].x = 1240;
      var k0 = G.stats.kills;
      sim(42);
      check('Cây bắn đậu hạ zombie thường', G.stats.kills > k0, 'kills+' + (G.stats.kills - k0));

      G.recharge.wallnut = 0;
      G.sun = 3000;
      tryPlant('wallnut', 3, 0);
      var wn = null;
      for (var i = 0; i < G.plants.length; i++) if (G.plants[i].type === 'wallnut') wn = G.plants[i];
      spawnZombie('normal', 0);
      var zz = G.zombies[G.zombies.length - 1];
      zz.x = cellCX(3) + 90;
      sim(6);
      check('Hạt dẻ bị zombie cắn', wn && wn.hp < wn.maxHp, wn ? ('hp=' + Math.round(wn.hp)) : 'missing');
      check('Hạt dẻ chặn zombie', !!(zz.dead || zz.eating), zz.dead ? 'zombie dead' : 'eating');

      G.recharge.potatomine = 0;
      G.sun = 3000;
      tryPlant('potatomine', 4, 2);
      var pm = G.plants[G.plants.length - 1];
      if (pm) { pm.armed = true; pm.armT = 14; }
      spawnZombie('normal', 2);
      var pz = G.zombies[G.zombies.length - 1];
      pz.x = cellCX(4) + 80;
      var k1 = G.stats.kills;
      sim(4);
      check('Mìn khoai tây nổ tiêu diệt', G.stats.kills > k1, 'kills+' + (G.stats.kills - k1));

      spawnZombie('normal', 3);
      var mz = G.zombies[G.zombies.length - 1];
      mz.x = 200;
      var k2 = G.stats.kills;
      sim(4);
      check('Xe cắt cỏ khởi động', G.mowers[3].state !== 'idle', G.mowers[3].state);
      check('Xe cắt cỏ dọn sạch', G.stats.kills > k2, 'kills+' + (G.stats.kills - k2));

      G.recharge.peashooter = 0;
      G.sun = 3000;
      tryPlant('peashooter', 1, 1);
      var ultShooter = G.plants[G.plants.length - 1];
      var uz = spawnZombie('bucket', 1);
      uz.x = 1150;
      var sawUlt = false;
      for (var ui = 0; ui < 40 * 60; ui++) {
        update(1 / 60);
        if (ultShooter.ultActive) sawUlt = true;
        if (ultShooter.hp <= 0) break;
      }
      check('Cây bắn đậu đại chiêu rải tiền sau 10 phát', sawUlt, 'shots=' + ultShooter.shots + ' ult=' + ultShooter.ultActive);

      var before = G.sun;
      var sun = { mode: 'idle', x: 700, y: 500, age: 0, phase: 0, landT: 0 };
      G.suns.push(sun);
      collectSun(sun);
      check('Click ánh sáng +25', G.sun === before + 25, G.sun + ' vs ' + (before + 25));

      var count = G.plants.length;
      if (G.plants.length) removePlantByShovel(G.plants[0]);
      check('Xẻng gỡ植物', G.plants.length === count - 1, 'plants=' + G.plants.length);

      G.sun = 0;
      G.recharge.sunflower = 0;
      var beforePlants = G.plants.length;
      tryPlant('sunflower', 8, 4);
      check('Không đủ ánh sáng không trồng được', G.plants.length === beforePlants);

      // UI hitboxes
      startLevel(0);
      G.testMode = true;
      G.sun = 1000;
      G.recharge = { sunflower: 0, peashooter: 0 };
      G.selected = null;
      render();
      handleClick({ x: 226, y: 52 });
      check('Click thẻ chọn cây', G.selected === 'sunflower', 'selected=' + G.selected);
      handleClick({ x: cellCX(2), y: rowTop(2) + LAWN.ch / 2 });
      check('Click bãi cỏ trồng cây', G.plants.some(function (p) { return p.col === 2 && p.row === 2; }),
        'plants=' + G.plants.length);
      G.selected = null;
      render();
      handleClick({ x: 432, y: 52 });
      check('Click xẻng', G.selected === 'shovel', 'selected=' + G.selected);
      handleClick({ x: cellCX(2), y: rowTop(2) + LAWN.ch / 2 });
      check('Xẻng gỡ cây', !G.plants.some(function (p) { return p.col === 2 && p.row === 2; }));
      var beforeSun = G.sun;
      G.suns.push({ mode: 'idle', x: 700, y: 500, age: 0, phase: 0, landT: 0 });
      handleClick({ x: 700, y: 500 });
      check('Click thu ánh sáng', G.sun === beforeSun + 25, G.sun + ' vs ' + (beforeSun + 25));

      // full level smoke tests
      for (var li = 0; li < LEVELS.length; li++) {
        startLevel(li);
        G.testMode = false;
        G.state = 'playing';
        G.sun = 99999;
        G.sunTimer = 99999;
        G.plants = [];
        G.zombies = [];
        G.spawnQueue = [];
        G.nextWave = 0;
        G.wavesStarted = 0;
        for (var rr = 0; rr < LAWN.rows; rr++) {
          var colsToUse = [1, 2, 3, 4, 5];
          for (var ci = 0; ci < colsToUse.length; ci++) {
            var pp = newPlant('peashooter', colsToUse[ci], rr);
            pp.plantT = 2;
            pp.animT = 1;
            G.plants.push(pp);
          }
          var ww = newPlant('wallnut', 7, rr);
          ww.plantT = 2;
          G.plants.push(ww);
        }
        var steps = 0;
        while (G.state === 'playing' && steps < 260 * 60) {
          update(1 / 60);
          steps++;
        }
        check('Màn ' + (li + 1) + ' có thể phá đảo', G.state === 'won',
          'state=' + G.state + ' / ' + Math.round(G.time) + 's / ' + G.wavesStarted + 'đợt');
        if (li === 0) {
          check('Phá đảo mở khóa màn sau', G.unlocked >= 2, 'unlocked=' + G.unlocked);
          check('Phá đảo lưu số sao', (G.stars['0'] || 0) >= 1, 'stars=' + (G.stars['0'] || 0));
        }
      }
    } catch (err) {
      check('Lỗi runtime', false, err.message || String(err));
    }
    G.silent = false;

    G.testMode = false;
    G.testResults = results;
    G.state = 'test';
    G.stateT = 0;
  }

  // ---------------------------------------------------------------- startup
  function boot() {
    loadProgress();
    G.state = 'loading';
    Assets.load(function (p) { G.loadingP = p; }).then(function () {
      G.menuBg = makeBackground(PALETTES.morning);
      G.state = 'menu';
      G.stateT = 0;
      try {
        applyHash();
      } catch (err) {
        loadError = 'Lỗi khởi tạo: ' + (err.message || String(err));
      }
    }).catch(function (err) {
      G.loadError = err.message || String(err);
      G.state = 'error';
      G.loadingP = 1;
    });
  }

  // ---------------------------------------------------------------- background
  function makeBackgroundGrassOld(pal) {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');

    // hedge on top (hidden by HUD while playing)
    var bgGrad = c.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, pal.bush);
    bgGrad.addColorStop(1, pal.g2);
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, W, H);

    // hedge bumps
    c.fillStyle = '#2e6424';
    for (var bx = 0; bx < W; bx += 56) {
      c.beginPath();
      c.arc(bx + 28, 42, 34, Math.PI, 0);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.10)';
    for (var bx2 = 12; bx2 < W; bx2 += 56) {
      c.beginPath();
      c.arc(bx2 + 28, 34, 20, Math.PI * 1.05, Math.PI * 1.9);
      c.fill();
    }

    // house wall
    var wallGrad = c.createLinearGradient(0, 0, 100, 0);
    wallGrad.addColorStop(0, pal.wall2);
    wallGrad.addColorStop(0.55, pal.wall);
    wallGrad.addColorStop(1, pal.wall2);
    c.fillStyle = wallGrad;
    c.fillRect(0, HUD_H, 100, H - HUD_H);
    c.strokeStyle = 'rgba(120,94,54,.28)';
    c.lineWidth = 2;
    for (var sy = HUD_H + 14; sy < H; sy += 20) {
      c.beginPath();
      c.moveTo(0, sy);
      c.lineTo(100, sy);
      c.stroke();
    }
    // roof beam
    c.fillStyle = '#8a5a2f';
    c.fillRect(0, HUD_H - 2, 118, 16);
    c.fillStyle = 'rgba(255,255,255,.16)';
    c.fillRect(0, HUD_H - 2, 118, 4);

    // window
    c.save();
    c.translate(8, 232);
    c.fillStyle = '#fffaf0';
    c.fillRect(0, 0, 78, 104);
    c.fillStyle = '#a5e0ef';
    c.fillRect(6, 6, 66, 92);
    var glass = c.createLinearGradient(6, 6, 72, 98);
    glass.addColorStop(0, 'rgba(255,255,255,.85)');
    glass.addColorStop(0.45, 'rgba(255,255,255,.10)');
    glass.addColorStop(1, 'rgba(120,190,215,.35)');
    c.fillStyle = glass;
    c.fillRect(6, 6, 66, 92);
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(39, 6); c.lineTo(39, 98);
    c.moveTo(6, 52); c.lineTo(72, 52);
    c.stroke();
    // curtains
    c.fillStyle = 'rgba(245,140,150,.75)';
    c.beginPath();
    c.moveTo(6, 6); c.quadraticCurveTo(20, 30, 10, 98); c.lineTo(6, 98); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(72, 6); c.quadraticCurveTo(58, 30, 68, 98); c.lineTo(72, 98); c.closePath(); c.fill();
    c.restore();

    // flower box
    c.fillStyle = '#7a4a22';
    c.fillRect(4, 336, 86, 16);
    var flowerCols = ['#ff8fa3', '#ffd447', '#ff9f5a', '#f77fbe'];
    for (var fi = 0; fi < 6; fi++) {
      var fx = 12 + fi * 13;
      c.fillStyle = '#3f7d33';
      c.fillRect(fx + 2, 326, 3, 12);
      c.fillStyle = flowerCols[fi % flowerCols.length];
      c.beginPath();
      c.arc(fx + 4, 324, 5, 0, TAU);
      c.fill();
      c.fillStyle = '#f7e6a3';
      c.beginPath();
      c.arc(fx + 4, 324, 2, 0, TAU);
      c.fill();
    }

    // house door
    c.fillStyle = '#8f5c30';
    c.fillRect(18, 470, 64, 150);
    c.fillStyle = '#a9743f';
    c.fillRect(24, 478, 52, 142);
    c.fillStyle = 'rgba(60,36,14,.35)';
    c.fillRect(30, 492, 40, 40);
    c.fillRect(30, 546, 40, 60);
    c.fillStyle = '#ffd96b';
    c.beginPath();
    c.arc(66, 560, 4, 0, TAU);
    c.fill();

    // path (mower strip)
    var pathGrad = c.createLinearGradient(100, 0, 152, 0);
    pathGrad.addColorStop(0, pal.path);
    pathGrad.addColorStop(1, '#cbb891');
    c.fillStyle = pathGrad;
    c.fillRect(100, HUD_H, 52, H - HUD_H);
    c.strokeStyle = 'rgba(90,70,40,.18)';
    c.lineWidth = 2;
    for (var py = HUD_H + 30; py < H; py += 46) {
      c.beginPath();
      c.moveTo(100, py);
      c.lineTo(152, py);
      c.stroke();
    }
    c.strokeStyle = 'rgba(90,70,40,.22)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(151, HUD_H);
    c.lineTo(151, H);
    c.stroke();

    // lawn base
    var lawnGrad = c.createLinearGradient(0, LAWN.y, 0, LAWN.y + LAWN.h);
    lawnGrad.addColorStop(0, pal.g1);
    lawnGrad.addColorStop(1, pal.g2);
    c.fillStyle = lawnGrad;
    c.fillRect(LAWN.x, LAWN.y, LAWN.w, LAWN.h + 56);

    // mown stripes
    for (var col = 0; col < LAWN.cols; col++) {
      var cxp = LAWN.x + col * LAWN.cw;
      c.fillStyle = col % 2 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,60,0,0.045)';
      c.fillRect(cxp, LAWN.y, LAWN.cw, LAWN.h);
      c.strokeStyle = 'rgba(255,255,255,0.045)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cxp + 0.5, LAWN.y);
      c.lineTo(cxp + 0.5, LAWN.y + LAWN.h);
      c.stroke();
    }

    // horizontal subtle bands
    for (var r = 0; r < LAWN.rows; r++) {
      c.fillStyle = r % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,40,0,0.02)';
      c.fillRect(LAWN.x, LAWN.y + r * LAWN.ch, LAWN.w, LAWN.ch);
    }

    // grass speckles
    var seed = 12345;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < 260; i++) {
      var gx = LAWN.x + rnd() * LAWN.w;
      var gy = LAWN.y + rnd() * LAWN.h;
      c.strokeStyle = 'rgba(30,90,30,' + (0.08 + rnd() * 0.12) + ')';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(gx, gy);
      c.lineTo(gx - 2, gy - 4 - rnd() * 4);
      c.moveTo(gx + 2, gy);
      c.lineTo(gx + 3, gy - 3 - rnd() * 4);
      c.stroke();
    }

    // daisies
    for (var d = 0; d < 16; d++) {
      var dx = LAWN.x + 30 + rnd() * (LAWN.w - 60);
      var dy = LAWN.y + 20 + rnd() * (LAWN.h - 40);
      var pr = 3 + rnd() * 2;
      c.fillStyle = 'rgba(255,255,255,.72)';
      for (var petal = 0; petal < 5; petal++) {
        var pa = petal * TAU / 5;
        c.beginPath();
        c.arc(dx + Math.cos(pa) * pr, dy + Math.sin(pa) * pr, pr * 0.62, 0, TAU);
        c.fill();
      }
      c.fillStyle = '#ffd447';
      c.beginPath();
      c.arc(dx, dy, pr * 0.55, 0, TAU);
      c.fill();
    }

    // lawn border + shadow
    c.save();
    c.strokeStyle = 'rgba(35,80,25,.45)';
    c.lineWidth = 5;
    c.strokeRect(LAWN.x + 1, LAWN.y + 1, LAWN.w - 2, LAWN.h - 2);
    c.restore();

    // bottom grass strip + stone border
    c.fillStyle = pal.g3;
    c.fillRect(0, BOTTOM_Y, W, H - BOTTOM_Y);
    c.fillStyle = 'rgba(0,0,0,.12)';
    c.fillRect(0, BOTTOM_Y, W, 6);

    // right hedge
    c.fillStyle = '#2f6426';
    c.fillRect(W - 8, LAWN.y, 8, LAWN.h + 56);
    c.fillStyle = 'rgba(255,255,255,.08)';
    c.fillRect(W - 8, LAWN.y, 3, LAWN.h + 56);

    // warm tint
    c.fillStyle = pal.tint;
    c.fillRect(0, 0, W, H);

    return cv;
  }

  // ---------------------------------------------------------------- background (paper grid)
  function makeBackground(pal) {
    var cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    var c = cv.getContext('2d');

    // paper base
    var bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, pal.paper);
    bg.addColorStop(1, pal.paper);
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // faint pencil grain
    var seed = 90210;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < 520; i++) {
      var gx = rnd() * W;
      var gy = rnd() * H;
      c.fillStyle = 'rgba(90,80,60,' + (0.012 + rnd() * 0.03) + ')';
      c.fillRect(gx, gy, 1 + rnd() * 2, 1);
    }

    // house roof (visible on menu; hidden behind HUD during play)
    c.fillStyle = '#f0e5d0';
    c.strokeStyle = pal.grid;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, HUD_H + 2);
    c.lineTo(0, 56);
    c.lineTo(105, 56);
    c.lineTo(132, HUD_H + 2);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(70,55,35,.28)';
    c.lineWidth = 1.6;
    for (var r = 0; r < 4; r++) {
      var yy = 66 + r * 11;
      c.beginPath();
      c.moveTo(6, yy);
      c.lineTo(118 - r * 2, yy);
      c.stroke();
    }
    // roof edge
    c.fillStyle = '#d9c8a8';
    c.fillRect(0, HUD_H - 4, 134, 8);
    c.strokeStyle = pal.grid;
    c.lineWidth = 2.5;
    c.strokeRect(0, HUD_H - 4, 134, 8);

    // house wall
    c.fillStyle = pal.wall;
    c.fillRect(0, HUD_H + 4, 100, H - HUD_H - 4);
    c.strokeStyle = 'rgba(80,65,40,.16)';
    c.lineWidth = 1.5;
    for (var sy = HUD_H + 22; sy < H; sy += 22) {
      c.beginPath();
      c.moveTo(0, sy);
      c.lineTo(100, sy);
      c.stroke();
    }

    // window
    c.save();
    c.translate(8, 230);
    c.fillStyle = '#fffdf6';
    c.fillRect(0, 0, 78, 104);
    c.strokeStyle = pal.grid;
    c.lineWidth = 3;
    c.strokeRect(0, 0, 78, 104);
    c.fillStyle = '#bde7ef';
    c.fillRect(6, 6, 66, 92);
    var glass = c.createLinearGradient(6, 6, 72, 98);
    glass.addColorStop(0, 'rgba(255,255,255,.9)');
    glass.addColorStop(0.45, 'rgba(255,255,255,.12)');
    glass.addColorStop(1, 'rgba(130,200,215,.35)');
    c.fillStyle = glass;
    c.fillRect(6, 6, 66, 92);
    c.strokeStyle = '#fffdf6';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(39, 6); c.lineTo(39, 98);
    c.moveTo(6, 52); c.lineTo(72, 52);
    c.stroke();
    c.strokeStyle = pal.grid;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(39, 6); c.lineTo(39, 98);
    c.moveTo(6, 52); c.lineTo(72, 52);
    c.stroke();
    c.fillStyle = 'rgba(245,140,150,.8)';
    c.beginPath();
    c.moveTo(6, 6); c.quadraticCurveTo(20, 30, 10, 98); c.lineTo(6, 98); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(72, 6); c.quadraticCurveTo(58, 30, 68, 98); c.lineTo(72, 98); c.closePath(); c.fill();
    c.restore();

    // flower box
    c.fillStyle = '#a9743f';
    c.strokeStyle = pal.grid;
    c.lineWidth = 2;
    c.fillRect(4, 336, 86, 16);
    c.strokeRect(4, 336, 86, 16);
    var flowerCols = ['#ff8fa3', '#ffd447', '#ff9f5a', '#f77fbe'];
    for (var fi = 0; fi < 6; fi++) {
      var fx = 12 + fi * 13;
      c.strokeStyle = '#4f8c3a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(fx + 4, 336);
      c.lineTo(fx + 4, 324);
      c.stroke();
      c.fillStyle = flowerCols[fi % flowerCols.length];
      c.beginPath();
      c.arc(fx + 4, 320, 5, 0, TAU);
      c.fill();
      c.strokeStyle = pal.grid;
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = '#f7e6a3';
      c.beginPath();
      c.arc(fx + 4, 320, 2, 0, TAU);
      c.fill();
    }

    // door
    c.fillStyle = '#a9743f';
    c.fillRect(18, 470, 64, 150);
    c.strokeStyle = pal.grid;
    c.lineWidth = 3;
    c.strokeRect(18, 470, 64, 150);
    c.fillStyle = '#bf8c52';
    c.fillRect(24, 478, 52, 142);
    c.strokeStyle = 'rgba(60,36,14,.28)';
    c.lineWidth = 2;
    c.strokeRect(30, 492, 40, 40);
    c.strokeRect(30, 546, 40, 60);
    c.fillStyle = '#ffd96b';
    c.strokeStyle = pal.grid;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(66, 560, 4, 0, TAU);
    c.fill();
    c.stroke();

    // path
    c.fillStyle = pal.path;
    c.fillRect(100, HUD_H + 4, 52, H - HUD_H - 4);
    c.strokeStyle = 'rgba(80,65,40,.18)';
    c.lineWidth = 2;
    for (var py = HUD_H + 30; py < H; py += 46) {
      c.beginPath();
      c.moveTo(104, py);
      c.lineTo(148, py);
      c.stroke();
    }

    // lawn base
    c.fillStyle = pal.cellA;
    c.fillRect(LAWN.x, LAWN.y, LAWN.w, LAWN.h);

    // subtle checker cells
    for (var rr = 0; rr < LAWN.rows; rr++) {
      for (var cc = 0; cc < LAWN.cols; cc++) {
        c.fillStyle = (rr + cc) % 2 === 0 ? 'rgba(255,255,255,0.30)' : 'rgba(120,100,60,0.026)';
        c.fillRect(LAWN.x + cc * LAWN.cw, LAWN.y + rr * LAWN.ch, LAWN.cw, LAWN.ch);
      }
    }

    // grid lines
    c.strokeStyle = pal.grid;
    c.lineWidth = 2.2;
    c.lineCap = 'butt';
    for (var gx2 = 0; gx2 <= LAWN.cols; gx2++) {
      var xx = LAWN.x + gx2 * LAWN.cw;
      c.beginPath();
      c.moveTo(xx, LAWN.y);
      c.lineTo(xx, LAWN.y + LAWN.h);
      c.stroke();
    }
    for (var gy2 = 0; gy2 <= LAWN.rows; gy2++) {
      var yy2 = LAWN.y + gy2 * LAWN.ch;
      c.beginPath();
      c.moveTo(LAWN.x, yy2);
      c.lineTo(LAWN.x + LAWN.w, yy2);
      c.stroke();
    }

    // outer panel border (comic frame)
    c.strokeStyle = pal.grid;
    c.lineWidth = 4.5;
    c.strokeRect(LAWN.x - 1.5, LAWN.y - 1.5, LAWN.w + 3, LAWN.h + 3);
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(50,45,35,.55)';
    c.beginPath();
    c.moveTo(LAWN.x - 2, LAWN.y - 2);
    c.lineTo(LAWN.x + LAWN.w + 2, LAWN.y - 2);
    c.moveTo(LAWN.x - 2, LAWN.y - 2);
    c.lineTo(LAWN.x - 2, LAWN.y + LAWN.h + 2);
    c.stroke();

    // house / path / lawn separators
    c.strokeStyle = pal.grid;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(100, HUD_H + 4);
    c.lineTo(100, H);
    c.stroke();
    c.lineWidth = 4.5;
    c.beginPath();
    c.moveTo(LAWN.x - 1.5, LAWN.y - 1.5);
    c.lineTo(LAWN.x - 1.5, LAWN.y + LAWN.h + 2);
    c.stroke();

    // warm tint
    c.fillStyle = pal.tint;
    c.fillRect(0, 0, W, H);

    return cv;
  }

  // ---------------------------------------------------------------- audio hooks
  function sfx(name) {
    if (G.silent) return;
    if (window.SFX && SFX[name]) {
      try { SFX[name](); } catch (e) {}
    }
  }

  // ---------------------------------------------------------------- entities
  function newPlant(type, c, r) {
    var cfg = PLANTS[type];
    var p = {
      type: type, col: c, row: r,
      x: cellCX(c), y: rowBase(r),
      hp: cfg.hp, maxHp: cfg.hp,
      animT: Math.random() * 3,
      plantT: 0,
      fireT: 0.3,
      attackAnimT: -1,
      attackFired: false,
      produceT: cfg.first || 6,
      produceAnim: -1,
      produceSun: false,
      shots: 0,
      ultActive: false,
      ultT: 0,
      ultFireT: 0,
      armed: false,
      armT: 0,
      attacking: false,
      glow: 0,
      dead: false
    };
    return p;
  }

  function spawnPlantSun(p) {
    var cfg = PLANTS[p.type];
    var targetY = p.y - 14;
    G.suns.push({
      mode: 'hop',
      x: p.x,
      y: p.y - cfg.h * 0.72,
      vx: rand(-42, 42),
      vy: -210,
      targetY: targetY,
      age: 0,
      phase: Math.random() * TAU,
      landT: 0
    });
    p.glow = 0.9;
  }

  function spawnSkySun() {
    var x = LAWN.x + 50 + Math.random() * (LAWN.w - 100);
    var ty = LAWN.y + 80 + Math.random() * (LAWN.h - 190);
    if (G.suns.length > 14) return;
    G.suns.push({
      mode: 'sky',
      x: x, sx: x, y: -28,
      targetY: ty,
      age: 0,
      phase: Math.random() * TAU,
      landT: 0
    });
  }

  function collectSun(s) {
    if (s.mode === 'fly') return;
    G.sun += 25;
    G.stats.sun += 25;
    s.mode = 'fly';
    s.flyT = 0;
    s.fromX = s.x;
    s.fromY = s.y;
    G.texts.push({ x: s.x, y: s.y - 10, text: '+25', t: 0, dur: 0.8, color: '#ffe27a', size: 26 });
    burst(s.x, s.y, '#ffd84a', 10, 170, 3, 120, 0.55);
    sfx('sun');
  }

  function burst(x, y, color, count, speed, size, gravity, life) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * TAU;
      var sp = speed * (0.35 + Math.random() * 0.8);
      G.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (gravity || 0) * 0.12,
        color: color,
        size: size * (0.6 + Math.random() * 0.8),
        life: life * (0.7 + Math.random() * 0.6),
        max: life,
        grav: gravity || 0,
        rot: Math.random() * TAU,
        spin: rand(-6, 6)
      });
    }
  }

  function addExplosion(x, y, radius) {
    G.explosions.push({ x: x, y: y, r: radius, t: 0, dur: 0.7 });
    burst(x, y, '#ffd35a', 26, 320, 5, 260, 0.9);
    burst(x, y, '#ff8a3c', 18, 250, 6, 180, 0.8);
    burst(x, y, 'rgba(60,50,40,1)', 10, 160, 9, 140, 1.1);
  }

  function spawnZombie(type, lane) {
    var cfg = ZOMBIES[type];
    var z = {
      type: type,
      row: lane,
      x: W + 58 + Math.random() * 20,
      hp: cfg.hp,
      maxHp: cfg.hp,
      speed: cfg.speed,
      animT: Math.random() * 2,
      eating: false,
      eatPlant: null,
      chompT: 0,
      chompSnd: Math.random() * 0.4,
      dead: false,
      deadT: 0,
      flash: 0,
      sway: Math.random() * TAU
    };
    G.zombies.push(z);
    return z;
  }

  function pickLane() {
    var r = Math.floor(Math.random() * LAWN.rows);
    if (r === G.lastLane) {
      r = (r + 1 + Math.floor(Math.random() * (LAWN.rows - 1))) % LAWN.rows;
    }
    G.lastLane = r;
    return r;
  }

  function startWave(w, index) {
    G.wavesStarted = index + 1;
    var list = [];
    for (var type in w.list) {
      for (var i = 0; i < w.list[type]; i++) list.push(type);
    }
    for (var j = list.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = list[j]; list[j] = list[k]; list[k] = t;
    }
    var at = G.time + 0.25;
    for (var n = 0; n < list.length; n++) {
      G.spawnQueue.push({ type: list[n], lane: pickLane(), at: at + n * (w.huge ? 0.5 : 0.85) });
    }
    if (w.flag) {
      G.banner = {
        text: w.huge ? 'Đợt zombie cuối cùng khổng lồ đã đến!' : 'Một đợt zombie lớn đang đến gần!',
        t: 0, dur: 3.0, huge: !!w.huge
      };
      sfx('wave');
      if (w.huge) G.shake = Math.max(G.shake, 6);
    }
  }

  function activateMower(row) {
    var m = G.mowers[row];
    if (!m || m.state !== 'idle') return;
    m.state = 'run';
    m.hitT = 0;
    G.shake = Math.max(G.shake, 5);
    sfx('mower');
  }

  function zombieKey(z) {
    if (z.eating && z.type === 'normal') return 'zombie_eat';
    if (z.type === 'bucket') {
      if (z.hp > 570) return 'zombie_bucket';
      if (z.hp > 200) return 'zombie_cone';
      return 'zombie_normal';
    }
    if (z.type === 'cone') {
      return z.hp > 200 ? 'zombie_cone' : 'zombie_normal';
    }
    return 'zombie_normal';
  }

  function zHeight(key) {
    if (key === 'zombie_eat') return 180;
    if (key === 'zombie_bucket') return 214;
    if (key === 'zombie_cone') return 212;
    return 188;
  }

  function damageZombie(z, dmg, hx, hy) {
    if (z.dead) return;
    z.hp -= dmg;
    z.flash = 0.14;
    if (hx !== undefined) {
      burst(hx, hy, '#fff6c8', 5, 130, 2, 260, 0.28);
      burst(hx, hy, '#ffd75a', 3, 90, 2, 180, 0.22);
      G.hitFx.push({ x: hx, y: hy, t: 0, dur: 0.2 });
    }
    if (G.hitSnd <= 0) { sfx('hit'); G.hitSnd = 0.07; }
    if (z.hp <= 0) {
      z.hp = 0;
      z.dead = true;
      z.deadT = 0;
      z.eating = false;
      z.eatPlant = null;
      G.stats.kills++;
      burst(z.x, rowBase(z.row) - zHeight(zombieKey(z)) * 0.45, '#efe7d8', 8, 160, 3, 220, 0.6);
      sfx('zombieDie');
    }
  }

  function killPlant(p) {
    var i = G.plants.indexOf(p);
    if (i >= 0) G.plants.splice(i, 1);
    p.hp = 0;
    burst(p.x, p.y - 24, '#8ccf4e', 9, 120, 3, 200, 0.55);
    burst(p.x, p.y - 20, 'rgba(60,40,20,1)', 4, 80, 2, 160, 0.4);
  }

  function removePlantByShovel(p) {
    var i = G.plants.indexOf(p);
    if (i >= 0) G.plants.splice(i, 1);
    p.hp = 0;
    burst(p.x, p.y - 20, '#c7a46a', 8, 110, 3, 180, 0.5);
    sfx('shovel');
  }

  function firePea(p) {
    G.projectiles.push({
      x: p.x + 24,
      y: p.y - 50,
      row: p.row,
      dmg: PLANTS.peashooter.dmg,
      type: 'coin',
      spin: Math.random() * TAU
    });
    burst(p.x + 30, p.y - 50, '#ffd76a', 4, 90, 2, 60, 0.3);
    sfx('shoot');
  }

  function startUltimate(p) {
    var cfg = PLANTS.peashooter;
    p.ultActive = true;
    p.ultT = cfg.ultDur;
    p.ultFireT = 0;
    p.shots = 0;
    p.attackAnimT = -1;
    p.attackFired = false;
    p.attacking = true;
    p.glow = 1;
    G.texts.push({ x: p.x, y: p.y - 142, text: 'Đại chiêu rải tiền!', t: 0, dur: 1.5, color: '#8dff6a', size: 26 });
    burst(p.x, p.y - 66, '#7dff5a', 16, 240, 4, 150, 0.9);
    burst(p.x, p.y - 66, '#ffd75a', 14, 200, 3, 120, 0.9);
    spawnMoneyFan(p, 14);
    G.shake = Math.max(G.shake, 4);
    sfx('ultimate');
  }

  function spawnMoneyFan(p, count) {
    for (var i = 0; i < count; i++) {
      var type = Math.random() < 0.5 ? 'bill' : 'coin';
      var ang = -0.75 + Math.random() * 1.5;
      var sp = 150 + Math.random() * 200;
      G.moneyFx.push({
        x: p.x + 26,
        y: p.y - 66,
        vx: Math.cos(ang) * sp + 100,
        vy: Math.sin(ang) * sp,
        rot: Math.random() * TAU,
        vr: rand(-7, 7),
        type: type,
        age: 0,
        life: 0.8 + Math.random() * 0.6,
        scale: 0.85 + Math.random() * 0.5
      });
    }
  }

  function fireUltimate(p) {
    var cfg = PLANTS.peashooter;
    for (var d = -1; d <= 1; d++) {
      var rr = p.row + d;
      if (rr < 0 || rr >= LAWN.rows) continue;
      G.projectiles.push({
        x: p.x + 24,
        y: rowBase(rr) - 72,
        row: rr,
        dmg: cfg.ultBillDmg,
        type: 'bill',
        spin: Math.random() * TAU
      });
      G.projectiles.push({
        x: p.x + 34,
        y: rowBase(rr) - 50,
        row: rr,
        dmg: cfg.ultCoinDmg,
        type: 'coin',
        spin: Math.random() * TAU
      });
    }
    burst(p.x + 30, p.y - 66, '#b6ff6a', 6, 130, 2, 90, 0.4);
    burst(p.x + 36, p.y - 60, '#ffd75a', 5, 110, 2, 90, 0.4);
    spawnMoneyFan(p, 2);
    sfx('shoot');
  }

  function zombieInLane(row, minX) {
    for (var i = 0; i < G.zombies.length; i++) {
      var z = G.zombies[i];
      if (!z.dead && z.row === row && z.x > minX - 20) return true;
    }
    return false;
  }

  function triggerPotatoBoom(p) {
    var cfg = PLANTS.potatomine;
    var px = p.x, py = p.y;
    var i = G.plants.indexOf(p);
    if (i >= 0) G.plants.splice(i, 1);
    p.hp = 0;

    var info = Assets.meta[cfg.boomKey];
    var startMs = (info && info.cum && info.cum[17]) ? info.cum[17] : 900;
    var totalMs = (info && info.total) ? info.total : (startMs + 900);
    G.mineBooms.push({
      x: px, y: py, start: startMs, animT: 0,
      dur: Math.max(0.2, (totalMs - startMs) / 1000)
    });

    for (var j = G.zombies.length - 1; j >= 0; j--) {
      var z = G.zombies[j];
      if (!z.dead && z.row === p.row && Math.abs(z.x - px) < cfg.radius + 20) {
        damageZombie(z, cfg.dmg, z.x, rowBase(z.row) - 70);
      }
    }
    G.shake = Math.max(G.shake, 11);
    sfx('boom');
    burst(px, py - 40, '#ffd35a', 20, 260, 5, 220, 0.9);
    burst(px, py - 40, '#ff8a3c', 14, 220, 6, 180, 0.8);
    burst(px, py - 40, 'rgba(70,60,45,1)', 8, 140, 8, 120, 1.1);
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    G.time += dt;
    G.introT += dt;
    G.stateT += dt;
    G.shake = Math.max(0, G.shake - dt * 32);
    G.hitSnd = Math.max(0, G.hitSnd - dt);

    for (var k in G.recharge) {
      if (G.recharge[k] > 0) G.recharge[k] = Math.max(0, G.recharge[k] - dt);
    }

    G.sunTimer -= dt;
    if (G.sunTimer <= 0) {
      spawnSkySun();
      G.sunTimer = 8 + Math.random() * 2.5;
    }

    var waves = G.levelCfg.waves;
    if (G.nextWave < waves.length && G.time >= waves[G.nextWave].at) {
      startWave(waves[G.nextWave], G.nextWave);
      G.nextWave++;
    }

    for (var qi = G.spawnQueue.length - 1; qi >= 0; qi--) {
      var q = G.spawnQueue[qi];
      if (G.time >= q.at) {
        spawnZombie(q.type, q.lane);
        G.spawnQueue.splice(qi, 1);
      }
    }

    updatePlants(dt);
    updateProjectiles(dt);
    updateHitFx(dt);
    updateZombies(dt);
    updateSuns(dt);
    updateMowers(dt);
    updateMineBooms(dt);
    updateEffects(dt);

    if (G.nextWave >= waves.length && G.spawnQueue.length === 0 && G.zombies.length === 0) {
      G.clearT += dt;
      if (G.clearT > 1.1 && G.state === 'playing') winLevel();
    } else {
      G.clearT = 0;
    }
  }

  function updatePlants(dt) {
    for (var i = G.plants.length - 1; i >= 0; i--) {
      var p = G.plants[i];
      var cfg = PLANTS[p.type];
      p.animT += dt;
      p.plantT += dt;
      if (p.glow > 0) p.glow -= dt;

      if (p.type === 'sunflower') {
        if (p.produceAnim >= 0) {
          p.produceAnim += dt;
          var pdur = (Assets.meta.sunflower_produce && Assets.meta.sunflower_produce.total)
            ? Assets.meta.sunflower_produce.total / 1000 : 3.2;
          if (!p.produceSun && p.produceAnim >= 1.35) {
            p.produceSun = true;
            spawnPlantSun(p);
            p.glow = 0.9;
          }
          if (p.produceAnim >= pdur) p.produceAnim = -1;
        }
        p.produceT -= dt;
        if (p.produceT <= 0 && p.produceAnim < 0) {
          p.produceT = cfg.interval;
          p.produceAnim = 0;
          p.produceSun = false;
        }
      } else if (p.type === 'peashooter') {
        var hasTarget = zombieInLane(p.row, p.x);
        var atkInfo = Assets.meta.peashooter_attack;
        var atkTotal = (atkInfo && atkInfo.total) ? atkInfo.total / 1000 : 1.54;
        if (p.ultActive) {
          p.attacking = true;
          p.ultT -= dt;
          p.ultFireT -= dt;
          if (p.ultFireT <= 0) {
            fireUltimate(p);
            p.ultFireT = cfg.ultRate;
          }
          if (p.ultT <= 0) {
            p.ultActive = false;
            p.attacking = false;
            p.fireT = 0.3;
            p.attackAnimT = -1;
          }
        } else if (p.attackAnimT >= 0) {
          p.attacking = true;
          p.attackAnimT += dt;
          if (!p.attackFired && p.attackAnimT >= atkTotal - 0.08) {
            p.attackFired = true;
            firePea(p);
            p.shots++;
            if (p.shots >= cfg.ultShots) startUltimate(p);
          }
          if (p.attackAnimT >= atkTotal) {
            p.attackAnimT = -1;
            p.attacking = false;
            p.fireT = Math.max(0.05, cfg.rate - atkTotal);
          }
        } else if (p.shotWait > 0) {
          p.attacking = false;
          p.shotWait -= dt;
          if (p.shotWait <= 0) {
            p.shotWait = 0;
            firePea(p);
            p.shots++;
            if (p.shots >= cfg.ultShots) startUltimate(p);
            p.fireT = Math.max(0.05, cfg.rate - atkTotal);
          }
        } else {
          p.attacking = false;
          p.fireT -= dt;
          if (hasTarget && p.fireT <= 0) {
            p.attackAnimT = 0;
            p.attackFired = false;
            p.attacking = true;
          }
        }
      } else if (p.type === 'potatomine') {
        if (!p.armed) {
          p.armT += dt;
          if (p.armT >= cfg.arm) {
            p.armed = true;
            burst(p.x, p.y - 56, '#ffd35a', 10, 90, 2, -30, 0.5);
            sfx('arm');
          }
        } else {
          for (var j = 0; j < G.zombies.length; j++) {
            var z = G.zombies[j];
            if (!z.dead && z.row === p.row && Math.abs(z.x - p.x) < 72) {
              triggerPotatoBoom(p);
              break;
            }
          }
        }
      }
    }
  }

  function updateProjectiles(dt) {
    for (var i = G.projectiles.length - 1; i >= 0; i--) {
      var p = G.projectiles[i];
      p.x += 520 * dt;
      p.spin += dt * 12;
      var best = null;
      var bx = Infinity;
      for (var j = 0; j < G.zombies.length; j++) {
        var z = G.zombies[j];
        if (!z.dead && z.row === p.row && p.x >= z.x - 44 && p.x <= z.x + 30 && z.x < bx) {
          best = z;
          bx = z.x;
        }
      }
      if (best) {
        damageZombie(best, p.dmg, p.x, p.y);
        G.projectiles.splice(i, 1);
      } else if (p.x > W + 50) {
        G.projectiles.splice(i, 1);
      }
    }
  }

  function updateZombies(dt) {
    for (var i = G.zombies.length - 1; i >= 0; i--) {
      var z = G.zombies[i];
      if (z.dead) {
        z.deadT += dt;
        if (z.deadT > 1.15) G.zombies.splice(i, 1);
        continue;
      }
      z.animT += dt;
      if (z.flash > 0) z.flash -= dt;

      if (z.eating) {
        var plant = z.eatPlant;
        if (!plant || plant.hp <= 0) {
          z.eating = false;
          z.eatPlant = null;
        } else {
          plant.hp -= 90 * dt;
          z.chompSnd -= dt;
          if (z.chompSnd <= 0) {
            z.chompSnd = 0.55 + Math.random() * 0.4;
            sfx('chomp');
            burst(plant.x + 14, plant.y - 36, '#9ad35f', 2, 50, 2, 160, 0.3);
          }
          if (plant.hp <= 0) {
            killPlant(plant);
            z.eating = false;
            z.eatPlant = null;
          }
        }
      }

      if (!z.eating) {
        var target = null;
        for (var j = 0; j < G.plants.length; j++) {
          var pl = G.plants[j];
          if (pl.row === z.row && Math.abs(pl.x - z.x) < 58) {
            target = pl;
            break;
          }
        }
        if (target) {
          z.eating = true;
          z.eatPlant = target;
        } else {
          z.x -= z.speed * dt;
          if (z.x < LAWN.x + 28) {
            var m = G.mowers[z.row];
            if (m && m.state === 'idle') activateMower(z.row);
          }
          if (z.x < 46) {
            if (G.state === 'playing') loseGame();
            z.x = 46;
          }
        }
      }
    }
  }

  function updateSuns(dt) {
    for (var i = G.suns.length - 1; i >= 0; i--) {
      var s = G.suns[i];
      if (s.mode === 'fly') {
        s.flyT += dt;
        if (s.flyT > 0.45) G.suns.splice(i, 1);
        continue;
      }
      s.age += dt;
      if (s.mode === 'sky') {
        s.y += 58 * dt;
        s.x = s.sx + Math.sin(s.age * 1.35 + s.phase) * 15;
        if (s.y >= s.targetY) {
          s.y = s.targetY;
          s.mode = 'idle';
          s.landT = 0;
        }
      } else if (s.mode === 'hop') {
        s.vy += 760 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.vy > 0 && s.y >= s.targetY) {
          s.y = s.targetY;
          s.mode = 'idle';
          s.landT = 0;
          burst(s.x, s.y + 8, '#ffe48a', 4, 60, 2, 60, 0.3);
        }
      } else {
        s.landT += dt;
        if (G.autoSun && s.landT > 0.5) {
          collectSun(s);
          continue;
        }
        if (s.landT > 10) {
          burst(s.x, s.y, '#ffe48a', 5, 60, 2, 40, 0.4);
          G.suns.splice(i, 1);
        }
      }
    }
  }

  function updateMowers(dt) {
    for (var i = 0; i < G.mowers.length; i++) {
      var m = G.mowers[i];
      if (m.state === 'run') {
        m.animT += dt * 2.2;
        m.x += 760 * dt;
        for (var j = G.zombies.length - 1; j >= 0; j--) {
          var z = G.zombies[j];
          if (!z.dead && z.row === m.row && Math.abs(z.x - m.x) < 74 && z.x > 90) {
            damageZombie(z, 99999, z.x, rowBase(z.row) - 70);
          }
        }
        if (Math.random() < dt * 22) {
          burst(m.x - 30, rowBase(m.row) - 10, '#c9b98f', 2, 80, 2, 120, 0.35);
        }
        if (m.x > W + 160) m.state = 'gone';
      }
    }
  }

  function updateMineBooms(dt) {
    for (var i = G.mineBooms.length - 1; i >= 0; i--) {
      var b = G.mineBooms[i];
      b.animT += dt;
      if (b.animT > b.dur) G.mineBooms.splice(i, 1);
    }
  }

  function updateEffects(dt) {
    var i;
    for (i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      p.life -= dt;
      if (p.life <= 0) { G.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (i = G.texts.length - 1; i >= 0; i--) {
      var t = G.texts[i];
      t.t += dt;
      if (t.t > t.dur) G.texts.splice(i, 1);
    }
    for (i = G.explosions.length - 1; i >= 0; i--) {
      var e = G.explosions[i];
      e.t += dt;
      if (e.t > e.dur) G.explosions.splice(i, 1);
    }
    for (i = G.moneyFx.length - 1; i >= 0; i--) {
      var f = G.moneyFx[i];
      f.age += dt;
      if (f.age > f.life) { G.moneyFx.splice(i, 1); continue; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 46 * dt;
      f.rot += f.vr * dt;
    }
  }

  // ---------------------------------------------------------------- win / lose
  function winLevel() {
    if (G.state !== 'playing' || G.testMode) return;
    var stars = starCount();
    var key = String(G.level);
    if (!G.stars[key] || G.stars[key] < stars) G.stars[key] = stars;
    if (G.level + 1 < LEVELS.length) {
      G.unlocked = Math.max(G.unlocked, G.level + 2);
    }
    G.unlocked = Math.min(G.unlocked, LEVELS.length);
    saveProgress();
    G.finalStats = {
      stars: stars,
      time: G.time,
      kills: G.stats.kills,
      sun: G.stats.sun,
      planted: G.stats.planted
    };
    setState('won');
    sfx('win');
  }

  function loseGame() {
    if (G.state !== 'playing' || G.testMode) return;
    G.finalStats = {
      stars: 0,
      time: G.time,
      kills: G.stats.kills,
      sun: G.stats.sun,
      mowers: G.mowers.filter(function (m) { return m.state === 'idle'; }).length
    };
    setState('lost');
    sfx('lose');
  }

  // ---------------------------------------------------------------- level control
  function startLevel(index) {
    G.level = index;
    G.levelCfg = LEVELS[index];
    G.pal = PALETTES[G.levelCfg.pal];
    G.bg = makeBackground(G.pal);
    G.sun = G.levelCfg.sun;
    G.time = 0;
    G.introT = 0;
    G.clearT = 0;
    G.shake = 0;
    G.plants = [];
    G.zombies = [];
    G.projectiles = [];
    G.hitFx = [];
    G.suns = [];
    G.particles = [];
    G.explosions = [];
    G.mineBooms = [];
    G.moneyFx = [];
    G.texts = [];
    G.flies = [];
    G.hoverPlant = null;
    G.mowers = [];
    for (var r = 0; r < LAWN.rows; r++) {
      G.mowers.push({ row: r, x: 116, baseY: rowBase(r), state: 'idle', animT: r * 0.4 });
    }
    G.recharge = {};
    for (var i = 0; i < G.levelCfg.plants.length; i++) G.recharge[G.levelCfg.plants[i]] = 0;
    G.selected = null;
    G.nextWave = 0;
    G.wavesStarted = 0;
    G.spawnQueue = [];
    G.banner = null;
    G.sunTimer = 3.4;
    G.hitSnd = 0;
    G.lastLane = -1;
    G.stats = { kills: 0, planted: 0, sun: 0 };
    G.finalStats = null;
    G.demo = false;
    G.testMode = false;
    setState('playing');
  }

  function restartLevel() {
    startLevel(G.level);
  }

  // ---------------------------------------------------------------- actions
  function seedCooldown(type) {
    return G.cheatNoCooldown ? 0 : (G.recharge[type] || 0);
  }

  function tryPlant(type, c, r) {
    var cfg = PLANTS[type];
    if (G.sun < cfg.cost) { sfx('error'); return; }
    if (seedCooldown(type) > 0) { sfx('error'); return; }
    for (var i = 0; i < G.plants.length; i++) {
      if (G.plants[i].col === c && G.plants[i].row === r) { sfx('error'); return; }
    }
    G.sun -= cfg.cost;
    G.recharge[type] = cfg.cooldown;
    var p = newPlant(type, c, r);
    G.plants.push(p);
    G.stats.planted++;
    G.texts.push({ x: p.x, y: p.y - 70, text: '-' + cfg.cost, t: 0, dur: 0.7, color: '#fff3b0', size: 20 });
    burst(p.x, p.y - 10, '#b8e986', 8, 90, 2, 160, 0.45);
    sfx('plant');
    G.selected = null;
  }

  function selectSeed(type) {
    if (G.state !== 'playing') return;
    if (G.selected === type) { G.selected = null; sfx('click'); return; }
    var cfg = PLANTS[type];
    if (G.sun < cfg.cost || seedCooldown(type) > 0) { sfx('error'); return; }
    G.selected = type;
    sfx('click');
  }

  function selectShovel() {
    if (G.state !== 'playing') return;
    G.selected = G.selected === 'shovel' ? null : 'shovel';
    sfx('click');
  }

  function cancelSelection() {
    if (G.selected) {
      G.selected = null;
      sfx('click');
    }
  }

  function gameplayClick(p) {
    var best = null;
    var bd = 46 * 46;
    for (var i = 0; i < G.suns.length; i++) {
      var s = G.suns[i];
      if (s.mode === 'fly') continue;
      var d = dist2(p.x, p.y, s.x, s.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) { collectSun(best); return; }

    var cell = cellAt(p.x, p.y);
    if (G.selected === 'shovel') {
      if (cell) {
        for (var j = 0; j < G.plants.length; j++) {
          var pl = G.plants[j];
          if (pl.col === cell.c && pl.row === cell.r) {
            removePlantByShovel(pl);
            G.selected = null;
            break;
          }
        }
      }
      return;
    }
    if (G.selected) {
      if (cell) tryPlant(G.selected, cell.c, cell.r);
      else G.selected = null;
    }
  }

  function togglePause() {
    if (G.state === 'playing') {
      setState('paused');
      sfx('click');
    } else if (G.state === 'paused') {
      setState('playing');
      sfx('click');
    }
  }

  function toggleMute() {
    SFX.toggleMute();
  }

  // ---------------------------------------------------------------- input
  function toGame(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }

  function updateCursor() {
    if (G.state === 'playing' && G.selected === 'shovel' && !G.cheatOpen) {
      canvas.style.cursor = 'none';
      return;
    }
    var m = G.mouse;
    var pointer = false;
    for (var i = G.buttons.length - 1; i >= 0; i--) {
      if (inside(m, G.buttons[i])) { pointer = true; break; }
    }
    if (G.state === 'playing' && !pointer) {
      for (var j = 0; j < G.suns.length; j++) {
        if (G.suns[j].mode !== 'fly' && dist2(m.x, m.y, G.suns[j].x, G.suns[j].y) < 46 * 46) { pointer = true; break; }
      }
    }
    if (pointer) canvas.style.cursor = 'pointer';
    else if (G.state === 'playing' && G.selected) canvas.style.cursor = 'copy';
    else canvas.style.cursor = 'default';
  }

  canvas.addEventListener('pointermove', function (e) {
    G.mouse = toGame(e);
    updateCursor();
  });
  canvas.addEventListener('pointerleave', function () {
    G.mouse = { x: -999, y: -999 };
  });
  canvas.addEventListener('pointerdown', function (e) {
    SFX.unlock();
    if (e.button === 2) { cancelSelection(); return; }
    var p = toGame(e);
    G.mouse = p;
    handleClick(p);
    updateCursor();
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function handleClick(p) {
    if (G.state === 'loading' || G.state === 'error') return;
    for (var i = G.buttons.length - 1; i >= 0; i--) {
      var b = G.buttons[i];
      if (inside(p, b)) {
        if (b.onClick) b.onClick();
        return;
      }
    }
    if (G.state === 'playing' && !G.cheatOpen) gameplayClick(p);
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (G.state === 'playing' && G.cheatOpen) { G.cheatOpen = false; e.preventDefault(); }
      else if (G.selected) { cancelSelection(); e.preventDefault(); }
      else if (G.state === 'playing') { togglePause(); e.preventDefault(); }
      else if (G.state === 'paused') { togglePause(); e.preventDefault(); }
      else if (G.state === 'help') { setState('menu'); e.preventDefault(); }
      else if (G.state === 'levels') { setState('menu'); e.preventDefault(); }
    } else if (e.key === ' ') {
      if (G.state === 'playing' || G.state === 'paused') { togglePause(); e.preventDefault(); }
    } else if (e.key === 'm' || e.key === 'M') {
      toggleMute();
    } else if (e.key >= '1' && e.key <= '4' && G.state === 'playing') {
      var idx = parseInt(e.key, 10) - 1;
      if (idx < G.levelCfg.plants.length) selectSeed(G.levelCfg.plants[idx]);
    }
  });

  // ---------------------------------------------------------------- loop
  var lastTs = performance.now();
  function loop(ts) {
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.06) dt = 0.06;
    G.uiT += dt;
    G.stateT += dt;

    if (G.state === 'playing' && !G.demo && !G.cheatOpen) update(dt);
    if (G.banner && G.state === 'playing' && !G.cheatOpen) {
      G.banner.t += dt;
      if (G.banner.t > G.banner.dur) G.banner = null;
    }

    render();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- render
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    G.buttons.length = 0;

    if (G.state === 'loading' || G.state === 'error') { drawLoading(); return; }
    if (G.state === 'test') { drawTestReport(); drawError(); return; }
    if (G.state === 'menu') { drawMenu(); drawError(); return; }
    if (G.state === 'levels') { drawMenuBase(); drawLevelSelect(); drawError(); return; }
    if (G.state === 'help') { drawMenuBase(); drawHelp(); drawError(); return; }

    drawScene();
    drawHUD();
    if (G.state === 'playing') drawIntroHint();
    if (G.state === 'playing' && G.selected === 'shovel' && !G.cheatOpen) drawShovelCursor();
    if (G.state === 'paused') drawPause();
    else if (G.state === 'won') drawWin();
    else if (G.state === 'lost') drawLose();

    if (G.tooltip) drawTooltip();
    drawError();
  }

  function drawError() {
    var msg = loadError || G.loadError;
    if (!msg) return;
    ctx.save();
    ctx.fillStyle = 'rgba(80,0,0,.9)';
    ctx.fillRect(0, H - 90, W, 90);
    ctx.fillStyle = '#ffd0d0';
    ctx.font = '600 18px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('Đã xảy ra lỗi: ' + msg.split('\n')[0], 24, H - 50);
    ctx.restore();
  }

  // ---------------------------------------------------------------- loading
  function drawLoading() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c5a35');
    g.addColorStop(1, '#122a1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    txt('Cây vs Zombie', W / 2, 280, 64, '#f7f0b8', {
      align: 'center', stroke: '#3a2510', sw: 10, shadow: 'rgba(0,0,0,.4)', blur: 12, oy: 6
    });
    txt('Phiên bản Q · Tower Defense', W / 2, 330, 24, '#a9e08a', { align: 'center' });

    var bw = 520, bh = 22, bx = (W - bw) / 2, by = 400;
    fillRR(bx, by, bw, bh, 11, 'rgba(0,0,0,.35)');
    var p = G.state === 'error' ? 1 : G.loadingP;
    fillRR(bx + 3, by + 3, Math.max(0, (bw - 6) * p), bh - 6, 8, '#8fd45e');
    strokeRR(bx, by, bw, bh, 11, 'rgba(255,255,255,.35)', 2);

    txt(G.state === 'error' ? 'Tải tài nguyên thất bại' : 'Đang đánh thức các nhân vật Q…', W / 2, 458, 18, '#d8efc6', { align: 'center' });

    if (G.state === 'error') {
      txt('Vui lòng dùng run_game.bat để khởi động game,', W / 2, 512, 17, '#ffd0d0', { align: 'center' });
      txt('hoặc đặt toàn bộ thư mục PvZGame lên máy chủ nội bộ.', W / 2, 540, 17, '#ffd0d0', { align: 'center' });
      var lines = wrapText(G.loadError || '', 800, 14);
      for (var i = 0; i < Math.min(lines.length, 4); i++) {
        txt(lines[i], W / 2, 580 + i * 22, 14, 'rgba(255,220,220,.8)', { align: 'center', weight: 400 });
      }
    } else {
      drawSunIcon(W / 2, 520, 26, G.uiT * 0.6);
    }
    drawError();
  }

  // ---------------------------------------------------------------- test report
  function drawTestReport() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c5a35');
    g.addColorStop(1, '#10251a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var x = 200, y = 34, w = 880, h = 692;
    overlayCard(x, y, w, h);
    txt('Báo cáo tự kiểm tra', W / 2, y + 56, 40, '#4c2f12', { align: 'center' });
    txt('Kiểm thử tự động logic gameplay cốt lõi', W / 2, y + 84, 15, '#8a6134', { align: 'center', weight: 500 });

    var results = G.testResults || [];
    var fails = 0;
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (!r.ok) fails++;
      var ry = y + 96 + i * 24;
      ctx.save();
      ctx.fillStyle = r.ok ? '#5aa832' : '#c23c2c';
      ctx.beginPath();
      ctx.arc(x + 60, ry - 5, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 10px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.ok ? 'OK' : 'X', x + 60, ry - 4);
      ctx.restore();
      txt(r.name, x + 82, ry, 15, '#4c2f12', { weight: 600 });
      txt(r.extra, x + w - 54, ry, 12, r.ok ? '#7a5b35' : '#c23c2c', { align: 'right', weight: 500 });
    }

    ctx.fillStyle = fails ? 'rgba(194,60,44,.12)' : 'rgba(90,168,50,.14)';
    ctx.fillRect(x + 40, y + h - 96, w - 80, 50);
    txt(fails ? ('Có ' + fails + ' mục chưa đạt') : 'Tất cả bài kiểm tra đều đạt · Sẵn sàng chơi', W / 2, y + h - 62, 20,
      fails ? '#a3301f' : '#3d6b1e', { align: 'center' });
    txt('Mở lại index.html để về game', W / 2, y + h - 22, 13, 'rgba(120,95,55,.8)', {
      align: 'center', weight: 500
    });
  }

  // ---------------------------------------------------------------- sun art
  function drawSunIcon(cx, cy, r, t) {
    var sunImg = Assets.ui ? (r < 10 ? Assets.ui('sun_orb') : Assets.ui('sun')) : null;
    if (sunImg) {
      ctx.save();
      ctx.translate(cx, cy);
      var glowSize = r * (r < 10 ? 1.9 : 2.6);
      var gg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, glowSize);
      gg.addColorStop(0, 'rgba(255,222,120,.42)');
      gg.addColorStop(1, 'rgba(255,222,120,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, glowSize, 0, TAU);
      ctx.fill();
      ctx.rotate((t || 0) * 0.4);
      var hh = r * (r < 10 ? 2.0 : 2.35);
      var ww = hh * sunImg.width / sunImg.height;
      ctx.drawImage(sunImg, -ww / 2, -hh / 2, ww, hh);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.save();
    ctx.rotate(t || 0);
    ctx.fillStyle = 'rgba(255,214,58,.55)';
    for (var i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.beginPath();
      ctx.moveTo(-r * 0.24, -r * 0.9);
      ctx.lineTo(0, -r * 1.45);
      ctx.lineTo(r * 0.24, -r * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    var glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.9);
    glow.addColorStop(0, 'rgba(255,230,120,.55)');
    glow.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, TAU);
    ctx.fill();

    var body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.16, 0, 0, r);
    body.addColorStop(0, '#fffbe0');
    body.addColorStop(0.45, '#ffe05c');
    body.addColorStop(1, '#f6ae1f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,120,10,.55)';
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.stroke();

    ctx.fillStyle = '#8a5a14';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.08, r * 0.09, 0, TAU);
    ctx.arc(r * 0.3, -r * 0.08, r * 0.09, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a5a14';
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.beginPath();
    ctx.arc(0, r * 0.03, r * 0.32, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- world
  function drawScene() {
    ctx.save();
    if (G.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    }
    if (G.bg) ctx.drawImage(G.bg, 0, 0);

    if (G.pal.fireflies) drawFireflies();

    G.hoverPlant = null;
    if (G.state === 'playing' && G.selected === 'shovel') {
      var hc = cellAt(G.mouse.x, G.mouse.y);
      if (hc) {
        for (var hp = 0; hp < G.plants.length; hp++) {
          if (G.plants[hp].col === hc.c && G.plants[hp].row === hc.r) {
            G.hoverPlant = G.plants[hp];
            break;
          }
        }
      }
    }

    drawMowers();

    var ps = G.plants.slice().sort(function (a, b) { return a.row - b.row || a.x - b.x; });
    for (var i = 0; i < ps.length; i++) drawPlant(ps[i]);

    for (var j = 0; j < G.projectiles.length; j++) drawProjectile(G.projectiles[j]);

    var zs = G.zombies.slice().sort(function (a, b) { return a.row - b.row || a.x - b.x; });
    for (var k = 0; k < zs.length; k++) drawZombie(zs[k]);

    for (var mb = 0; mb < G.mineBooms.length; mb++) drawMineBoom(G.mineBooms[mb]);

    drawMoneyFx();

    for (var m = 0; m < G.suns.length; m++) drawSun(G.suns[m]);

    for (var e = 0; e < G.explosions.length; e++) drawExplosion(G.explosions[e]);

    drawParticles();
    drawHitFx();
    drawTexts();

    if (G.banner) drawBanner();
    if (G.state === 'playing') drawGhost();

    ctx.restore();
  }

  function drawFireflies() {
    for (var i = 0; i < 18; i++) {
      var ph = i * 1.7;
      var x = LAWN.x + 60 + ((i * 137) % (LAWN.w - 120)) + Math.sin(G.uiT * 0.7 + ph) * 22;
      var y = LAWN.y + 40 + ((i * 97) % (LAWN.h - 90)) + Math.cos(G.uiT * 0.9 + ph) * 18;
      var a = 0.35 + 0.35 * Math.sin(G.uiT * 2.4 + ph);
      var g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, 'rgba(255,240,150,' + a + ')');
      g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, TAU);
      ctx.fill();
    }
  }

  function drawMowers() {
    for (var i = 0; i < G.mowers.length; i++) {
      var m = G.mowers[i];
      if (m.state === 'gone') continue;
      var y = rowBase(m.row) + 1;
      ellipse(m.x + 4, y + 2, 38, 10, 'rgba(0,0,0,.16)');
      var idx = Assets.frameIndex('mower_idle', m.animT * 1000);
      Assets.draw(ctx, 'mower_idle', idx, m.x, y, 96);
      if (m.state === 'run') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 3;
        for (var s = 0; s < 3; s++) {
          var sx = m.x - 52 - s * 14;
          ctx.beginPath();
          ctx.moveTo(sx, y - 70 + s * 16);
          ctx.lineTo(sx - 16, y - 70 + s * 16);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  function wallnutKey(ratio) {
    if (ratio > 0.75) return 'wallnut_idle';
    if (ratio > 0.5) return 'wallnut_idle2';
    if (ratio > 0.25) return 'wallnut_hurt';
    return 'wallnut_critical';
  }

  function drawPlant(p) {
    var cfg = PLANTS[p.type];
    var s = p.plantT < 0.3 ? 0.55 + easeOutBack(p.plantT / 0.3) * 0.45 : 1;
    var h = cfg.h * s;
    var y = p.y + (s < 1 ? (1 - s) * 6 : 0);
    var ratio = p.hp / p.maxHp;
    var nervous = G.hoverPlant === p;
    var wob = nervous ? Math.sin(G.uiT * 36) * 2 : 0;
    var x = p.x + wob;
    var bob = 0;
    if (p.type === 'sunflower' || p.type === 'potatomine') {
      bob = Math.sin(p.animT * 2) * 1.2;
    } else if (p.type === 'wallnut') {
      bob = Math.sin(p.animT * 1.5) * 0.8;
    }
    ellipse(p.x, p.y + 2, 34 * s, 10 * s, 'rgba(0,0,0,.18)');

    if (p.type === 'sunflower' && p.glow > 0) {
      var a = clamp(p.glow, 0, 1) * 0.5;
      var g = ctx.createRadialGradient(p.x, p.y - h * 0.55, 6, p.x, p.y - h * 0.55, h * 0.9);
      g.addColorStop(0, 'rgba(255,240,150,' + a + ')');
      g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h * 0.55, h * 0.9, 0, TAU);
      ctx.fill();
    }

    if (p.type === 'peashooter' && p.ultActive) {
      var ua = 0.26 + 0.12 * Math.sin(G.uiT * 9);
      var ug = ctx.createRadialGradient(p.x, p.y - h * 0.55, 8, p.x, p.y - h * 0.55, h * 0.95);
      ug.addColorStop(0, 'rgba(150,255,110,' + ua + ')');
      ug.addColorStop(0.55, 'rgba(255,215,90,' + (ua * 0.55) + ')');
      ug.addColorStop(1, 'rgba(255,215,90,0)');
      ctx.fillStyle = ug;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h * 0.55, h * 0.95, 0, TAU);
      ctx.fill();
    }

    if (p.type === 'potatomine') {
      if (p.armed) {
        var pulse = 0.35 + 0.3 * Math.sin(G.uiT * 7);
        var gg = ctx.createRadialGradient(p.x, p.y - h * 0.8, 2, p.x, p.y - h * 0.8, 26);
        gg.addColorStop(0, 'rgba(255,70,55,' + pulse + ')');
        gg.addColorStop(1, 'rgba(255,70,55,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(p.x, p.y - h * 0.8, 26, 0, TAU);
        ctx.fill();
      } else {
        var k = clamp(p.armT / cfg.arm, 0, 1);
        ctx.save();
        ctx.strokeStyle = 'rgba(210,145,40,.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y - h * 0.5, 18, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(90,65,25,.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y - h * 0.5, 20, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    var key = cfg.key;
    if (nervous) {
      key = cfg.reactKey || cfg.key;
    } else if (p.type === 'sunflower') {
      if (p.produceAnim >= 0) key = cfg.produceKey;
    } else if (p.type === 'peashooter') {
      if (p.ultActive && cfg.ultKey) key = cfg.ultKey;
      else if (p.attacking && p.attackAnimT >= 0) key = cfg.atkKey;
    } else if (p.type === 'wallnut') {
      key = wallnutKey(ratio);
    } else if (p.type === 'potatomine') {
      key = p.armed ? cfg.armedKey : cfg.key;
    }

    var idx;
    if (nervous) {
      idx = Assets.frameIndex(key, G.uiT * 720);
    } else if (p.type === 'sunflower' && p.produceAnim >= 0) {
      idx = Assets.frameIndex(key, p.produceAnim * 1000);
    } else if (p.type === 'peashooter' && p.ultActive && cfg.ultKey) {
      idx = Assets.frameIndex(key, G.uiT * 1000);
    } else if (p.type === 'peashooter' && p.attacking && p.attackAnimT >= 0) {
      var atkMeta = Assets.meta.peashooter_attack;
      var maxMs = (atkMeta && atkMeta.total) ? atkMeta.total - 1 : 1449;
      idx = Assets.frameIndex(key, Math.min(p.attackAnimT * 1000, maxMs));
    } else {
      idx = Assets.frameIndex(key, p.animT * 800);
    }
    var drawH = h, drawX = x;
    if (p.type === 'peashooter' && p.ultActive && cfg.ultKey && !nervous) {
      drawH = h * 1.4;
      drawX = x + h * 0.24;
    }
    Assets.draw(ctx, key, idx, drawX, y + bob, drawH);

    if (nervous) drawSweatDrops(x, y, h);
  }

  function drawSweatDrops(x, y, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(125,210,255,.9)';
    ctx.strokeStyle = 'rgba(70,140,190,.55)';
    ctx.lineWidth = 1.2;
    for (var i = 0; i < 2; i++) {
      var sx = x + (i === 0 ? 22 : -20) + Math.sin(G.uiT * 5 + i * 2) * 2;
      var sy = y - h * (0.92 - i * 0.1) + Math.sin(G.uiT * 8 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 7);
      ctx.quadraticCurveTo(sx + 4, sy - 1, sx, sy + 2);
      ctx.quadraticCurveTo(sx - 4, sy - 1, sx, sy - 7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProjectile(p) {
    if (p.type === 'bill') drawBill(p);
    else drawCoin(p);
  }

  function drawCoin(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    var glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 19);
    glow.addColorStop(0, 'rgba(255,220,120,.5)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, TAU);
    ctx.fill();

    // horizontal coin: subtle vertical flip, never a tall vertical oval
    ctx.scale(1, 0.72 + 0.28 * Math.abs(Math.cos(p.spin * 1.7)));

    // side rim
    ctx.fillStyle = '#c98a18';
    ctx.strokeStyle = '#8c5a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2.4, 15, 9, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // top face
    var body = ctx.createLinearGradient(-14, -6, 14, 6);
    body.addColorStop(0, '#d89a1c');
    body.addColorStop(0.3, '#ffe98a');
    body.addColorStop(0.62, '#ffc93c');
    body.addColorStop(1, '#b97913');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -1, 14, 8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // embossed inner ring
    ctx.strokeStyle = 'rgba(255,246,195,.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -1, 9.5, 5, 0, 0, TAU);
    ctx.stroke();

    // shine
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.ellipse(-5, -3.4, 3.4, 1.7, -0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBill(p) {
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(p.spin * 2) * 2.5);
    ctx.rotate(Math.sin(p.spin * 1.3) * 0.26);
    ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.spin * 2.4)));
    var glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 23);
    glow.addColorStop(0, 'rgba(150,255,110,.38)');
    glow.addColorStop(1, 'rgba(150,255,110,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, TAU);
    ctx.fill();
    var bg = ctx.createLinearGradient(-16, -10, 16, 10);
    bg.addColorStop(0, '#2fa844');
    bg.addColorStop(0.5, '#79dc67');
    bg.addColorStop(1, '#2b9440');
    rrPath(-16, -11, 32, 22, 5);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#1b6529';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd75a';
    ctx.fillRect(-3.5, -11, 7, 22);
    ctx.strokeStyle = 'rgba(255,246,180,.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-2.8, -10.2, 5.6, 20.4);
    txt('$', 0, 5, 14, '#1b6529', { align: 'center', weight: 800 });
    ctx.restore();
  }

  function drawZombie(z) {
    var key = zombieKey(z);
    var h = zHeight(key);
    var y = rowBase(z.row);
    var x = z.x;
    if (!z.dead) {
      ctx.save();
      if (z.type === 'normal' && z.eating) {
        // dedicated eating animation
      } else if (z.eating) {
        var bob = Math.sin(z.animT * 18) * 2;
        ctx.translate(0, bob);
      }
      if (z.flash > 0) x += Math.sin(z.flash * 150) * 3.5;
      ellipse(x, y + 2, 30, 9, 'rgba(0,0,0,.18)');
      var idx = Assets.frameIndex(key, z.animT * (z.eating ? 1150 : 900));
      Assets.draw(ctx, key, idx, x, y, h);
      if (z.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.85, (z.flash / 0.14) * 0.85);
        ctx.filter = 'brightness(0) invert(1)';
        Assets.draw(ctx, key, idx, x, y, h);
        ctx.filter = 'none';
        ctx.restore();
      }
      ctx.restore();
    } else {
      var k = clamp(z.deadT / 0.95, 0, 1);
      ctx.save();
      ctx.translate(x, y + k * 10);
      ctx.rotate(-1.35 * easeOutCubic(k));
      ctx.scale(1 - k * 0.1, 1 - k * 0.1);
      ctx.translate(-x, -y);
      ellipse(x, y + 2, 30, 9, 'rgba(0,0,0,.12)');
      Assets.draw(ctx, 'zombie_normal', Assets.frameIndex('zombie_normal', 0), x, y, h);
      ctx.restore();
      // dust puff (the zombie itself stays fully opaque)
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.28;
      ctx.fillStyle = '#d8d0bd';
      for (var pi = 0; pi < 3; pi++) {
        ctx.beginPath();
        ctx.arc(x - 12 + pi * 12, y - 8 - pi * 4, 10 + k * 24, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function updateHitFx(dt) {
    for (var i = G.hitFx.length - 1; i >= 0; i--) {
      G.hitFx[i].t += dt;
      if (G.hitFx[i].t >= G.hitFx[i].dur) G.hitFx.splice(i, 1);
    }
  }

  function drawHitFx() {
    for (var i = 0; i < G.hitFx.length; i++) {
      var f = G.hitFx[i];
      var k = clamp(f.t / f.dur, 0, 1);
      var a = 1 - k;
      var r = 5 + k * 18;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(255,226,138,.32)';
      ctx.beginPath();
      ctx.arc(0, 0, 6 + k * 9, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,174,64,.95)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,190,.98)';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      for (var s = 0; s < 4; s++) {
        var ang = s * Math.PI / 2 + Math.PI / 4 + k * 0.5;
        var rr = 4 + k * 15;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,253,240,.98)';
      ctx.beginPath();
      ctx.arc(0, 0, 3 * a + 1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMoneyFx() {
    for (var i = 0; i < G.moneyFx.length; i++) {
      var f = G.moneyFx[i];
      var a = clamp(1 - f.age / f.life, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(f.x, f.y);
      ctx.scale(f.scale, f.scale);
      ctx.translate(-f.x, -f.y);
      var obj = { x: f.x, y: f.y, spin: f.rot };
      if (f.type === 'bill') drawBill(obj); else drawCoin(obj);
      ctx.restore();
    }
  }

  function drawMineBoom(b) {
    var key = 'potato_boom';
    var a = Assets.meta[key];
    if (!a) return;
    var ms = b.start + b.animT * 1000;
    var idx = Assets.frameIndex(key, Math.min(ms, a.total - 1));
    if (idx >= a.count) idx = a.count - 1;
    ctx.save();
    ctx.globalAlpha = 1;
    Assets.draw(ctx, key, idx, b.x, b.y, 190);
    ctx.restore();
  }

  function drawSun(s) {
    var x = s.x, y = s.y, sc = 1, alpha = 1;
    if (s.mode === 'fly') {
      var k = easeOutCubic(s.flyT / 0.45);
      x = lerp(s.fromX, 96, k);
      y = lerp(s.fromY, 54, k);
      sc = 1 - 0.55 * k;
      alpha = 1 - 0.15 * k;
    } else if (s.mode === 'idle') {
      y += Math.sin(G.uiT * 2.4 + s.phase) * 2;
      if (s.landT > 7.5) alpha = 0.55 + 0.45 * Math.sin(G.uiT * 12);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    drawSunIcon(0, 0, 23, G.uiT * 0.7 + s.phase);
    ctx.restore();

    if (G.tooltip || true) {
      // subtle hint ring on hover
      var m = G.mouse;
      if (G.state === 'playing' && s.mode !== 'fly' && dist2(m.x, m.y, s.x, s.y) < 46 * 46) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 30 + Math.sin(G.uiT * 6) * 2, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawExplosion(e) {
    var k = clamp(e.t / e.dur, 0, 1);
    var r = e.r * (0.35 + easeOutCubic(k) * 0.9);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    var g = ctx.createRadialGradient(e.x, e.y, r * 0.1, e.x, e.y, r);
    g.addColorStop(0, 'rgba(255,255,220,.95)');
    g.addColorStop(0.35, 'rgba(255,210,90,.85)');
    g.addColorStop(0.7, 'rgba(255,120,40,.55)');
    g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,245,200,' + (0.7 * (1 - k)) + ')';
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.85, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      var a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  function drawTexts() {
    for (var i = 0; i < G.texts.length; i++) {
      var t = G.texts[i];
      var k = t.t / t.dur;
      ctx.save();
      ctx.globalAlpha = 1 - easeInOut(k);
      txt(t.text, t.x, t.y - 46 * easeOutCubic(k), t.size || 22, t.color || '#fff', {
        align: 'center', stroke: 'rgba(40,30,15,.65)', sw: 4
      });
      ctx.restore();
    }
  }

  function drawBanner() {
    var b = G.banner;
    var k = b.t / b.dur;
    var slide = easeOutCubic(clamp(b.t / 0.45, 0, 1));
    var out = clamp((b.t - (b.dur - 0.5)) / 0.5, 0, 1);
    var x = W * (1 - slide) + out * W;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(60,20,15,0)');
    g.addColorStop(0.18, 'rgba(90,25,18,.84)');
    g.addColorStop(0.82, 'rgba(90,25,18,.84)');
    g.addColorStop(1, 'rgba(60,20,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 240, W, 108);
    ctx.translate(x, 0);
    txt(b.text, W / 2, 298, b.huge ? 54 : 50, '#ffe7a6', {
      align: 'center', stroke: '#511e12', sw: 10, shadow: 'rgba(0,0,0,.35)', blur: 6, oy: 3
    });
    txt(b.huge ? 'ĐỢT CUỐI KHỔNG LỒ' : 'MỘT ĐỢT ZOMBIE LỚN ĐANG ĐẾN', W / 2, 330, 14, 'rgba(255,210,160,.85)', { align: 'center' });
    ctx.restore();
  }

  function drawGhost() {
    if (!G.selected) return;
    var cell = cellAt(G.mouse.x, G.mouse.y);
    if (G.selected === 'shovel') {
      if (!cell) return;
      var cellX = LAWN.x + cell.c * LAWN.cw;
      var cellY = rowTop(cell.r);
      ctx.save();
      ctx.fillStyle = G.hoverPlant ? 'rgba(255,204,70,.24)' : 'rgba(255,255,255,.16)';
      ctx.fillRect(cellX, cellY, LAWN.cw, LAWN.ch);
      ctx.strokeStyle = G.hoverPlant ? 'rgba(220,150,20,.95)' : 'rgba(80,70,50,.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(cellX + 2, cellY + 2, LAWN.cw - 4, LAWN.ch - 4);
      ctx.restore();
      return;
    }
    if (!cell) return;
    var cfg = PLANTS[G.selected];
    var occupied = false;
    for (var i = 0; i < G.plants.length; i++) {
      if (G.plants[i].col === cell.c && G.plants[i].row === cell.r) { occupied = true; break; }
    }
    var x = cellCX(cell.c);
    var y = rowBase(cell.r);
    ctx.save();
    if (occupied) {
      ctx.fillStyle = 'rgba(220,60,50,.22)';
      ctx.fillRect(LAWN.x + cell.c * LAWN.cw, rowTop(cell.r), LAWN.cw, LAWN.ch);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.20)';
      ctx.fillRect(LAWN.x + cell.c * LAWN.cw, rowTop(cell.r), LAWN.cw, LAWN.ch);
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(LAWN.x + cell.c * LAWN.cw + 2, rowTop(cell.r) + 2, LAWN.cw - 4, LAWN.ch - 4);
    }
    ctx.globalAlpha = 0.62;
    var key = cfg.key;
    var idx = Assets.frameIndex(key, G.uiT * 900);
    Assets.draw(ctx, key, idx, x, y, cfg.h);
    ctx.restore();
  }

  // ---------------------------------------------------------------- HUD
  function drawHUD() {
    drawTopBar();
    drawBottomBar();
    if (G.cheatOpen) drawCheatPanel();
    if (G.state === 'playing') updateCursor();
  }

  function drawTopBar() {
    var panelW = 180 + G.levelCfg.plants.length * 100 + 18;

    function panelPath() {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(panelW - 28, 0);
      ctx.quadraticCurveTo(panelW, 0, panelW, 28);
      ctx.lineTo(panelW, HUD_H - 28);
      ctx.quadraticCurveTo(panelW, HUD_H, panelW - 28, HUD_H);
      ctx.lineTo(0, HUD_H);
      ctx.closePath();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.42)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 7;
    panelPath();
    var g = ctx.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, '#8a5c32');
    g.addColorStop(0.55, '#714726');
    g.addColorStop(1, '#57351b');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    panelPath();
    ctx.strokeStyle = 'rgba(52,30,12,.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,230,180,.15)';
    ctx.fillRect(0, 0, panelW - 30, 3);

    // vine decoration along the panel bottom
    ctx.save();
    ctx.strokeStyle = 'rgba(130,195,95,.55)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var x = 6; x < panelW - 30; x += 26) {
      var yy = HUD_H - 7 + Math.sin(x * 0.09) * 3;
      if (x === 6) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(130,195,95,.55)';
    for (var lf = 24; lf < panelW - 40; lf += 78) {
      ctx.beginPath();
      ctx.ellipse(lf, HUD_H - 3, 6, 3, -0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    drawSunPanel(16, 12, 148, 80);

    var sx = 180;
    for (var i = 0; i < G.levelCfg.plants.length; i++) {
      drawSeedCard(sx, 10, 92, 84, G.levelCfg.plants[i], i);
      sx += 100;
    }

    var shovelX = panelW + 24;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    fillRR(shovelX - 8, 8, 96, 88, 18, '#5f3b1d');
    ctx.restore();
    strokeRR(shovelX - 8, 8, 96, 88, 18, '#e4c58e', 2.5);
    fillRR(shovelX - 3, 13, 86, 8, 4, 'rgba(255,230,180,.12)');
    drawShovelCard(shovelX, 10, 80, 84);

    drawIconButton(1098, 22, 48, 'cheat');
    drawIconButton(1156, 22, 48, 'pause');
    drawIconButton(1214, 22, 48, 'sound');
  }

  function drawSunPanel(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    fillRR(x, y, w, h, 16, '#fdf3d5');
    ctx.restore();
    strokeRR(x, y, w, h, 16, '#8a5a2f', 3);
    fillRR(x + 4, y + 4, w - 8, 10, 6, 'rgba(255,255,255,.55)');

    drawSunIcon(x + 38, y + h / 2, 25, G.uiT * 0.5);
    txt(String(G.sun), x + w - 18, y + 48, 34, '#5b3a14', {
      align: 'right', stroke: 'rgba(255,250,220,.9)', sw: 4
    });
    txt('Ánh sáng', x + w - 18, y + 68, 14, '#8a6134', { align: 'right' });
  }

  function drawSeedCard(x, y, w, h, type, index) {
    var cfg = PLANTS[type];
    var cd = seedCooldown(type);
    var afford = G.sun >= cfg.cost;
    var selected = G.selected === type;
    var hover = inside(G.mouse, { x: x, y: y, w: w, h: h });
    var lift = selected ? -3 : (hover ? -1 : 0);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = selected ? 16 : 8;
    ctx.shadowOffsetY = 4;
    fillRR(x, y + lift, w, h, 12, selected ? '#fff0b8' : '#f9edc9');
    ctx.restore();
    strokeRR(x, y + lift, w, h, 12, selected ? '#ffd447' : '#8a5a2f', selected ? 3.5 : 2.5);

    fillRR(x + 5, y + 5 + lift, w - 10, 8, 5, 'rgba(255,255,255,.5)');

    if (cd <= 0 && afford) {
      drawPortrait(type, x + w / 2, y + 60 + lift, cfg.portrait);
    } else {
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawPortrait(type, x + w / 2, y + 60 + lift, cfg.portrait);
      ctx.restore();
    }

    // cost
    fillRR(x + 8, y + 62 + lift, w - 16, 18, 8, 'rgba(60,40,15,.14)');
    drawSunIcon(x + 21, y + 71 + lift, 7, G.uiT * 0.4);
    txt(String(cfg.cost), x + w - 13, y + 76 + lift, 16, afford ? '#3d6b1e' : '#c23c2c', {
      align: 'right', stroke: 'rgba(255,255,255,.65)', sw: 3
    });

    // key hint
    fillRR(x + 6, y + 6 + lift, 16, 16, 5, 'rgba(90,60,25,.55)');
    txt(String(index + 1), x + 14, y + 18 + lift, 11, '#fff3c4', { align: 'center' });

    if (cd > 0) {
      var ratio = clamp(cd / cfg.cooldown, 0, 1);
      ctx.save();
      rrPath(x + 1.5, y + 1.5 + lift, w - 3, h - 3, 11);
      ctx.clip();
      ctx.fillStyle = 'rgba(25,30,20,.62)';
      ctx.fillRect(x + 1, y + 1 + lift, w - 2, (h - 2) * ratio);
      ctx.restore();
      txt(Math.ceil(cd) + 's', x + w / 2, y + 46 + lift, 19, '#e9e0c8', {
        align: 'center', stroke: 'rgba(0,0,0,.4)', sw: 4
      });
    } else if (!afford) {
      ctx.save();
      rrPath(x + 1.5, y + 1.5 + lift, w - 3, h - 3, 11);
      ctx.clip();
      ctx.fillStyle = 'rgba(40,40,30,.25)';
      ctx.fillRect(x + 1, y + 1 + lift, w - 2, h - 2);
      ctx.restore();
    }

    var rect = { x: x, y: y, w: w, h: h };
    G.buttons.push({ x: x, y: y, w: w, h: h, silent: true, onClick: function () { selectSeed(type); } });
    if (hover) G.tooltip = { type: type, x: x, y: y + h };
  }

  function drawPortrait(type, cx, cy, h) {
    var cfg = PLANTS[type];
    var key = cfg.key;
    var idx = Assets.frameIndex(key, 0);
    Assets.draw(ctx, key, idx, cx, cy, h);
  }

  function drawShovelCard(x, y, w, h) {
    var selected = G.selected === 'shovel';
    var hover = inside(G.mouse, { x: x, y: y, w: w, h: h });
    var lift = selected ? -3 : (hover ? -1 : 0);
    ctx.save();
    ctx.shadowColor = selected ? 'rgba(255,207,80,.55)' : 'rgba(0,0,0,.4)';
    ctx.shadowBlur = selected ? 18 : 10;
    ctx.shadowOffsetY = 4;
    fillRR(x, y + lift, w, h, 14, '#2f2013');
    ctx.restore();
    var g = ctx.createLinearGradient(0, y + lift, 0, y + h + lift);
    g.addColorStop(0, selected ? '#6b4c22' : '#4b3420');
    g.addColorStop(1, selected ? '#4a3212' : '#2f2013');
    fillRR(x + 3, y + 3 + lift, w - 6, h - 6, 11, g);
    strokeRR(x, y + lift, w, h, 14, selected ? '#ffd447' : '#c9a25c', selected ? 3.5 : 2.5);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2 + 2 + lift, 21, 0, TAU);
    ctx.fillStyle = 'rgba(255,240,205,.10)';
    ctx.fill();
    ctx.restore();
    drawShovelIcon(x + w / 2, y + h / 2 + 2 + lift, 40);
    txt('Xẻng', x + w / 2, y + 16 + lift, 12, '#f3ddb0', { align: 'center', weight: 700 });
    txt(selected ? 'Click để cất' : 'Click để lấy', x + w / 2, y + h - 11 + lift, 11, selected ? '#ffe08a' : '#d8bd8a', { align: 'center', weight: selected ? 700 : 500 });
    G.buttons.push({ x: x, y: y, w: w, h: h, silent: true, onClick: selectShovel });
  }

  function drawShovelCursor() {
    if (G.mouse.x < -100 || G.mouse.y < -100) return;
    ctx.save();
    ctx.translate(G.mouse.x, G.mouse.y + 3);
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    drawShovelIcon(0, 4, 52);
    ctx.restore();
  }

  function drawShovelIcon(cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35);
    ctx.shadowColor = 'rgba(255,236,190,.4)';
    ctx.shadowBlur = size * 0.14;
    // handle
    ctx.strokeStyle = '#8a5a2f';
    ctx.lineWidth = size * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.5);
    ctx.lineTo(0, size * 0.14);
    ctx.stroke();
    ctx.strokeStyle = '#b98346';
    ctx.lineWidth = size * 0.07;
    ctx.beginPath();
    ctx.moveTo(-size * 0.11, -size * 0.48);
    ctx.lineTo(size * 0.11, -size * 0.48);
    ctx.stroke();
    // blade
    var g = ctx.createLinearGradient(-size * 0.3, 0, size * 0.3, 0);
    g.addColorStop(0, '#c9d2d8');
    g.addColorStop(0.5, '#eef4f7');
    g.addColorStop(1, '#9fb0ba');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-size * 0.26, size * 0.1);
    ctx.lineTo(size * 0.26, size * 0.1);
    ctx.quadraticCurveTo(size * 0.3, size * 0.42, 0, size * 0.55);
    ctx.quadraticCurveTo(-size * 0.3, size * 0.42, -size * 0.26, size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6c7d86';
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlaque(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    fillRR(x, y, w, h, 14, 'rgba(70,44,22,.55)');
    ctx.restore();
    strokeRR(x, y, w, h, 14, 'rgba(220,180,120,.35)', 2);
    txt(G.levelCfg.tag + ' · ' + G.levelCfg.name, x + w / 2, y + 34, 22, '#fff0c2', {
      align: 'center', stroke: 'rgba(40,24,8,.6)', sw: 4
    });
    var total = G.levelCfg.waves.length;
    var waveLabel = G.wavesStarted === 0 ? ('Chuẩn bị · Tổng ' + total + ' đợt') : ('Đợt ' + G.wavesStarted + ' / ' + total);
    txt(waveLabel, x + w / 2, y + 60, 15, '#e7c98d', {
      align: 'center', weight: 600
    });
    // little decorative leaves
    ctx.save();
    ctx.fillStyle = 'rgba(140,200,100,.55)';
    for (var i = 0; i < 3; i++) {
      var lx = x + w - 26 + i * 6;
      var ly = y + 16 + i * 12;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 5, 9, -0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawIconButton(x, y, size, kind) {
    var hover = inside(G.mouse, { x: x, y: y, w: size, h: size });
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = hover ? 12 : 7;
    ctx.shadowOffsetY = 3;
    var g = ctx.createLinearGradient(0, y, 0, y + size);
    g.addColorStop(0, hover ? '#a97745' : '#936438');
    g.addColorStop(1, '#5d3a1c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#e4c58e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1.2, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.fillStyle = '#ffedc4';
    if (kind === 'pause') {
      ctx.fillRect(-9, -11, 7, 22);
      ctx.fillRect(2, -11, 7, 22);
    } else if (kind === 'cheat') {
      txt('S', 0, 8, 23, '#ffedc4', { align: 'center', weight: 800 });
    } else {
      var muted = SFX.isMuted();
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(-5, -4);
      ctx.lineTo(2, -11);
      ctx.lineTo(2, 11);
      ctx.lineTo(-5, 4);
      ctx.lineTo(-12, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffedc4';
      ctx.lineWidth = 2.5;
      if (!muted) {
        ctx.beginPath();
        ctx.arc(4, 0, 8, -0.8, 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(4, 0, 13, -0.75, 0.75);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(6, -8);
        ctx.lineTo(16, 8);
        ctx.moveTo(16, -8);
        ctx.lineTo(6, 8);
        ctx.stroke();
      }
    }
    ctx.restore();

    G.buttons.push({
      x: x, y: y, w: size, h: size, silent: true,
      onClick: kind === 'pause' ? togglePause : (kind === 'cheat' ? toggleCheat : toggleMute)
    });
  }

  function toggleCheat() {
    if (G.state !== 'playing') return;
    G.cheatOpen = !G.cheatOpen;
    if (G.cheatOpen) G.selected = null;
    sfx('click');
  }

  function clearZombiesCheat() {
    var n = 0;
    for (var i = 0; i < G.zombies.length; i++) {
      var z = G.zombies[i];
      if (z.dead) continue;
      z.dead = true;
      z.deadT = 0;
      z.eating = false;
      z.eatPlant = null;
      z.flash = 0;
      n++;
      G.stats.kills++;
    }
    G.cheatOpen = false;
    G.texts.push({
      x: W / 2, y: 300, text: 'Đã dọn ' + n + ' zombie',
      t: 0, dur: 1.2, color: '#ffe7a6', size: 28
    });
    burst(W / 2, 320, '#efe7d8', 12, 220, 3, 120, 0.8);
    sfx('shovel');
  }

  function addSunCheat() {
    G.sun += 1000;
    G.cheatOpen = false;
    G.texts.push({
      x: 100, y: 155, text: '+1000', t: 0, dur: 1.2, color: '#ffd75a', size: 26
    });
    burst(96, 54, '#ffd75a', 14, 180, 3, 80, 0.75);
    sfx('sun');
  }

  function drawCheatPanel() {
    ctx.save();
    ctx.fillStyle = 'rgba(20,20,15,.16)';
    ctx.fillRect(0, 0, W, H);
    var w = 260, h = 356;
    var x = W - w - 14, y = 82;
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 7;
    fillRR(x, y, w, h, 16, '#fff7df');
    ctx.restore();
    strokeRR(x, y, w, h, 16, '#8a5a2f', 2.5);
    txt('Menu điều chỉnh', x + 16, y + 30, 19, '#4c2f12');
    txt('Game đang tạm dừng', x + w - 40, y + 28, 11, 'rgba(120,95,55,.85)', { align: 'right', weight: 500 });

    var cs = 24, cx = x + w - 28, cy = y + 10;
    ctx.save();
    ctx.fillStyle = 'rgba(120,90,50,.12)';
    ctx.beginPath();
    ctx.arc(cx, cy + 8, cs / 2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,25,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 3);
    ctx.lineTo(cx + 5, cy + 13);
    ctx.moveTo(cx + 5, cy + 3);
    ctx.lineTo(cx - 5, cy + 13);
    ctx.stroke();
    ctx.restore();
    G.buttons.push({
      x: cx - 14, y: cy - 4, w: 28, h: 28, silent: true,
      onClick: function () { G.cheatOpen = false; sfx('click'); }
    });

    drawBigButton(x + 16, y + 48, w - 32, 46, 'Dọn zombie trên sân', 'cream', clearZombiesCheat);
    drawBigButton(x + 16, y + 104, w - 32, 46, 'Thêm 1000 ánh sáng', 'cream', addSunCheat);
    var noCd = G.cheatNoCooldown;
    drawBigButton(
      x + 16, y + 160, w - 32, 46,
      noCd ? 'Không hồi chiêu: BẬT' : 'Không hồi chiêu: TẮT',
      noCd ? 'primary' : 'cream',
      toggleNoCooldown
    );
    drawBigButton(
      x + 16, y + 216, w - 32, 46,
      G.autoSun ? 'Tự động thu ánh sáng: BẬT' : 'Tự động thu ánh sáng: TẮT',
      G.autoSun ? 'primary' : 'cream',
      toggleAutoSun
    );
    var allUnlocked = G.unlocked >= LEVELS.length;
    drawBigButton(
      x + 16, y + 272, w - 32, 46,
      allUnlocked ? 'Đã mở khóa tất cả màn' : 'Mở khóa tất cả màn',
      allUnlocked ? 'primary' : 'cream',
      unlockAllLevels
    );
    txt('Dành cho debug · Bật/tắt tùy ý', x + w / 2, y + h - 12, 11, 'rgba(120,95,55,.8)', {
      align: 'center', weight: 500
    });
  }

  function toggleNoCooldown() {
    G.cheatNoCooldown = !G.cheatNoCooldown;
    sfx('click');
  }

  function toggleAutoSun() {
    G.autoSun = !G.autoSun;
    sfx('click');
  }

  function unlockAllLevels() {
    G.unlocked = LEVELS.length;
    saveProgress();
    if (G.state === 'playing') {
      G.cheatOpen = false;
      G.texts.push({
        x: W / 2, y: 300, text: 'Đã mở khóa tất cả màn',
        t: 0, dur: 1.4, color: '#ffe7a6', size: 28
      });
      burst(W / 2, 320, '#ffe7a6', 14, 200, 3, 120, 0.8);
    }
    sfx('sun');
  }

  function drawIntroHint() {
    if (G.cheatOpen) return;
    var t = G.introT;
    if (t > 10) return;
    var a = 1;
    if (t < 0.6) a = t / 0.6;
    if (t > 8.2) a = Math.max(0, (10 - t) / 1.8);
    if (a <= 0.01) return;
    var s = G.levelCfg.hint;
    ctx.save();
    ctx.globalAlpha = a;
    var w = 560;
    var x = W / 2 - w / 2;
    var y = 116;
    ctx.shadowColor = 'rgba(0,0,0,.28)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    fillRR(x, y, w, 48, 16, 'rgba(48,34,16,.78)');
    ctx.shadowColor = 'transparent';
    strokeRR(x, y, w, 48, 16, 'rgba(255,225,160,.45)', 2);
    txt(s, W / 2, y + 30, 16, '#fff2c8', { align: 'center' });
    ctx.restore();
  }

  function drawTooltip() {
    var t = G.tooltip;
    if (!t) return;
    var cfg = PLANTS[t.type];
    var w = 230;
    var h = 108;
    var x = clamp(G.mouse.x - w / 2, 8, W - w - 8);
    var y = HUD_H + 8;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    fillRR(x, y, w, h, 12, '#fff7df');
    ctx.restore();
    strokeRR(x, y, w, h, 12, '#8a5a2f', 2.5);
    var name = cfg.name + '  ·  ' + cfg.cost + ' ánh sáng';
    txt(name, x + 14, y + 26, 17, '#5b3a14');
    var lines = wrapText(cfg.desc, w - 28, 14, 500);
    for (var i = 0; i < lines.length; i++) {
      txt(lines[i], x + 14, y + 50 + i * 19, 14, '#7a5b35', { weight: 500 });
    }
    var extra = '';
    if (t.type === 'sunflower') extra = 'Lần đầu 6 giây, tạo ánh sáng sau animation';
    if (t.type === 'peashooter') extra = 'Cứ 10 phát xu → đại chiêu rải tiền hình quạt';
    if (t.type === 'wallnut') extra = 'Máu 4000, 4 giai đoạn máu';
    if (t.type === 'potatomine') extra = 'Sát thương nổ 1800';
    txt(extra, x + 14, y + h - 14, 12, '#a27a45', { weight: 500 });
    G.tooltip = null;
  }

  function drawBottomBar() {
    var g = ctx.createLinearGradient(0, BOTTOM_Y, 0, H);
    g.addColorStop(0, '#6f4825');
    g.addColorStop(1, '#4a2e15');
    ctx.fillStyle = g;
    ctx.fillRect(0, BOTTOM_Y, W, H - BOTTOM_Y);
    ctx.fillStyle = 'rgba(255,230,180,.16)';
    ctx.fillRect(0, BOTTOM_Y, W, 3);

    var total = G.levelCfg.waves.length;

    // level + wave info (left)
    txt(G.levelCfg.tag + ' · ' + G.levelCfg.name, 22, 728, 15, '#ffe8b0', {
      stroke: 'rgba(50,30,10,.55)', sw: 3
    });
    txt('Tiến độ  ' + G.wavesStarted + ' / ' + total, 22, 748, 12, '#d9b57a', { weight: 500 });

    var bx = 340, bw = 590, by = 726, bh = 18;
    fillRR(bx, by, bw, bh, 9, 'rgba(0,0,0,.35)');
    var ratio = total ? G.wavesStarted / total : 0;
    if (ratio > 0) {
      var fill = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      fill.addColorStop(0, '#9ee06a');
      fill.addColorStop(1, '#5cb63a');
      fillRR(bx + 2, by + 2, Math.max(0, (bw - 4) * ratio), bh - 4, 7, fill);
    }
    strokeRR(bx, by, bw, bh, 9, 'rgba(230,200,140,.5)', 2);

    // flags
    for (var i = 0; i < total; i++) {
      var fx = bx + bw * ((i + 0.5) / total);
      if (!G.levelCfg.waves[i].flag) continue;
      ctx.save();
      ctx.strokeStyle = '#f2dfb8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, by - 8);
      ctx.lineTo(fx, by - 2);
      ctx.stroke();
      ctx.fillStyle = i === total - 1 ? '#e5483b' : '#ffcf5a';
      ctx.beginPath();
      ctx.moveTo(fx, by - 9);
      ctx.lineTo(fx + 13, by - 5);
      ctx.lineTo(fx, by - 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    drawZombieHead(bx + bw * ratio, by + bh / 2, 11);

    // mower count
    var leftMowers = G.mowers.filter(function (m) { return m.state === 'idle'; }).length;
    var mk = Assets.frameIndex('mower_idle', G.uiT * 500);
    Assets.draw(ctx, 'mower_idle', mk, 974, 749, 40);
    txt('×' + leftMowers, 998, 744, 16, '#ffe7a6', { stroke: 'rgba(50,30,10,.6)', sw: 3 });

    // stats
    txt('Hạ gục ' + G.stats.kills + '  ·  Thu thập ' + G.stats.sun, 1256, 744, 14, '#e7c98d', {
      align: 'right', weight: 600
    });

    // hint
    if (G.selected === 'shovel') {
      txt('Click vào cây để gỡ nó', W / 2, BOTTOM_Y - 14, 16, 'rgba(50,40,15,.72)', { align: 'center', stroke: 'rgba(255,255,255,.4)', sw: 3 });
    } else if (G.selected) {
      txt('Click lên bãi cỏ để trồng ' + PLANTS[G.selected].name + ' (chuột phải để hủy)', W / 2, BOTTOM_Y - 14, 16, 'rgba(50,40,15,.72)', {
        align: 'center', stroke: 'rgba(255,255,255,.4)', sw: 3
      });
    }
  }

  function drawZombieHead(cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#efe7d8';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3c2b20';
    ctx.lineWidth = 2;
    ctx.stroke();
    // hair
    ctx.strokeStyle = '#2d211c';
    ctx.lineWidth = 2;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, -r + 1);
      ctx.lineTo(i * 3 - 1, -r - 4);
      ctx.stroke();
    }
    // eyes
    ctx.fillStyle = '#2d211c';
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.05, r * 0.13, 0, TAU);
    ctx.arc(r * 0.34, -r * 0.05, r * 0.13, 0, TAU);
    ctx.fill();
    // tongue
    ctx.fillStyle = '#e7869a';
    ctx.beginPath();
    ctx.ellipse(r * 0.05, r * 0.42, r * 0.22, r * 0.3, 0.15, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- menu
  function drawMenuBase() {
    if (G.menuBg) ctx.drawImage(G.menuBg, 0, 0);
    else { ctx.fillStyle = '#5aa544'; ctx.fillRect(0, 0, W, H); }
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,248,225,.10)');
    g.addColorStop(0.55, 'rgba(80,60,30,.06)');
    g.addColorStop(1, 'rgba(70,52,28,.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMenu() {
    drawMenuBase();

    // floating pollen
    for (var i = 0; i < 22; i++) {
      var x = (i * 173 + G.uiT * 12) % W;
      var y = 60 + (i * 97) % 560 + Math.sin(G.uiT * 0.8 + i) * 10;
      ctx.fillStyle = 'rgba(255,248,190,' + (0.2 + 0.2 * Math.sin(G.uiT + i)) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, TAU);
      ctx.fill();
    }

    drawSign(W / 2, 132, 600, 158, 'Cây vs Zombie', 'Phiên bản Q · Tower Defense');

    // character line-up
    var base = 662;
    var t = G.uiT;
    drawMenuChar('peashooter_idle', 236, base, 172, t * 0.9, 0);
    drawMenuChar('sunflower_idle', 402, base, 176, t * 0.9, 0.6);
    drawMenuChar('wallnut_idle', 556, base, 168, t * 0.9, 1.2);
    drawMenuChar('potato_idle', 700, base, 156, t * 0.9, 1.8);
    drawMenuChar('zombie_normal', 900, base + 4, 196, t * 0.8, 0);
    drawMenuChar('zombie_cone', 1024, base + 4, 218, t * 0.8, 0.7);
    drawMenuChar('zombie_bucket', 1138, base + 4, 220, t * 0.8, 1.4);

    // buttons
    drawBigButton(470, 228, 170, 58, 'Bắt đầu', 'primary', function () { setState('levels'); sfx('click'); });
    drawBigButton(656, 228, 170, 58, 'Hướng dẫn', 'cream', function () { setState('help'); sfx('click'); });

    var cleared = 0;
    for (var k in G.stars) if (G.stars[k] > 0) cleared++;
    txt('Đã phá đảo ' + cleared + ' / ' + LEVELS.length + ' màn', W / 2, 320, 16, 'rgba(255,244,204,.85)', {
      align: 'center', stroke: 'rgba(30,40,15,.5)', sw: 3
    });

    // footer
    ctx.fillStyle = 'rgba(20,30,15,.32)';
    ctx.fillRect(0, H - 40, W, 40);
    txt('Nhân vật: UP主 Bilibili「钻斧你干嘛」· Fan-made · Chỉ phục vụ học tập · BGM: Bilibili BV1DYNLePEEG', W / 2, H - 15, 13, 'rgba(255,246,220,.82)', {
      align: 'center', weight: 500
    });
  }

  function drawMenuChar(key, x, base, h, t, phase) {
    ellipse(x, base + 4, h * 0.22, h * 0.045, 'rgba(0,0,0,.16)');
    var idx = Assets.frameIndex(key, (t + phase) * 1000);
    Assets.draw(ctx, key, idx, x, base, h);
  }

  function drawSign(cx, cy, w, h, title, subtitle) {
    ctx.save();
    ctx.translate(cx, cy);
    // ropes
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, -h / 2);
    ctx.lineTo(-w * 0.42, -h / 2 - 46);
    ctx.moveTo(w * 0.38, -h / 2);
    ctx.lineTo(w * 0.42, -h / 2 - 46);
    ctx.stroke();

    ctx.rotate(-0.018);
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    var g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#c18c4d');
    g.addColorStop(0.5, '#a9743c');
    g.addColorStop(1, '#845527');
    rrPath(-w / 2, -h / 2, w, h, 22);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    strokeRR(-w / 2, -h / 2, w, h, 22, '#5a3616', 7);
    strokeRR(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 16, 'rgba(255,230,170,.28)', 2);

    // wood grain
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#5a3616';
    ctx.lineWidth = 1.5;
    for (var i = 0; i < 7; i++) {
      var yy = -h / 2 + 22 + i * (h - 44) / 6;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 20, yy);
      ctx.bezierCurveTo(-w / 4, yy + 3, w / 4, yy - 3, w / 2 - 20, yy);
      ctx.stroke();
    }
    ctx.restore();

    // title
    var titleSize = w > 560 ? 78 : 62;
    txt(title, 0, 20, titleSize, '#fdf6c9', {
      align: 'center', stroke: '#40260e', sw: 12, shadow: 'rgba(0,0,0,.35)', blur: 6, oy: 4
    });
    // shiny line
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#fff8cf';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.33, -18);
    ctx.quadraticCurveTo(0, -28, w * 0.33, -18);
    ctx.stroke();
    ctx.restore();

    // subtitle badge
    var sw = 250, sh = 40;
    ctx.save();
    ctx.translate(0, h / 2 - 24);
    ctx.rotate(0.01);
    fillRR(-sw / 2, -sh / 2, sw, sh, 20, '#4f9137');
    strokeRR(-sw / 2, -sh / 2, sw, sh, 20, '#2f5c1f', 3);
    txt(subtitle, 0, 7, 20, '#f2ffd9', { align: 'center' });
    ctx.restore();

    // leaves
    drawLeaf(-w / 2 + 26, -h / 2 + 12, -0.7);
    drawLeaf(w / 2 - 30, -h / 2 + 10, 0.8);
    drawLeaf(-w / 2 + 40, h / 2 - 20, 0.5);
    drawLeaf(w / 2 - 44, h / 2 - 22, -0.55);
    ctx.restore();
  }

  function drawLeaf(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#7cc24e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4f8c2f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawBigButton(x, y, w, h, label, style, onClick) {
    var hover = inside(G.mouse, { x: x, y: y, w: w, h: h });
    var lift = hover ? -3 : 0;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = hover ? 20 : 12;
    ctx.shadowOffsetY = hover ? 8 : 5;
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (style === 'primary') {
      g.addColorStop(0, hover ? '#a6e074' : '#8fd45e');
      g.addColorStop(1, hover ? '#69b93f' : '#5aa832');
    } else {
      g.addColorStop(0, hover ? '#fff5d8' : '#f6e6bd');
      g.addColorStop(1, hover ? '#efd9a8' : '#e3c88f');
    }
    fillRR(x, y + lift, w, h, 18, g);
    ctx.restore();
    strokeRR(x, y + lift, w, h, 18, style === 'primary' ? '#2f6b1e' : '#8a5a2f', 3.5);
    fillRR(x + 6, y + 6 + lift, w - 12, 8, 5, 'rgba(255,255,255,.35)');
    txt(label, x + w / 2, y + h / 2 + 10 + lift, 24, style === 'primary' ? '#ffffff' : '#5b3a14', {
      align: 'center', stroke: style === 'primary' ? 'rgba(30,70,15,.55)' : 'rgba(255,255,255,.45)', sw: 4
    });
    G.buttons.push({ x: x, y: y, w: w, h: h, silent: true, onClick: onClick });
  }

  // ---------------------------------------------------------------- level select
  function drawLevelSelect() {
    txt('Chọn màn', W / 2, 92, 46, '#fdf6c9', {
      align: 'center', stroke: '#3d240e', sw: 9, shadow: 'rgba(0,0,0,.35)', blur: 8, oy: 4
    });

    var cw = 332, ch = 430, gap = 30;
    var x0 = (W - (cw * 3 + gap * 2)) / 2;
    var y0 = 138;

    for (var i = 0; i < LEVELS.length; i++) {
      drawLevelCard(LEVELS[i], i, x0 + i * (cw + gap), y0, cw, ch);
    }

    if (G.unlocked < LEVELS.length) {
      drawBigButton(W / 2 - 110, 580, 220, 40, 'Mở khóa tất cả màn', 'cream', unlockAllLevels);
    }

    drawBigButton(24, 22, 108, 44, 'Quay lại', 'cream', function () { setState('menu'); sfx('click'); });

    txt('Click vào màn đã mở khóa để bắt đầu · Phá đảo mở khóa màn tiếp theo', W / 2, G.unlocked < LEVELS.length ? 650 : 626, 15, 'rgba(255,246,220,.85)', {
      align: 'center', stroke: 'rgba(20,30,12,.5)', sw: 3
    });

    if (G.unlocked >= LEVELS.length) {
      txt('Tất cả màn đã mở khóa, hãy bảo vệ bãi cỏ!', W / 2, 652, 15, 'rgba(255,235,150,.95)', {
        align: 'center', stroke: 'rgba(20,30,12,.5)', sw: 3
      });
    }
  }

  function drawLevelCard(cfg, index, x, y, w, h) {
    var unlocked = index < G.unlocked;
    var stars = G.stars[String(index)] || 0;
    var hover = unlocked && inside(G.mouse, { x: x, y: y, w: w, h: h });
    var lift = hover ? -5 : 0;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = hover ? 26 : 16;
    ctx.shadowOffsetY = hover ? 12 : 8;
    fillRR(x, y + lift, w, h, 20, '#fff7dc');
    ctx.restore();
    strokeRR(x, y + lift, w, h, 20, hover ? '#ffd447' : '#8a5a2f', hover ? 4 : 3);

    // preview
    var px = x + 18, py = y + 18 + lift, pw = w - 36, ph = 168;
    ctx.save();
    rrPath(px, py, pw, ph, 16);
    ctx.clip();
    var palette = PALETTES[cfg.pal];
    ctx.fillStyle = palette.paper;
    ctx.fillRect(px, py, pw, ph);
    // tiny house edge
    var hw = 34;
    ctx.fillStyle = palette.wall;
    ctx.fillRect(px, py, hw, ph);
    ctx.fillStyle = 'rgba(90,70,40,.16)';
    for (var sy = py + 12; sy < py + ph; sy += 18) ctx.fillRect(px, sy, hw, 1.4);
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + hw, py);
    ctx.lineTo(px + hw, py + ph);
    ctx.stroke();
    // mini paper grid
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1.3;
    var gcw = (pw - hw) / 6;
    var gch = ph / 3;
    for (var gc = 0; gc <= 6; gc++) {
      ctx.beginPath();
      ctx.moveTo(px + hw + gc * gcw, py);
      ctx.lineTo(px + hw + gc * gcw, py + ph);
      ctx.stroke();
    }
    for (var gr = 0; gr <= 3; gr++) {
      ctx.beginPath();
      ctx.moveTo(px + hw, py + gr * gch);
      ctx.lineTo(px + pw, py + gr * gch);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,100,60,.045)';
    for (var gc2 = 0; gc2 < 6; gc2++) {
      if (gc2 % 2 === 0) ctx.fillRect(px + hw + gc2 * gcw, py, gcw, ph);
    }
    // characters in preview
    drawPreviewChar('peashooter_idle', px + pw * 0.40, py + ph - 24, 88, 0.3);
    drawPreviewChar('sunflower_idle', px + pw * 0.23, py + ph - 22, 82, 1.1);
    if (index >= 1) drawPreviewChar('wallnut_idle', px + pw * 0.56, py + ph - 20, 74, 0.7);
    if (index >= 2) drawPreviewChar('potato_idle', px + pw * 0.68, py + ph - 18, 64, 1.6);
    drawPreviewChar('zombie_normal', px + pw * 0.88, py + ph - 22, 96, 0.9);
    ctx.restore();
    strokeRR(px, py, pw, ph, 16, 'rgba(70,45,15,.35)', 2);

    // tag
    fillRR(x + 28, y + 30 + lift, 86, 30, 15, 'rgba(70,45,15,.72)');
    txt(cfg.tag, x + 71, y + 51 + lift, 15, '#ffe9b5', { align: 'center' });

    // name / desc
    txt(cfg.name, x + 22, y + 216 + lift, 26, '#4c2f12', { stroke: 'rgba(255,255,255,.5)', sw: 4 });
    var lines = wrapText(cfg.desc, w - 44, 14, 500);
    for (var i = 0; i < lines.length; i++) {
      txt(lines[i], x + 22, y + 242 + i * 20 + lift, 14, '#7a5b35', { weight: 500 });
    }

    // plants
    var list = cfg.plants;
    var ix = x + 24;
    for (var j = 0; j < list.length; j++) {
      var t = list[j];
      fillRR(ix, y + 284 + lift, 54, 54, 12, 'rgba(80,55,20,.10)');
      var pp = PLANTS[t];
      var idx = Assets.frameIndex(pp.key, 0);
      Assets.draw(ctx, pp.key, idx, ix + 27, y + 336 + lift, 44);
      ix += 62;
    }

    // stars
    for (var s = 0; s < 3; s++) {
      drawStar(x + w - 108 + s * 28, y + 46 + lift, 12, s < stars);
    }

    // button
    var by = y + h - 64 + lift;
    if (unlocked) {
      drawBigButton(x + 24, by, w - 48, 46, stars > 0 ? 'Chơi lại' : 'Bắt đầu', 'primary', function (i) {
        return function () { startLevel(i); sfx('click'); };
      }(index));
    } else {
      fillRR(x + 24, by, w - 48, 46, 16, 'rgba(90,80,60,.25)');
      strokeRR(x + 24, by, w - 48, 46, 16, 'rgba(90,70,40,.35)', 2);
      drawLock(x + w / 2 - 58, by + 23);
      txt('Phá màn trước để mở', x + w / 2 + 12, by + 30, 16, '#7e6b4c', { align: 'center' });
    }

    if (!unlocked) {
      ctx.save();
      rrPath(x, y + lift, w, h, 20);
      ctx.clip();
      ctx.fillStyle = 'rgba(40,40,30,.42)';
      ctx.fillRect(x, y + lift, w, h);
      ctx.restore();
    }
  }

  function drawPreviewChar(key, x, base, h, phase) {
    var idx = Assets.frameIndex(key, (G.uiT + phase) * 800);
    ellipse(x, base + 3, h * 0.2, h * 0.04, 'rgba(0,0,0,.12)');
    Assets.draw(ctx, key, idx, x, base, h);
  }

  function drawLock(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#5f4a2c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -4, 8, Math.PI, 0);
    ctx.stroke();
    fillRR(-12, -4, 24, 18, 4, '#5f4a2c');
    ctx.fillStyle = '#c8ad7c';
    ctx.beginPath();
    ctx.arc(0, 4, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- help
  function drawHelp() {
    var x = 90, y = 30, w = 1100, h = 700;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    fillRR(x, y, w, h, 26, '#fff7df');
    ctx.restore();
    strokeRR(x, y, w, h, 26, '#8a5a2f', 4);
    fillRR(x + 12, y + 12, w - 24, 10, 6, 'rgba(255,255,255,.5)');

    txt('Hướng dẫn chơi', W / 2, y + 66, 40, '#4c2f12', { align: 'center', stroke: 'rgba(255,255,255,.55)', sw: 5 });

    // left column
    var lx = x + 48;
    var ly = y + 116;
    txt('Mục tiêu', lx, ly, 22, '#3d6b1e');
    var goal = 'Zombie sẽ xuất hiện từ bên phải bãi cỏ và đi sang trái. Dùng cây để chặn chúng, đừng để chúng vào đến nhà! Trụ đến hết đợt cuối cùng của mỗi màn là thắng.';
    var gl = wrapText(goal, 430, 15, 500);
    for (var i = 0; i < gl.length; i++) txt(gl[i], lx, ly + 28 + i * 23, 15, '#6b5232', { weight: 500 });

    txt('Thao tác', lx, ly + 168, 22, '#3d6b1e');
    var ops = [
      ['Click thẻ, rồi click bãi cỏ', 'Trồng cây'],
      ['Click ánh sáng', 'Thu 25 ánh sáng'],
      ['Click xẻng, rồi click cây', 'Gỡ cây'],
      ['Di xẻng qua cây', 'Cây sẽ giật mình'],
      ['1 - 4 / Space / ESC', 'Chọn nhanh / Tạm dừng'],
      ['Chuột phải', 'Hủy lựa chọn hiện tại']
    ];
    for (var k = 0; k < ops.length; k++) {
      fillRR(lx, ly + 188 + k * 34, 430, 30, 9, 'rgba(80,55,20,.07)');
      txt(ops[k][0], lx + 12, ly + 208 + k * 34, 14, '#5b3a14', { weight: 600 });
      txt(ops[k][1], lx + 418, ly + 208 + k * 34, 14, '#3f7a24', { align: 'right' });
    }

    txt('Kinh tế ánh sáng', lx, ly + 408, 22, '#3d6b1e');
    var eco = 'Ánh sáng rơi từ trên trời; hướng dương tạo 25 ánh sáng mỗi 22 giây. Trồng nhiều hướng dương trước, rồi bố trí sát thương và phòng thủ, là chìa khóa để phá đảo.';
    var el = wrapText(eco, 430, 15, 500);
    for (var e = 0; e < el.length; e++) txt(el[e], lx, ly + 436 + e * 23, 15, '#6b5232', { weight: 500 });

    // right column: album
    var rx = x + 520;
    txt('Bộ sưu tập cây', rx, ly, 22, '#3d6b1e');
    var plants = PLANT_ORDER;
    for (var p = 0; p < plants.length; p++) {
      var px = rx + (p % 2) * 270;
      var py = ly + 22 + Math.floor(p / 2) * 156;
      drawAlbumCard(px, py, 254, 142, PLANTS[plants[p]], plants[p]);
    }

    txt('Bộ sưu tập zombie', rx, ly + 344, 22, '#3d6b1e');
    var zkeys = ['normal', 'cone', 'bucket'];
    for (var z = 0; z < zkeys.length; z++) {
      var zx = rx + z * 180;
      var zy = ly + 366;
      var zc = ZOMBIES[zkeys[z]];
      fillRR(zx, zy, 168, 130, 12, 'rgba(80,55,20,.08)');
      var zkey = zkeys[z] === 'normal' ? 'zombie_normal' : (zkeys[z] === 'cone' ? 'zombie_cone' : 'zombie_bucket');
      Assets.draw(ctx, zkey, Assets.frameIndex(zkey, 0), zx + 84, zy + 88, 72);
      txt(zc.name, zx + 84, zy + 108, 13, '#5b3a14', { align: 'center' });
      txt('Máu ' + zc.hp, zx + 84, zy + 124, 11, '#8a6134', { align: 'center', weight: 500 });
    }

    drawBigButton(W / 2 - 90, y + h - 74, 180, 50, 'Quay lại', 'cream', function () { setState('menu'); sfx('click'); });
    txt('Nhân vật: UP主 Bilibili「钻斧你干嘛」· Chỉ phục vụ học tập', W / 2, y + h - 12, 12, 'rgba(120,95,55,.75)', {
      align: 'center', weight: 500
    });
  }

  function drawAlbumCard(x, y, w, h, cfg, type) {
    fillRR(x, y, w, h, 12, 'rgba(80,55,20,.08)');
    var key = cfg.key;
    Assets.draw(ctx, key, Assets.frameIndex(key, 0), x + 56, y + h - 14, 68);
    txt(cfg.name, x + 104, y + 30, 17, '#4c2f12');
    drawSunIcon(x + 110, y + 48, 6, G.uiT * 0.3);
    txt(String(cfg.cost), x + 120, y + 53, 13, '#3d6b1e');
    var lines = wrapText(cfg.desc, w - 112, 12, 500);
    for (var i = 0; i < Math.min(lines.length, 3); i++) {
      txt(lines[i], x + 104, y + 74 + i * 17, 12, '#7a5b35', { weight: 500 });
    }
  }

  // ---------------------------------------------------------------- overlays
  function dim(alpha) {
    ctx.fillStyle = 'rgba(12,20,12,' + alpha + ')';
    ctx.fillRect(0, 0, W, H);
  }

  function drawPause() {
    dim(0.55);
    var w = 560, h = 468, x = (W - w) / 2, y = (H - h) / 2;
    overlayCard(x, y, w, h);

    txt('Tạm dừng', x + w / 2, y + 64, 42, '#4c2f12', { align: 'center' });
    txt(G.levelCfg.tag + ' · ' + G.levelCfg.name, x + w / 2, y + 96, 16, '#8a6134', { align: 'center', weight: 500 });

    tfRow(x + 60, y + 132, 'Thời gian chơi', fmtTime(G.time));
    tfRow(x + 60, y + 168, 'Zombie hạ gục', String(G.stats.kills));
    tfRow(x + 60, y + 204, 'Ánh sáng thu thập', String(G.stats.sun));
    tfRow(x + 60, y + 240, 'Xe cắt cỏ còn lại', String(G.mowers.filter(function (m) { return m.state === 'idle'; }).length));

    drawBigButton(x + 70, y + 282, w - 140, 50, 'Tiếp tục', 'primary', togglePause);
    drawBigButton(x + 70, y + 342, w - 140, 46, 'Chơi lại', 'cream', function () { restartLevel(); sfx('click'); });
    drawBigButton(x + 70, y + 398, w - 140, 46, 'Về chọn màn', 'cream', function () { setState('levels'); sfx('click'); });
    txt('Nhấn ESC hoặc Space để tiếp tục', x + w / 2, y + h - 10, 13, 'rgba(120,95,55,.8)', { align: 'center', weight: 500 });
  }

  function tfRow(x, y, label, value) {
    txt(label, x, y, 18, '#6b5232', { weight: 500 });
    txt(value, x + 440, y, 18, '#3d6b1e', { align: 'right' });
  }

  function overlayCard(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 16;
    fillRR(x, y, w, h, 26, '#fff7df');
    ctx.restore();
    strokeRR(x, y, w, h, 26, '#8a5a2f', 4);
    fillRR(x + 12, y + 12, w - 24, 10, 6, 'rgba(255,255,255,.5)');
  }

  function drawWin() {
    dim(0.6);
    var sf = G.finalStats || { stars: 3, time: G.time, kills: 0, sun: 0 };
    var w = 620, h = 552, x = (W - w) / 2, y = (H - h) / 2;
    overlayCard(x, y, w, h);

    txt('Hoàn thành màn chơi!', x + w / 2, y + 70, 46, '#3d6b1e', {
      align: 'center', stroke: 'rgba(255,255,255,.6)', sw: 5
    });
    txt(G.levelCfg.tag + ' · ' + G.levelCfg.name, x + w / 2, y + 102, 16, '#8a6134', { align: 'center', weight: 500 });

    // stars
    for (var i = 0; i < 3; i++) {
      var pop = clamp((G.stateT - 0.15 * i) / 0.35, 0, 1);
      var r = 24 * (0.6 + 0.5 * pop);
      drawStar(x + w / 2 - 66 + i * 66, y + 158, Math.max(3, r), i < sf.stars);
    }

    tfRow(x + 110, y + 220, 'Thời gian', fmtTime(sf.time));
    tfRow(x + 110, y + 256, 'Zombie hạ gục', String(sf.kills));
    tfRow(x + 110, y + 292, 'Ánh sáng thu thập', String(sf.sun));

    var isLast = G.level >= LEVELS.length - 1;
    if (isLast) {
      txt('Chúc mừng phá đảo toàn bộ màn!', x + w / 2, y + 342, 20, '#b07a1e', { align: 'center' });
    }

    if (!isLast) {
      drawBigButton(x + 60, y + 368, 240, 50, 'Màn tiếp', 'primary', function () {
        startLevel(Math.min(LEVELS.length - 1, G.level + 1));
        sfx('click');
      });
      drawBigButton(x + 320, y + 368, 240, 50, 'Chơi lại', 'cream', function () { restartLevel(); sfx('click'); });
    } else {
      drawBigButton(x + 60, y + 368, 240, 50, 'Chơi lại', 'primary', function () { restartLevel(); sfx('click'); });
      drawBigButton(x + 320, y + 368, 240, 50, 'Về chọn màn', 'cream', function () { setState('levels'); sfx('click'); });
    }
    drawBigButton(x + 60, y + 430, 500, 44, 'Về chọn màn', 'cream', function () { setState('levels'); sfx('click'); });
    txt(isLast ? 'Đã phá đảo toàn bộ màn, chúc mừng!' : 'Màn mới đã mở khóa!', x + w / 2, y + h - 18, 13, 'rgba(120,95,55,.8)', {
      align: 'center', weight: 500
    });
  }

  function drawLose() {
    dim(0.62);
    var w = 620, h = 520, x = (W - w) / 2, y = (H - h) / 2;
    overlayCard(x, y, w, h);

    // zombie
    var bob = Math.sin(G.stateT * 4) * 4;
    Assets.draw(ctx, 'zombie_eat', Assets.frameIndex('zombie_eat', G.stateT * 1000), x + w / 2, y + 168 + bob, 150);

    txt('Zombie đã ăn mất não của bạn!', x + w / 2, y + 222, 34, '#8f2f22', {
      align: 'center', stroke: 'rgba(255,255,255,.55)', sw: 5
    });
    txt('Đừng nản, hãy chỉnh lại đội hình rồi thử lại!', x + w / 2, y + 256, 16, '#8a6134', { align: 'center', weight: 500 });

    var sf = G.finalStats || { time: G.time, kills: 0 };
    tfRow(x + 110, y + 300, 'Thời gian trụ', fmtTime(sf.time));
    tfRow(x + 110, y + 336, 'Zombie hạ gục', String(sf.kills));
    tfRow(x + 110, y + 372, 'Đợt đạt được', G.wavesStarted + ' / ' + G.levelCfg.waves.length);

    drawBigButton(x + 70, y + 406, 230, 50, 'Thử lại', 'primary', function () { restartLevel(); sfx('click'); });
    drawBigButton(x + 320, y + 406, 230, 50, 'Về chọn màn', 'cream', function () { setState('levels'); sfx('click'); });

    txt('Nghĩ xem: đủ hướng dương chưa? Hàng trước có hạt dẻ chặn không?', x + w / 2, y + h - 18, 13, 'rgba(120,95,55,.85)', {
      align: 'center', weight: 500
    });
  }

  function fmtTime(t) {
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------------------------------------------------------------- boot
  boot();
  requestAnimationFrame(loop);
})();