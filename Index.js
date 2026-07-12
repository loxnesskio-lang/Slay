/**
 * 💅🔥 SLAY Images — Inline Image Generation + Wardrobe + Gallery
 * by Wewwa (https://github.com/wewwaistyping) — tg: @wewwajai
 * gallery update by hydall (https://github.com/hydall)
 * based on sillyimages by 0xl0cal and aceeenvw's NPC system
 */
const SLAY_VERSION = '4.2.17';

/* ╔═══════════════════════════════════════════════════════════════╗
   ║  MODULE 1: SlayWardrobe                                       ║
   ╚═══════════════════════════════════════════════════════════════╝ */

(function initWardrobe() {
    'use strict';
    const SW = 'slay_wardrobe';

    function uid() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 8); }
    function swLog(l, ...a) { (l === 'ERROR' ? console.error : l === 'WARN' ? console.warn : console.log)('[SW]', ...a); }
    function esc(t) { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }

    // ── Categories & Tags ──
    const CATEGORIES = Object.freeze({
        full: 'Полный',
        top: 'Верх',
        bottom: 'Низ',
        shoes: 'Обувь',
        accessories: 'Аксессуары',
        hair: 'Причёска',
    });
    const CAT_KEYS = Object.keys(CATEGORIES);
    const TAGS = Object.freeze({
        street: 'Улица',
        home: 'Дом',
        evening: 'Вечер',
        sleep: 'Сон',
        sport: 'Спорт',
        beach: 'Пляж',
        other: 'Другое',
    });
    const TAG_KEYS = Object.keys(TAGS);

    const GENDERS = Object.freeze({ unisex: '⚥', female: '♀️', male: '♂️' });
    const GENDER_KEYS = Object.keys(GENDERS);
    const GENDER_COLORS = Object.freeze({ unisex: '#a855f7', female: '#f472b6', male: '#60a5fa' });

    // ── Defaults (v4 — global items, per-character active outfits) ──
    const swDefaults = Object.freeze({
        items: [],
        activeOutfits: {},
        maxDimension: 512,
        showFloatingBtn: false,
        autoDescribe: true,
        describeMode: 'direct',
        describeModel: '',
        describeEndpoint: '',
        describeKey: '',
        describePromptStyle: 'detailed',
        sendOutfitDescription: true,
        sendOutfitImageBot: true,
        sendOutfitImageUser: true,
        experimentalCollage: false,
        skipDescriptionWarning: false,
        // v4.1 UX additions
        modalWidth: 'normal',   // compact | normal | wide | xwide | full
        showHidden: false,      // toggle to show hidden items in grid
    });

    // Map preset -> pixel width (used as CSS var --sw-modal-width)
    const MODAL_WIDTH_MAP = Object.freeze({
        compact: '480px',
        normal: '560px',
        wide: '800px',
        xwide: '1100px',
        full: '96vw',
    });
    function swApplyModalWidth() {
        const s = swGetSettings();
        const val = MODAL_WIDTH_MAP[s.modalWidth] || MODAL_WIDTH_MAP.normal;
        document.documentElement.style.setProperty('--sw-modal-width', val);
    }

    function swGetSettings() {
        const ctx = SillyTavern.getContext();
        if (!ctx.extensionSettings[SW]) ctx.extensionSettings[SW] = structuredClone(swDefaults);
        const s = ctx.extensionSettings[SW];
        for (const k of Object.keys(swDefaults)) if (!Object.hasOwn(s, k)) s[k] = swDefaults[k];
        if (!Array.isArray(s.items)) s.items = [];
        if (!s.activeOutfits || typeof s.activeOutfits !== 'object') s.activeOutfits = {};
        swMigrate(s);
        return s;
    }
    function swSave() { SillyTavern.getContext().saveSettingsDebounced(); }

    // ── Migration from v3 (per-character wardrobes) to v4 (global items) ──
    function swMigrate(s) {
        if (!s.wardrobes) return;
        swLog('INFO', 'Migrating v3 wardrobes to v4 global items...');
        for (const charName of Object.keys(s.wardrobes)) {
            const w = s.wardrobes[charName];
            for (const type of ['bot', 'user']) {
                if (!Array.isArray(w[type])) continue;
                for (const old of w[type]) {
                    if (s.items.find(i => i.id === old.id)) continue;
                    s.items.push({
                        id: old.id,
                        name: old.name || 'Unnamed',
                        description: old.description || '',
                        imagePath: old.imagePath || '',
                        base64: old.base64 || '',
                        category: 'full',
                        tags: [],
                        addedAt: old.addedAt || Date.now(),
                    });
                }
                // Migrate active outfit references
                const oldActive = s.activeOutfits?.[charName];
                if (oldActive && (oldActive.bot === undefined || typeof oldActive.bot === 'string' || oldActive.bot === null)) {
                    const oldBotId = oldActive.bot || null;
                    const oldUserId = oldActive.user || null;
                    s.activeOutfits[charName] = swMakeCharOutfit(oldBotId, oldUserId);
                }
            }
        }
        delete s.wardrobes;
        swSave();
        swLog('INFO', 'Migration complete');
    }

    function swMakeCharOutfit(botFullId, userFullId) {
        return {
            mode: 'full',
            bot: { full: botFullId || null, top: null, bottom: null, shoes: null, accessories: null, hair: null },
            user: { full: userFullId || null, top: null, bottom: null, shoes: null, accessories: null, hair: null },
        };
    }

    function swCharName() {
        const ctx = SillyTavern.getContext();
        return (ctx.characterId !== undefined && ctx.characters?.[ctx.characterId]) ? (ctx.characters[ctx.characterId].name || '') : '';
    }

    // ── Item accessors (global) ──
    function swFindItem(id) { return swGetSettings().items.find(o => o.id === id) || null; }
    function swAddItem(item) { swGetSettings().items.push(item); swSave(); }
    function swToggleHidden(id) {
        const o = swFindItem(id); if (!o) return;
        o.hidden = !o.hidden;
        swSave();
    }
    function swToggleFavourite(id) {
        const o = swFindItem(id); if (!o) return;
        o.favourite = !o.favourite;
        swSave();
    }
    function swRemoveItem(id) {
        const s = swGetSettings();
        s.items = s.items.filter(o => o.id !== id);
        // Clear from all active outfits
        for (const cn of Object.keys(s.activeOutfits)) {
            const co = s.activeOutfits[cn];
            for (const type of ['bot', 'user']) {
                if (!co[type]) continue;
                for (const cat of CAT_KEYS) {
                    if (co[type][cat] === id) co[type][cat] = null;
                }
            }
        }
        swSave();
        swUpdatePromptInjection();
    }

    // ── Per-character active outfit ──
    function swGetCharOutfit() {
        const cn = swCharName();
        if (!cn) return null;
        const s = swGetSettings();
        if (!s.activeOutfits[cn]) s.activeOutfits[cn] = swMakeCharOutfit(null, null);
        const co = s.activeOutfits[cn];
        // Ensure structure
        if (!co.bot) co.bot = { full: null, top: null, bottom: null, shoes: null, accessories: null, hair: null };
        if (!co.user) co.user = { full: null, top: null, bottom: null, shoes: null, accessories: null, hair: null };
        if (!co.botMode) co.botMode = co.mode || 'full';
        if (!co.userMode) co.userMode = co.mode || 'full';
        return co;
    }

    function swGetSlot(type, cat) {
        const co = swGetCharOutfit();
        return co ? (co[type]?.[cat] || null) : null;
    }

    function swSetSlot(type, cat, id) {
        const cn = swCharName();
        if (!cn) { toastr.error('Персонаж не выбран', 'Гардероб'); return false; }
        const co = swGetCharOutfit();
        co[type][cat] = id;
        swSave();
        return true;
    }

    function swSetMode(mode) {
        const co = swGetCharOutfit();
        if (!co) return;
        // Per-type mode: bot and user can have different modes
        const modeKey = swTab === 'bot' ? 'botMode' : 'userMode';
        co[modeKey] = mode;
        swSave();
    }

    function swGetMode() {
        const co = swGetCharOutfit();
        if (!co) return 'full';
        return swTab === 'bot' ? (co.botMode || 'full') : (co.userMode || 'full');
    }

    function swGetModeFor(type) {
        const co = swGetCharOutfit();
        if (!co) return 'full';
        return type === 'bot' ? (co.botMode || 'full') : (co.userMode || 'full');
    }

    function swIsCatBlocked(mode, cat) {
        if (mode === 'full') return ['top', 'bottom', 'shoes'].includes(cat);
        if (mode === 'parts') return cat === 'full';
        return false;
    }

    function swResize(file, maxDim) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = (e) => { const img = new Image(); img.onload = () => { let { width: w, height: h } = img; if (w > maxDim || h > maxDim) { const s = Math.min(maxDim / w, maxDim / h); w = Math.round(w * s); h = Math.round(h * s); } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res({ base64: c.toDataURL('image/png').split(',')[1] }); }; img.onerror = () => rej(new Error('decode')); img.src = e.target.result; };
            r.onerror = () => rej(new Error('read')); r.readAsDataURL(file);
        });
    }

    // ── Save wardrobe image to server file ──
    async function swSaveImageToFile(base64, label) {
        const ctx = SillyTavern.getContext();
        const safeName = label.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
        const filename = `wardrobe_${safeName}_${Date.now()}`;
        const response = await fetch('/api/images/upload', {
            method: 'POST', headers: ctx.getRequestHeaders(),
            body: JSON.stringify({ image: base64, format: 'png', ch_name: 'wardrobe_refs', filename })
        });
        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        const result = await response.json();
        swLog('INFO', `Wardrobe image saved: ${result.path}`);
        return result.path;
    }

    // ── Load wardrobe image from server path -> base64 ──
    async function swLoadImageAsBase64(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) return null;
            const blob = await response.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) { swLog('WARN', `swLoadImageAsBase64 failed: ${path}`, e.message); return null; }
    }

    // ── Get outfit image src for display (path preferred, base64 fallback) ──
    function swGetOutfitSrc(outfit) {
        if (outfit.imagePath) return outfit.imagePath;
        if (outfit.base64) return `data:image/png;base64,${outfit.base64}`;
        return '';
    }

    // ── Collage builder: merge parts into one image ──
    // Get all parts images for a type (bot/user). Returns array of base64 strings.
    async function swGetPartsImages(type) {
        const co = swGetCharOutfit();
        if (!co) return [];
        const mode = swGetModeFor(type);
        if (mode !== 'parts') return [];

        const slots = ['top', 'bottom', 'shoes', 'accessories', 'hair'];
        const images = [];
        for (const cat of slots) {
            const itemId = co[type]?.[cat];
            if (!itemId) continue;
            const item = swFindItem(itemId);
            if (!item) continue;
            let b64 = null;
            if (item.imagePath) b64 = await swLoadImageAsBase64(item.imagePath);
            if (!b64 && item.base64) b64 = item.base64;
            if (b64) images.push(b64);
        }
        return images;
    }

    async function swBuildCollage(type) {
        const images = await swGetPartsImages(type);
        if (images.length < 2) return null; // 1 item = send as single ref, not collage
        const collageImages = images.slice(0, 6); // max 6

        return new Promise((resolve) => {
            const size = 512;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, size, size);
            const count = collageImages.length;
            let cols, rows;
            if (count <= 2) { cols = 2; rows = 1; }
            else if (count <= 4) { cols = 2; rows = 2; }
            else { cols = 3; rows = 2; }
            const cellW = Math.floor(size / cols);
            const cellH = Math.floor(size / rows);
            let loaded = 0;
            collageImages.forEach((b64, idx) => {
                const img = new Image();
                img.onload = () => {
                    const col = idx % cols; const row = Math.floor(idx / cols);
                    const x = col * cellW; const y = row * cellH;
                    const scale = Math.max(cellW / img.width, cellH / img.height);
                    const sw = cellW / scale; const sh = cellH / scale;
                    const sx = (img.width - sw) / 2; const sy = (img.height - sh) / 2;
                    ctx.drawImage(img, sx, sy, sw, sh, x, y, cellW, cellH);
                    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, cellW, cellH);
                    loaded++;
                    if (loaded === collageImages.length) {
                        const result = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
                        swLog('INFO', `Collage built: ${count} images, ${cols}x${rows}, ~${Math.round(result.length / 1024)}KB`);
                        resolve(result);
                    }
                };
                img.onerror = () => { loaded++; if (loaded === collageImages.length) resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]); };
                img.src = `data:image/png;base64,${b64}`;
            });
        });
    }

    // ── Inline styles for new v4 elements ──
    function swInjectV4Styles() {
        if (document.getElementById('sw-v4-styles')) return;
        const style = document.createElement('style');
        style.id = 'sw-v4-styles';
        style.textContent = `
            .sw-mode-switch { display:flex; gap:6px; padding:4px 12px; }
            .sw-mode-btn { padding:5px 14px; border-radius:16px; cursor:pointer; font-size:13px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:#ccc; transition:all .2s; user-select:none; }
            .sw-mode-btn:hover { background:rgba(255,255,255,0.1); }
            .sw-mode-btn-active { background:rgba(219,112,147,0.25); color:#f0a0c0; border-color:rgba(219,112,147,0.5); }
            .sw-mode-btn-active:hover { background:rgba(219,112,147,0.35); }

            .sw-cat-tabs { display:flex; gap:4px; padding:4px 12px; flex-wrap:wrap; }
            .sw-cat-tab { position:relative; padding:4px 12px; border-radius:14px; cursor:pointer; font-size:12px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#aaa; transition:all .2s; user-select:none; }
            .sw-cat-tab:hover { background:rgba(255,255,255,0.08); }
            .sw-cat-tab-active { background:rgba(219,112,147,0.2); color:#f0a0c0; border-color:rgba(219,112,147,0.4); }
            .sw-cat-tab-blocked { opacity:0.35; pointer-events:none; }
            .sw-cat-dot { position:absolute; top:2px; right:4px; width:6px; height:6px; border-radius:50%; background:#db7093; display:none; }
            .sw-cat-dot-visible { display:block; }

            .sw-tag-filter { display:flex; gap:4px; padding:4px 12px; flex-wrap:wrap; }
            .sw-tag-chip { padding:3px 10px; border-radius:12px; cursor:pointer; font-size:11px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); color:#999; transition:all .2s; user-select:none; }
            .sw-tag-chip:hover { background:rgba(255,255,255,0.07); }
            .sw-tag-chip-active { background:rgba(147,197,219,0.2); color:#a0d0f0; border-color:rgba(147,197,219,0.4); }

            .sw-current-outfit { padding:8px 12px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0; }
            .sw-current-title { font-size:12px; color:#888; margin-bottom:6px; }
            .sw-current-slots { display:flex; gap:6px; flex-wrap:wrap; align-items:flex-start; }
            .sw-current-slot { display:flex; flex-direction:column; align-items:center; gap:2px; min-width:52px; }
            .sw-current-slot-img { width:44px; height:44px; border-radius:8px; object-fit:cover; border:1px solid rgba(255,255,255,0.12); background:rgba(0,0,0,0.2); }
            .sw-current-slot-empty { width:44px; height:44px; border-radius:8px; border:1px dashed rgba(255,255,255,0.15); background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; font-size:10px; color:#555; }
            .sw-current-slot-label { font-size:10px; color:#777; text-align:center; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .sw-current-desc { font-size:11px; color:#999; margin-top:6px; line-height:1.4; max-height:60px; overflow-y:auto; }

            .sw-upload-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:200000; display:flex; align-items:flex-start; justify-content:center; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:20px; padding-top:10vh; }
            @media (max-width:600px) { .sw-upload-modal-overlay { align-items:flex-start; padding-top:40px; } .sw-upload-modal { max-height:calc(100dvh - 60px); overflow-y:auto; } }
            @media (max-width:600px) { .sw-edit-modal-overlay { align-items:flex-start; padding:16px; padding-top:40px; } .sw-edit-modal { max-height:calc(100dvh - 60px); overflow-y:auto; } }
            .sw-upload-modal { background:#2a2a2e; border-radius:14px; padding:20px; width:360px; max-width:90vw; max-height:80vh; overflow-y:auto; color:#ddd; box-shadow:0 8px 32px rgba(0,0,0,0.5); flex-shrink:0; }
            .sw-upload-modal h3 { margin:0 0 14px; font-size:15px; color:#f0a0c0; }
            .sw-upload-modal label { display:block; font-size:12px; color:#aaa; margin:10px 0 4px; }
            .sw-upload-modal input[type="text"] { width:100%; padding:7px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.2); color:#eee; font-size:13px; box-sizing:border-box; }
            .sw-upload-modal select { width:100%; padding:7px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.2); color:#eee; font-size:13px; box-sizing:border-box; }
            .sw-upload-tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
            .sw-upload-tag { display:flex; align-items:center; gap:3px; font-size:12px; color:#bbb; cursor:pointer; user-select:none; }
            .sw-upload-tag input { accent-color:#db7093; }
            .sw-upload-btns { display:flex; gap:8px; margin-top:16px; justify-content:flex-end; }
            .sw-upload-btn { padding:7px 18px; border-radius:10px; border:none; cursor:pointer; font-size:13px; }
            .sw-upload-btn-cancel { background:rgba(255,255,255,0.08); color:#aaa; }
            .sw-upload-btn-cancel:hover { background:rgba(255,255,255,0.14); }
            .sw-upload-btn-save { background:rgba(219,112,147,0.3); color:#f0a0c0; }
            .sw-upload-btn-save:hover { background:rgba(219,112,147,0.45); }

            .sw-edit-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:200000; display:flex; align-items:flex-start; justify-content:center; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:20px; padding-top:10vh; }
            .sw-edit-modal { background:#2a2a2e; border-radius:14px; padding:20px; width:380px; max-width:90vw; max-height:80vh; overflow-y:auto; color:#ddd; box-shadow:0 8px 32px rgba(0,0,0,0.5); flex-shrink:0; }
            .sw-edit-modal h3 { margin:0 0 14px; font-size:15px; color:#f0a0c0; }
            .sw-edit-modal label { display:block; font-size:12px; color:#aaa; margin:10px 0 4px; }
            .sw-edit-modal input[type="text"], .sw-edit-modal textarea { width:100%; padding:7px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.2); color:#eee; font-size:13px; box-sizing:border-box; }
            .sw-edit-modal textarea { min-height:60px; resize:vertical; }
            .sw-edit-modal select { width:100%; padding:7px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.2); color:#eee; font-size:13px; box-sizing:border-box; }
        `;
        document.head.appendChild(style);
    }

    // ── Modal state ──
    let swOpen = false, swTab = 'bot', swCatTab = 'full', swTagFilter = null, swForWhoFilter = null, swGenderFilter = null, swFavFilter = false;

    function swOpenModal() {
        swCloseModal();
        swInjectV4Styles();
        swApplyModalWidth();
        swOpen = true;
        const cn = swCharName();
        if (!cn) { toastr.warning('Выберите персонажа', 'Гардероб'); swOpen = false; return; }

        const ov = document.createElement('div'); ov.id = 'sw-modal-overlay';
        ov.addEventListener('click', (e) => { if (e.target === ov) swCloseModal(); });

        const co = swGetCharOutfit();
        const s = swGetSettings();
        const hiddenCount = (s.items || []).filter(o => o.hidden).length;
        const m = document.createElement('div'); m.id = 'sw-modal';
        m.innerHTML = `
            <div class="sw-modal-header">
                <span>\uD83D\uDC85 Гардероб — <b>${esc(cn)}</b>
                    <label class="sw-header-toggle ${s.showHidden ? 'sw-header-toggle-active' : ''}" id="sw-show-hidden-toggle" title="Показать скрытые">
                        <i class="fa-solid fa-eye${s.showHidden ? '' : '-slash'}"></i> Скрытые: ${hiddenCount}
                    </label>
                </span>
                <div class="sw-modal-close" title="Закрыть"><i class="fa-solid fa-xmark"></i></div>
            </div>
            <div class="sw-tabs" id="sw-type-tabs">
                <div class="sw-tab ${swTab === 'bot' ? 'sw-tab-active' : ''}" data-tab="bot">Бот</div>
                <div class="sw-tab ${swTab === 'user' ? 'sw-tab-active' : ''}" data-tab="user">Юзер</div>
            </div>
            <div class="sw-mode-switch" id="sw-mode-switch"></div>
            <div class="sw-cat-tabs" id="sw-cat-tabs"></div>
            <div class="sw-tag-filter" id="sw-tag-filter"></div>
            <div class="sw-tag-filter" id="sw-forwho-filter"></div>
            <div class="sw-tab-content" id="sw-tab-content"></div>
            <div class="sw-current-outfit" id="sw-current-outfit"></div>`;

        ov.appendChild(m); document.body.appendChild(ov);
        m.querySelector('.sw-modal-close').addEventListener('click', swCloseModal);
        m.querySelector('#sw-show-hidden-toggle')?.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const st = swGetSettings();
            st.showHidden = !st.showHidden;
            swSave();
            // Re-render: update toggle visual + re-filter grid
            const toggle = e.currentTarget;
            toggle.classList.toggle('sw-header-toggle-active', st.showHidden);
            toggle.querySelector('i').className = `fa-solid fa-eye${st.showHidden ? '' : '-slash'}`;
            swRender();
        });
        for (const t of m.querySelectorAll('#sw-type-tabs .sw-tab')) t.addEventListener('click', () => {
            swTab = t.dataset.tab;
            swForWhoFilter = swTab; // Auto-filter: Бот tab → show bot items, Юзер tab → show user items
            m.querySelectorAll('#sw-type-tabs .sw-tab').forEach(x => x.classList.toggle('sw-tab-active', x.dataset.tab === swTab));
            swRender();
        });
        swForWhoFilter = swTab; // Default filter to current tab
        swRender();
        document.addEventListener('keydown', swEsc);
    }
    function swEsc(e) { if (e.key === 'Escape') swCloseModal(); }
    function swCloseModal() { swOpen = false; document.getElementById('sw-modal-overlay')?.remove(); document.removeEventListener('keydown', swEsc); }

    function swRender() {
        const content = document.getElementById('sw-tab-content');
        const modeWrap = document.getElementById('sw-mode-switch');
        const catWrap = document.getElementById('sw-cat-tabs');
        const tagWrap = document.getElementById('sw-tag-filter');
        const currentWrap = document.getElementById('sw-current-outfit');
        if (!content) return;
        const cn = swCharName();
        const co = swGetCharOutfit();
        if (!co) return;
        const mode = swGetMode();

        // ── Mode switch ──
        if (modeWrap) {
            modeWrap.innerHTML = `
                <div class="sw-mode-btn ${mode === 'full' ? 'sw-mode-btn-active' : ''}" data-mode="full">\uD83D\uDC57 Полный комплект</div>
                <div class="sw-mode-btn ${mode === 'parts' ? 'sw-mode-btn-active' : ''}" data-mode="parts">\uD83E\uDDE9 По частям</div>`;
            for (const btn of modeWrap.querySelectorAll('.sw-mode-btn')) {
                btn.addEventListener('click', () => {
                    swSetMode(btn.dataset.mode);
                    swRender();
                    swUpdatePromptInjection();
                    swInjectFloatingBtn();
                });
            }
        }

        // ── Category tabs with dots ──
        if (catWrap) {
            let catHtml = '';
            for (const cat of CAT_KEYS) {
                const blocked = swIsCatBlocked(mode, cat);
                const active = swCatTab === cat;
                const equipped = !!(co[swTab]?.[cat]);
                catHtml += `<div class="sw-cat-tab ${active ? 'sw-cat-tab-active' : ''} ${blocked ? 'sw-cat-tab-blocked' : ''}" data-cat="${cat}">
                    ${esc(CATEGORIES[cat])}
                    <span class="sw-cat-dot ${equipped && !blocked ? 'sw-cat-dot-visible' : ''}"></span>
                </div>`;
            }
            catWrap.innerHTML = catHtml;
            // If current cat is blocked, switch to first available
            if (swIsCatBlocked(mode, swCatTab)) {
                swCatTab = CAT_KEYS.find(c => !swIsCatBlocked(mode, c)) || 'full';
                // Re-render cat tabs with corrected active
                swRender();
                return;
            }
            for (const tab of catWrap.querySelectorAll('.sw-cat-tab:not(.sw-cat-tab-blocked)')) {
                tab.addEventListener('click', () => {
                    swCatTab = tab.dataset.cat;
                    swRender();
                });
            }
        }

        // ── Tag filter ──
        if (tagWrap) {
            let tagHtml = `<div class="sw-tag-chip ${swTagFilter === null ? 'sw-tag-chip-active' : ''}" data-tag="">Все</div>`;
            for (const tag of TAG_KEYS) {
                tagHtml += `<div class="sw-tag-chip ${swTagFilter === tag ? 'sw-tag-chip-active' : ''}" data-tag="${tag}">${esc(TAGS[tag])}</div>`;
            }
            tagWrap.innerHTML = tagHtml;
            for (const chip of tagWrap.querySelectorAll('.sw-tag-chip')) {
                chip.addEventListener('click', () => {
                    swTagFilter = chip.dataset.tag || null;
                    swRender();
                });
            }
        }

        // ── For who + gender filter (one row with divider) ──
        const forWhoWrap = document.getElementById('sw-forwho-filter');
        if (forWhoWrap) {
            const fwLabels = { '': 'Все', 'bot': '🤖 Бот', 'user': '👤 Юзер' };
            let fwHtml = '';
            for (const [key, label] of Object.entries(fwLabels)) {
                const active = (swForWhoFilter || '') === key;
                fwHtml += `<div class="sw-tag-chip ${active ? 'sw-tag-chip-active' : ''}" data-fw="${key}">${label}</div>`;
            }
            // Divider + gender chips
            fwHtml += `<div style="width:1px;background:rgba(255,255,255,0.1);margin:0 2px;flex-shrink:0;"></div>`;
            for (const g of GENDER_KEYS) {
                const active = (swGenderFilter || '') === g || (!swGenderFilter && g === 'unisex' && false);
                const noFilter = !swGenderFilter && g === 'unisex';
                fwHtml += `<div class="sw-tag-chip ${!swGenderFilter && g === GENDER_KEYS[0] ? '' : ''} ${swGenderFilter === g ? 'sw-tag-chip-active' : ''}" data-gender="${g}" style="${swGenderFilter === g ? 'border-color:' + GENDER_COLORS[g] + '40;color:' + GENDER_COLORS[g] + ';background:' + GENDER_COLORS[g] + '18;' : ''}">${GENDERS[g]}</div>`;
            }
            // "All genders" button
            fwHtml = fwHtml.replace('</div><div style="width:1px', `</div><div class="sw-tag-chip ${!swGenderFilter ? 'sw-tag-chip-active' : ''}" data-gender="" style="font-size:10px;">Все</div><div style="width:1px`);

            // Divider + favourites filter chip
            fwHtml += `<div style="width:1px;background:rgba(255,255,255,0.1);margin:0 2px;flex-shrink:0;"></div>`;
            fwHtml += `<div class="sw-tag-chip sw-fav-filter-chip ${swFavFilter ? 'sw-tag-chip-active' : ''}" data-fav-filter title="Показать только избранные"><i class="fa-solid fa-star" style="color:${swFavFilter ? '#fbbf24' : '#888'};"></i></div>`;

            forWhoWrap.innerHTML = fwHtml;
            for (const chip of forWhoWrap.querySelectorAll('.sw-tag-chip[data-fw]')) {
                chip.addEventListener('click', () => { swForWhoFilter = chip.dataset.fw || null; swRender(); });
            }
            for (const chip of forWhoWrap.querySelectorAll('.sw-tag-chip[data-gender]')) {
                chip.addEventListener('click', () => { swGenderFilter = chip.dataset.gender || null; swRender(); });
            }
            forWhoWrap.querySelector('[data-fav-filter]')?.addEventListener('click', () => { swFavFilter = !swFavFilter; swRender(); });
        }

        // ── Filter items by category + tag + forWho + gender + hidden ──
        const settings = swGetSettings();
        const allItems = settings.items;
        const showHidden = !!settings.showHidden;
        const filtered = allItems.filter(o => {
            if (o.category !== swCatTab) return false;
            if (swTagFilter && (!Array.isArray(o.tags) || !o.tags.includes(swTagFilter))) return false;
            if (swForWhoFilter && o.forWho && o.forWho !== 'all' && o.forWho !== swForWhoFilter) return false;
            if (swGenderFilter && (o.gender || 'unisex') !== swGenderFilter) return false;
            if (!showHidden && o.hidden) return false;
            if (swFavFilter && !o.favourite) return false;
            return true;
        });

        const equippedId = co[swTab]?.[swCatTab] || null;

        // ── Sort: equipped first → favourites → normal → hidden last ──
        filtered.sort((a, b) => {
            const aRank = (a.id === equippedId) ? 0 : (a.favourite ? 1 : (a.hidden ? 3 : 2));
            const bRank = (b.id === equippedId) ? 0 : (b.favourite ? 1 : (b.hidden ? 3 : 2));
            if (aRank !== bRank) return aRank - bRank;
            // Within same rank: newest first (by addedAt desc)
            return (b.addedAt || 0) - (a.addedAt || 0);
        });

        // ── Grid ──
        let h = '<div class="sw-outfit-grid"><div class="sw-outfit-card sw-upload-card" id="sw-upload-trigger"><div class="sw-upload-icon"><i class="fa-solid fa-plus"></i></div><span>Загрузить</span></div>';
        for (const o of filtered) {
            const a = o.id === equippedId;
            const fav = !!o.favourite;
            const hid = !!o.hidden;
            const classes = ['sw-outfit-card'];
            if (a) classes.push('sw-outfit-active');
            if (fav) classes.push('sw-outfit-favourite');
            if (hid) classes.push('sw-outfit-hidden');
            h += `<div class="${classes.join(' ')}" data-id="${o.id}">
                <div class="sw-outfit-img-wrap">
                    <img src="${swGetOutfitSrc(o)}" alt="${esc(o.name)}" class="sw-outfit-img" loading="lazy">
                    ${a ? '<div class="sw-active-badge"><i class="fa-solid fa-check"></i></div>' : ''}
                    <button class="sw-corner-btn sw-corner-fav ${fav ? 'sw-corner-active' : ''}" data-act="fav" title="${fav ? 'Убрать из избранного' : 'В избранное'}"><i class="fa-${fav ? 'solid' : 'regular'} fa-star"></i></button>
                    <button class="sw-corner-btn sw-corner-hide ${hid ? 'sw-corner-active' : ''}" data-act="hide" title="${hid ? 'Показать' : 'Скрыть'}"><i class="fa-solid fa-eye${hid ? '-slash' : ''}"></i></button>
                    <div style="position:absolute;top:4px;left:4px;font-size:10px;padding:1px 5px;border-radius:6px;background:rgba(0,0,0,0.5);color:${GENDER_COLORS[o.gender || 'unisex']};">${GENDERS[o.gender || 'unisex']}</div>
                </div>
                <div class="sw-outfit-footer"><span class="sw-outfit-name" title="${esc(o.description || o.name)}">${esc(o.name)}</span>
                    <div class="sw-outfit-btns">
                        <div class="sw-btn-activate" title="${a ? 'Снять' : 'Надеть'}"><i class="fa-solid ${a ? 'fa-toggle-on' : 'fa-toggle-off'}"></i></div>
                        <div class="sw-btn-edit" title="Редактировать"><i class="fa-solid fa-pen"></i></div>
                        <div class="sw-btn-regen" title="Перегенерировать описание"><i class="fa-solid fa-robot"></i></div>
                        <div class="sw-btn-delete" title="Удалить"><i class="fa-solid fa-trash-can"></i></div>
                    </div></div></div>`;
        }
        h += '</div>';
        content.innerHTML = h;

        // Update header hidden count
        const hdrToggle = document.getElementById('sw-show-hidden-toggle');
        if (hdrToggle) {
            const hiddenCount = allItems.filter(o => o.hidden).length;
            const labelText = hdrToggle.childNodes[hdrToggle.childNodes.length - 1];
            if (labelText && labelText.nodeType === 3) labelText.textContent = ` Скрытые: ${hiddenCount}`;
        }

        document.getElementById('sw-upload-trigger')?.addEventListener('click', swUpload);
        for (const card of content.querySelectorAll('.sw-outfit-card[data-id]')) {
            const id = card.dataset.id;
            card.querySelector('.sw-outfit-img')?.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); swToggle(id); });
            card.querySelector('.sw-btn-activate')?.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); swToggle(id); });
            card.querySelector('.sw-corner-fav')?.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); swToggleFavourite(id); swRender(); });
            card.querySelector('.sw-corner-hide')?.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); swToggleHidden(id); swRender(); });
            card.querySelector('.sw-btn-edit')?.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); swEdit(id); });
            card.querySelector('.sw-btn-regen')?.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); swRegenDescription(id); });
            card.querySelector('.sw-btn-delete')?.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); if (confirm('Удалить?')) { swRemoveItem(id); swRender(); toastr.info('Удалён', 'Гардероб'); } });
        }

        // ── Current outfit preview ──
        swRenderCurrentOutfit(currentWrap, co, cn);
    }

    function swRenderCurrentOutfit(wrap, co, cn) {
        if (!wrap) return;
        const mode = swGetMode();
        const slots = mode === 'full' ? ['full', 'accessories', 'hair'] : ['top', 'bottom', 'shoes', 'accessories', 'hair'];
        const type = swTab;

        let slotsHtml = '';
        for (const cat of slots) {
            const itemId = co[type]?.[cat] || null;
            const item = itemId ? swFindItem(itemId) : null;
            if (item) {
                const src = swGetOutfitSrc(item);
                slotsHtml += `<div class="sw-current-slot">
                    <img src="${src}" class="sw-current-slot-img" alt="${esc(item.name)}" title="${esc(item.name)}">
                    <span class="sw-current-slot-label">${esc(CATEGORIES[cat])}</span>
                </div>`;
            } else {
                slotsHtml += `<div class="sw-current-slot">
                    <div class="sw-current-slot-empty">${esc(CATEGORIES[cat]?.[0] || '?')}</div>
                    <span class="sw-current-slot-label">${esc(CATEGORIES[cat])}</span>
                </div>`;
            }
        }

        const descText = swBuildDescription(type, cn);
        wrap.innerHTML = `
            <div class="sw-current-title">Сейчас надето (${type === 'bot' ? esc(cn) : '{{user}}'})</div>
            <div class="sw-current-slots">${slotsHtml}</div>
            ${descText ? `<div class="sw-current-desc">${esc(descText)}</div>` : ''}`;
    }

    // ── Build combined description from all active slots ──
    function swBuildDescription(type, cn) {
        const co = swGetCharOutfit();
        if (!co) return '';
        const mode = swGetModeFor(type);
        const slots = mode === 'full' ? ['full', 'accessories', 'hair'] : ['top', 'bottom', 'shoes', 'accessories', 'hair'];
        const SLOT_LABELS = { full: 'FULL', top: 'TOP', bottom: 'BOTTOM', shoes: 'SHOES', accessories: 'ACCESSORIES', hair: 'HAIR' };
        const parts = [];
        for (const cat of slots) {
            const itemId = co[type]?.[cat] || null;
            const item = itemId ? swFindItem(itemId) : null;
            if (item?.description) {
                if (item.description.trim()) parts.push(`${SLOT_LABELS[cat]}: ${item.description.trim()}`);
            }
        }
        return parts.join(' ');
    }

    // Description choice — inline in #sw-tab-content
    function swShowDescriptionModal(outfitName) {
        return new Promise((resolve) => {
            const el = swShowInline(`
                <div style="padding:10px;">
                    <div style="font-size:14px;font-weight:600;color:#f472b6;margin-bottom:6px;">💅 Описание отсутствует</div>
                    <div style="font-size:12px;color:#999;margin-bottom:14px;">«${esc(outfitName)}» — для наилучшего результата добавьте описание</div>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <button class="sw-inline-btn" data-choice="skip" style="padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#ddd;cursor:pointer;text-align:left;font-size:13px;"><b>Без описания</b><br><span style="font-size:11px;opacity:0.6;">Надеть как есть</span></button>
                        <button class="sw-inline-btn" data-choice="manual" style="padding:12px;border-radius:8px;border:1px solid rgba(244,114,182,0.25);background:rgba(244,114,182,0.08);color:#ddd;cursor:pointer;text-align:left;font-size:13px;"><b style="color:#f472b6;">✏️ Ввести вручную</b><br><span style="font-size:11px;opacity:0.6;">Описать аутфит своими словами</span></button>
                        <button class="sw-inline-btn" data-choice="ai" style="padding:12px;border-radius:8px;border:1px solid rgba(244,114,182,0.25);background:rgba(244,114,182,0.08);color:#ddd;cursor:pointer;text-align:left;font-size:13px;"><b style="color:#f472b6;">🤖 Сгенерировать ИИ</b><br><span style="font-size:11px;opacity:0.6;">Отправить картинку на анализ</span></button>
                    </div>
                </div>`);
            if (!el) { resolve(null); return; }
            for (const btn of el.querySelectorAll('.sw-inline-btn')) {
                btn.addEventListener('click', () => { swRestoreInline(); resolve(btn.dataset.choice); });
            }
        });
    }

    // ── Upload modal (custom, replaces browser prompts) ──
    // Render sub-forms inside #sw-tab-content, replacing the grid temporarily
    let _savedContent = null;
    function swShowInline(html) {
        const el = document.getElementById('sw-tab-content');
        if (!el) return null;
        _savedContent = el.innerHTML;
        el.innerHTML = html;
        // Hide current outfit preview and filters while sub-form is open
        const cur = document.getElementById('sw-current-outfit'); if (cur) cur.style.display = 'none';
        return el;
    }
    function swRestoreInline() {
        const el = document.getElementById('sw-tab-content');
        if (el && _savedContent !== null) { el.innerHTML = _savedContent; _savedContent = null; }
        const cur = document.getElementById('sw-current-outfit'); if (cur) cur.style.display = '';
        swRender(); // re-render to rebind events
    }

    function swShowUploadModal(defaultName) {
        return new Promise((resolve) => {
            let tagsHtml = '';
            for (const tag of TAG_KEYS) { tagsHtml += `<label style="display:inline-flex;align-items:center;gap:3px;font-size:12px;color:#bbb;cursor:pointer;"><input type="checkbox" value="${tag}" style="accent-color:#db7093;"> ${esc(TAGS[tag])}</label> `; }
            let catOptions = '';
            for (const cat of CAT_KEYS) { catOptions += `<option value="${cat}" ${cat === swCatTab ? 'selected' : ''}>${esc(CATEGORIES[cat])}</option>`; }

            const el = swShowInline(`
                <div style="padding:10px;">
                    <h3 style="margin:0 0 12px;font-size:15px;color:#f472b6;">👗 Новый предмет</h3>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Название</label>
                    <input type="text" id="sw-upl-name" value="${esc(defaultName)}" placeholder="Название" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;">
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Категория</label>
                    <select id="sw-upl-cat" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;">${catOptions}</select>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Для кого</label>
                    <select id="sw-upl-forwho" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;"><option value="all">Все</option><option value="bot" ${swTab === 'bot' ? 'selected' : ''}>Бот</option><option value="user" ${swTab === 'user' ? 'selected' : ''}>Юзер</option></select>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Пол</label>
                    <select id="sw-upl-gender" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;"><option value="unisex">⚥ Унисекс</option><option value="female">♀️ Женское</option><option value="male">♂️ Мужское</option></select>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Теги</label>
                    <div id="sw-upl-tags" style="display:flex;flex-wrap:wrap;gap:6px;">${tagsHtml}</div>
                    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
                        <button id="sw-upl-cancel" style="padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;background:rgba(255,255,255,0.08);color:#aaa;">Отмена</button>
                        <button id="sw-upl-save" style="padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;background:rgba(219,112,147,0.3);color:#f0a0c0;">Сохранить</button>
                    </div>
                </div>`);
            if (!el) { resolve(null); return; }

            const close = (val) => { swRestoreInline(); resolve(val); };
            el.querySelector('#sw-upl-cancel').addEventListener('click', () => close(null));
            el.querySelector('#sw-upl-save').addEventListener('click', () => {
                const name = el.querySelector('#sw-upl-name').value.trim();
                if (!name) { toastr.warning('Введите название', 'Гардероб'); return; }
                const category = el.querySelector('#sw-upl-cat').value;
                const forWho = el.querySelector('#sw-upl-forwho').value;
                const gender = el.querySelector('#sw-upl-gender').value;
                const tags = [...el.querySelectorAll('#sw-upl-tags input:checked')].map(c => c.value);
                close({ name, category, forWho, gender, tags });
            });
            setTimeout(() => el.querySelector('#sw-upl-name')?.focus(), 50);
        });
    }

    // ── Description input modal (replaces browser prompt()) ──
    function swShowDescInput(title, value) {
        return new Promise((resolve) => {
            const el = swShowInline(`
                <div style="padding:10px;">
                    <div style="font-size:14px;font-weight:600;color:#f472b6;margin-bottom:12px;">${esc(title)}</div>
                    <textarea id="sw-descinput-text" style="width:100%;min-height:100px;max-height:200px;padding:10px;border-radius:8px;border:1px solid rgba(244,114,182,0.2);background:rgba(0,0,0,0.3);color:#eee;font-size:13px;line-height:1.5;resize:vertical;box-sizing:border-box;font-family:inherit;">${esc(value || '')}</textarea>
                    <div style="font-size:11px;color:#888;margin-top:4px;" id="sw-descinput-count">${(value || '').length} символов</div>
                    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
                        <button id="sw-descinput-cancel" style="padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;background:rgba(255,255,255,0.08);color:#aaa;">Отмена</button>
                        <button id="sw-descinput-save" style="padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;background:rgba(244,114,182,0.25);color:#f472b6;font-weight:500;">Сохранить</button>
                    </div>
                </div>`);
            if (!el) { resolve(null); return; }
            const textarea = el.querySelector('#sw-descinput-text');
            const counter = el.querySelector('#sw-descinput-count');
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            textarea.addEventListener('input', () => { counter.textContent = `${textarea.value.length} символов`; });
            const close = (val) => { swRestoreInline(); resolve(val); };
            el.querySelector('#sw-descinput-cancel').addEventListener('click', () => close(null));
            el.querySelector('#sw-descinput-save').addEventListener('click', () => close(textarea.value.trim()));
        });
    }

    // ── Edit modal (custom, replaces browser prompts) ──
    function swShowEditModal(item) {
        return new Promise((resolve) => {
            let tagsHtml = '';
            for (const tag of TAG_KEYS) {
                const checked = Array.isArray(item.tags) && item.tags.includes(tag) ? 'checked' : '';
                tagsHtml += `<label style="display:inline-flex;align-items:center;gap:3px;font-size:12px;color:#bbb;cursor:pointer;"><input type="checkbox" value="${tag}" ${checked} style="accent-color:#db7093;"> ${esc(TAGS[tag])}</label> `;
            }
            let catOptions = '';
            for (const cat of CAT_KEYS) { catOptions += `<option value="${cat}" ${item.category === cat ? 'selected' : ''}>${esc(CATEGORIES[cat])}</option>`; }

            const el = swShowInline(`
                <div style="padding:10px;">
                    <h3 style="margin:0 0 12px;font-size:15px;color:#f472b6;">✏️ Редактировать</h3>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Название</label>
                    <input type="text" id="sw-edit-name" value="${esc(item.name)}" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;">
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Описание</label>
                    <textarea id="sw-edit-desc" style="width:100%;min-height:60px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;resize:vertical;">${esc(item.description || '')}</textarea>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Категория</label>
                    <select id="sw-edit-cat" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;">${catOptions}</select>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Для кого</label>
                    <select id="sw-edit-forwho" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;"><option value="all" ${(item.forWho || 'all') === 'all' ? 'selected' : ''}>Все</option><option value="bot" ${item.forWho === 'bot' ? 'selected' : ''}>Бот</option><option value="user" ${item.forWho === 'user' ? 'selected' : ''}>Юзер</option></select>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Пол</label>
                    <select id="sw-edit-gender" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.2);color:#eee;font-size:13px;box-sizing:border-box;"><option value="unisex" ${(item.gender || 'unisex') === 'unisex' ? 'selected' : ''}>⚥ Унисекс</option><option value="female" ${item.gender === 'female' ? 'selected' : ''}>♀️ Женское</option><option value="male" ${item.gender === 'male' ? 'selected' : ''}>♂️ Мужское</option></select>
                    <label style="display:block;font-size:12px;color:#aaa;margin:8px 0 4px;">Теги</label>
                    <div id="sw-edit-tags" style="display:flex;flex-wrap:wrap;gap:6px;">${tagsHtml}</div>
                    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
                        <button id="sw-edit-cancel" style="padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;background:rgba(255,255,255,0.08);color:#aaa;">Отмена</button>
                        <button id="sw-edit-save" style="padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;background:rgba(219,112,147,0.3);color:#f0a0c0;">Сохранить</button>
                    </div>
                </div>`);
            if (!el) { resolve(null); return; }
            const close = (val) => { swRestoreInline(); resolve(val); };
            el.querySelector('#sw-edit-cancel').addEventListener('click', () => close(null));
            el.querySelector('#sw-edit-save').addEventListener('click', () => {
                const name = el.querySelector('#sw-edit-name').value.trim();
                if (!name) { toastr.warning('Введите название', 'Гардероб'); return; }
                const description = el.querySelector('#sw-edit-desc').value.trim();
                const category = el.querySelector('#sw-edit-cat').value;
                const forWho = el.querySelector('#sw-edit-forwho').value;
                const gender = el.querySelector('#sw-edit-gender').value;
                const tags = [...el.querySelectorAll('#sw-edit-tags input:checked')].map(c => c.value);
                close({ name, description, category, forWho, gender, tags });
            });
            setTimeout(() => m.querySelector('#sw-edit-name')?.focus(), 50);
        });
    }

    async function swToggle(id) {
        const co = swGetCharOutfit();
        if (!co) return;
        const cn = swCharName();
        const o = swFindItem(id);
        if (!o) return;
        const nm = o.name || id;
        const cat = o.category || 'full';
        const mode = swGetMode();

        // Check category+mode compatibility
        if (swIsCatBlocked(mode, cat)) {
            toastr.warning(`Категория "${CATEGORIES[cat]}" недоступна в режиме "${mode === 'full' ? 'Полный комплект' : 'По частям'}"`, 'Гардероб');
            return;
        }

        const currentId = co[swTab]?.[cat] || null;
        const off = currentId === id;

        // If putting ON and no description — show custom modal (unless user opted out)
        if (!off && o && !o.description?.trim() && !swGetSettings().skipDescriptionWarning) {
            const choice = await swShowDescriptionModal(nm);

            if (choice === null) return;

            if (choice === 'manual') {
                const desc = await swShowDescInput('✏️ Описание аутфита', '');
                if (desc) { o.description = desc; swSave(); swRender(); }
                if (!o.description?.trim()) return;
            } else if (choice === 'ai') {
                const imgBase64 = o.imagePath ? await swLoadImageAsBase64(o.imagePath) : o.base64;
                if (imgBase64) {
                    const autoDesc = await swAnalyzeOutfit(imgBase64, cat);
                    if (autoDesc) {
                        const edited = await swShowDescInput('🤖 Описание (можете отредактировать)', autoDesc);
                        if (edited) { o.description = edited; swSave(); swRender(); }
                    } else {
                        toastr.warning('Не удалось сгенерировать. Попробуйте вручную.', 'Гардероб');
                        return;
                    }
                }
                if (!o.description?.trim()) return;
            }
            // 'skip' — proceed without description
        }

        if (off) {
            // Un-equip
            swSetSlot(swTab, cat, null);
        } else {
            // Equip — handle mode rules
            if (mode === 'full' && cat === 'full') {
                // Clear top/bottom/shoes (shouldn't have them, but just in case)
                co[swTab].top = null;
                co[swTab].bottom = null;
                co[swTab].shoes = null;
            }
            swSetSlot(swTab, cat, id);
        }

        swRender();
        swUpdatePromptInjection();
        swInjectFloatingBtn();
        off ? toastr.info(`\u00AB${nm}\u00BB снят`, 'Гардероб', { timeOut: 2000 }) : toastr.success(`\u00AB${nm}\u00BB надет`, 'Гардероб', { timeOut: 2000 });
    }

    const DESCRIBE_PROMPTS = {
        detailed: 'Reply IMMEDIATELY with a clothing description. Skip any thinking, reasoning, or preamble. Start directly with the garment name. Max 3 sentences, max 500 characters. Include: garment names, fabric, texture, fit, colors. Avoid mentioning what is absent or missing. English only.',
        simple: 'Reply IMMEDIATELY with a brief clothing description. Skip any thinking or preamble. Max 2 sentences, max 300 characters. List garments, colors. Avoid mentioning what is absent or missing. English only.',
        hair: 'Reply IMMEDIATELY with a short hairstyle description. Skip any thinking or preamble. Max 15 words. Format: "[style], [length], [texture]". Avoid mentioning hair color. Avoid mentioning what is absent or missing. Keep to one sentence only.',
    };

    async function swAnalyzeOutfit(base64, category) {
        const swS = swGetSettings();
        const mode = swS.describeMode || 'direct';
        const promptStyle = (category === 'hair') ? 'hair' : (swS.describePromptStyle || 'detailed');
        const describePrompt = DESCRIBE_PROMPTS[promptStyle] || DESCRIBE_PROMPTS.detailed;
        const maxDescLen = (category === 'hair') ? 250 : (promptStyle === 'simple' ? 400 : 600);
        const maxTokens = (category === 'hair') ? 80 : 300;
        swLog('INFO', `swAnalyzeOutfit: mode=${mode}, promptStyle=${promptStyle}, maxLen=${maxDescLen}`);
        toastr.info('Анализ образа...', 'Гардероб', { timeOut: 15000 });

        // ── Direct API mode (recommended) ──
        if (mode === 'direct') {
            const iigSettings = SillyTavern.getContext().extensionSettings[MODULE_NAME] || {};
            const endpoint = (swS.describeEndpoint || iigSettings.endpoint || '').replace(/\/$/, '');
            const apiKey = swS.describeKey || iigSettings.apiKey || '';
            const modelSelect = document.getElementById('slay_sw_describe_model');
            const model = modelSelect?.value || swS.describeModel || iigSettings.model || 'gemini-2.5-flash';
            if (!endpoint || !apiKey) {
                toastr.warning('Настройте API для описания в секции Гардероб', 'Гардероб', { timeOut: 5000 });
                return null;
            }
            // Determine API format: user choice > auto-detect by model name
            const apiFormat = swS.describeApiFormat || 'auto';
            let useGeminiFormat;
            if (apiFormat === 'gemini') useGeminiFormat = true;
            else if (apiFormat === 'openai') useGeminiFormat = false;
            else useGeminiFormat = model.toLowerCase().includes('gemini') || model.toLowerCase().includes('nano-banana');
            swLog('INFO', `Describe API format: ${apiFormat} -> ${useGeminiFormat ? 'gemini' : 'openai'}, model=${model}`);

            try {
                let desc = null;

                if (useGeminiFormat) {
                    const url = `${endpoint}/v1beta/models/${model}:generateContent`;
                    const body = {
                        contents: [{
                            role: 'user', parts: [
                                { inlineData: { mimeType: 'image/png', data: base64 } },
                                { text: describePrompt }
                            ]
                        }],
                        generationConfig: { responseModalities: ['TEXT'], maxOutputTokens: maxTokens }
                    };
                    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    if (!response.ok) throw new Error(`API ${response.status}`);
                    const result = await response.json();
                    desc = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text?.trim() || '';
                } else {
                    const url = `${endpoint}/v1/chat/completions`;
                    const body = {
                        model, max_tokens: maxTokens,
                        messages: [
                            { role: 'system', content: describePrompt },
                            {
                                role: 'user', content: [
                                    { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
                                    { type: 'text', text: 'Describe the clothing in this image.' }
                                ]
                            }
                        ]
                    };
                    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    if (!response.ok) throw new Error(`API ${response.status}`);
                    const result = await response.json();
                    desc = result.choices?.[0]?.message?.content?.trim() || '';
                }

                if (desc) {
                    // Strip thinking/reasoning preamble if model outputs it
                    // Strip thinking/reasoning: find where actual description starts
                    desc = desc.replace(/^\*\*.*?\*\*\s*/s, '');
                    if (/^(My Thought|Okay|Let me|I need to|First|Here's|Here is|Alright|So,|Right|Looking|I'm seeing|The prompt|Let's|I see)/i.test(desc)) {
                        const parts = desc.split(/\n\n/);
                        if (parts.length > 1) { desc = parts[parts.length - 1]; }
                        else {
                            const clothingMatch = desc.match(/(?:^|[.!]\s+)((?:A |An |The |Fitted |Loose |Soft |Thick |Thin |Dark |Light |Black |White |Red |Blue |Pink |Green |Long |Short |High |Low |Cropped |Oversized |Slim |Wide |Strapless |Off-shoulder |V-neck )[A-Z]?[a-z].*)/i);
                            if (clothingMatch) desc = clothingMatch[1];
                        }
                    }
                    desc = desc.replace(/^["'`]+|["'`]+$/g, '').replace(/^(Here|This|The image|I see|In this).{0,20}(shows?|features?|depicts?|displays?)\s*/i, '');
                }
                // Truncate to maxDescLen if model ignores token limits
                if (desc && desc.length > maxDescLen) {
                    const lastDot = desc.lastIndexOf('.', maxDescLen);
                    desc = lastDot > 50 ? desc.substring(0, lastDot + 1) : desc.substring(0, maxDescLen);
                    swLog('INFO', `Description truncated to ${desc.length} chars`);
                }
                if (desc && desc.length > 10) {
                    swLog('INFO', `Direct API described (${model}):`, desc.substring(0, 100)); return desc;
                }
                swLog('WARN', `Direct API: unusable result (len=${desc?.length || 0})`);
            } catch (e) { swLog('WARN', `Direct API failed (${model}):`, e.message); toastr.warning(`Ошибка: ${e.message}`, 'Гардероб', { timeOut: 5000 }); }
            return null;
        }

        // ── Chat API mode ──
        const ctx = SillyTavern.getContext();

        if (typeof ctx.generateRaw === 'function') {
            try {
                const messages = [
                    { role: 'system', content: describePrompt },
                    {
                        role: 'user', content: [
                            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
                            { type: 'text', text: 'Describe the clothing in this image.' },
                        ]
                    },
                ];
                const rawResult = await ctx.generateRaw({ prompt: messages, maxTokens: maxTokens });
                const result = typeof rawResult === 'string' ? rawResult : (rawResult?.text || rawResult?.message || String(rawResult || ''));
                let desc = (result || '').trim().replace(/^["'`]+|["'`]+$/g, '');
                if (desc && desc.length > maxDescLen) { const ld = desc.lastIndexOf('.', maxDescLen); desc = ld > 50 ? desc.substring(0, ld + 1) : desc.substring(0, maxDescLen); }
                if (desc && desc.length > 10) { return desc; }
            } catch (e) { swLog('WARN', 'generateRaw failed:', e.message); }
        }

        if (typeof ctx.generateQuietPrompt === 'function') {
            try {
                const rawResult = await ctx.generateQuietPrompt({ quietPrompt: '[OOC: Describe ONLY the clothing in the attached image. 1-2 sentences, English, no RP.]', quietImage: `data:image/png;base64,${base64}`, maxTokens: maxTokens });
                const result = typeof rawResult === 'string' ? rawResult : (rawResult?.text || rawResult?.message || String(rawResult || ''));
                let desc = (result || '').trim().replace(/^["'`]+|["'`]+$/g, '');
                if (desc && desc.length > maxDescLen) { const ld = desc.lastIndexOf('.', maxDescLen); desc = ld > 50 ? desc.substring(0, ld + 1) : desc.substring(0, maxDescLen); }
                if (desc && desc.length > 10) { return desc; }
            } catch (e) { swLog('WARN', 'generateQuietPrompt failed:', e.message); }
        }

        toastr.warning('Не удалось описать. Введите вручную.', 'Гардероб', { timeOut: 5000 });
        return null;
    }

    async function swUpload() {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.addEventListener('change', async () => {
            const f = inp.files?.[0]; if (!f) return;
            const defaultName = f.name.replace(/\.[^.]+$/, '');

            // Show upload modal
            const result = await swShowUploadModal(defaultName);
            if (!result) return;

            try {
                const { base64 } = await swResize(f, swGetSettings().maxDimension);
                let autoDesc = null;
                if (swGetSettings().autoDescribe !== false) {
                    autoDesc = await swAnalyzeOutfit(base64, result.category);
                }
                if (autoDesc) {
                    const edited = await swShowDescInput('🤖 Описание (можете отредактировать)', autoDesc);
                    if (edited !== null) autoDesc = edited;
                }
                const imagePath = await swSaveImageToFile(base64, `wardrobe_${result.name}`);
                swAddItem({
                    id: uid(),
                    name: result.name,
                    description: (autoDesc || '').trim(),
                    imagePath,
                    base64: '',
                    category: result.category,
                    forWho: result.forWho || 'all',
                    gender: result.gender || 'unisex',
                    tags: result.tags,
                    addedAt: Date.now(),
                });
                // Switch to the uploaded item's category
                swCatTab = result.category;
                swRender();
                toastr.success(`\u00AB${result.name}\u00BB добавлен`, 'Гардероб');
            } catch (e) { toastr.error('Ошибка: ' + e.message, 'Гардероб'); }
        });
        inp.click();
    }

    async function swEdit(id) {
        const o = swFindItem(id); if (!o) return;
        const result = await swShowEditModal(o);
        if (!result) return;
        o.name = result.name || o.name;
        o.description = result.description ?? o.description;
        o.category = result.category || o.category;
        o.forWho = result.forWho || 'all';
        o.gender = result.gender || 'unisex';
        o.tags = result.tags || o.tags;
        swSave();
        swRender();
        swUpdatePromptInjection();
        toastr.info('Обновлён', 'Гардероб');
    }

    async function swRegenDescription(id) {
        const o = swFindItem(id); if (!o) return;
        const imgBase64 = o.imagePath ? await swLoadImageAsBase64(o.imagePath) : o.base64;
        if (!imgBase64) { toastr.error('Картинка не найдена', 'Гардероб'); return; }
        const autoDesc = await swAnalyzeOutfit(imgBase64, o.category);
        if (autoDesc) {
            const edited = await swShowDescInput('🤖 Описание (можете отредактировать)', autoDesc);
            if (edited) {
                o.description = edited; swSave(); swRender(); swUpdatePromptInjection();
                toastr.success('Описание обновлено', 'Гардероб', { timeOut: 2000 });
            }
        }
    }

    // ── Prompt injection ──
    const SW_PROMPT_KEY = 'slaywardrobe_outfit';

    function swUpdatePromptInjection() {
        try {
            const ctx = SillyTavern.getContext();
            if (typeof ctx.setExtensionPrompt !== 'function') { swLog('WARN', 'setExtensionPrompt not available'); return; }
            const cn = swCharName();
            if (!cn) { ctx.setExtensionPrompt(SW_PROMPT_KEY, '', 1, 0); return; }
            const co = swGetCharOutfit();
            if (!co) { ctx.setExtensionPrompt(SW_PROMPT_KEY, '', 1, 0); return; }

            const lines = [];
            for (const type of ['bot', 'user']) {
                const who = type === 'bot' ? cn : '{{user}}';
                const desc = swBuildDescription(type, cn);
                if (desc) {
                    lines.push(`[OUTFIT LOCK \u2014 keep unchanged: ${who} is currently wearing: ${desc}. Always use this exact outfit when writing image prompts for ${who}.]`);
                }
            }

            const injectionText = lines.length > 0 ? lines.join('\n') : '';
            ctx.setExtensionPrompt(SW_PROMPT_KEY, injectionText, 1, 0);
            if (injectionText) { swLog('INFO', `Prompt injection updated (MANDATORY depth=0): ${lines.length} outfit(s)`); }
            else { swLog('INFO', 'Prompt injection cleared (no active outfits)'); }
        } catch (e) { swLog('ERROR', 'Failed to update prompt injection:', e.message); }
    }

    // ── Bar button ──
    function swInjectFloatingBtn() {
        let $btn = $('#sw-bar-btn');
        if ($btn.length === 0) {
            $btn = $('<div id="sw-bar-btn" title="Гардероб"><i class="fa-solid fa-shirt"></i></div>');
            $btn.on('click touchend', function (e) { e.preventDefault(); e.stopPropagation(); swOpenModal(); });
            const $left = $('#leftSendForm');
            if ($left.length) $left.append($btn); else $('body').append($btn);
        }
        const co = swGetCharOutfit();
        let count = 0;
        if (co) {
            for (const type of ['bot', 'user']) {
                for (const cat of CAT_KEYS) {
                    if (co[type]?.[cat]) count++;
                }
            }
        }
        $btn.toggleClass('sw-bar-active', count > 0);
        if (count > 0) {
            $btn.html(`<i class="fa-solid fa-shirt"></i><span class="sw-bar-count">${count}</span>`);
        } else { $btn.html('<i class="fa-solid fa-shirt"></i>'); }
        $btn.show();
    }

    // ── Public API ──
    window.slayWardrobe = {
        async getActiveOutfitBase64(type) {
            const cn = swCharName(); if (!cn) return null;
            const co = swGetCharOutfit(); if (!co) return null;
            const mode = swGetModeFor(type);
            // Only return base64 if mode=full and full item equipped
            if (mode !== 'full') return null;
            const fullId = co[type]?.full;
            if (!fullId) return null;
            const outfit = swFindItem(fullId);
            if (!outfit) return null;
            if (outfit.imagePath) return await swLoadImageAsBase64(outfit.imagePath);
            return outfit.base64 || null;
        },
        getActiveOutfitDescription(type) {
            const cn = swCharName(); if (!cn) return '';
            return swBuildDescription(type, cn);
        },
        async getCollageBase64(type) {
            if (!swGetSettings().experimentalCollage) return null;
            // 1 item = return as single ref; 2+ = collage
            const images = await swGetPartsImages(type);
            if (images.length === 1) return images[0]; // single item, no collage needed
            if (images.length >= 2) return await swBuildCollage(type);
            return null;
        },
        getActiveOutfitData(type) {
            const cn = swCharName(); if (!cn) return null;
            const co = swGetCharOutfit(); if (!co) return null;
            const result = {};
            for (const cat of CAT_KEYS) {
                const itemId = co[type]?.[cat] || null;
                result[cat] = itemId ? swFindItem(itemId) : null;
            }
            return result;
        },
        openModal: () => swOpenModal(),
        isReady: () => true,
        applyModalWidth: () => swApplyModalWidth(),
    };

    // ── Init hooks ──
    const ctx = SillyTavern.getContext();
    ctx.eventSource.on(ctx.event_types.APP_READY, () => {
        swApplyModalWidth();
        setTimeout(() => { swUpdatePromptInjection(); swInjectFloatingBtn(); }, 500);
    });
    ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, () => {
        setTimeout(() => { swUpdatePromptInjection(); swInjectFloatingBtn(); }, 300);
    });
    // Refresh outfit prompt injection RIGHT BEFORE every LLM request. Fixes
    // intermittent "wardrobe description missing" cases:
    //   - User sends message within the 300ms CHAT_CHANGED debounce window
    //   - Swipe / regenerate cleared/reordered ST's extension prompt buffer
    //   - User's preset rebuilds the messages array and stale ext prompts
    // Calling swUpdatePromptInjection() here guarantees the injection is
    // present and current for every single generation.
    if (ctx.event_types.GENERATION_STARTED) {
        ctx.eventSource.on(ctx.event_types.GENERATION_STARTED, () => {
            try { swUpdatePromptInjection(); } catch (e) { swLog('WARN', 'GENERATION_STARTED injection refresh failed:', e.message); }
        });
    }
    swLog('INFO', 'SlayWardrobe v4 initialized');
})();


/* ╔═══════════════════════════════════════════════════════════════╗
   ║  MODULE 2: Core Engine (Inline Image Generation + NPC Refs)   ║
   ╚═══════════════════════════════════════════════════════════════╝ */

// PREVIEW BUILD — isolated. Seeded once from slay_image_gen on first load.
const MODULE_NAME = 'slay_image_gen';

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const FETCH_TIMEOUT = IS_IOS ? 180000 : 300000;

function robustFetch(url, options = {}) {
    if (!IS_IOS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        return fetch(url, { ...options, signal: controller.signal })
            .then(r => { clearTimeout(timeoutId); return r; })
            .catch(e => { clearTimeout(timeoutId); if (e.name === 'AbortError') throw new Error('Request timed out after 5 minutes'); throw e; });
    }
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url);
        xhr.timeout = FETCH_TIMEOUT;
        xhr.responseType = 'text';
        if (options.headers) { for (const [key, value] of Object.entries(options.headers)) { xhr.setRequestHeader(key, value); } }
        xhr.onload = () => { resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, statusText: xhr.statusText, text: () => Promise.resolve(xhr.responseText), json: () => Promise.resolve(JSON.parse(xhr.responseText)), headers: { get: (name) => xhr.getResponseHeader(name) } }); };
        xhr.ontimeout = () => reject(new Error('Request timed out after 3 minutes (iOS)'));
        xhr.onerror = () => reject(new Error('Network error (iOS)'));
        xhr.onabort = () => reject(new Error('Request aborted (iOS)'));
        xhr.send(options.body || null);
    });
}

