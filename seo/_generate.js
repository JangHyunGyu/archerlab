// archerlab SEO 생성기 — ko + en, 6 pages
const fs = require('fs'); const path = require('path');
const SITE = 'https://archerlab.dev';
const HOME = { ko: '/', en: '/index-en.html' };

const C = {
  ko: {
    htmlLang:'ko',
    why_title:'archerlab은 무엇인가',
    why:['1인 개발자가 만드는 웹 사이드 프로젝트 허브','AI 골프 스윙 분석, 라틴댄스 모션 코칭, 로맨스 VN, 캐주얼 게임까지','전부 브라우저에서 무설치로 동작','코드·디자인·기획 모두 1인 운영'],
    how_title:'둘러보는 법',
    how:['아래 [지금 보기] 클릭','관심 있는 카테고리(스포츠/게임/뉴스) 선택','각 프로젝트는 별도 도메인에서 즉시 실행'],
    faq_title:'자주 묻는 질문',
    faqs:[
      ['1인 개발이 정말 가능한가요?','네. AI 코딩 도구와 관리 가능한 스코프 설정이 핵심입니다. 하나하나 작게 시작해서 살아남는 것만 키웁니다.'],
      ['수익 모델은?','일부는 광고, 일부는 트래픽 검증용 무료, 일부는 실험. 살아남는 프로젝트만 다음 단계로.'],
      ['어떤 기술 스택을 쓰나요?','Cloudflare Workers + 정적 HTML + 최소 의존성. 운영 비용을 0에 가깝게.']
    ],
    picks_title:'대표 프로젝트',
    main_name:'AI 골프 스윙 분석',
    main_desc:'영상만 올리면 AI가 자세·템포·임팩트를 진단. 무설치 무료.',
    sec_name:'라틴댄스 메이트',
    sec_label:'한국 동호회',
    sec_desc:'살사·바차타 동호회 찾기 + AI 모션 코칭. 직장인 입문자용.',
    cta:'지금 보기 →',
    other_langs_label:'다른 언어',
    footer:'© archerlab.dev — 1인 개발 사이드 프로젝트 허브'
  },
  en: {
    htmlLang:'en',
    why_title:'What is archerlab',
    why:['A solo dev hub of small, browser-first web side projects','AI golf swing analysis, Latin dance motion coaching, romance VNs, casual games','All run in the browser — no install, no signup','Code, design, and product by one person'],
    how_title:'How to explore',
    how:['Click [Visit] below','Pick a category — sports tools, games, news','Each project runs on its own subdomain'],
    faq_title:'Frequently asked questions',
    faqs:[
      ['Is solo dev really viable?','Yes. The trick is scope discipline plus AI coding tools. Start small, ship fast, only grow what survives.'],
      ['How is it monetized?','Some via ads, some kept free for traffic validation, some experimental. Only survivors get reinvested in.'],
      ['What stack?','Cloudflare Workers + static HTML + minimal dependencies. Operating cost stays near zero.']
    ],
    picks_title:'Featured projects',
    main_name:'AI Golf Swing Analyzer',
    main_desc:'Upload a video, get instant AI feedback on posture, tempo, and impact. Free, no install.',
    sec_name:'Latin Dance Mate',
    sec_label:'Beginner-friendly',
    sec_desc:'Find local salsa & bachata clubs plus AI motion coaching. Built for working adults.',
    cta:'Visit →',
    other_langs_label:'Other languages',
    footer:'© archerlab.dev — solo dev side project hub'
  }
};

