// Prosty skrypt do tłumaczenia stron statycznych (help.html, contact.html, itp.)

function setStaticLanguage(lang) {
    // Upewnij się, że obiekt translations istnieje
    if (typeof translations === 'undefined') {
        console.error('translations.js not loaded!');
        return;
    }
    
    const t = translations[lang] || translations['pl']; // Domyślnie polski
    document.documentElement.lang = t.htmlLang;

    // Przetłumacz przyciski globalne
    const themeBtn = document.getElementById('theme-toggle-btn');
    const langBtn = document.getElementById('lang-toggle-btn');
    if (themeBtn) themeBtn.title = (lang === 'pl') ? 'Zmień motyw' : 'Change theme';
    if (langBtn) {
        langBtn.textContent = t.langBtn;
        langBtn.title = t.langTitle;
    }

    // Przetłumacz stopkę
    const footerMap = {
        "footerHelp": "/help.html",
        "footerContact": "/contact.html",
        "footerBlog": "/blog",
        "footerPrivacy": "/privacy-policy.html"
    };
    for (const key in footerMap) {
        const el = document.querySelector(`.footer-content a[href="${footerMap[key]}"]`);
        if (el) el.textContent = t[key];
    }
    
    // Przetłumacz baner cookie
    const cookieText = document.querySelector('[data-lang="cookieText"]');
    const cookieBtn = document.querySelector('[data-lang="cookieBtn"]');
    if (cookieText) cookieText.innerHTML = t.cookieText; // Użyj innerHTML dla linku
    if (cookieBtn) cookieBtn.textContent = t.cookieBtn;

    // Przetłumacz zawartość strony
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.dataset.lang;
        if (t[key]) {
            // Użyj innerHTML, aby zezwolić na tagi <strong>, <ul> itp.
            el.innerHTML = t[key]; 
        }
    });

    // Ustaw tytuł i opis strony
    const titleKey = document.body.dataset.pageTitle;
    const descKey = document.body.dataset.pageDesc;
    if (titleKey && t[titleKey]) document.title = t[titleKey];
    if (descKey && t[descKey]) {
         const descMeta = document.querySelector('meta[name="description"]');
         if (descMeta) descMeta.setAttribute('content', t[descKey]);
    }
}

// Uruchom przy ładowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    let currentLang = localStorage.getItem('memorr_lang') || 'pl';
    setStaticLanguage(currentLang);

    // Ustaw listener dla przycisku
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            const newLang = (currentLang === 'pl') ? 'en' : 'pl';
            localStorage.setItem('memorr_lang', newLang);
            setStaticLanguage(newLang); // Natychmiast przetłumacz
        });
    }
});