const processingMessages = new Set();
const recentlyProcessed = new Map();
const REPROCESS_COOLDOWN_MS = 5000;
let _eventHandlerDepth = 0;
const MAX_EVENT_HANDLER_DEPTH = 2;

setInterval(() => {
    const now = Date.now();
    for (const [id, ts] of recentlyProcessed) {
        if (now - ts > REPROCESS_COOLDOWN_MS * 2) recentlyProcessed.delete(id);
    }
}, 30000);

let sessionGenCount = 0;
let sessionErrorCount = 0;

function updateSessionStats() {
    const el = document.getElementById('slay_session_stats');
    if (!el) return;
    if (sessionGenCount === 0 && sessionErrorCount === 0) { el.textContent = ''; return; }
    const parts = [];
    if (sessionGenCount > 0) parts.push(`${sessionGenCount} generated`);
    if (sessionErrorCount > 0) parts.push(`${sessionErrorCount} failed`);
    el.textContent = `Session: ${parts.join(' · ')}`;
}

const logBuffer = [];
const MAX_LOG_ENTRIES = 200;

function iigLog(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const entry = `[${timestamp}] [${level}] ${message}`;
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.shift();
    if (level === 'ERROR') console.error('[IIG]', ...args);
    else if (level === 'WARN') console.warn('[IIG]', ...args);
    else console.log('[IIG]', ...args);
}

