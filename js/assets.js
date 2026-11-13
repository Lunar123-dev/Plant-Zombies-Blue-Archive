(function () {
  'use strict';

  var A = window.ATLAS || {};
  var images = {};
  var uiImages = {};
  var UI = {
    sun: 'assets/ui/sun.png',
    sun_orb: 'assets/ui/sun_orb.png'
  };
  var ready = false;

  function buildMeta() {
    if (ready) return;
    for (var k in A) {
      var a = A[k];
      var cum = [0];
      var total = 0;
      var i;
      for (i = 0; i < a.durations.length; i++) {
        total += a.durations[i];
        cum.push(total);
      }
      while (cum.length <= a.count) {
        total += 60;
        cum.push(total);
      }
      a.cum = cum;
      a.total = Math.max(1, total);
    }
    ready = true;
  }

  function load(onProgress) {
    buildMeta();
    var keys = Object.keys(A);
    var uiKeys = Object.keys(UI);
    var total = keys.length + uiKeys.length;
    var done = 0;
    var failed = [];
    function tick() {
      done++;
      if (onProgress) onProgress(done / total);
    }
    var atlasJobs = keys.map(function (k) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          images[k] = img;
          tick();
          resolve();
        };
        img.onerror = function () {
          failed.push(k);
          tick();
          resolve();
        };
        img.src = A[k].file;
      });
    });
    var uiJobs = uiKeys.map(function (k) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          uiImages[k] = img;
          tick();
          resolve();
        };
        img.onerror = function () {
          tick();
          resolve();
        };
        img.src = UI[k];
      });
    });
    return Promise.all(atlasJobs.concat(uiJobs)).then(function () {
      if (failed.length) {
        throw new Error('素材加载失败：' + failed.join('、') + '\n请使用 run_game.bat 启动，或通过本地服务器打开。');
      }
    });
  }

  function frameIndex(key, ms) {
    var a = A[key];
    if (!a) return 0;
    var t = ms % a.total;
    if (t < 0) t += a.total;
    var lo = 0;
    var hi = a.count - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (a.cum[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function draw(ctx, key, idx, x, y, h, alpha) {
    var a = A[key];
    if (!a) return;
    var img = images[key];
    if (!img) return;
    var w = h * a.fw / a.fh;
    var cw = a.fw + a.pad * 2;
    var ch = a.fh + a.pad * 2;
    var sx = (idx % a.cols) * cw + a.pad;
    var sy = Math.floor(idx / a.cols) * ch + a.pad;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, a.fw, a.fh, x - w / 2, y - h, w, h);
    if (alpha !== undefined) ctx.globalAlpha = 1;
    return { w: w, h: h };
  }

  function size(key, h) {
    var a = A[key];
    if (!a) return { w: h, h: h };
    return { w: h * a.fw / a.fh, h: h };
  }

  window.Assets = {
    load: load,
    draw: draw,
    frameIndex: frameIndex,
    size: size,
    ui: function (key) { return uiImages[key] || null; },
    images: images,
    meta: A
  };
})();
