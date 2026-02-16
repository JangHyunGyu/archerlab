/**
 * Cursor Follower — Targeting Lock-on Effect
 * 클릭 가능한 요소에 마우스를 올리면 십자가 에임 커서 주변에
 * 회전 링 + 코너 브래킷 타겟팅 애니메이션이 표시됩니다.
 */
(() => {
	// 터치 디바이스에서는 비활성화
	if (window.matchMedia("(pointer: coarse)").matches) return;

	/* ── DOM 요소 생성 ── */
	const ring = document.createElement("div");
	ring.className = "cursor-ring";

	const corners = document.createElement("div");
	corners.className = "cursor-corners";
	for (let i = 0; i < 4; i++) {
		corners.appendChild(document.createElement("span"));
	}

	document.body.appendChild(ring);
	document.body.appendChild(corners);

	/* ── 상태 ── */
	let mouseX = -100;
	let mouseY = -100;
	let ringX = -100;
	let ringY = -100;
	let animating = false;

	// 클릭 가능한 요소 셀렉터
	const INTERACTIVE_SELECTOR = [
		"a",
		"button",
		"select",
		"[role='button']",
		".hub-card",
		".pill-card",
		".feature-card",
		".cta-btn",
		".ghost-btn",
		".scroll-top",
		".contact-mail-address"
	].join(",");

	// 카드(큰 요소) 셀렉터 — 좀 더 큰 타겟팅 효과
	const CARD_SELECTOR = [
		".hub-card",
		".pill-card",
		".feature-card",
		".stat",
		".testimonial",
		".longform"
	].join(",");

	/* ── 마우스 이동 추적 ── */
	const onMouseMove = (e) => {
		mouseX = e.clientX;
		mouseY = e.clientY;
		if (!animating) {
			animating = true;
			requestAnimationFrame(followCursor);
		}
	};

	/* ── 부드러운 커서 추적 (lerp) ── */
	const followCursor = () => {
		const ease = 0.18;
		ringX += (mouseX - ringX) * ease;
		ringY += (mouseY - ringY) * ease;

		const ringW = ring.offsetWidth;
		const ringH = ring.offsetHeight;
		const tx = ringX - ringW / 2;
		const ty = ringY - ringH / 2;

		ring.style.transform = `translate(${tx}px, ${ty}px)`;
		corners.style.transform = `translate(${tx}px, ${ty}px)`;

		// 충분히 가까우면 정지, 아니면 계속 추적
		if (Math.abs(mouseX - ringX) > 0.5 || Math.abs(mouseY - ringY) > 0.5) {
			requestAnimationFrame(followCursor);
		} else {
			animating = false;
		}
	};

	/* ── 호버 감지 ── */
	const onMouseOver = (e) => {
		const target = e.target.closest(INTERACTIVE_SELECTOR);
		if (!target) {
			ring.classList.remove("active", "active-card");
			corners.classList.remove("active", "active-card");
			return;
		}

		const isCard = target.matches(CARD_SELECTOR);
		if (isCard) {
			ring.classList.remove("active");
			corners.classList.remove("active");
			ring.classList.add("active-card");
			corners.classList.add("active-card");
		} else {
			ring.classList.remove("active-card");
			corners.classList.remove("active-card");
			ring.classList.add("active");
			corners.classList.add("active");
		}
	};

	const onMouseOut = (e) => {
		const related = e.relatedTarget;
		if (related && related.closest && related.closest(INTERACTIVE_SELECTOR)) return;
		ring.classList.remove("active", "active-card");
		corners.classList.remove("active", "active-card");
	};

	/* ── 페이지 밖으로 나갈 때 숨기기 ── */
	const onMouseLeave = () => {
		ring.classList.remove("active", "active-card");
		corners.classList.remove("active", "active-card");
		ring.style.opacity = "0";
		corners.style.opacity = "0";
	};

	const onMouseEnter = () => {
		ring.style.opacity = "";
		corners.style.opacity = "";
	};

	/* ── 이벤트 등록 ── */
	document.addEventListener("mousemove", onMouseMove, { passive: true });
	document.addEventListener("mouseover", onMouseOver, { passive: true });
	document.addEventListener("mouseout", onMouseOut, { passive: true });
	document.documentElement.addEventListener("mouseleave", onMouseLeave);
	document.documentElement.addEventListener("mouseenter", onMouseEnter);
})();
