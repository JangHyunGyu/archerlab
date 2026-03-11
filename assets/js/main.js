// DOMContentLoaded 이벤트는 HTML 문서가 완전히 파싱되었을 때 발생합니다.
document.addEventListener("DOMContentLoaded", () => {
	const LANGUAGE_STORAGE_KEY = "archerlab:language";

	const normalizeLanguage = (value) => {
		if (!value || typeof value !== "string") {
			return null;
		}
		const lowered = value.toLowerCase();
		if (lowered.startsWith("ko")) {
			return "ko";
		}
		if (lowered.startsWith("en")) {
			return "en";
		}
		return null;
	};

	const detectBrowserLanguage = () => {
		const candidate = Array.isArray(navigator.languages) && navigator.languages.length
			? navigator.languages[0]
			: navigator.language || navigator.userLanguage || "";
		return normalizeLanguage(candidate);
	};

	const getStoredLanguage = () => {
		try {
			return localStorage.getItem(LANGUAGE_STORAGE_KEY);
		} catch (error) {
			return null;
		}
	};

	const setStoredLanguage = (code) => {
		if (!code) {
			return;
		}
		try {
			localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
		} catch (error) {
			// 저장이 불가능한 환경에서는 조용히 무시합니다.
		}
	};

	const currentLanguage = normalizeLanguage(document.documentElement?.lang || "");
	const storedLanguage = normalizeLanguage(getStoredLanguage());
	const browserLanguage = detectBrowserLanguage();

	/* ── 커스텀 언어 드롭다운 ── */
	const dropdowns = document.querySelectorAll("[data-lang-dropdown]");

	// 자동 언어 리다이렉트 (첫 방문 시)
	if (/bot|crawl|spider|slurp|facebookexternalhit|mediapartners/i.test(navigator.userAgent)) return;
	const preferredLanguage = storedLanguage || browserLanguage;
	if (preferredLanguage && currentLanguage && preferredLanguage !== currentLanguage) {
		const firstDropdown = dropdowns[0];
		if (firstDropdown) {
			const matchItem = firstDropdown.querySelector(`[data-lang-code="${preferredLanguage}"]`);
			if (matchItem) {
				setStoredLanguage(preferredLanguage);
				window.location.replace(matchItem.dataset.langUrl);
				return;
			}
		}
	}

	if (!storedLanguage && currentLanguage) {
		setStoredLanguage(currentLanguage);
	}

	dropdowns.forEach((dropdown) => {
		const toggle = dropdown.querySelector(".lang-dropdown__toggle");
		const menu = dropdown.querySelector(".lang-dropdown__menu");
		const items = dropdown.querySelectorAll(".lang-dropdown__item");

		if (!toggle || !menu) return;

		const open = () => {
			dropdown.setAttribute("data-open", "");
			toggle.setAttribute("aria-expanded", "true");
		};

		const close = () => {
			dropdown.removeAttribute("data-open");
			toggle.setAttribute("aria-expanded", "false");
		};

		const isOpen = () => dropdown.hasAttribute("data-open");

		toggle.addEventListener("click", (e) => {
			e.stopPropagation();
			isOpen() ? close() : open();
		});

		// ESC 키로 닫기
		dropdown.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && isOpen()) {
				close();
				toggle.focus();
			}
		});

		// 외부 클릭 시 닫기
		document.addEventListener("click", (e) => {
			if (isOpen() && !dropdown.contains(e.target)) {
				close();
			}
		});

		// 항목 선택
		items.forEach((item) => {
			item.addEventListener("click", () => {
				const langCode = item.dataset.langCode;
				const langUrl = item.dataset.langUrl;
				if (langCode) {
					setStoredLanguage(langCode);
				}
				if (langUrl) {
					window.location.href = langUrl;
				}
			});

			// 키보드 접근성
			item.setAttribute("tabindex", "0");
			item.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					item.click();
				}
			});
		});
	});

	const languageLinkTargets = {
		itstory: {
			ko: "https://itstory.archerlab.dev",
			en: "https://itstory.archerlab.dev/index-en"
		},
		walkwithme: {
			ko: "https://chatbot.archerlab.dev",
			en: "https://chatbot.archerlab.dev/index-en"
		}
	};

	const resolveActiveLanguage = () => currentLanguage || normalizeLanguage(getStoredLanguage()) || browserLanguage || "ko";

	const syncExternalLanguageLinks = () => {
		const languageCode = resolveActiveLanguage();
		const linkNodes = document.querySelectorAll("[data-language-link][data-link-key]");
		if (!linkNodes.length) {
			return;
		}
		linkNodes.forEach((node) => {
			const linkKey = node.dataset?.linkKey;
			if (!linkKey) {
				return;
			}
			const targets = languageLinkTargets[linkKey];
			if (!targets) {
				return;
			}
			node.href = targets[languageCode] || targets.en || node.href;
		});
	};

	syncExternalLanguageLinks();

	// 푸터 연도를 채울 span 요소를 id로 선택합니다.
	const yearEl = document.getElementById("year");
	// 요소가 존재하는 경우에만 값을 업데이트해 오류를 방지합니다.
	if (yearEl) {
		// 현재 연도를 구한 뒤 텍스트 콘텐츠로 삽입합니다.
		yearEl.textContent = new Date().getFullYear();
	}

	/* ── 카테고리 탭 필터 ── */
	const tabBtns = document.querySelectorAll('.tab-btn');
	const hubCards = document.querySelectorAll('.hub-card');

	tabBtns.forEach((btn) => {
		btn.addEventListener('click', () => {
			const tab = btn.dataset.tab;

			tabBtns.forEach((b) => b.classList.remove('active'));
			btn.classList.add('active');

			hubCards.forEach((card) => {
				if (tab === 'all' || card.dataset.category === tab) {
					card.removeAttribute('hidden');
				} else {
					card.setAttribute('hidden', '');
				}
			});
		});
	});

	const scrollTopButton = document.querySelector('[data-scroll-top]');
	if (scrollTopButton) {
		const toggleScrollTop = () => {
			const shouldShow = window.scrollY > 320;
			const isHidden = scrollTopButton.hasAttribute('hidden');
			if (shouldShow && isHidden) {
				scrollTopButton.removeAttribute('hidden');
			} else if (!shouldShow && !isHidden) {
				scrollTopButton.setAttribute('hidden', '');
			}
		};

		let ticking = false;
		const onScroll = () => {
			if (ticking) {
				return;
			}
			ticking = true;
			requestAnimationFrame(() => {
				toggleScrollTop();
				ticking = false;
			});
		};

		toggleScrollTop();
		window.addEventListener('scroll', onScroll, { passive: true });
		scrollTopButton.addEventListener('click', (event) => {
			event.preventDefault();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	}
});