const PAGES = {
  ko: [
    { slug:'side-project-idea', h1:'웹 사이드 프로젝트 아이디어 — 1인 개발자가 실제로 만든 6개', title:'웹 사이드 프로젝트 아이디어 | 1인 개발자 실전 사례 2026', meta:'1인 개발자가 실제로 운영 중인 웹 사이드 프로젝트 6가지 — AI 도구, 게임, 뉴스, VN. 아이디어 + 기술 스택 공개.', intro:'"웹 사이드 프로젝트 아이디어"를 검색하면 대부분 To-Do 앱, 날씨 앱 같은 튜토리얼 수준입니다. 여기는 실제로 사용자가 들어오는 6개를 공개합니다.' },
    { slug:'1in-gaebal', h1:'1인 개발 — 어떻게 6개를 동시에 운영하는가', title:'1인 개발 가이드 | 6개 프로젝트 동시 운영 노하우', meta:'1인 개발자가 6개 사이드 프로젝트를 동시에 운영하는 방법. 스코프 관리, AI 도구 활용, 운영 비용 최소화.', intro:'1인 개발의 가장 큰 적은 "다 만들고 싶은 마음"입니다. 작게 자르고 빠르게 검증하고 살아남는 것만 키우는 게 전부입니다.' },
    { slug:'vibe-coding', h1:'바이브 코딩 — AI 시대의 1인 개발 워크플로우', title:'바이브 코딩 가이드 | AI 시대 1인 개발 워크플로우 2026', meta:'바이브 코딩(vibe coding)으로 사이드 프로젝트를 빠르게 만드는 워크플로우. Claude Code 활용 사례.', intro:'"바이브 코딩"은 AI에게 다 맡기는 게 아닙니다. 작은 단위로 자르고, 매번 검증하고, 컨텍스트를 관리하는 기술입니다.' }
  ],
  en: [
    { slug:'side-project-ideas', h1:'Side Project Ideas — 6 Real Apps from One Solo Dev', title:'Side Project Ideas | 6 Real Apps from a Solo Dev 2026', meta:'Six real side projects shipped by one solo developer — AI tools, games, news, visual novels. Ideas plus the actual stack.', intro:'Most "side project ideas" lists end at todo apps and weather apps. Here are six that actually have users — with the real stack and lessons each one taught.' },
    { slug:'solo-developer-portfolio', h1:'Solo Developer Portfolio — How to Run 6 Projects at Once', title:'Solo Developer Portfolio | Running 6 Projects at Once 2026', meta:'How a solo developer ships and runs six side projects in parallel. Scope discipline, AI tooling, and near-zero ops cost.', intro:'The biggest enemy of solo dev is "wanting to build everything." The trick is small slices, fast validation, and only growing what survives.' },
    { slug:'vibe-coding-examples', h1:'Vibe Coding Examples — AI-Era Solo Dev Workflow', title:'Vibe Coding Examples | AI-Era Solo Dev Workflow 2026', meta:'Real vibe coding workflow examples from a solo dev shipping six projects with Claude Code.', intro:'"Vibe coding" is not handing everything to the AI. It is small slices, constant verification, and disciplined context management — with the AI as a fast collaborator.' }
  ]
};

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,"Noto Sans KR",sans-serif;line-height:1.65;color:#1a1a2a;background:linear-gradient(180deg,#f3f0ff 0%,#fff 40%);min-height:100vh}.wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px}h1{font-size:28px;line-height:1.3;margin:24px 0 16px;color:#5e35b1;text-align:center}h2{font-size:20px;margin:36px 0 12px;color:#4527a0;border-bottom:2px solid #d1c4e9;padding-bottom:6px}p{margin-bottom:14px}ul{margin:12px 0 18px 22px}li{margin-bottom:8px}.intro{font-size:17px;color:#444;background:#fff;border-left:4px solid #7e57c2;padding:14px 18px;border-radius:6px;margin:18px 0}.cta-box{text-align:center;margin:36px 0;padding:28px 20px;background:linear-gradient(135deg,#7e57c2,#4527a0);border-radius:14px}.cta{display:inline-block;background:#fff;color:#4527a0;font-weight:700;font-size:18px;padding:14px 32px;border-radius:50px;text-decoration:none}.pick{background:#fff;border:1px solid #d1c4e9;border-radius:10px;padding:16px;margin-bottom:14px}.pick h3{font-size:17px;color:#4527a0;margin-bottom:6px}.pick .badge{display:inline-block;background:#d1c4e9;color:#4527a0;font-size:12px;padding:2px 8px;border-radius:10px;margin-left:6px;vertical-align:middle}.pick p{font-size:14px;color:#555}.faq{margin-bottom:14px}.faq summary{cursor:pointer;font-weight:600;padding:10px 0}.faq p{padding:6px 0;color:#555;font-size:15px}footer{margin-top:48px;padding-top:20px;border-top:1px solid #d1c4e9;text-align:center;font-size:13px;color:#888}.langs{margin-top:14px;font-size:13px}.langs a{color:#5e35b1;margin:0 6px;text-decoration:none}@media(max-width:520px){h1{font-size:23px}h2{font-size:18px}.cta{font-size:16px;padding:12px 26px}}`;

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function render(lang, p) {
  const c = C[lang]; const url = `${SITE}/seo/${p.slug}.html`; const home = HOME[lang];
  const altLinks = Object.keys(PAGES).map(L=>`<link rel="alternate" hreflang="${L}" href="${SITE}/seo/${PAGES[L][0].slug}.html">`).join('\n  ') + `\n  <link rel="alternate" hreflang="x-default" href="${SITE}/seo/${PAGES.en[0].slug}.html">`;
  const otherLangs = Object.keys(PAGES).filter(L=>L!==lang).map(L=>`<a href="/seo/${PAGES[L][0].slug}.html">${L.toUpperCase()}</a>`).join(' · ');
  const faqLd = {"@context":"https://schema.org","@type":"FAQPage","mainEntity":c.faqs.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}}))};
  return `<!DOCTYPE html>
<html lang="${c.htmlLang}"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.meta)}">
<link rel="canonical" href="${url}">
${altLinks}
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.meta)}"><meta property="og:url" content="${url}"><meta property="og:type" content="website">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head><body><div class="wrap">
<h1>${esc(p.h1)}</h1>
<p class="intro">${esc(p.intro)}</p>
<div class="cta-box"><a class="cta" href="${home}">${esc(c.cta)}</a></div>
<h2>${esc(c.why_title)}</h2><ul>${c.why.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>
<h2>${esc(c.picks_title)}</h2>
<div class="pick"><h3>${esc(c.main_name)}</h3><p>${esc(c.main_desc)}</p></div>
<div class="pick"><h3>${esc(c.sec_name)} <span class="badge">${esc(c.sec_label)}</span></h3><p>${esc(c.sec_desc)}</p></div>
<h2>${esc(c.how_title)}</h2><ul>${c.how.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>
<div class="cta-box"><a class="cta" href="${home}">${esc(c.cta)}</a></div>
<h2>${esc(c.faq_title)}</h2>
${c.faqs.map(([q,a])=>`<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
<footer><div>${esc(c.footer)}</div><div class="langs"><span>${esc(c.other_langs_label)}:</span> ${otherLangs}</div></footer>
</div></body></html>`;
}

let n=0; const all=[];
for (const lang of Object.keys(PAGES)) for (const p of PAGES[lang]) {
  fs.writeFileSync(path.join(__dirname, `${p.slug}.html`), render(lang, p), 'utf8');
  all.push({lang, slug:p.slug}); n++;
}
console.log(`✓ ${n} pages generated`);
const firstSlugs = Object.fromEntries(Object.keys(PAGES).map(L => [L, PAGES[L][0].slug]));
const frag = all.map(u => {
  const isFirst = firstSlugs[u.lang] === u.slug;
  let alts = '';
  if (isFirst) alts = '\n' + Object.keys(PAGES).map(L=>`    <xhtml:link rel="alternate" hreflang="${L}" href="${SITE}/seo/${firstSlugs[L]}.html"/>`).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/seo/${firstSlugs.en}.html"/>`;
  return `  <url><loc>${SITE}/seo/${u.slug}.html</loc>${alts}\n    <changefreq>monthly</changefreq><priority>0.7</priority></url>`;
}).join('\n');
fs.writeFileSync(path.join(__dirname, '_sitemap_fragment.xml'), frag, 'utf8');
console.log('✓ sitemap fragment written');
