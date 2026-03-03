/* ═══════════════════════════════════════════════════════
   ArcherLab — Sagittarius Constellation + Candle Glow
   PixiJS 8.x GPU-Accelerated Version
   궁수자리 별자리를 배경에 은은하게 그리고,
   마우스/스크롤에 따라 미세한 패럴랙스 효과를 제공합니다.
   파티클 기반 유성 + 글로우 필터로 풍부한 비주얼 제공.
   ═══════════════════════════════════════════════════════ */

(function () {
	"use strict";

	/* ── 성능 체크: 저사양 기기에서는 비활성화 ───── */
	function shouldAnimate() {
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return false;
		}
		return true;
	}

	if (!shouldAnimate()) return;

	/* ── 궁수자리 별자리 좌표 (정규화: 0~1 범위) ─── */
	var SAGITTARIUS_STARS = [
		{ x: 0.32, y: 0.68, size: 4.0, brightness: 1.0 },
		{ x: 0.45, y: 0.52, size: 3.2, brightness: 0.9 },
		{ x: 0.58, y: 0.38, size: 3.6, brightness: 0.95 },
		{ x: 0.52, y: 0.20, size: 2.8, brightness: 0.8 },
		{ x: 0.35, y: 0.25, size: 3.0, brightness: 0.85 },
		{ x: 0.22, y: 0.45, size: 2.4, brightness: 0.75 },
		{ x: 0.32, y: 0.68, size: 4.0, brightness: 1.0 },
		{ x: 0.68, y: 0.55, size: 3.0, brightness: 0.85 },
		{ x: 0.82, y: 0.72, size: 2.2, brightness: 0.7 },
		{ x: 0.18, y: 0.82, size: 2.8, brightness: 0.8 },
		{ x: 0.15, y: 0.55, size: 2.0, brightness: 0.65 },
	];

	var CONSTELLATION_LINES = [
		[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
		[1, 7], [7, 8],
		[0, 9], [9, 10], [10, 5],
	];

	/* ── 배경 별 데이터 ─────────────────────────── */
	var BACKGROUND_STAR_COUNT = 160;
	var backgroundStars = [];

	function generateBackgroundStars() {
		for (var i = 0; i < BACKGROUND_STAR_COUNT; i++) {
			backgroundStars.push({
				x: Math.random(),
				y: Math.random(),
				size: Math.random() * 1.8 + 0.3,
				brightness: Math.random() * 0.5 + 0.15,
				twinkleSpeed: Math.random() * 0.003 + 0.001,
				twinkleOffset: Math.random() * Math.PI * 2,
			});
		}
	}

	/* ── 유성(Shooting Star) 파티클 데이터 ──────── */
	var SHOOTING_STAR_MAX = 3;
	var shootingStars = [];
	var shootingStarTimer = 0;
	var SHOOTING_STAR_INTERVAL = 180;

	function spawnShootingStar(w, h) {
		if (shootingStars.length >= SHOOTING_STAR_MAX) return;
		var startX = Math.random() * w * 0.8 + w * 0.1;
		var startY = Math.random() * h * 0.3;
		var angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
		var speed = 3 + Math.random() * 4;
		shootingStars.push({
			x: startX,
			y: startY,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			life: 1.0,
			decay: 0.008 + Math.random() * 0.012,
			length: 40 + Math.random() * 60,
			width: 1.0 + Math.random() * 1.5,
		});
	}

	/* ── 먼지 파티클(Nebula Dust) 데이터 ─────────── */
	var DUST_COUNT = 30;
	var dustParticles = [];

	function generateDust() {
		for (var i = 0; i < DUST_COUNT; i++) {
			dustParticles.push({
				x: Math.random(),
				y: Math.random(),
				size: Math.random() * 30 + 15,
				alpha: Math.random() * 0.04 + 0.01,
				driftX: (Math.random() - 0.5) * 0.00008,
				driftY: (Math.random() - 0.5) * 0.00005,
				pulseSpeed: Math.random() * 0.001 + 0.0005,
				pulseOffset: Math.random() * Math.PI * 2,
			});
		}
	}

	/* ── 상태 ─────────────────────────────────────── */
	var app = null;
	var width = window.innerWidth;
	var height = window.innerHeight;
	var mouseX = 0.5, mouseY = 0.5;
	var targetMouseX = 0.5, targetMouseY = 0.5;
	var scrollY = 0;

	/* ── Parallax 좌표 계산 ───────────────────────── */
	function parallax(star, depthFactor) {
		var offsetX = (mouseX - 0.5) * depthFactor * 80;
		var offsetY = (mouseY - 0.5) * depthFactor * 50;
		var scrollOffset = scrollY * depthFactor * 0.03;
		return {
			x: star.x * width + offsetX,
			y: star.y * height + offsetY - scrollOffset,
		};
	}

	/* ── PixiJS 초기화 ────────────────────────────── */
	async function pixiInit() {
		generateBackgroundStars();
		generateDust();

		app = new PIXI.Application();
		await app.init({
			backgroundAlpha: 0,
			resizeTo: window,
			antialias: true,
			resolution: Math.min(window.devicePixelRatio || 1, 2),
			autoDensity: true,
			preference: "webgl",
		});

		var canvas = app.canvas;
		canvas.id = "constellation-canvas";
		canvas.setAttribute("aria-hidden", "true");
		canvas.style.position = "fixed";
		canvas.style.top = "0";
		canvas.style.left = "0";
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		canvas.style.pointerEvents = "none";
		canvas.style.zIndex = "10";
		canvas.style.opacity = "0.7";
		document.body.prepend(canvas);

		/* ── 레이어 ── */
		var dustLayer = new PIXI.Container();
		var bgStarLayer = new PIXI.Container();
		var lineLayer = new PIXI.Container();
		var constellationLayer = new PIXI.Container();
		var shootingLayer = new PIXI.Container();

		app.stage.addChild(dustLayer);
		app.stage.addChild(bgStarLayer);
		app.stage.addChild(lineLayer);
		app.stage.addChild(constellationLayer);
		app.stage.addChild(shootingLayer);

		var dustGfx = new PIXI.Graphics();
		var bgGfx = new PIXI.Graphics();
		var lineGfx = new PIXI.Graphics();
		var starGfx = new PIXI.Graphics();
		var shootGfx = new PIXI.Graphics();

		dustLayer.addChild(dustGfx);
		bgStarLayer.addChild(bgGfx);
		lineLayer.addChild(lineGfx);
		constellationLayer.addChild(starGfx);
		shootingLayer.addChild(shootGfx);

		/* 별자리 별 글로우 스프라이트 */
		var glowTexture = createGlowTexture(64);
		var glowSprites = [];
		for (var i = 0; i < SAGITTARIUS_STARS.length; i++) {
			if (i === 6) continue;
			var sprite = new PIXI.Sprite(glowTexture);
			sprite.anchor.set(0.5);
			sprite.blendMode = "add";
			constellationLayer.addChild(sprite);
			glowSprites.push({ sprite: sprite, index: i });
		}

		/* ── 이벤트 리스너 ── */
		window.addEventListener("mousemove", function (e) {
			targetMouseX = e.clientX / width;
			targetMouseY = e.clientY / height;
		}, { passive: true });

		window.addEventListener("scroll", function () {
			scrollY = window.scrollY;
		}, { passive: true });

		window.addEventListener("resize", function () {
			width = window.innerWidth;
			height = window.innerHeight;
		}, { passive: true });

		scrollY = window.scrollY;

		/* ── 메인 렌더 루프 ── */
		app.ticker.add(function () {
			var timestamp = performance.now();
			var w = app.screen.width;
			var h = app.screen.height;
			width = w;
			height = h;

			mouseX += (targetMouseX - mouseX) * 0.08;
			mouseY += (targetMouseY - mouseY) * 0.08;

			var mxPx = mouseX * w;
			var myPx = mouseY * h;

			/* 0 — 성운 먼지 */
			dustGfx.clear();
			for (var d = 0; d < dustParticles.length; d++) {
				var dust = dustParticles[d];
				dust.x += dust.driftX;
				dust.y += dust.driftY;
				if (dust.x < -0.1) dust.x = 1.1;
				if (dust.x > 1.1) dust.x = -0.1;
				if (dust.y < -0.1) dust.y = 1.1;
				if (dust.y > 1.1) dust.y = -0.1;

				var pulse = Math.sin(timestamp * dust.pulseSpeed + dust.pulseOffset);
				var dustAlpha = dust.alpha * (0.6 + 0.4 * pulse);
				var dpos = parallax(dust, 0.08);

				dustGfx.circle(dpos.x, dpos.y, dust.size);
				dustGfx.fill({ color: 0xe8b04a, alpha: Math.max(0, Math.min(0.06, dustAlpha)) });
			}

			/* 1 — 배경 별 */
			bgGfx.clear();
			for (var bi = 0; bi < backgroundStars.length; bi++) {
				var bStar = backgroundStars[bi];
				var twinkle = Math.sin(timestamp * bStar.twinkleSpeed + bStar.twinkleOffset);
				var bpos = parallax(bStar, 0.15);

				var dx = bpos.x - mxPx;
				var dy = bpos.y - myPx;
				var dist = Math.sqrt(dx * dx + dy * dy);
				var proximity = Math.max(0, 1 - dist / 250);
				var bAlpha = bStar.brightness * (0.6 + 0.4 * twinkle) + proximity * 0.6;
				var bSize = bStar.size + proximity * 2;

				bgGfx.circle(bpos.x, bpos.y, bSize);
				bgGfx.fill({ color: 0xf5deb3, alpha: Math.min(1, Math.max(0, bAlpha)) });

				if (proximity > 0.1) {
					bgGfx.circle(bpos.x, bpos.y, bSize * 4);
					bgGfx.fill({ color: 0xe8b04a, alpha: proximity * 0.2 });
				}
			}

			/* 2 — 별자리 파선 */
			lineGfx.clear();
			for (var li = 0; li < CONSTELLATION_LINES.length; li++) {
				var pair = CONSTELLATION_LINES[li];
				var starA = SAGITTARIUS_STARS[pair[0]];
				var starB = SAGITTARIUS_STARS[pair[1]];
				var posA = parallax(starA, 0.25);
				var posB = parallax(starB, 0.25);

				var midX = (posA.x + posB.x) / 2;
				var midY = (posA.y + posB.y) / 2;
				var dxL = midX - mxPx;
				var dyL = midY - myPx;
				var distL = Math.sqrt(dxL * dxL + dyL * dyL);
				var lineProx = Math.max(0, 1 - distL / 300);
				var lineAlpha = 0.12 + lineProx * 0.35;
				var lineWidth = 1 + lineProx * 1.5;

				drawDashedLine(lineGfx, posA.x, posA.y, posB.x, posB.y, 4, 6, 0xe8b04a, lineAlpha, lineWidth);
			}

			/* 3 — 별자리 별 + 글로우 스프라이트 */
			starGfx.clear();
			var glowIdx = 0;
			for (var si = 0; si < SAGITTARIUS_STARS.length; si++) {
				if (si === 6) continue;
				var star = SAGITTARIUS_STARS[si];
				var sTwinkle = Math.sin(timestamp * 0.002 + si * 0.8);
				var spos = parallax(star, 0.25);

				var dxS = spos.x - mxPx;
				var dyS = spos.y - myPx;
				var distS = Math.sqrt(dxS * dxS + dyS * dyS);
				var proxS = Math.max(0, 1 - distS / 300);
				var sAlpha = star.brightness * (0.7 + 0.3 * sTwinkle) + proxS * 0.4;
				var glowRadius = star.size * (8 + proxS * 12);

				if (glowIdx < glowSprites.length) {
					var gs = glowSprites[glowIdx].sprite;
					gs.x = spos.x;
					gs.y = spos.y;
					gs.width = glowRadius * 2;
					gs.height = glowRadius * 2;
					gs.alpha = sAlpha * 0.35;
					gs.tint = 0xe8b04a;
					glowIdx++;
				}

				starGfx.circle(spos.x, spos.y, star.size);
				starGfx.fill({ color: 0xf5deb3, alpha: Math.min(1, sAlpha) });
			}

			/* 4 — 유성 */
			shootingStarTimer++;
			if (shootingStarTimer >= SHOOTING_STAR_INTERVAL) {
				shootingStarTimer = 0;
				SHOOTING_STAR_INTERVAL = 120 + Math.random() * 180;
				spawnShootingStar(w, h);
			}

			shootGfx.clear();
			for (var shi = shootingStars.length - 1; shi >= 0; shi--) {
				var ss = shootingStars[shi];
				ss.x += ss.vx;
				ss.y += ss.vy;
				ss.life -= ss.decay;

				if (ss.life <= 0 || ss.x > w + 50 || ss.y > h + 50) {
					shootingStars.splice(shi, 1);
					continue;
				}

				var tailX = ss.x - ss.vx * ss.length * ss.life * 0.3;
				var tailY = ss.y - ss.vy * ss.length * ss.life * 0.3;

				shootGfx.circle(ss.x, ss.y, 2 + ss.width * ss.life);
				shootGfx.fill({ color: 0xf5deb3, alpha: ss.life * 0.9 });

				shootGfx.moveTo(ss.x, ss.y);
				shootGfx.lineTo(tailX, tailY);
				shootGfx.stroke({ color: 0xe8b04a, alpha: ss.life * 0.5, width: ss.width * ss.life });

				shootGfx.moveTo(ss.x, ss.y);
				shootGfx.lineTo(tailX, tailY);
				shootGfx.stroke({ color: 0xe8b04a, alpha: ss.life * 0.15, width: ss.width * ss.life * 6 });
			}
		});
	}

	/* ── 파선 그리기 유틸 ──────────────────────── */
	function drawDashedLine(gfx, x1, y1, x2, y2, dashLen, gapLen, color, alpha, lineWidth) {
		var ddx = x2 - x1;
		var ddy = y2 - y1;
		var len = Math.sqrt(ddx * ddx + ddy * ddy);
		var ux = ddx / len;
		var uy = ddy / len;
		var drawn = 0;
		var isDash = true;

		while (drawn < len) {
			var seg = isDash ? dashLen : gapLen;
			seg = Math.min(seg, len - drawn);
			var sx = x1 + ux * drawn;
			var sy = y1 + uy * drawn;
			var ex = x1 + ux * (drawn + seg);
			var ey = y1 + uy * (drawn + seg);

			if (isDash) {
				gfx.moveTo(sx, sy);
				gfx.lineTo(ex, ey);
				gfx.stroke({ color: color, alpha: alpha, width: lineWidth });
			}
			drawn += seg;
			isDash = !isDash;
		}
	}

	/* ── 글로우 텍스처 생성 ── */
	function createGlowTexture(size) {
		var c = document.createElement("canvas");
		c.width = size;
		c.height = size;
		var ctx = c.getContext("2d");
		var half = size / 2;
		var gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
		gradient.addColorStop(0, "rgba(232, 176, 74, 0.6)");
		gradient.addColorStop(0.3, "rgba(232, 176, 74, 0.2)");
		gradient.addColorStop(0.7, "rgba(232, 176, 74, 0.05)");
		gradient.addColorStop(1, "rgba(232, 176, 74, 0)");
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, size, size);
		return PIXI.Texture.from(c);
	}

	/* ── DOM 준비 후 실행 ── */
	function start() {
		if (typeof PIXI === "undefined") {
			console.warn("PixiJS not loaded, constellation effect disabled.");
			return;
		}
		pixiInit().catch(function (err) {
			console.warn("PixiJS constellation init failed:", err);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start);
	} else {
		start();
	}
})();