function exportLogs() {
    const logsText = logBuffer.join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `slay-iig-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`; a.click();
    URL.revokeObjectURL(url);
    toastr.success('Логи экспортированы', 'SLAY Images');
}

// ── Default settings (union of both extensions) ──
const defaultSettings = Object.freeze({
    enabled: true,
    externalBlocks: false,
    imageContextEnabled: false,
    imageContextCount: 1,
    apiType: 'openai',
    endpoint: '',
    apiKey: '',
    model: '',
    size: '1024x1024',
    quality: 'standard',
    maxRetries: 0,
    retryDelay: 1000,
    // Gemini/nano-banana
    sendCharAvatar: true,
    sendUserAvatar: true,
    userAvatarFile: '',
    // refMigratedV41 — sentinel for one-time migration to reset sticky false values
    refMigratedV41: false,
    aspectRatio: '1:1',
    imageSize: '1K',
    // Naistera
    naisteraAspectRatio: '1:1',
    naisteraPreset: '',
    naisteraModel: 'grok',
    // Style picker
    slayStyle: '',
    slayStyleName: '',
    naisteraSendCharAvatar: false,
    naisteraSendUserAvatar: false,
    naisteraVideoTest: false,
    naisteraVideoEveryN: 1,
    // NPC refs (flat storage)
    charRef: { name: '', imageBase64: '', imagePath: '' },
    userRef: { name: '', imageBase64: '', imagePath: '' },
    npcReferences: [],
});

