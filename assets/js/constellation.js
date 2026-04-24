/* ═══════════════════════════════════════════════════════
   ArcherLab — Sagittarius Constellation  ★  Optimized
   PixiJS 8.x — Lightweight & Smooth
   ═══════════════════════════════════════════════════════ */

(function () {
	"use strict";

	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	/* ══════════════════════════════════════════
	   1. 데이터
	   ══════════════════════════════════════════ */

	var STARS = [
		{ x: 0.32, y: 0.68, s: 4.5, b: 1.0 },
		{ x: 0.45, y: 0.52, s: 3.5, b: 0.9 },
		{ x: 0.58, y: 0.38, s: 4.0, b: 0.95 },
		{ x: 0.52, y: 0.20, s: 3.0, b: 0.8 },
		{ x: 0.35, y: 0.25, s: 3.2, b: 0.85 },
		{ x: 0.22, y: 0.45, s: 2.6, b: 0.75 },
		{ x: 0.68, y: 0.55, s: 3.2, b: 0.85 },
		{ x: 0.82, y: 0.72, s: 2.4, b: 0.7 },
		{ x: 0.18, y: 0.82, s: 3.0, b: 0.8 },
		{ x: 0.15, y: 0.55, s: 2.2, b: 0.65 },
	];

	var LINES = [
		[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
		[1, 6], [6, 7], [0, 8], [8, 9], [9, 5],
	];

	var isMobile = window.matchMedia("(pointer: coarse)").matches;
	var BG_COUNT = isMobile ? 70 : 120;
	var DUST_N = isMobile ? 15 : 25;
	var TRAIL_MAX = isMobile ? 0 : 25;

	var bgStars = [];
	function genBg() {
		for (var i = 0; i < BG_COUNT; i++) {
			bgStars.push({
				x: Math.random(), y: Math.random(),
				s: Math.random() * 1.6 + 0.3,
				b: Math.random() * 0.45 + 0.15,
				ts: Math.random() * 0.003 + 0.001,
				to: Math.random() * Math.PI * 2,
				color: [0xf5deb3, 0xe8d5b8, 0xfff8e7, 0xffebc8][i & 3],
			});
		}
	}

	var shootingStars = [];
	var ssTimer = 0, ssInterval = 200;
	function spawnSS(w, h) {
		if (shootingStars.length >= 2) return;
		var a = Math.PI * 0.12 + Math.random() * 0.25;
		var sp = 4 + Math.random() * 4;
		shootingStars.push({
			x: Math.random() * w * 0.8 + w * 0.05,
			y: Math.random() * h * 0.25,
			vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
			life: 1.0, decay: 0.008 + Math.random() * 0.01,
		});
	}

	var dusts = [];
	function genDust() {
		for (var i = 0; i < DUST_N; i++) {
			dusts.push({
				x: Math.random(), y: Math.random(),
				r: Math.random() * 35 + 18,
				a: Math.random() * 0.04 + 0.01,
				dx: (Math.random() - 0.5) * 0.0001,
				dy: (Math.random() - 0.5) * 0.00006,
				ps: Math.random() * 0.001 + 0.0005,
				po: Math.random() * Math.PI * 2,
				color: [0xe8b04a, 0xd4953a, 0xb07328, 0xc4883a][i & 3],
			});
		}
	}

	var trailParts = [];
	var energyPulses = [];
	var pulseTimer = 0;

	/* ══════════════════════════════════════════
	   2. 상태
	   ══════════════════════════════════════════ */
	var app = null;
	var W = window.innerWidth, H = window.innerHeight;
	var mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
	var prevMx = 0.5, prevMy = 0.5;
	var scrollY = 0;

	function px(star, depth) {
		var ox = (mx - 0.5) * depth * 80;
		var oy = (my - 0.5) * depth * 50;
		var sy = scrollY * depth * 0.03;
		return { x: star.x * W + ox, y: star.y * H + oy - sy };
	}

	/* ══════════════════════════════════════════
	   3. 텍스처 (작은 사이즈로 최적화)
	   ══════════════════════════════════════════ */

	function makeGlowTex(sz) {
		var c = document.createElement("canvas"); c.width = c.height = sz;
		var g = c.getContext("2d"), h = sz / 2;
		var gr = g.createRadialGradient(h, h, 0, h, h, h);
		gr.addColorStop(0, "rgba(245,222,179,0.7)");
		gr.addColorStop(0.2, "rgba(232,176,74,0.4)");
		gr.addColorStop(0.5, "rgba(232,176,74,0.1)");
		gr.addColorStop(1, "rgba(232,176,74,0)");
		g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
		return PIXI.Texture.from(c);
	}

	function makeTrailTex(sz) {
		var c = document.createElement("canvas"); c.width = c.height = sz;
		var g = c.getContext("2d"), h = sz / 2;
		var gr = g.createRadialGradient(h, h, 0, h, h, h);
		gr.addColorStop(0, "rgba(245,222,179,0.6)");
		gr.addColorStop(0.4, "rgba(232,176,74,0.2)");
		gr.addColorStop(1, "rgba(232,176,74,0)");
		g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
		return PIXI.Texture.from(c);
	}

	/* ══════════════════════════════════════════
	   4. PixiJS 초기화
	   ══════════════════════════════════════════ */

	async function pixiInit() {
		genBg(); genDust();

		app = new PIXI.Application();
		await app.init({
			backgroundAlpha: 0,
			resizeTo: window,
			antialias: false,
			resolution: 1,
			autoDensity: true,
			preference: "webgl",
			powerPreference: "low-power",
		});

		var cv = app.canvas;
		cv.id = "constellation-canvas";
		cv.setAttribute("aria-hidden", "true");
		Object.assign(cv.style, {
			position: "fixed", top: "0", left: "0",
			width: "100%", height: "100%",
			pointerEvents: "none", zIndex: "0", opacity: "0.28",
		});
		document.body.prepend(cv);

		/* ── 레이어 (3개로 축소) ── */
		var bgLayer = new PIXI.Container();
		var mainLayer = new PIXI.Container();
		var fxLayer = new PIXI.Container();

		app.stage.addChild(bgLayer);
		app.stage.addChild(mainLayer);
		app.stage.addChild(fxLayer);

		/* Graphics (3개로 축소) */
		var bgGfx = new PIXI.Graphics(); bgLayer.addChild(bgGfx);
		var mainGfx = new PIXI.Graphics(); mainLayer.addChild(mainGfx);
		var fxGfx = new PIXI.Graphics(); fxLayer.addChild(fxGfx);

		/* 텍스처 */
		var glowTex = makeGlowTex(64);
		var trailTex = TRAIL_MAX > 0 ? makeTrailTex(24) : null;

		/* 별자리 글로우 스프라이트 */
		var conGlows = [];
		for (var i = 0; i < STARS.length; i++) {
			var gs = new PIXI.Sprite(glowTex);
			gs.anchor.set(0.5); gs.blendMode = "add";
			mainLayer.addChild(gs);
			conGlows.push(gs);
		}

		/* 마우스 트레일 스프라이트 풀 */
		var trailSprites = [];
		if (TRAIL_MAX > 0) {
			for (var t = 0; t < TRAIL_MAX; t++) {
				var ts = new PIXI.Sprite(trailTex);
				ts.anchor.set(0.5); ts.blendMode = "add";
				ts.visible = false;
				fxLayer.addChild(ts);
				trailSprites.push(ts);
			}
		}

		/* ── 이벤트 ── */
		window.addEventListener("mousemove", function (e) {
			tmx = e.clientX / W; tmy = e.clientY / H;
		}, { passive: true });
		window.addEventListener("scroll", function () { scrollY = window.scrollY; }, { passive: true });
		window.addEventListener("resize", function () { W = window.innerWidth; H = window.innerHeight; }, { passive: true });
		scrollY = window.scrollY;

		/* 프레임 스킵: 모바일에서 30fps 타겟 */
		var frameSkip = isMobile ? 1 : 0;
		var frameCount = 0;

		/* ══════════════════════════════════════
		   5. 메인 렌더 루프
		   ══════════════════════════════════════ */

		app.ticker.add(function (ticker) {
			/* 모바일 프레임 스킵 */
			if (frameSkip > 0) {
				frameCount++;
				if (frameCount % 2 !== 0) return;
			}

			var t = performance.now();
			var w = app.screen.width, h = app.screen.height;
			W = w; H = h;
			var dt = ticker.deltaTime;

			prevMx = mx; prevMy = my;
			mx += (tmx - mx) * 0.07;
			my += (tmy - my) * 0.07;
			var mPx = mx * w, mPy = my * h;
			var mouseDelta = Math.abs(mx - prevMx) + Math.abs(my - prevMy);

			/* ─── 배경: 먼지 + 별 (단일 Graphics) ─── */
			bgGfx.clear();

			/* 먼지 */
			for (var d = 0; d < dusts.length; d++) {
				var du = dusts[d];
				du.x += du.dx; du.y += du.dy;
				if (du.x < -0.1) du.x = 1.1;
				if (du.x > 1.1) du.x = -0.1;
				if (du.y < -0.1) du.y = 1.1;
				if (du.y > 1.1) du.y = -0.1;
				var pulse = Math.sin(t * du.ps + du.po);
				var dA = du.a * (0.6 + 0.4 * pulse);
				var dp = px(du, 0.08);
				bgGfx.circle(dp.x, dp.y, du.r);
				bgGfx.fill({ color: du.color, alpha: Math.min(0.06, Math.max(0, dA)) });
			}

			/* 배경 별 (단순화: 마우스 인터랙션 제거) */
			for (var bi = 0; bi < bgStars.length; bi++) {
				var bs = bgStars[bi];
				var tw = Math.sin(t * bs.ts + bs.to);
				var bp = px(bs, 0.15);
				var bA = bs.b * (0.6 + 0.4 * tw);
				bgGfx.circle(bp.x, bp.y, bs.s);
				bgGfx.fill({ color: bs.color, alpha: Math.min(1, Math.max(0, bA)) });
			}

			/* ─── 메인: 별자리 선 + 별 + 에너지 ─── */
			mainGfx.clear();

			/* 별자리 선 (솔리드 — 파선 제거로 draw call 대폭 절감) */
			for (var li = 0; li < LINES.length; li++) {
				var pair = LINES[li];
				var pA = px(STARS[pair[0]], 0.25);
				var pB = px(STARS[pair[1]], 0.25);

				var midX = (pA.x + pB.x) * 0.5, midY = (pA.y + pB.y) * 0.5;
				var lDx = midX - mPx, lDy = midY - mPy;
				var lDist2 = lDx * lDx + lDy * lDy;
				var lProx = Math.max(0, 1 - Math.sqrt(lDist2) / 350);
				var lA = 0.08 + lProx * 0.35;

				mainGfx.moveTo(pA.x, pA.y); mainGfx.lineTo(pB.x, pB.y);
				mainGfx.stroke({ color: 0xe8b04a, alpha: lA, width: 0.8 + lProx * 1.2 });
			}

			/* 에너지 펄스 (최대 2개) */
			pulseTimer += dt;
			if (pulseTimer > 60 && energyPulses.length < 2) {
				pulseTimer = 0;
				var pIdx = Math.floor(Math.random() * LINES.length);
				energyPulses.push({
					lineIdx: pIdx, progress: 0,
					speed: 0.008 + Math.random() * 0.01,
				});
			}

			for (var pi = energyPulses.length - 1; pi >= 0; pi--) {
				var ep = energyPulses[pi];
				ep.progress += ep.speed * dt;
				if (ep.progress > 1) { energyPulses.splice(pi, 1); continue; }
				var ePair = LINES[ep.lineIdx];
				if (!ePair) { energyPulses.splice(pi, 1); continue; }
				var eA = px(STARS[ePair[0]], 0.25);
				var eB = px(STARS[ePair[1]], 0.25);
				var eX = eA.x + (eB.x - eA.x) * ep.progress;
				var eY = eA.y + (eB.y - eA.y) * ep.progress;
				var eAlpha = Math.sin(ep.progress * Math.PI);
				mainGfx.circle(eX, eY, 3);
				mainGfx.fill({ color: 0xfffae0, alpha: eAlpha * 0.8 });
				mainGfx.circle(eX, eY, 8);
				mainGfx.fill({ color: 0xe8b04a, alpha: eAlpha * 0.15 });
			}

			/* 별자리 별 + 글로우 */
			for (var si = 0; si < STARS.length; si++) {
				var st = STARS[si];
				var sTw = Math.sin(t * 0.002 + si * 0.9);
				var sp = px(st, 0.25);

				var sDx = sp.x - mPx, sDy = sp.y - mPy;
				var sDist2 = sDx * sDx + sDy * sDy;
				var sProx = Math.max(0, 1 - Math.sqrt(sDist2) / 300);
				var sA = st.b * (0.6 + 0.4 * sTw) + sProx * 0.35;
				var gR = st.s * (8 + sProx * 10);

				var gSp = conGlows[si];
				gSp.x = sp.x; gSp.y = sp.y;
				gSp.width = gR * 2; gSp.height = gR * 2;
				gSp.alpha = sA * 0.35;
				gSp.tint = 0xe8b04a;

				mainGfx.circle(sp.x, sp.y, st.s);
				mainGfx.fill({ color: 0xfffae0, alpha: Math.min(1, sA * 0.75) });
			}

			/* ─── FX: 유성 + 트레일 ─── */
			ssTimer += dt;
			if (ssTimer >= ssInterval) {
				ssTimer = 0;
				ssInterval = 150 + Math.random() * 250;
				spawnSS(w, h);
			}

			fxGfx.clear();

			for (var shi = shootingStars.length - 1; shi >= 0; shi--) {
				var ss = shootingStars[shi];
				ss.x += ss.vx * dt * 0.6;
				ss.y += ss.vy * dt * 0.6;
				ss.life -= ss.decay * dt * 0.5;

				if (ss.life <= 0 || ss.x > w + 60 || ss.y > h + 60) {
					shootingStars.splice(shi, 1); continue;
				}

				var tailX = ss.x - ss.vx * 12 * ss.life;
				var tailY = ss.y - ss.vy * 12 * ss.life;

				/* 꼬리 */
				fxGfx.moveTo(ss.x, ss.y); fxGfx.lineTo(tailX, tailY);
				fxGfx.stroke({ color: 0xe8b04a, alpha: ss.life * 0.5, width: 1.5 * ss.life });

				/* 넓은 글로우 꼬리 */
				fxGfx.moveTo(ss.x, ss.y); fxGfx.lineTo(tailX, tailY);
				fxGfx.stroke({ color: 0xe8b04a, alpha: ss.life * 0.1, width: 6 * ss.life });

				/* 헤드 */
				fxGfx.circle(ss.x, ss.y, 2 + ss.life);
				fxGfx.fill({ color: 0xfffae0, alpha: ss.life * 0.9 });
			}

			/* 마우스 트레일 (PC만) */
			if (TRAIL_MAX > 0 && mouseDelta > 0.002) {
				trailParts.push({
					x: mPx, y: mPy, life: 1.0,
					decay: 0.02 + Math.random() * 0.02,
					s: 6 + Math.random() * 10,
				});
				if (trailParts.length > TRAIL_MAX) trailParts.shift();
			}

			for (var ti = 0; ti < TRAIL_MAX; ti++) {
				var tsp = trailSprites[ti];
				if (ti < trailParts.length) {
					var tp = trailParts[ti];
					tp.life -= tp.decay * dt * 0.5;
					if (tp.life <= 0) { trailParts.splice(ti, 1); tsp.visible = false; continue; }
					tsp.visible = true;
					tsp.x = tp.x; tsp.y = tp.y;
					tsp.width = tp.s * tp.life; tsp.height = tp.s * tp.life;
					tsp.alpha = tp.life * 0.4;
					tsp.tint = 0xe8b04a;
				} else {
					tsp.visible = false;
				}
			}
		});
	}

	/* ══════════════════════════════════════════
	   6. 부트
	   ══════════════════════════════════════════ */

	function start() {
		if (typeof PIXI === "undefined") {
			console.warn("PixiJS not loaded — constellation disabled.");
			return;
		}
		pixiInit().catch(function (e) { console.warn("Constellation init error:", e); });
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start);
	} else {
		start();
	}
})();
