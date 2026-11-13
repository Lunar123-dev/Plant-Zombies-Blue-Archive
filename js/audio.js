(function () {
  'use strict';

  var actx = null;
  var master = null;
  var muted = false;
  var bgmEl = null;
  var bgmVolume = 0.2;
  try { muted = localStorage.getItem('pvzq_muted') === '1'; } catch (e) {}

  function startBgm() {
    if (muted) return;
    if (!bgmEl) {
      bgmEl = new Audio('assets/audio/bgm.mp3');
      bgmEl.loop = true;
      bgmEl.volume = bgmVolume;
      bgmEl.preload = 'auto';
    }
    if (bgmEl.paused) {
      var p = bgmEl.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function ensure() {
    if (actx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0.16;
    master.connect(actx.destination);
    return true;
  }

  function unlock() {
    if (ensure() && actx.state === 'suspended') actx.resume();
    startBgm();
  }

  function tone(type, f0, f1, dur, gain, delay) {
    if (muted || !ensure()) return;
    var t = actx.currentTime + (delay || 0);
    var o = actx.createOscillator();
    var g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== undefined && f1 !== null) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.04);
  }

  function noise(dur, gain, freq, delay, q) {
    if (muted || !ensure()) return;
    var t = actx.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(actx.sampleRate * dur));
    var buf = actx.createBuffer(1, len, actx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = actx.createBufferSource();
    src.buffer = buf;
    var f = actx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 900;
    f.Q.value = q || 0.8;
    var g = actx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  var SFX = {
    click: function () { tone('sine', 520, 700, 0.07, 0.10); },
    error: function () { tone('square', 150, 110, 0.12, 0.10); },
    plant: function () { tone('sine', 320, 620, 0.12, 0.16); noise(0.12, 0.05, 600, 0, 0.7); },
    shovel: function () { noise(0.18, 0.10, 1400, 0, 0.4); tone('sine', 240, 140, 0.14, 0.05); },
    shoot: function () { tone('square', 760, 380, 0.07, 0.07); },
    hit: function () { noise(0.06, 0.06, 1800, 0, 0.9); },
    sun: function () {
      tone('sine', 880, 1180, 0.10, 0.13);
      tone('sine', 1320, 1560, 0.12, 0.08, 0.05);
    },
    chomp: function () { noise(0.07, 0.07, 500, 0, 1.2); tone('sawtooth', 120, 80, 0.08, 0.05); },
    boom: function () {
      noise(0.55, 0.30, 420, 0, 0.6);
      tone('sine', 140, 40, 0.5, 0.20);
      tone('square', 90, 30, 0.35, 0.10, 0.03);
    },
    mower: function () {
      tone('sawtooth', 120, 260, 0.5, 0.10);
      noise(0.5, 0.08, 700, 0, 0.7);
    },
    wave: function () {
      tone('sawtooth', 180, 240, 0.55, 0.12);
      tone('sawtooth', 240, 320, 0.55, 0.09, 0.18);
      noise(0.4, 0.06, 500, 0.1, 0.6);
    },
    arm: function () { tone('sine', 620, 900, 0.10, 0.10); },
    ultimate: function () {
      var notes = [523, 659, 784, 1046, 1318];
      for (var i = 0; i < notes.length; i++) {
        tone('triangle', notes[i], notes[i] * 1.02, 0.16, 0.11, i * 0.055);
      }
      tone('sine', 1568, 2093, 0.22, 0.08, 0.22);
      noise(0.22, 0.06, 2600, 0.12, 0.4);
    },
    zombieDie: function () {
      tone('sawtooth', 220, 90, 0.22, 0.08);
      noise(0.15, 0.05, 400, 0, 0.8);
    },
    win: function () {
      var notes = [523, 659, 784, 1046];
      for (var i = 0; i < notes.length; i++) {
        tone('triangle', notes[i], notes[i] * 1.01, 0.22, 0.12, i * 0.13);
      }
    },
    lose: function () {
      var notes = [330, 294, 262, 196];
      for (var i = 0; i < notes.length; i++) {
        tone('sawtooth', notes[i], notes[i] * 0.98, 0.3, 0.09, i * 0.16);
      }
    },
    toggleMute: function () {
      muted = !muted;
      try { localStorage.setItem('pvzq_muted', muted ? '1' : '0'); } catch (e) {}
      if (muted) {
        if (bgmEl) bgmEl.pause();
      } else {
        SFX.click();
        startBgm();
      }
      return muted;
    },
    isMuted: function () { return muted; },
    unlock: unlock
  };

  window.SFX = SFX;
})();