const MAX_CONTEXT_IMAGES = 3;
const MAX_GENERATION_REFERENCE_IMAGES = 5;
const STYLE_BLOCK_RE = /\[\s*style\s*:\s*[^\]]*\]/gi;

function injectStyleBlock(prompt, styleValue) {
    const normalizedPrompt = String(prompt || '').trim();
    const normalizedStyle = String(styleValue || '').trim();
    if (!normalizedStyle) {
        return normalizedPrompt;
    }

    const styleBlock = `[STYLE: ${normalizedStyle}]`;
    if (!normalizedPrompt) {
        return styleBlock;
    }

    STYLE_BLOCK_RE.lastIndex = 0;
    if (STYLE_BLOCK_RE.test(normalizedPrompt)) {
        STYLE_BLOCK_RE.lastIndex = 0;
        let replacedFirst = false;
        return normalizedPrompt.replace(STYLE_BLOCK_RE, () => {
            if (replacedFirst) return '';
            replacedFirst = true;
            return styleBlock;
        }).trim();
    }

    return `${styleBlock}\n\n${normalizedPrompt}`.trim();
}

const IMAGE_MODEL_KEYWORDS = [
    'dall-e', 'midjourney', 'mj', 'journey', 'stable-diffusion', 'sdxl', 'flux',
    'imagen', 'drawing', 'paint', 'image', 'seedream', 'hidream', 'dreamshaper',
    'ideogram', 'nano-banana', 'gpt-image', 'wanx', 'qwen'
];
const VIDEO_MODEL_KEYWORDS = [
    'sora', 'kling', 'jimeng', 'veo', 'pika', 'runway', 'luma',
    'video', 'gen-3', 'minimax', 'cogvideo', 'mochi', 'seedance',
    'vidu', 'wan-ai', 'hunyuan', 'hailuo'
];

