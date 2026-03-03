/* ═══════════════════════════════════════════════════════
   ArcherLab — Sagittarius Constellation  ★  Premium Edition
   PixiJS 8.x + pixi-filters GPU-Accelerated

   Features:
   • GPU 가속 WebGL 렌더링
   • AdvancedBloom + GodrayFilter + GlowFilter
   • 마우스 트레일 파티클 시스템
   • 별자리 에너지 펄스 (선을 따라 흐르는 빛)
   • ShockwaveFilter (마우스 클릭 리플)
   • 유성 + 성운 오로라 + 먼지 파티클
   • 다층 패럴랙스 + 마우스 인터랙션
   ═══════════════════════════════════════════════════════ */

(function () {
	"use strict";

	/* ── prefers-reduced-motion 존중 ── */
	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	/* ══════════════════════════════════════════════════
	   1. 데이터 정의
	   ══════════════════════════════════════════════════ */

	/* 궁수자리 별 좌표 (정규화 0~1) */
	var STARS = [
		{ x: 0.32, y: 0.68, s: 4.5, b: 1.0 },   // 0 Kaus Australis
		{ x: 0.45, y: 0.52, s: 3.5, b: 0.9 },   // 1 Kaus Media
		{ x: 0.58, y: 0.38, s: 4.0, b: 0.95 },  // 2 Kaus Borealis
		{ x: 0.52, y: 0.20, s: 3.0, b: 0.8 },   // 3 φ Sgr
		{ x: 0.35, y: 0.25, s: 3.2, b: 0.85 },  // 4 Nunki
		{ x: 0.22, y: 0.45, s: 2.6, b: 0.75 },  // 5 τ Sgr
		{ x: 0.68, y: 0.55, s: 3.2, b: 0.85 },  // 6 γ Sgr (화살 끝)
		{ x: 0.82, y: 0.72, s: 2.4, b: 0.7 },   // 7 화살 머리
		{ x: 0.18, y: 0.82, s: 3.0, b: 0.8 },   // 8 활 아래
		{ x: 0.15, y: 0.55, s: 2.2, b: 0.65 },  // 9 활 위
	];

	var LINES = [
		[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
		[1, 6], [6, 7],
		[0, 8], [8, 9], [9, 5],
	];

	/* 배경 별 */
	var BG_STAR_COUNT = 200;
	var bgStars = [];
	function genBgStars() {
		for (var i = 0; i < BG_STAR_COUNT; i++) {
			bgStars.push({
				x: Math.random(), y: Math.random(),
				s: Math.random() * 2.0 + 0.3,
				b: Math.random() * 0.5 + 0.15,
				ts: Math.random() * 0.004 + 0.001,
				to: Math.random() * Math.PI * 2,
				color: [0xf5deb3, 0xe8d5b8, 0xfff8e7, 0xffebc8][i % 4],
			});
		}
	}

	/* 유성 */
	var shootingStars = [];
	var ssTimer = 0, ssInterval = 160;
	function spawnSS(w, h) {
		if (shootingStars.length >= 3) return;
		var a = Math.PI * 0.12 + Math.random() * 0.25;
		var sp = 4 + Math.random() * 5;
		shootingStars.push({
			x: Math.random() * w * 0.85 + w * 0.05,
			y: Math.random() * h * 0.25,
			vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
			life: 1.0, decay: 0.006 + Math.random() * 0.01,
			len: 50 + Math.random() * 70,
			w: 1.2 + Math.random() * 1.8,
			trail: [],
		});
	}

	/* 성운 먼지 */
	var DUST_N = 40;
	var dusts = [];
	function genDust() {
		for (var i = 0; i < DUST_N; i++) {
			dusts.push({
				x: Math.random(), y: Math.random(),
				r: Math.random() * 40 + 20,
				a: Math.random() * 0.05 + 0.01,
				dx: (Math.random() - 0.5) * 0.0001,
				dy: (Math.random() - 0.5) * 0.00007,
				ps: Math.random() * 0.001 + 0.0005,
				po: Math.random() * Math.PI * 2,
				color: [0xe8b04a, 0xd4953a, 0xb07328, 0xc4883a][i % 4],
			});
		}
	}

	/* 마우스 트레일 파티클 */
	var TRAIL_MAX = 50;
	var trailParts = [];

	/* 에너지 펄스 (별자리 선을 흐르는 빛) */
	var energyPulses = [];
	var pulseTimer = 0;

	/* 충격파 (클릭 시) */
	var shockwaves = [];

	/* ══════════════════════════════════════════════════
	   2. 상태
	   ══════════════════════════════════════════════════ */
	var app = null;
	var W = window.innerWidth, H = window.innerHeight;
	var mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
	var prevMx = 0.5, prevMy = 0.5;
	var scrollY = 0;
	var isMobile = window.matchMedia("(pointer: coarse)").matches;
	var isTouch = "ontouchstart" in window;

	function px(star, depth) {
		var ox = (mx - 0.5) * depth * 80;
		var oy = (my - 0.5) * depth * 50;
		var sy = scrollY * depth * 0.03;
		return { x: star.x * W + ox, y: star.y * H + oy - sy };
	}

	/* ══════════════════════════════════════════════════
	   3. 텍스처 생성 유틸
	   ══════════════════════════════════════════════════ */

	function makeGlowTex(sz) {
		var c = document.createElement("canvas"); c.width = c.height = sz;
		var g = c.getContext("2d"), h = sz / 2;
		var gr = g.createRadialGradient(h, h, 0, h, h, h);
		gr.addColorStop(0, "rgba(245,222,179,0.8)");
		gr.addColorStop(0.15, "rgba(232,176,74,0.5)");
		gr.addColorStop(0.4, "rgba(232,176,74,0.15)");
		gr.addColorStop(0.7, "rgba(212,149,58,0.04)");
		gr.addColorStop(1, "rgba(212,149,58,0)");
		g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
		return PIXI.Texture.from(c);
	}

	function makeStarSpikeTex(sz) {
		var c = document.createElement("canvas"); c.width = c.height = sz;
		var g = c.getContext("2d"), h = sz / 2;
		g.translate(h, h);
		for (var i = 0; i < 4; i++) {
			g.save(); g.rotate((i * Math.PI) / 4);
			var gr = g.createLinearGradient(0, 0, h, 0);
			gr.addColorStop(0, "rgba(245,222,179,0.6)");
			gr.addColorStop(0.3, "rgba(232,176,74,0.2)");
			gr.addColorStop(1, "rgba(232,176,74,0)");
			g.fillStyle = gr;
			g.fillRect(0, -0.8, h, 1.6);
			g.restore();
		}
		return PIXI.Texture.from(c);
	}

	function makeTrailTex(sz) {
		var c = document.createElement("canvas"); c.width = c.height = sz;
		var g = c.getContext("2d"), h = sz / 2;
		var gr = g.createRadialGradient(h, h, 0, h, h, h);
		gr.addColorStop(0, "rgba(245,222,179,0.7)");
		gr.addColorStop(0.3, "rgba(232,176,74,0.3)");
		gr.addColorStop(1, "rgba(232,176,74,0)");
		g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
		return PIXI.Texture.from(c);
	}

	function makeAuroraTex(w, h) {
		var c = document.createElement("canvas"); c.width = w; c.height = h;
		var g = c.getContext("2d");
		var gr = g.createLinearGradient(0, 0, w, h);
		gr.addColorStop(0, "rgba(232,176,74,0.02)");
		gr.addColorStop(0.25, "rgba(180,115,40,0.04)");
		gr.addColorStop(0.5, "rgba(212,149,58,0.03)");
		gr.addColorStop(0.75, "rgba(200,160,90,0.02)");
		gr.addColorStop(1, "rgba(232,176,74,0.01)");
		g.fillStyle = gr; g.fillRect(0, 0, w, h);
		return PIXI.Texture.from(c);
	}

	function makePulseTex(sz) {
		var c = document.createElement("canvas"); c.width = c.height = sz;
		var g = c.getContext("2d"), h = sz / 2;
		var gr = g.createRadialGradient(h, h, 0, h, h, h);
		gr.addColorStop(0, "rgba(255,240,200,0.9)");
		gr.addColorStop(0.2, "rgba(232,176,74,0.6)");
		gr.addColorStop(0.5, "rgba(232,176,74,0.15)");
		gr.addColorStop(1, "rgba(232,176,74,0)");
		g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
		return PIXI.Texture.from(c);
	}

	/* 파선 유틸 */
	function dashedLine(gfx, x1, y1, x2, y2, dl, gl, col, a, lw) {
		var ddx = x2 - x1, ddy = y2 - y1;
		var ln = Math.sqrt(ddx * ddx + ddy * ddy);
		if (ln < 0.5) return;
		var ux = ddx / ln, uy = ddy / ln, d = 0, on = true;
		while (d < ln) {
			var s = on ? dl : gl; s = Math.min(s, ln - d);
			if (on) {
				gfx.moveTo(x1 + ux * d, y1 + uy * d);
				gfx.lineTo(x1 + ux * (d + s), y1 + uy * (d + s));
				gfx.stroke({ color: col, alpha: a, width: lw });
			}
			d += s; on = !on;
		}
	}

	/* ══════════════════════════════════════════════════
	   4. PixiJS 초기화
	   ══════════════════════════════════════════════════ */

	async function pixiInit() {
		genBgStars(); genDust();

		/* ── App 생성 ── */
		app = new PIXI.Application();
		await app.init({
			backgroundAlpha: 0,
			resizeTo: window,
			antialias: true,
			resolution: Math.min(window.devicePixelRatio || 1, 2),
			autoDensity: true,
			preference: "webgl",
		});

		var cv = app.canvas;
		cv.id = "constellation-canvas";
		cv.setAttribute("aria-hidden", "true");
		Object.assign(cv.style, {
			position: "fixed", top: "0", left: "0",
			width: "100%", height: "100%",
			pointerEvents: "none", zIndex: "10", opacity: "0.75",
		});
		document.body.prepend(cv);

		/* ── pixi-filters 로딩 확인 ── */
		var PF = typeof PIXI.filters !== "undefined" ? PIXI.filters : (typeof globalThis.PIXI !== "undefined" ? PIXI : null);
		var hasFilters = PF && (PF.AdvancedBloomFilter || PF.GlowFilter || PF.GodrayFilter);

		/* ── 레이어 구성 ── */
		var auroraLayer = new PIXI.Container();
		var dustLayer = new PIXI.Container();
		var bgLayer = new PIXI.Container();
		var lineLayer = new PIXI.Container();
		var pulseLayer = new PIXI.Container();
		var constLayer = new PIXI.Container();
		var shootLayer = new PIXI.Container();
		var trailLayer = new PIXI.Container();
		var shockLayer = new PIXI.Container();

		app.stage.addChild(auroraLayer);
		app.stage.addChild(dustLayer);
		app.stage.addChild(bgLayer);
		app.stage.addChild(lineLayer);
		app.stage.addChild(pulseLayer);
		app.stage.addChild(constLayer);
		app.stage.addChild(shootLayer);
		app.stage.addChild(trailLayer);
		app.stage.addChild(shockLayer);

		/* ── Graphics 객체 ── */
		var dustGfx = new PIXI.Graphics(); dustLayer.addChild(dustGfx);
		var bgGfx = new PIXI.Graphics(); bgLayer.addChild(bgGfx);
		var lineGfx = new PIXI.Graphics(); lineLayer.addChild(lineGfx);
		var starGfx = new PIXI.Graphics(); constLayer.addChild(starGfx);
		var shootGfx = new PIXI.Graphics(); shootLayer.addChild(shootGfx);
		var shockGfx = new PIXI.Graphics(); shockLayer.addChild(shockGfx);

		/* ── 텍스처 ── */
		var glowTex = makeGlowTex(128);
		var spikeTex = makeStarSpikeTex(128);
		var trailTex = makeTrailTex(32);
		var pulseTex = makePulseTex(48);

		/* ── 오로라 스프라이트 ── */
		var auroraSpr = new PIXI.Sprite(makeAuroraTex(512, 512));
		auroraSpr.anchor.set(0.5);
		auroraSpr.blendMode = "add";
		auroraSpr.alpha = 0.3;
		auroraLayer.addChild(auroraSpr);

		var auroraSpr2 = new PIXI.Sprite(makeAuroraTex(512, 512));
		auroraSpr2.anchor.set(0.5);
		auroraSpr2.blendMode = "add";
		auroraSpr2.alpha = 0.2;
		auroraLayer.addChild(auroraSpr2);

		/* ── 별자리 글로우 + 스파이크 스프라이트 ── */
		var conGlows = [];
		var conSpikes = [];
		for (var i = 0; i < STARS.length; i++) {
			var gs = new PIXI.Sprite(glowTex);
			gs.anchor.set(0.5); gs.blendMode = "add";
			constLayer.addChild(gs);

			var sk = new PIXI.Sprite(spikeTex);
			sk.anchor.set(0.5); sk.blendMode = "add";
			constLayer.addChild(sk);

			conGlows.push(gs);
			conSpikes.push(sk);
		}

		/* ── 마우스 트레일 스프라이트 풀 ── */
		var trailSprites = [];
		for (var t = 0; t < TRAIL_MAX; t++) {
			var ts = new PIXI.Sprite(trailTex);
			ts.anchor.set(0.5); ts.blendMode = "add";
			ts.visible = false;
			trailLayer.addChild(ts);
			trailSprites.push(ts);
		}

		/* ── pixi-filters 적용 ── */
		if (hasFilters) {
			try {
				if (PF.AdvancedBloomFilter) {
					constLayer.filters = [new PF.AdvancedBloomFilter({
						threshold: 0.3, bloomScale: 1.2, brightness: 1.1, blur: 6, quality: 6,
					})];
				}
				if (PF.GlowFilter) {
					lineLayer.filters = [new PF.GlowFilter({
						distance: 12, outerStrength: 1.5, innerStrength: 0.5, color: 0xe8b04a, quality: 0.3,
					})];
				}
				if (PF.GodrayFilter) {
					var godrayFilter = new PF.GodrayFilter({
						angle: 30, gain: 0.4, lacunarity: 2.5, parallel: true, time: 0, alpha: 0.15,
					});
					auroraLayer.filters = [godrayFilter];
				}
			} catch (e) {
				console.warn("pixi-filters apply error:", e);
			}
		}

		/* ── 내장 BlurFilter 폴백 ── */
		if (!hasFilters) {
			try {
				shootLayer.filters = [new PIXI.BlurFilter({ strength: 2, quality: 3 })];
			} catch (e) { /* noop */ }
		}

		/* ── 이벤트 ── */
		window.addEventListener("mousemove", function (e) {
			tmx = e.clientX / W;
			tmy = e.clientY / H;
		}, { passive: true });

		window.addEventListener("scroll", function () {
			scrollY = window.scrollY;
		}, { passive: true });

		window.addEventListener("resize", function () {
			W = window.innerWidth; H = window.innerHeight;
		}, { passive: true });

		/* 클릭 시 충격파 이펙트 */
		if (!isTouch) {
			document.addEventListener("mousedown", function (e) {
				shockwaves.push({
					x: e.clientX, y: e.clientY,
					radius: 0, maxRadius: 250,
					life: 1.0, speed: 4,
				});
			}, { passive: true });
		}

		scrollY = window.scrollY;

		/* ══════════════════════════════════════════════
		   5. 메인 렌더 루프
		   ══════════════════════════════════════════════ */

		app.ticker.add(function (ticker) {
			var t = performance.now();
			var w = app.screen.width, h = app.screen.height;
			W = w; H = h;
			var dt = ticker.deltaTime;

			/* 마우스 보간 */
			prevMx = mx; prevMy = my;
			mx += (tmx - mx) * 0.07;
			my += (tmy - my) * 0.07;
			var mPx = mx * w, mPy = my * h;
			var mouseDelta = Math.sqrt((mx - prevMx) * (mx - prevMx) + (my - prevMy) * (my - prevMy));

			/* ─── L0: 오로라 ─── */
			var aW = w * 1.6, aH = h * 1.4;
			auroraSpr.x = w * 0.35 + Math.sin(t * 0.00015) * w * 0.12;
			auroraSpr.y = h * 0.3 + Math.cos(t * 0.00012) * h * 0.08;
			auroraSpr.width = aW; auroraSpr.height = aH;
			auroraSpr.rotation = Math.sin(t * 0.00008) * 0.15;
			auroraSpr.alpha = 0.15 + Math.sin(t * 0.0003) * 0.08;

			auroraSpr2.x = w * 0.65 + Math.cos(t * 0.00018) * w * 0.1;
			auroraSpr2.y = h * 0.6 + Math.sin(t * 0.0001) * h * 0.06;
			auroraSpr2.width = aW * 0.8; auroraSpr2.height = aH * 0.7;
			auroraSpr2.rotation = -Math.sin(t * 0.0001) * 0.12;
			auroraSpr2.alpha = 0.1 + Math.cos(t * 0.00025) * 0.06;

			/* GodrayFilter 타임 업데이트 */
			if (hasFilters && auroraLayer.filters && auroraLayer.filters[0] && auroraLayer.filters[0].time !== undefined) {
				auroraLayer.filters[0].time = t * 0.0003;
			}

			/* ─── L1: 성운 먼지 ─── */
			dustGfx.clear();
			for (var d = 0; d < dusts.length; d++) {
				var du = dusts[d];
				du.x += du.dx; du.y += du.dy;
				if (du.x < -0.15) du.x = 1.15;
				if (du.x > 1.15) du.x = -0.15;
				if (du.y < -0.15) du.y = 1.15;
				if (du.y > 1.15) du.y = -0.15;

				var pulse = Math.sin(t * du.ps + du.po);
				var dAlpha = du.a * (0.6 + 0.4 * pulse);
				var dp = px(du, 0.08);

				/* 마우스 근처 먼지는 밝아짐 */
				var ddx = dp.x - mPx, ddy = dp.y - mPy;
				var dDist = Math.sqrt(ddx * ddx + ddy * ddy);
				var dProx = Math.max(0, 1 - dDist / 350);
				dAlpha += dProx * 0.03;

				dustGfx.circle(dp.x, dp.y, du.r);
				dustGfx.fill({ color: du.color, alpha: Math.max(0, Math.min(0.08, dAlpha)) });
			}

			/* ─── L2: 배경 별 ─── */
			bgGfx.clear();
			for (var bi = 0; bi < bgStars.length; bi++) {
				var bs = bgStars[bi];
				var tw = Math.sin(t * bs.ts + bs.to);
				var bp = px(bs, 0.15);

				var bDx = bp.x - mPx, bDy = bp.y - mPy;
				var bDist = Math.sqrt(bDx * bDx + bDy * bDy);
				var bProx = Math.max(0, 1 - bDist / 220);
				var bAlpha = bs.b * (0.55 + 0.45 * tw) + bProx * 0.65;
				var bSz = bs.s + bProx * 2.5;

				/* 별 본체 */
				bgGfx.circle(bp.x, bp.y, bSz);
				bgGfx.fill({ color: bs.color, alpha: Math.min(1, Math.max(0, bAlpha)) });

				/* 마우스 근처 십자 글로우 */
				if (bProx > 0.15) {
					var cLen = bSz * 5 * bProx;
					var cA = bProx * 0.3;
					bgGfx.moveTo(bp.x - cLen, bp.y); bgGfx.lineTo(bp.x + cLen, bp.y);
					bgGfx.stroke({ color: 0xe8b04a, alpha: cA, width: 0.6 });
					bgGfx.moveTo(bp.x, bp.y - cLen); bgGfx.lineTo(bp.x, bp.y + cLen);
					bgGfx.stroke({ color: 0xe8b04a, alpha: cA, width: 0.6 });
				}

				/* 글로우 원 */
				if (bProx > 0.1) {
					bgGfx.circle(bp.x, bp.y, bSz * 4);
					bgGfx.fill({ color: 0xe8b04a, alpha: bProx * 0.18 });
				}
			}

			/* ─── L3: 별자리 파선 + 솔리드 언더라인 ─── */
			lineGfx.clear();
			for (var li = 0; li < LINES.length; li++) {
				var pair = LINES[li];
				var pA = px(STARS[pair[0]], 0.25);
				var pB = px(STARS[pair[1]], 0.25);

				var mX = (pA.x + pB.x) / 2, mY = (pA.y + pB.y) / 2;
				var lDx = mX - mPx, lDy = mY - mPy;
				var lDist = Math.sqrt(lDx * lDx + lDy * lDy);
				var lProx = Math.max(0, 1 - lDist / 350);
				var lAlpha = 0.1 + lProx * 0.45;
				var lW = 0.8 + lProx * 2;

				/* 언더글로우 (넓은 반투명 선) */
				lineGfx.moveTo(pA.x, pA.y); lineGfx.lineTo(pB.x, pB.y);
				lineGfx.stroke({ color: 0xe8b04a, alpha: lAlpha * 0.2, width: lW * 4 });

				/* 메인 파선 */
				dashedLine(lineGfx, pA.x, pA.y, pB.x, pB.y, 5, 7, 0xe8b04a, lAlpha, lW);
			}

			/* ─── L3.5: 에너지 펄스 ─── */
			pulseTimer += dt;
			if (pulseTimer > 40 + Math.random() * 30) {
				pulseTimer = 0;
				var pLine = LINES[Math.floor(Math.random() * LINES.length)];
				energyPulses.push({
					lineIdx: LINES.indexOf(pLine),
					from: pLine[0], to: pLine[1],
					progress: 0, speed: 0.008 + Math.random() * 0.012,
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

				/* 펄스 스프라이트 대신 Graphics로 그리기 */
				lineGfx.circle(eX, eY, 3);
				lineGfx.fill({ color: 0xfffae0, alpha: eAlpha * 0.9 });
				lineGfx.circle(eX, eY, 10);
				lineGfx.fill({ color: 0xe8b04a, alpha: eAlpha * 0.3 });
				lineGfx.circle(eX, eY, 20);
				lineGfx.fill({ color: 0xe8b04a, alpha: eAlpha * 0.08 });
			}

			/* ─── L4: 별자리 별 + 글로우 + 스파이크 ─── */
			starGfx.clear();
			for (var si = 0; si < STARS.length; si++) {
				var st = STARS[si];
				var sTw = Math.sin(t * 0.0025 + si * 0.9);
				var sp = px(st, 0.25);

				var sDx = sp.x - mPx, sDy = sp.y - mPy;
				var sDist = Math.sqrt(sDx * sDx + sDy * sDy);
				var sProx = Math.max(0, 1 - sDist / 300);
				var sA = st.b * (0.65 + 0.35 * sTw) + sProx * 0.45;
				var gR = st.s * (10 + sProx * 16);

				/* 글로우 스프라이트 */
				var gSp = conGlows[si];
				gSp.x = sp.x; gSp.y = sp.y;
				gSp.width = gR * 2.5; gSp.height = gR * 2.5;
				gSp.alpha = sA * 0.4;
				gSp.tint = 0xe8b04a;

				/* 스파이크 스프라이트 */
				var skSp = conSpikes[si];
				skSp.x = sp.x; skSp.y = sp.y;
				skSp.width = gR * 3; skSp.height = gR * 3;
				skSp.alpha = sA * 0.25;
				skSp.tint = 0xf5deb3;
				skSp.rotation = t * 0.0003 + si;

				/* 별 코어 (밝은 중심) */
				starGfx.circle(sp.x, sp.y, st.s * 1.2);
				starGfx.fill({ color: 0xfffae0, alpha: Math.min(1, sA * 0.8) });

				/* 별 외곽 */
				starGfx.circle(sp.x, sp.y, st.s * 0.7);
				starGfx.fill({ color: 0xffffff, alpha: Math.min(1, sA * 0.6) });
			}

			/* ─── L5: 유성 + 잔해 파티클 ─── */
			ssTimer += dt;
			if (ssTimer >= ssInterval) {
				ssTimer = 0;
				ssInterval = 100 + Math.random() * 200;
				spawnSS(w, h);
			}

			shootGfx.clear();
			for (var shi = shootingStars.length - 1; shi >= 0; shi--) {
				var ss = shootingStars[shi];
				ss.x += ss.vx * dt * 0.6;
				ss.y += ss.vy * dt * 0.6;
				ss.life -= ss.decay * dt * 0.5;

				/* 잔해 트레일 기록 */
				ss.trail.push({ x: ss.x, y: ss.y, a: ss.life });
				if (ss.trail.length > 20) ss.trail.shift();

				if (ss.life <= 0 || ss.x > w + 80 || ss.y > h + 80) {
					shootingStars.splice(shi, 1); continue;
				}

				/* 유성 꼬리 트레일 (점점 얇아지는 다중선) */
				for (var trI = 1; trI < ss.trail.length; trI++) {
					var tA = ss.trail[trI], tB = ss.trail[trI - 1];
					var trAlpha = (trI / ss.trail.length) * ss.life;
					shootGfx.moveTo(tB.x, tB.y); shootGfx.lineTo(tA.x, tA.y);
					shootGfx.stroke({ color: 0xe8b04a, alpha: trAlpha * 0.6, width: ss.w * trAlpha * 1.5 });
				}

				/* 넓은 글로우 꼬리 */
				if (ss.trail.length > 2) {
					var tLast = ss.trail[0];
					shootGfx.moveTo(ss.x, ss.y); shootGfx.lineTo(tLast.x, tLast.y);
					shootGfx.stroke({ color: 0xe8b04a, alpha: ss.life * 0.12, width: ss.w * ss.life * 8 });
				}

				/* 유성 헤드 */
				shootGfx.circle(ss.x, ss.y, 2.5 + ss.w * ss.life);
				shootGfx.fill({ color: 0xfffae0, alpha: ss.life * 0.95 });
				shootGfx.circle(ss.x, ss.y, 6 + ss.w * ss.life * 2);
				shootGfx.fill({ color: 0xe8b04a, alpha: ss.life * 0.3 });
			}

			/* ─── L6: 마우스 트레일 파티클 ─── */
			if (!isMobile && mouseDelta > 0.001) {
				trailParts.push({
					x: mPx, y: mPy,
					vx: (Math.random() - 0.5) * 0.8,
					vy: (Math.random() - 0.5) * 0.8,
					life: 1.0, decay: 0.015 + Math.random() * 0.02,
					s: 8 + Math.random() * 16,
				});
				if (trailParts.length > TRAIL_MAX) trailParts.shift();
			}

			for (var ti = 0; ti < TRAIL_MAX; ti++) {
				var tsp = trailSprites[ti];
				if (ti < trailParts.length) {
					var tp = trailParts[ti];
					tp.x += tp.vx * dt; tp.y += tp.vy * dt;
					tp.life -= tp.decay * dt * 0.5;
					if (tp.life <= 0) { trailParts.splice(ti, 1); tsp.visible = false; continue; }
					tsp.visible = true;
					tsp.x = tp.x; tsp.y = tp.y;
					tsp.width = tp.s * tp.life; tsp.height = tp.s * tp.life;
					tsp.alpha = tp.life * 0.5;
					tsp.tint = 0xe8b04a;
				} else {
					tsp.visible = false;
				}
			}

			/* ─── L7: 충격파 리플 ─── */
			shockGfx.clear();
			for (var swi = shockwaves.length - 1; swi >= 0; swi--) {
				var sw = shockwaves[swi];
				sw.radius += sw.speed * dt * 2;
				sw.life -= 0.012 * dt;

				if (sw.life <= 0 || sw.radius > sw.maxRadius) {
					shockwaves.splice(swi, 1); continue;
				}

				var swA = sw.life * 0.35;
				/* 외곽 링 */
				shockGfx.circle(sw.x, sw.y, sw.radius);
				shockGfx.stroke({ color: 0xe8b04a, alpha: swA, width: 1.5 });
				/* 내부 링 */
				shockGfx.circle(sw.x, sw.y, sw.radius * 0.7);
				shockGfx.stroke({ color: 0xf5deb3, alpha: swA * 0.5, width: 0.8 });
				/* 넓은 글로우 */
				shockGfx.circle(sw.x, sw.y, sw.radius);
				shockGfx.stroke({ color: 0xe8b04a, alpha: swA * 0.15, width: 12 });
			}
		});
	}

	/* ══════════════════════════════════════════════════
	   6. 부트
	   ══════════════════════════════════════════════════ */

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
