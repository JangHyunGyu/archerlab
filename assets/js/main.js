// DOMContentLoaded 이벤트는 HTML 문서가 완전히 파싱되었을 때 발생합니다.
document.addEventListener("DOMContentLoaded", () => {
	const LANGUAGE_STORAGE_KEY = "archerlab:language";
	const languageSelects = Array.from(document.querySelectorAll("[data-language-switch]"));

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

	const findOptionByLanguage = (select, languageCode) => {
		if (!select || !languageCode) {
			return null;
		}
		return (
			Array.from(select.options || []).find((option) =>
				normalizeLanguage(option.dataset?.languageCode || option.value)
				=== languageCode
			) || null
		);
	};

	const getSelectedOption = (select) => {
		if (!select) {
			return null;
		}
		if (select.selectedOptions && select.selectedOptions.length) {
			return select.selectedOptions[0];
		}
		const index = typeof select.selectedIndex === "number" ? select.selectedIndex : -1;
		if (index < 0 || !select.options || !select.options.length) {
			return null;
		}
		return select.options[index] || null;
	};

	const currentLanguage = normalizeLanguage(document.documentElement?.lang || "");
	const storedLanguage = normalizeLanguage(getStoredLanguage());

	languageSelects.forEach((select) => {
		const optionForCurrent = findOptionByLanguage(select, currentLanguage);
		if (optionForCurrent) {
			select.value = optionForCurrent.value;
		}
	});

	if (storedLanguage && currentLanguage && storedLanguage !== currentLanguage) {
		const redirectSelect = languageSelects[0] || null;
		const redirectOption = findOptionByLanguage(redirectSelect, storedLanguage);
		if (redirectOption) {
			setStoredLanguage(storedLanguage);
			window.location.replace(redirectOption.value);
			return;
		}
	}

	if (!storedLanguage && currentLanguage) {
		setStoredLanguage(currentLanguage);
	}

	const languageLinkTargets = {
		itstory: {
			ko: "https://itstory.archerlab.dev",
			en: "https://itstory.archerlab.dev/index-en.html"
		},
		walkwithme: {
			ko: "https://walkwithme.archerlab.dev",
			en: "https://walkwithme.archerlab.dev/index-en.html"
		}
	};

	const resolveActiveLanguage = () => normalizeLanguage(getStoredLanguage()) || currentLanguage || "ko";

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

	languageSelects.forEach((select) => {
		select.addEventListener("change", (event) => {
			const target = event.target;
			const destination = target?.value;
			const selectedOption = getSelectedOption(target);
			const selectedLanguageCode = normalizeLanguage(
				selectedOption?.dataset?.languageCode || selectedOption?.value || ""
			);
			if (selectedLanguageCode) {
				setStoredLanguage(selectedLanguageCode);
			}
			if (!destination) {
				return;
			}
			window.location.href = destination;
		});
	});

	// 푸터 연도를 채울 span 요소를 id로 선택합니다.
	const yearEl = document.getElementById("year");
	// 요소가 존재하는 경우에만 값을 업데이트해 오류를 방지합니다.
	if (yearEl) {
		// 현재 연도를 구한 뒤 텍스트 콘텐츠로 삽입합니다.
		yearEl.textContent = new Date().getFullYear();
	}

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