function isImageModel(modelId) {
    const mid = modelId.toLowerCase();
    for (const kw of VIDEO_MODEL_KEYWORDS) { if (mid.includes(kw)) return false; }
    if (mid.includes('vision') && mid.includes('preview')) return false;
    for (const kw of IMAGE_MODEL_KEYWORDS) { if (mid.includes(kw)) return true; }
    return false;
}

function isGeminiModel(modelId) {
    return modelId.toLowerCase().includes('nano-banana');
}

// ── Naistera/endpoint helpers (from sillyimages-master) ──
const NAISTERA_MODELS = Object.freeze(['grok', 'nano banana', 'grok-pro', 'novelai']);
const DEFAULT_ENDPOINTS = Object.freeze({ naistera: 'https://naistera.org' });
const ENDPOINT_PLACEHOLDERS = Object.freeze({ openai: 'https://api.openai.com', gemini: 'https://generativelanguage.googleapis.com', naistera: 'https://naistera.org' });

function normalizeNaisteraModel(model) {
    const raw = String(model || '').trim().toLowerCase();
    if (!raw) return 'grok';
    if (raw === 'nano-banana' || raw === 'nano-banana-pro' || raw === 'nano-banana-2' || raw === 'nano banana pro' || raw === 'nano banana 2') return 'nano banana';
    if (NAISTERA_MODELS.includes(raw)) return raw;
    return 'grok';
}
function shouldUseNaisteraVideoTest(model) { const n = normalizeNaisteraModel(model); return n === 'grok' || n === 'nano banana'; }
function normalizeNaisteraVideoFrequency(value) { const n = Number.parseInt(String(value ?? '').trim(), 10); if (!Number.isFinite(n) || n < 1) return 1; return Math.min(n, 999); }
function normalizeImageContextCount(value) { const n = Number.parseInt(String(value ?? '').trim(), 10); if (!Number.isFinite(n) || n < 1) return 1; return Math.min(n, MAX_CONTEXT_IMAGES); }

