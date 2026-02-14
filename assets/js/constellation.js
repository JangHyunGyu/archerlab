/* ═══════════════════════════════════════════════════════
   ArcherLab — Sagittarius Constellation + Candle Glow
   궁수자리 별자리를 배경에 은은하게 그리고,
   마우스/스크롤에 따라 미세한 패럴랙스 효과를 제공합니다.
   ═══════════════════════════════════════════════════════ */

(function () {
	"use strict";

	/* ── 궁수자리 별자리 좌표 (정규화: 0~1 범위) ─── */
	/* 실제 궁수자리(Sagittarius) 주요 별 위치를 단순화한 데이터 */
	const SAGITTARIUS_STARS = [
		// 찻잔(Teapot) 형태의 핵심 별들
		{ x: 0.42, y: 0.38, size: 2.8, brightness: 1.0 },   // Kaus Australis (ε Sgr)
		{ x: 0.48, y: 0.32, size: 2.2, brightness: 0.9 },   // Kaus Media (δ Sgr)
		{ x: 0.53, y: 0.28, size: 2.5, brightness: 0.95 },  // Kaus Borealis (λ Sgr)
		{ x: 0.50, y: 0.22, size: 1.8, brightness: 0.8 },   // φ Sgr
		{ x: 0.44, y: 0.24, size: 2.0, brightness: 0.85 },  // σ Sgr (Nunki)
		{ x: 0.39, y: 0.30, size: 1.6, brightness: 0.75 },  // τ Sgr
		{ x: 0.42, y: 0.38, size: 2.8, brightness: 1.0 },   // 다시 시작점 (닫기용)
		// 활과 화살 부분
		{ x: 0.55, y: 0.35, size: 2.0, brightness: 0.85 },  // γ Sgr (화살 끝)
		{ x: 0.60, y: 0.42, size: 1.5, brightness: 0.7 },   // 화살 머리
		{ x: 0.35, y: 0.45, size: 1.8, brightness: 0.8 },   // 활 아래
		{ x: 0.33, y: 0.35, size: 1.4, brightness: 0.65 },  // 활 위
	];

	/* 별자리 선을 연결하는 쌍 인덱스 */
	const CONSTELLATION_LINES = [
		[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],  // 찻잔 형태
		[1, 7], [7, 8],                                     // 화살
		[0, 9], [9, 10], [10, 5],                           // 활
	];

	/* ── 배경 별(랜덤) 데이터 ─────────────────────── */
	const BACKGROUND_STAR_COUNT = 80;
	const backgroundStars = [];

	function generateBackgroundStars() {
		for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
			backgroundStars.push({
				x: Math.random(),
				y: Math.random(),
				size: Math.random() * 1.5 + 0.3,
				brightness: Math.random() * 0.5 + 0.15,
				twinkleSpeed: Math.random() * 0.003 + 0.001,
				twinkleOffset: Math.random() * Math.PI * 2,
			});
		}
	}

	/* ── Canvas Setup ─────────────────────────────── */
	let canvas, ctx;
	let width, height;
	let mouseX = 0.5, mouseY = 0.5;
	let scrollY = 0;
	let animationId;

	function createCanvas() {
		canvas = document.createElement("canvas");
		canvas.id = "constellation-canvas";
		canvas.setAttribute("aria-hidden", "true");
		document.body.prepend(canvas);
		ctx = canvas.getContext("2d");
		resize();
	}

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = width + "px";
		canvas.style.height = height + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	/* ── Parallax 좌표 계산 ───────────────────────── */
	function parallax(star, depthFactor) {
		const offsetX = (mouseX - 0.5) * depthFactor * 30;
		const offsetY = (mouseY - 0.5) * depthFactor * 20;
		const scrollOffset = scrollY * depthFactor * 0.03;
		return {
			x: star.x * width + offsetX,
			y: star.y * height + offsetY - scrollOffset,
		};
	}

	/* ── 그리기 ───────────────────────────────────── */
	function draw(timestamp) {
		ctx.clearRect(0, 0, width, height);

		// 1. 배경 별 (작고 반짝이는)
		backgroundStars.forEach(function (star) {
			var twinkle = Math.sin(timestamp * star.twinkleSpeed + star.twinkleOffset);
			var alpha = star.brightness * (0.6 + 0.4 * twinkle);
			var pos = parallax(star, 0.15);

			ctx.beginPath();
			ctx.arc(pos.x, pos.y, star.size, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(245, 222, 179, " + Math.max(0, alpha) + ")";
			ctx.fill();
		});

		// 2. 궁수자리 별자리 선
		ctx.strokeStyle = "rgba(232, 176, 74, 0.12)";
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 6]);

		CONSTELLATION_LINES.forEach(function (pair) {
			var starA = SAGITTARIUS_STARS[pair[0]];
			var starB = SAGITTARIUS_STARS[pair[1]];
			var posA = parallax(starA, 0.25);
			var posB = parallax(starB, 0.25);

			ctx.beginPath();
			ctx.moveTo(posA.x, posA.y);
			ctx.lineTo(posB.x, posB.y);
			ctx.stroke();
		});

		ctx.setLineDash([]);

		// 3. 궁수자리 별 (글로우 포함)
		SAGITTARIUS_STARS.forEach(function (star, index) {
			// 중복 닫기 포인트 제외
			if (index === 6) return;

			var twinkle = Math.sin(timestamp * 0.002 + index * 0.8);
			var alpha = star.brightness * (0.7 + 0.3 * twinkle);
			var pos = parallax(star, 0.25);

			// 글로우 (촛불 색)
			var glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, star.size * 8);
			glow.addColorStop(0, "rgba(232, 176, 74, " + (alpha * 0.2) + ")");
			glow.addColorStop(1, "rgba(232, 176, 74, 0)");
			ctx.beginPath();
			ctx.arc(pos.x, pos.y, star.size * 8, 0, Math.PI * 2);
			ctx.fillStyle = glow;
			ctx.fill();

			// 별 본체
			ctx.beginPath();
			ctx.arc(pos.x, pos.y, star.size, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(245, 222, 179, " + alpha + ")";
			ctx.fill();
		});

		animationId = requestAnimationFrame(draw);
	}

	/* ── 이벤트 리스너 ────────────────────────────── */
	function onMouseMove(e) {
		mouseX = e.clientX / width;
		mouseY = e.clientY / height;
	}

	function onScroll() {
		scrollY = window.scrollY;
	}

	var resizeTimer;
	function onResize() {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(resize, 150);
	}

	/* ── 성능 체크: 저사양 기기에서는 비활성화 ───── */
	function shouldAnimate() {
		// prefers-reduced-motion 존중
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return false;
		}
		// 모바일에서도 기본 활성화 (가벼운 효과이므로)
		return true;
	}

	/* ── 초기화 ───────────────────────────────────── */
	function init() {
		if (!shouldAnimate()) return;

		generateBackgroundStars();
		createCanvas();

		window.addEventListener("mousemove", onMouseMove, { passive: true });
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize, { passive: true });

		onScroll();
		animationId = requestAnimationFrame(draw);
	}

	// DOM 준비 후 실행
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