function getAssistantMessageOrdinal(messageId) {
    const context = SillyTavern.getContext();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    let ordinal = 0;
    for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message || message.is_user || message.is_system) continue;
        ordinal += 1;
        if (i === messageId) return ordinal;
    }
    return Math.max(1, messageId + 1);
}
function shouldTriggerNaisteraVideoForMessage(messageId, everyN) {
    const n = normalizeNaisteraVideoFrequency(everyN);
    if (n <= 1) return true;
    return getAssistantMessageOrdinal(messageId) % n === 0;
}
function getEndpointPlaceholder(apiType) { return ENDPOINT_PLACEHOLDERS[apiType] || 'https://api.example.com'; }
function normalizeConfiguredEndpoint(apiType, endpoint) {
    const trimmed = String(endpoint || '').trim().replace(/\/+$/, '');
    if (!trimmed) return apiType === 'naistera' ? DEFAULT_ENDPOINTS.naistera : '';
    if (apiType === 'naistera') return trimmed.replace(/\/api\/generate$/i, '');
    return trimmed;
}
function shouldReplaceEndpointForApiType(apiType, endpoint) {
    const trimmed = String(endpoint || '').trim();
    if (!trimmed) return true;
    if (apiType !== 'naistera') return false;
    return /\/v1\/images\/generations\/?$/i.test(trimmed) || /\/v1\/models\/?$/i.test(trimmed) || /\/v1beta\/models\//i.test(trimmed);
}
function getEffectiveEndpoint(settings = getSettings()) {
    return normalizeConfiguredEndpoint(settings.apiType, settings.endpoint);
}

// ── Settings management ──
function getSettings() {
    const context = SillyTavern.getContext();
    if (!context.extensionSettings[MODULE_NAME]) context.extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(context.extensionSettings[MODULE_NAME], key)) context.extensionSettings[MODULE_NAME][key] = defaultSettings[key];
    }
    return context.extensionSettings[MODULE_NAME];
}

// Capture ST's original window.saveSettings lazily to avoid infinite recursion
// if our function shadows it in global scope
let _stSaveSettings = null;
let _stSaveSettingsCaptured = false;

function saveSettings() {
    if (!_stSaveSettingsCaptured) {
        _stSaveSettings = window.saveSettings;
        _stSaveSettingsCaptured = true;
    }
    const context = SillyTavern.getContext();
    if (typeof _stSaveSettings === 'function' && _stSaveSettings !== saveSettings) {
        try { _stSaveSettings(); } catch (e) { context.saveSettingsDebounced(); }
    } else {
        context.saveSettingsDebounced();
    }
    persistRefsToLocalStorage();
}
function saveSettingsNow() { saveSettings(); }

const LS_KEY = 'slay_iig_refs_v1';

function persistRefsToLocalStorage() {
    try {
        const settings = getSettings();
        const refs = JSON.parse(JSON.stringify(settings.npcReferences || {}));
        localStorage.setItem(LS_KEY, JSON.stringify(refs));
    } catch (e) { iigLog('WARN', 'persistRefsToLocalStorage failed:', e.message); }
}

function restoreRefsFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const backup = JSON.parse(raw);
        if (!backup || typeof backup !== 'object') return;
        const settings = getSettings();
        settings.npcReferences = backup;
        iigLog('INFO', 'Refs restored from localStorage');
    } catch (e) { iigLog('WARN', 'restoreRefsFromLocalStorage failed:', e.message); }
}

function initMobileSaveListeners() {
    const flush = () => {
        persistRefsToLocalStorage();
        try { SillyTavern.getContext().saveSettingsDebounced(); } catch (e) { }
        if (typeof _stSaveSettings === 'function' && _stSaveSettings !== saveSettings) { try { _stSaveSettings(); } catch (e) { } }
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
}

// ── NPC refs (per-character storage) ──
function getActiveCharacterName() {
    const ctx = SillyTavern.getContext();
    if (ctx.characterId !== undefined && ctx.characters?.[ctx.characterId]) {
        return ctx.characters[ctx.characterId].name || '';
    }
    return '';
}

function getActiveUserName() {
    const ctx = SillyTavern.getContext();
    return String(
        ctx.name1
        || ctx.user_name
        || ctx.chatMetadata?.user_name
        || ctx.groups?.find?.(g => g.id === ctx.groupId)?.name
        || ''
    ).trim();
}

function getDefaultCharRefName(refs = getCurrentCharacterRefs()) {
    return String(refs?.charRef?.name || getActiveCharacterName() || 'Character').trim();
}

function getDefaultUserRefName(refs = getCurrentCharacterRefs()) {
    return String(refs?.userRef?.name || getActiveUserName() || 'User').trim();
}

const EMPTY_REFS = () => ({
    charRef: { name: '', imageBase64: '', imagePath: '' },
    userRef: { name: '', imageBase64: '', imagePath: '' },
    npcReferences: [
        { name: '', imageBase64: '', imagePath: '' },
        { name: '', imageBase64: '', imagePath: '' },
        { name: '', imageBase64: '', imagePath: '' },
        { name: '', imageBase64: '', imagePath: '' },
    ],
});

function getCurrentCharacterRefs() {
    const settings = getSettings();
    const charName = getActiveCharacterName();

    // Initialize per-character storage if missing
    if (!settings.perCharacterRefs) settings.perCharacterRefs = {};

    // If we have a character selected, use per-character refs
    if (charName) {
        if (!settings.perCharacterRefs[charName]) {
            // Migrate: if old flat refs exist and this is the first time, copy them
            if (settings.charRef?.imagePath || settings.userRef?.imagePath || settings.npcReferences?.some?.(n => n?.imagePath || n?.imageBase64)) {
                settings.perCharacterRefs[charName] = {
                    charRef: settings.charRef ? { ...settings.charRef } : EMPTY_REFS().charRef,
                    userRef: settings.userRef ? { ...settings.userRef } : EMPTY_REFS().userRef,
                    npcReferences: Array.isArray(settings.npcReferences) ? settings.npcReferences.map(n => ({ ...n })) : EMPTY_REFS().npcReferences,
                };
                iigLog('INFO', `Migrated flat refs to per-character for "${charName}"`);
            } else {
                settings.perCharacterRefs[charName] = EMPTY_REFS();
            }
        }
        const refs = settings.perCharacterRefs[charName];
        if (!refs.charRef) refs.charRef = { name: '', imageBase64: '', imagePath: '' };
        if (!refs.userRef) refs.userRef = { name: '', imageBase64: '', imagePath: '' };
        if (!Array.isArray(refs.npcReferences)) refs.npcReferences = [];
        while (refs.npcReferences.length < 4) refs.npcReferences.push({ name: '', imageBase64: '', imagePath: '' });
        return refs;
    }

    // Fallback: no character selected — use flat refs
    if (!settings.charRef) settings.charRef = { name: '', imageBase64: '', imagePath: '' };
    if (!settings.userRef) settings.userRef = { name: '', imageBase64: '', imagePath: '' };
    if (!Array.isArray(settings.npcReferences)) settings.npcReferences = [];
    while (settings.npcReferences.length < 4) settings.npcReferences.push({ name: '', imageBase64: '', imagePath: '' });
    return settings;
}
function getCurrentCharacterNpcs() { return getCurrentCharacterRefs().npcReferences; }

// Parse a name field that may contain multiple aliases separated by comma / semicolon / pipe /
// slash / whitespace (e.g. "Ева, Eve, Eva, Ivy, Иви"). Returns tokens of length >= 2.
// The >=2 cutoff (was >2) lets 2-letter names like "Ли", "Ян", "Ed", "Jo" pass.
function parseNameTokens(rawName) {
    return String(rawName || '')
        .split(/[\s,;|/]+/)
        .map(t => t.trim())
        .filter(t => t.length >= 2);
}

// Generic placeholder names ST falls back to when persona/char name is empty.
// Without the skip below, nameIsInPrompt("User", "the user walks") returns
// true (substring match on "user") and our code happily ships the user ref
// into a prompt that has no actual user mention. Same for "Character", etc.
const NAME_GENERIC_FALLBACKS = new Set([
    'user', 'character', 'char', 'persona', 'юзер', 'персонаж', 'чар',
]);

// Substring check with Unicode-aware word boundary so a real-name alias
// doesn't trip on a longer word that just happens to contain it. Examples
// of the false positives this prevents:
//   Eva → evangelion / evangelist
//   Ева → евразия / евангелие
//   Roxy → proxy / epoxy
//   Ed → predator / editor
//   User → user-friendly (also caught by NAME_GENERIC_FALLBACKS above)
// Cyrillic letters are correctly treated as word chars via \p{L}.
function wordBoundaryIncludes(needle, haystack) {
    if (!needle || !haystack) return false;
    const isLetter = ch => !!ch && /[\p{L}]/u.test(ch);
    let idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        const before = idx === 0 ? '' : haystack[idx - 1];
        const after = idx + needle.length >= haystack.length ? '' : haystack[idx + needle.length];
        if (!isLetter(before) && !isLetter(after)) return true;
        idx += 1;
    }
    return false;
}

function nameIsInPrompt(rawName, lowerPrompt) {
    const tokens = parseNameTokens(rawName);
    if (tokens.length === 0) return false;
    return tokens.some(token => {
        const lower = token.toLowerCase();
        if (NAME_GENERIC_FALLBACKS.has(lower)) return false;
        return wordBoundaryIncludes(lower, lowerPrompt);
    });
}

function matchNpcReferences(prompt, npcList) {
    if (!prompt || !npcList || npcList.length === 0) return [];
    const lowerPrompt = prompt.toLowerCase();
    const matched = [];
    for (const npc of npcList) {
        if (!npc || !npc.name || (!npc.imagePath && !npc.imageBase64 && !npc.imageData)) continue;
        if (nameIsInPrompt(npc.name, lowerPrompt)) {
            matched.push({ name: npc.name, imageBase64: npc.imageBase64, imagePath: npc.imagePath });
        }
    }
    return matched;
}

// ── External blocks + context images (from sillyimages-master) ──
function getMessageRenderText(message, settings = getSettings()) {
    if (!message) return '';
    if (settings.externalBlocks && message.extra?.display_text) return message.extra.display_text;
    return message.mes || '';
}

async function parseMessageImageTags(message, options = {}) {
    const settings = getSettings();
    const tags = [];
    const mainTags = await parseImageTags(message?.mes || '', options);
    tags.push(...mainTags.map(tag => ({ ...tag, sourceKey: 'mes' })));
    if (settings.externalBlocks && message?.extra?.extblocks) {
        const extTags = await parseImageTags(message.extra.extblocks, options);
        tags.push(...extTags.map(tag => ({ ...tag, sourceKey: 'extblocks' })));
    }
    return tags;
}

function replaceTagInMessageSource(message, tag, replacement) {
    if (!message || !tag) return;
    if (tag.sourceKey === 'extblocks') {
        if (!message.extra) message.extra = {};
        message.extra.extblocks = (message.extra.extblocks || '').replace(tag.fullMatch, replacement);
        const swipeId = message.swipe_id;
        if (swipeId !== undefined && message.swipe_info?.[swipeId]?.extra?.extblocks) {
            message.swipe_info[swipeId].extra.extblocks = message.swipe_info[swipeId].extra.extblocks.replace(tag.fullMatch, replacement);
        }
        if (message.extra.display_text) message.extra.display_text = message.extra.display_text.replace(tag.fullMatch, replacement);
        return;
    }
    // Main message path: update mes, display_text AND all swipes/swipe_info.
    // ST re-renders from swipes on chat reload AND on swipe-revert (after
    // an aborted swipe). Updating only the current swipe leaves stale src
    // in other swipe entries — abort/revert can resurrect them.
    // Iterating ALL swipes is safe: tag.fullMatch is per-swipe-content, so
    // it's no-op when a swipe doesn't contain it.
    message.mes = (message.mes || '').replace(tag.fullMatch, replacement);
    if (message.extra?.display_text) message.extra.display_text = message.extra.display_text.replace(tag.fullMatch, replacement);
    if (Array.isArray(message.swipes)) {
        for (let i = 0; i < message.swipes.length; i++) {
            if (typeof message.swipes[i] === 'string') {
                message.swipes[i] = message.swipes[i].replace(tag.fullMatch, replacement);
            }
        }
    }
    if (Array.isArray(message.swipe_info)) {
        for (let i = 0; i < message.swipe_info.length; i++) {
            const si = message.swipe_info[i]?.extra;
            if (!si) continue;
            if (typeof si.display_text === 'string') si.display_text = si.display_text.replace(tag.fullMatch, replacement);
            if (typeof si.extblocks === 'string') si.extblocks = si.extblocks.replace(tag.fullMatch, replacement);
        }
    }
}

function extractGeneratedImageUrlsFromText(text) {
    const urls = []; const seen = new Set(); const rawText = String(text || '');
    const legacyMatches = Array.from(rawText.matchAll(/\[IMG:✓:([^\]]+)\]/g));
    for (let i = legacyMatches.length - 1; i >= 0; i--) {
        const src = String(legacyMatches[i][1] || '').trim();
        if (!src || seen.has(src)) continue; seen.add(src); urls.push(src);
    }
    if (!rawText.includes('<img')) return urls;
    const template = document.createElement('template');
    template.innerHTML = rawText;
    const imageNodes = Array.from(template.content.querySelectorAll('img[data-iig-instruction], video[data-iig-instruction]')).reverse();
    for (const node of imageNodes) {
        const src = String(node.getAttribute('src') || '').trim();
        if (!src || src.startsWith('data:') || src.includes('[IMG:') || src.includes('[VID:') || src.endsWith('/error.svg') || seen.has(src)) continue;
        seen.add(src); urls.push(src);
    }
    return urls;
}

function getPreviousGeneratedImageUrls(messageId, requestedCount) {
    const count = normalizeImageContextCount(requestedCount);
    if (!Number.isInteger(messageId) || messageId <= 0) return [];
    const settings = getSettings();
    const context = SillyTavern.getContext();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    const urls = []; const seen = new Set();
    for (let idx = messageId - 1; idx >= 0 && urls.length < count; idx--) {
        const message = chat[idx];
        if (!message || message.is_user || message.is_system) continue;
        const text = getMessageRenderText(message, settings);
        const messageUrls = extractGeneratedImageUrlsFromText(text);
        for (const url of messageUrls) {
            if (seen.has(url)) continue; seen.add(url); urls.push(url);
            if (urls.length >= count) break;
        }
    }
    return urls;
}

async function collectPreviousContextReferences(messageId, format, requestedCount) {
    const urls = getPreviousGeneratedImageUrls(messageId, requestedCount);
    if (urls.length === 0) return [];
    const convert = format === 'dataUrl' ? imageUrlToDataUrl : imageUrlToBase64;
    const converted = await Promise.all(urls.map(url => convert(url)));
    return converted.filter(Boolean);
}

// ── Image utilities ──
function compressBase64Image(rawBase64, maxDim = 768, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) { const scale = maxDim / Math.max(w, h); w = Math.round(w * scale); h = Math.round(h * scale); }
            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const b64 = dataUrl.split(',')[1];
            iigLog('INFO', `Compressed: ${img.width}x${img.height} -> ${w}x${h}, ~${Math.round(b64.length / 1024)}KB`);
            resolve(b64);
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = 'data:image/jpeg;base64,' + rawBase64;
    });
}

async function fetchImageBlob(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) { iigLog('WARN', `Skipping ref fetch: url=${url} status=${response.status}`); return null; }
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) { iigLog('WARN', `Non-image content-type: url=${url} ct=${contentType}`); return null; }
        const blob = await response.blob();
        const blobType = String(blob.type || contentType || '').toLowerCase();
        if (!blobType.startsWith('image/')) { iigLog('WARN', `Non-image blob type: url=${url} bt=${blobType}`); return null; }
        return blob;
    } catch (error) { iigLog('WARN', `Ref fetch failed: url=${url} err=${error?.message}`); return null; }
}

async function imageUrlToBase64(url) {
    try {
        const blob = await fetchImageBlob(url);
        if (!blob) return null;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) { console.error('[IIG] imageUrlToBase64 failed:', error); return null; }
}

async function imageUrlToDataUrl(url) {
    try {
        const blob = await fetchImageBlob(url);
        if (!blob) return null;
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) { console.error('[IIG] imageUrlToDataUrl failed:', error); return null; }
}

// ── v4.2 Recent Refs ──
// Tracks the last N ref-image paths that were assigned to any slot, so the user can
// re-assign them quickly via a ribbon under the refs block or a "Недавние" picker.
const RECENT_REFS_MAX = 10;

function pushRecentRef(path) {
    if (!path) return;
    const settings = getSettings();
    if (!Array.isArray(settings.recentRefs)) settings.recentRefs = [];
    // Remove any existing entry with this path (we'll re-insert at front)
    settings.recentRefs = settings.recentRefs.filter(r => (typeof r === 'string' ? r : r.path) !== path);
    settings.recentRefs.unshift({ path, lastUsed: Date.now() });
    if (settings.recentRefs.length > RECENT_REFS_MAX) settings.recentRefs.length = RECENT_REFS_MAX;
    saveSettings();
    // Re-render ribbon if UI is mounted
    try { renderRecentRefsRibbon(); } catch (_) { /* no-op if not yet mounted */ }
}

function getRecentRefs() {
    const 
