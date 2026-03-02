// ================= CONFIGURATION =================
let game = {
    ki: 0,
    kiPerClick: 1,
    autoCount: 0,
    autoSpeed: 1000,
    prestige: 0,
    meditationCount: 0,
    costs: { click: 5, auto: 50, speed: 500 },
    totalClicks: 0,
    totalKiEarned: 0,
    totalAutoKi: 0,
    sessionStart: Date.now()
};

let musicOn = false;
let musicStarted = false;
let autoInterval;
let autoCursors = [];

// ================= BONUS TEMPORAIRE =================
let tempBonusActive = false;
let tempBonusInterval = null;
let tempBonusTimeLeft = 0;
const TEMP_BONUS_DURATION = 30;
const TEMP_BONUS_MULTIPLIER = 10;

function activateTempBonus() {
    if (tempBonusActive) { showMasterMessage("KAIOKEN DEJA ACTIF !"); return; }
    const cost = Math.round(200 * Math.pow(2, game.prestige));
    if (game.ki < cost) { showMasterMessage("Ki insuffisant ! Besoin : " + cost.toLocaleString() + " Ki"); return; }
    game.ki -= cost;
    tempBonusActive = true;
    tempBonusTimeLeft = TEMP_BONUS_DURATION;
    const btn = document.getElementById("aff_click_button");
    if (btn) btn.style.filter = "hue-rotate(0deg) brightness(2) drop-shadow(0 0 30px red)";
    document.documentElement.style.setProperty('--glow-color', '#ff2200');
    showMasterMessage("KAIOKEN x" + TEMP_BONUS_MULTIPLIER + " ACTIVE ! (" + TEMP_BONUS_DURATION + "s)");
    if (tempBonusInterval) clearInterval(tempBonusInterval);
    tempBonusInterval = setInterval(() => {
        tempBonusTimeLeft--;
        updateTempBonusDisplay();
        refreshStatsValues();
        if (tempBonusTimeLeft <= 0) deactivateTempBonus();
    }, 1000);
    updateTempBonusDisplay();
    updateDisplay();
}

function deactivateTempBonus() {
    tempBonusActive = false;
    tempBonusTimeLeft = 0;
    if (tempBonusInterval) clearInterval(tempBonusInterval);
    const btn = document.getElementById("aff_click_button");
    if (btn) btn.style.filter = "";
    const rank = getRankData(game.prestige);
    document.documentElement.style.setProperty('--glow-color', rank.couleur);
    showMasterMessage("Kaioken termine...");
    updateTempBonusDisplay();
    updateDisplay();
}

function updateTempBonusDisplay() {
    const btn = document.getElementById("upg_tempbonus");
    if (!btn) return;
    const cost = Math.round(200 * Math.pow(2, game.prestige));
    if (tempBonusActive) {
        btn.disabled = true;
        btn.innerHTML = "KAIOKEN ACTIF<br><span style='color:#ff4400'>Temps restant : " + tempBonusTimeLeft + "s</span>";
        btn.style.borderColor = "#ff2200";
        btn.style.color = "#ff4400";
        btn.style.background = "rgba(80,0,0,0.8)";
    } else {
        btn.disabled = game.ki < cost;
        btn.innerHTML = "Kaioken x" + TEMP_BONUS_MULTIPLIER + "<br><span>(" + cost.toLocaleString() + " Ki / " + TEMP_BONUS_DURATION + "s)</span>";
        btn.style.borderColor = "";
        btn.style.color = "";
        btn.style.background = "";
    }
}

// ================= DRAG GÉNÉRIQUE =================
function makeDraggable(panel, handle) {
    handle = handle || panel;
    let isDragging = false, startX, startY;
    panel.style.position = "fixed";

    function startDrag(cx, cy) {
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        startX = cx - rect.left;
        startY = cy - rect.top;
        panel.style.transform = "none";
        panel.style.left = rect.left + "px";
        panel.style.top  = rect.top  + "px";
    }
    function moveDrag(cx, cy) {
        if (!isDragging) return;
        let nx = Math.max(0, Math.min(cx - startX, window.innerWidth  - panel.offsetWidth));
        let ny = Math.max(0, Math.min(cy - startY, window.innerHeight - panel.offsetHeight));
        panel.style.left = nx + "px";
        panel.style.top  = ny + "px";
    }
    function stopDrag() { isDragging = false; }

    handle.addEventListener("mousedown",  e => { if (e.target.tagName === "BUTTON") return; startDrag(e.clientX, e.clientY); e.preventDefault(); });
    document.addEventListener("mousemove", e => moveDrag(e.clientX, e.clientY));
    document.addEventListener("mouseup",   stopDrag);

    handle.addEventListener("touchstart", e => { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener("touchmove", e => { if (isDragging) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener("touchend",  stopDrag, { passive: true });

    handle.style.cursor = "move";
}

// ================= STATISTIQUES =================
let statsVisible = false;
let statsRefreshInterval = null;

function openStatsPanel() {
    const existing = document.getElementById("statsPanel");
    if (existing) {
        existing.remove();
        statsVisible = false;
        if (statsRefreshInterval) { clearInterval(statsRefreshInterval); statsRefreshInterval = null; }
        return;
    }
    statsVisible = true;
    const rank = getRankData(game.prestige);
    const panel = document.createElement("div");
    panel.id = "statsPanel";
    panel.innerHTML =
        '<div id="statsDragHandle" class="drag-handle" style="border-radius:12px 12px 0 0;">' +
            '<span style="font-size:1rem;font-weight:bold;color:' + rank.couleur + ';text-shadow:0 0 10px ' + rank.couleur + ';letter-spacing:2px;">STATISTIQUES</span>' +
            '<span style="font-size:0.7rem;color:#555;margin-left:6px;">[ deplacer ]</span>' +
            '<button onclick="openStatsPanel()" style="background:none!important;border:none!important;color:#555;font-size:1.1rem;cursor:pointer;padding:2px 6px;width:auto!important;height:auto!important;margin-left:auto;line-height:1;transition:color 0.2s;">x</button>' +
        '</div>' +
        '<div id="statsBody" style="padding:14px 18px 18px;">' +
            '<div class="stat-row"><span class="stat-label">Duree de session</span><span class="stat-value" id="sv0">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Total clics</span><span class="stat-value" id="sv1">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Ki gagne (clics)</span><span class="stat-value" id="sv2">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Ki/sec (auto)</span><span class="stat-value" id="sv3">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Ki auto total</span><span class="stat-value" id="sv4">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Eleves</span><span class="stat-value" id="sv5">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Meditations</span><span class="stat-value" id="sv6">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Technique</span><span class="stat-value" id="sv7">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Rang Prestige</span><span class="stat-value" id="sv8">-</span></div>' +
            '<div class="stat-row"><span class="stat-label">Kaioken</span><span class="stat-value" id="sv9">-</span></div>' +
        '</div>';
    document.body.appendChild(panel);
    makeDraggable(panel, panel.querySelector("#statsDragHandle"));
    refreshStatsValues();
    statsRefreshInterval = setInterval(refreshStatsValues, 1000);
}

function refreshStatsValues() {
    if (!statsVisible || !document.getElementById("statsPanel")) return;
    const sec = Math.floor((Date.now() - game.sessionStart) / 1000);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const dur = h > 0 ? h + "h " + m + "m " + s + "s" : m > 0 ? m + "m " + s + "s" : s + "s";
    const kps = game.autoCount > 0 ? (game.autoCount * (1 + game.prestige) * (1000 / game.autoSpeed)).toFixed(1) : "0";
    const rank = getRankData(game.prestige);

    const sv = (id, val, color) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = val;
        if (color !== undefined) el.style.color = color;
    };
    sv("sv0", dur);
    sv("sv1", game.totalClicks.toLocaleString());
    sv("sv2", Math.floor(game.totalKiEarned).toLocaleString());
    sv("sv3", kps);
    sv("sv4", Math.floor(game.totalAutoKi).toLocaleString());
    sv("sv5", game.autoCount + " / " + MAX_ELEVES);
    sv("sv6", game.meditationCount + " / " + MAX_MEDITATION);
    sv("sv7", game.kiPerClick + " / " + MAX_TECHNIQUE);
    sv("sv8", game.prestige + " - " + rank.titre, rank.couleur);
    sv("sv9", tempBonusActive ? "Actif (" + tempBonusTimeLeft + "s)" : "Inactif", tempBonusActive ? '#ff4400' : '#888');
}

// ================= KONAMI CODE =================
const konamiCode = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a","Enter"];
let currentInput = [];
document.addEventListener('keydown', e => handleKonami(e.key));

function handleKonami(key) {
    currentInput.push(key);
    if (currentInput.length > konamiCode.length) currentInput.shift();
    if (currentInput.join(",") === konamiCode.join(",")) { openAdmin(); currentInput = []; }
}

// ================= ADMIN (DRAGGABLE) =================
function openAdmin() {
    const panel = document.getElementById("adminPanel");
    if (panel) {
        panel.style.display = "block";
        localStorage.setItem("adminOpen", "1");
        showMasterMessage("PANEL ADMIN DEBLOQUE");
        makeDraggable(panel, panel.querySelector("#adminDragHandle"));
    }
}

function closeAdmin() {
    document.getElementById("adminPanel").style.display = "none";
    localStorage.removeItem("adminOpen");
}

function cheatKi() { game.ki += 1e27; updateDisplay(); showMasterMessage("+1 000 000 000 000 000 000 000 000 000 Ki !"); }
function cheatPrestige() { game.prestige++; applyPrestige(); }
function cheatMaxPrestige() { game.prestige = MAX_PRESTIGE; applyPrestige(); showMasterMessage("RANG MAXIMUM ATTEINT !"); }
function cheatMaxTechnique() { game.kiPerClick = MAX_TECHNIQUE; game.costs.click = Math.round(5 * Math.pow(1.5, MAX_TECHNIQUE - 1)); updateDisplay(); saveGame(); showMasterMessage("TECHNIQUES AU MAXIMUM !"); checkUltraMode(); }
function cheatMaxEleves() { const toAdd = MAX_ELEVES - game.autoCount; for (let i = 0; i < toAdd; i++) createVisualCursor(); game.autoCount = MAX_ELEVES; game.costs.auto = Math.round(50 * Math.pow(3, MAX_ELEVES)); updateDisplay(); saveGame(); showMasterMessage("DOJO COMPLET !"); checkUltraMode(); }
function cheatMaxMeditation() { game.meditationCount = MAX_MEDITATION; game.autoSpeed = 1000 - (MAX_MEDITATION * 150); game.costs.speed = Math.round(500 * Math.pow(10, MAX_MEDITATION)); startAutoLoop(); updateDisplay(); saveGame(); showMasterMessage("MEDITATION ULTIME !"); checkUltraMode(); }
function cheatResetStats() { game.totalClicks = 0; game.totalKiEarned = 0; game.totalAutoKi = 0; game.sessionStart = Date.now(); saveGame(); showMasterMessage("Statistiques reinitialisees !"); }
function cheatActivateBonus() { if (!tempBonusActive) { game.ki += 999999; activateTempBonus(); } else { showMasterMessage("Kaioken deja actif !"); } }

// ================= INITIALISATION =================
function init() {
    loadGame();
    applyRankVisuals();
    updateDisplay();
    startAutoLoop();
    animateStars();
    animateCursors();
    setInterval(saveGame, 5000);

    if (localStorage.getItem("adminOpen") === "1") {
        const panel = document.getElementById("adminPanel");
        if (panel) { panel.style.display = "block"; makeDraggable(panel, panel.querySelector("#adminDragHandle")); }
    }

    const savedMusicOn = localStorage.getItem("musicOn");
    if (savedMusicOn === "1") {
        musicOn = true; musicStarted = true;
        const m = document.getElementById("bg_music");
        if (m) { m.volume = getVolume(); m.play().catch(() => {}); }
        updateMusicBtn();
    }

    initControllerUI();
    checkUltraMode();
}

// ================= MANETTE CACHÉE =================
function openController() {
    document.getElementById("controller").classList.add("visible");
    const overlay = document.getElementById("controller-overlay");
    if (overlay) overlay.classList.add("visible");
    const toggle = document.getElementById("controller-toggle");
    if (toggle) { toggle.style.borderColor = "cyan"; toggle.style.boxShadow = "0 0 16px rgba(0,255,255,0.5)"; }
}

function closeController() {
    document.getElementById("controller").classList.remove("visible");
    const overlay = document.getElementById("controller-overlay");
    if (overlay) overlay.classList.remove("visible");
    const toggle = document.getElementById("controller-toggle");
    if (toggle) { toggle.style.borderColor = "#444"; toggle.style.boxShadow = ""; }
}

function toggleController() {
    const ctrl = document.getElementById("controller");
    ctrl.classList.contains("visible") ? closeController() : openController();
}

function initControllerUI() {
    const ctrl = document.getElementById("controller");
    let startY = 0, isDragging = false;
    ctrl.addEventListener("touchstart", e => { startY = e.touches[0].clientY; isDragging = true; }, { passive: true });
    ctrl.addEventListener("touchmove", e => {
        if (!isDragging) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) { ctrl.style.transition = "none"; ctrl.style.transform = "translateY(" + dy + "px)"; }
    }, { passive: true });
    ctrl.addEventListener("touchend", e => {
        isDragging = false;
        const dy = e.changedTouches[0].clientY - startY;
        ctrl.style.transition = "";
        if (dy > 80) { ctrl.style.transform = ""; closeController(); } else { ctrl.style.transform = ""; }
    }, { passive: true });
    const overlay = document.getElementById("controller-overlay");
    if (overlay) overlay.addEventListener("click", closeController);
}

// ================= MUSIQUE =================
function getVolume() { const s = document.getElementById("volumeSlider"); return s ? s.value / 100 : 0.3; }

function setVolume(val) {
    const m = document.getElementById("bg_music");
    if (m) m.volume = val / 100;
    const label = document.getElementById("volumeLabel");
    if (label) label.textContent = val + "%";
}

function updateMusicBtn() {
    const btn = document.getElementById("musicBtn");
    if (btn) {
        btn.textContent      = musicOn ? "Musique ON" : "Musique OFF";
        btn.style.background = musicOn ? "#004400" : "#440000";
        btn.style.borderColor = musicOn ? "#00cc00" : "#cc0000";
        btn.style.color      = musicOn ? "#00ff88" : "#ff4444";
    }
}

function ToggleMusic() {
    musicOn = !musicOn;
    const m = document.getElementById("bg_music");
    if (m) { m.volume = getVolume(); if (musicOn) m.play().catch(() => {}); else m.pause(); }
    musicStarted = true;
    localStorage.setItem("musicOn", musicOn ? "1" : "0");
    updateMusicBtn();
}

// ================= ACTIONS PRINCIPALES =================
function Click(e) {
    if (!musicStarted) {
        musicStarted = true; musicOn = true;
        const m = document.getElementById("bg_music");
        if (m) { m.volume = getVolume(); m.play().catch(() => {}); }
        localStorage.setItem("musicOn", "1");
        updateMusicBtn();
    }
    const multiplier = tempBonusActive ? TEMP_BONUS_MULTIPLIER : 1;
    let gain = game.kiPerClick * (1 + game.prestige) * multiplier;
    game.ki += gain;
    game.totalClicks++;
    game.totalKiEarned += gain;
    createParticle(e.pageX, e.pageY, "+" + Math.floor(gain));
    updateDisplay();
}

function UpgPowderPerClick() {
    if (game.kiPerClick > MAX_TECHNIQUE) { showMasterMessage("Techniques au maximum !"); return; }
    if (game.ki >= game.costs.click) {
        game.ki = 0; game.kiPerClick++;
        game.costs.click = Math.round(game.costs.click * 1.5);
        showMasterMessage(game.kiPerClick > MAX_TECHNIQUE ? "Technique ultime maitrisee !" : "Technique Apprise !");
        updateDisplay(); saveGame(); checkUltraMode();
    }
}

const MAX_ELEVES = 20;
const MAX_TECHNIQUE = 100;

function BuyAuto() {
    if (game.autoCount >= MAX_ELEVES) { showMasterMessage("Dojo complet ! 20 eleves max."); return; }
    if (game.ki >= game.costs.auto) {
        game.ki = 0; game.autoCount++;
        game.costs.auto = Math.round(game.costs.auto * 3);
        createVisualCursor();
        showMasterMessage(game.autoCount >= MAX_ELEVES ? "Dernier eleve recrute !" : "Un nouvel eleve rejoint le Dojo !");
        updateDisplay(); saveGame(); checkUltraMode();
    }
}

const MAX_MEDITATION = 5;

function BuySpeed() {
    if (game.meditationCount >= MAX_MEDITATION) { showMasterMessage("Esprit au maximum !"); return; }
    if (game.ki >= game.costs.speed && game.autoSpeed > 100) {
        game.ki = 0; game.autoSpeed -= 150; game.meditationCount++;
        game.costs.speed = Math.round(game.costs.speed * 10);
        startAutoLoop();
        showMasterMessage(game.meditationCount >= MAX_MEDITATION ? "Meditation ultime atteinte !" : "Meditation reussie : Esprit eclairci !");
        updateDisplay(); saveGame(); checkUltraMode();
    }
}

// ================= PRESTIGE DATA =================
function getPrestigeCost() { return Math.round(1000 * Math.pow(3, game.prestige)); }

const PRESTIGE_RANKS = [
    { titre: "Goku Enfant",                          couleur: "#ff8800", bonus: null,                         img: "Goku-enfant.jpg",       bg: "bg.png",  desc: "Le debut du voyage..." },
    { titre: "Oozaru",                               couleur: "#448800", bonus: "Eleves x1.5",               img: "oozaru.jpg",            bg: "bg.png",  desc: "La bete interieure s'eveille." },
    { titre: "Goku Adulte",                          couleur: "#88ccff", bonus: "Ki/clic x2",                img: "gokuadult.png",         bg: "bg.png",  desc: "L'entrainement forge le corps." },
    { titre: "Kaioken",                              couleur: "#ff2200", bonus: "Ki auto x2",                img: "gokuk.jpg",             bg: "bg.png",  desc: "L'aura rouge embrase le corps." },
    { titre: "Super Saiyan",                         couleur: "#ffee00", bonus: "Clic x3 + Eleves x2",      img: "gokussj.jpg",           bg: "bg.png",  desc: "La legende prend vie." },
    { titre: "Super Saiyan 2",                       couleur: "#b4b400", bonus: "Ki auto x3",                img: "gokussj2.jpg",          bg: "bg.png",  desc: "L'electricite crepite autour de toi." },
    { titre: "Super Saiyan 3",                       couleur: "#6d6d00", bonus: "Vitesse x2 + Clic x4",     img: "gokussj3.jpg",          bg: "bg.png",  desc: "Les cheveux atteignent l'infini." },
    { titre: "Oozaru Golden",                        couleur: "#6f8800", bonus: "Eleves x3",                 img: "oozarugolden.png",      bg: "bg.png",  desc: "La bete doree s'eveille." },
    { titre: "Super Saiyan 4",                       couleur: "#be003f", bonus: "Tout x5",                   img: "gokussj4.jpg",          bg: "bg.png",  desc: "L'union du Saiyan et de la Bete." },
    { titre: "Goku Drip",                            couleur: "#00aaff", bonus: "Ki/clic x5",                img: "goku-drip.jpg",         bg: "bg.png",  desc: "Le style avant tout." },
    { titre: "Super Saiyan God",                     couleur: "#ff4488", bonus: "Tout x8",                   img: "gokussjgod.jpg",        bg: "bg.png",  desc: "Le Ki divin coule en toi." },
    { titre: "Super Saiyan Blue",                    couleur: "#0099ff", bonus: "Ki/clic x10",               img: "gokussjblue.jpg",       bg: "bg.png",  desc: "Ki Divin + Saiyan = perfection." },
    { titre: "Oozaru Blue",                          couleur: "#000e88", bonus: "Eleves x10",                img: "oozarublue.jpg",        bg: "bg.png",  desc: "La bete bleue s'eveille." },
    { titre: "Ultra Instinct Signe",                 couleur: "#aaaaff", bonus: "Auto x10",                  img: "gokusign.jpg",          bg: "bg.png",  desc: "Le corps agit de lui-meme." },
    { titre: "Goku Drip Sign",                       couleur: "#aa44ff", bonus: "Eleves x10 + Vitesse x10", img: "goku-drip-sign.jpg",    bg: "bg.png",  desc: "Le signe du style." },
    { titre: "Ultra Instinct Maitrise",              couleur: "#ccccff", bonus: "Tout x10",                  img: "gokuui.jpg",            bg: "bg.png",  desc: "L'eveil ultime de l'esprit." },
    { titre: "Oozaru Ultra Instinct Maitrise",       couleur: "#515174", bonus: "Eleves x15",                img: "uioozaru.png",          bg: "bg.png",  desc: "La bete ultime s'eveille." },
    { titre: "SSJ Infinity",                         couleur: "#fdff8e", bonus: "Tout x15",                  img: "SSJ_Infinity_2.0.png",  bg: "bg.png",  desc: "L'infini tout simplement." },
    { titre: "Goku Drip Infinity",                   couleur: "#ff00ff", bonus: "Tout x20",                  img: "goku-drip-infinty.jpg", bg: "bg.png",  desc: "L'infini stylise." },
    { titre: "SSJ Infinity Ultra Instinct Maitrise", couleur: "#ffffff", bonus: "PUISSANCE ABSOLUE x infini",img: "gokuinfi.jpg",          bg: "bg.png",  desc: "Au-dela de toute limite connue." },
];

const MAX_PRESTIGE = PRESTIGE_RANKS.length - 1;
function getRankData(rang) { return PRESTIGE_RANKS[Math.min(rang, MAX_PRESTIGE)]; }

// ================= VISUELS DU RANG =================
function applyRankVisuals() {
    const rank = getRankData(game.prestige);
    const btnImg = document.getElementById("aff_click_button");
    if (btnImg) {
        if (rank.img) { btnImg.src = rank.img; btnImg.style.filter = ""; }
        else { btnImg.src = "wallpaperflare.com_wallpaper2.jpg"; btnImg.style.filter = "hue-rotate(" + (game.prestige * 25) + "deg) brightness(1.1)"; }
        btnImg.style.boxShadow = "0 0 60px " + rank.couleur + ", 0 0 120px " + rank.couleur + "44";
    }
    document.documentElement.style.setProperty('--glow-color', rank.couleur);
    if (rank.bg) { document.body.style.backgroundImage = "url('" + rank.bg + "')"; document.body.style.backgroundSize = "cover"; document.body.style.backgroundPosition = "center"; document.body.style.backgroundAttachment = "fixed"; }
    else { document.body.style.backgroundImage = "none"; document.body.style.backgroundColor = "#000"; }
    const kiCounter = document.getElementById("dis_powder");
    if (kiCounter) { kiCounter.style.textShadow = "0 0 20px " + rank.couleur + ", 0 0 40px " + rank.couleur + "88"; kiCounter.style.color = rank.couleur; }
    document.title = "Ki Clicker - " + rank.titre;
}

// ================= PRESTIGE (SANS RELOAD) =================
function applyPrestige() {
    game.ki = 0; game.kiPerClick = 1; game.autoCount = 0; game.autoSpeed = 1000;
    game.meditationCount = 0; game.costs = { click: 5, auto: 50, speed: 500 };
    autoCursors.forEach(c => c.remove()); autoCursors = [];
    saveGame(); applyRankVisuals(); updateDisplay(); startAutoLoop();
    const panel = document.getElementById("prestigePanel"); if (panel) panel.remove();
    const flash = document.createElement("div"); flash.className = "reset-flash";
    document.body.appendChild(flash); setTimeout(() => flash.remove(), 1000);
    showMasterMessage(getRankData(game.prestige).titre + " !");
    checkUltraMode();
}

function Prestige() {
    if (game.prestige >= MAX_PRESTIGE) { showMasterMessage("Rang maximum deja atteint !"); return; }
    const cost = getPrestigeCost();
    if (game.ki >= cost) { game.prestige++; applyPrestige(); }
    else { showMasterMessage("Ki insuffisant ! Besoin : " + getPrestigeCost().toLocaleString()); }
}

// ================= PANEL PRESTIGE (DRAGGABLE) =================
function openPrestigePanel() {
    const existing = document.getElementById("prestigePanel");
    if (existing) { existing.remove(); return; }

    const rank     = getRankData(game.prestige);
    const nextRank = getRankData(game.prestige + 1);
    const cost     = getPrestigeCost();
    const canPrest = game.ki >= cost && game.prestige < MAX_PRESTIGE;

    let rankHistory = "";
    for (let i = 0; i <= game.prestige; i++) {
        const r = getRankData(i);
        const isCurrent = i === game.prestige;
        const imgTag = r.img
            ? '<img src="' + r.img + '" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid ' + r.couleur + ';margin-right:6px;vertical-align:middle">'
            : '<span style="width:30px;height:30px;border-radius:50%;background:#222;border:1px dashed #555;display:inline-flex;align-items:center;justify-content:center;margin-right:6px;font-size:0.6rem;color:#555">?</span>';
        rankHistory +=
            '<div class="prestige-rank-row ' + (isCurrent ? "current-rank" : "past-rank") + '">' +
                '<span style="color:' + r.couleur + ';text-shadow:0 0 6px ' + r.couleur + ';display:flex;align-items:center;">' +
                    imgTag + (isCurrent ? "* " : "OK ") + "Rang " + i + " - " + r.titre +
                '</span>' +
                (r.bonus ? '<span class="rank-bonus">+' + r.bonus + '</span>' : '') +
            '</div>';
    }

    const nextImgHtml = game.prestige >= MAX_PRESTIGE
        ? '<div style="color:#ffcc00;font-size:1.2rem;margin:10px 0;">RANG MAXIMUM</div>'
        : nextRank.img
            ? '<img src="' + nextRank.img + '" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid ' + nextRank.couleur + ';box-shadow:0 0 15px ' + nextRank.couleur + ';margin-bottom:8px;">'
            : '<div style="width:60px;height:60px;border-radius:50%;background:#111;border:2px dashed #444;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-size:0.65rem;color:#555;">IMG A VENIR</div>';

    const curImgHtml = rank.img
        ? '<img src="' + rank.img + '" style="width:45px;height:45px;border-radius:50%;object-fit:cover;border:2px solid ' + rank.couleur + ';box-shadow:0 0 10px ' + rank.couleur + ';margin-right:10px;">'
        : "";

    const nextBlock = game.prestige >= MAX_PRESTIGE
        ? '<div class="prestige-next" style="text-align:center;"><div style="color:#ffcc00;font-size:1.3rem;margin-bottom:6px;">RANG MAXIMUM ATTEINT</div><div style="color:#aaa;font-size:0.85rem;">SSJ Infinity Ultra Instinct Maitrise</div></div>'
        : '<div class="prestige-next">' +
              '<div style="color:#aaa;font-size:0.8rem;margin-bottom:8px;">PROCHAIN EVEIL</div>' +
              nextImgHtml +
              '<div style="color:' + nextRank.couleur + ';font-weight:bold;font-size:1.05rem;text-shadow:0 0 10px ' + nextRank.couleur + '">Rang ' + (game.prestige+1) + ' - ' + nextRank.titre + '</div>' +
              '<div style="color:#888;font-size:0.8rem;font-style:italic;margin-top:4px">"' + nextRank.desc + '"</div>' +
              (nextRank.bonus ? '<div style="color:#00ffcc;margin-top:6px;font-size:0.82rem">Bonus : ' + nextRank.bonus + '</div>' : '') +
              '<div style="margin-top:10px;font-size:0.9rem;color:' + (canPrest ? '#00ff88' : '#ff4444') + '">Cout : ' + cost.toLocaleString() + ' Ki ' + (canPrest ? 'OK' : 'X') + '</div>' +
          '</div>';

    const panel = document.createElement("div");
    panel.id = "prestigePanel";
    panel.innerHTML =
        '<div id="prestigeDragHandle" class="drag-handle" style="border-radius:14px 14px 0 0;">' +
            '<span style="color:' + rank.couleur + ';text-shadow:0 0 15px ' + rank.couleur + ';font-weight:bold;letter-spacing:2px;">DOJO DU PRESTIGE</span>' +
            '<span style="font-size:0.7rem;color:#555;margin-left:6px;">[ deplacer ]</span>' +
            '<button onclick="document.getElementById(\'prestigePanel\').remove()" style="background:none!important;border:none!important;color:#555;font-size:1.1rem;cursor:pointer;padding:2px 6px;width:auto!important;height:auto!important;margin-left:auto;line-height:1;">x</button>' +
        '</div>' +
        '<div style="padding:18px 20px 20px;">' +
            '<div class="pp-rang-actuel" style="border-color:' + rank.couleur + '">' +
                '<div style="display:flex;align-items:center;justify-content:center;">' +
                    curImgHtml +
                    '<div><div style="font-size:0.75rem;color:#aaa">RANG ACTUEL</div>' +
                    '<div style="color:' + rank.couleur + ';font-size:1.3rem;font-weight:bold;text-shadow:0 0 12px ' + rank.couleur + '">' + rank.titre + '</div>' +
                    '<div style="color:#888;font-size:0.78rem;font-style:italic">"' + rank.desc + '"</div></div>' +
                '</div>' +
                '<div style="color:#aaa;font-size:0.82rem;margin-top:8px">Multiplicateur : <strong style="color:#00ffcc">x' + (1+game.prestige) + '</strong></div>' +
            '</div>' +
            '<div class="pp-history"><div style="color:#aaa;font-size:0.75rem;margin-bottom:6px;">HISTORIQUE DES EVEILS</div>' + rankHistory + '</div>' +
            nextBlock +
            '<button onclick="Prestige()" style="width:100%;margin-top:14px;padding:12px;background:' + (canPrest ? 'linear-gradient(135deg,#4b0082,#000)' : '#1a1a1a') + ';color:' + (canPrest ? rank.couleur : '#555') + ';border:2px solid ' + (canPrest ? rank.couleur : '#333') + ';font-size:1rem;font-weight:bold;cursor:' + (canPrest ? 'pointer' : 'not-allowed') + ';border-radius:10px;" ' + (canPrest ? '' : 'disabled') + '>' +
                (game.prestige >= MAX_PRESTIGE ? "RANG MAXIMUM" : canPrest ? "ACCOMPLIR L'EVEIL SPIRITUEL" : 'Ki insuffisant') +
            '</button>' +
        '</div>';
    document.body.appendChild(panel);
    makeDraggable(panel, panel.querySelector("#prestigeDragHandle"));
}

// ================= PUISSANCE ABSOLUE =================
let ultraModeActive = false;
let ultraInterval = null;
const ULTRA_BONUS = 999999999999;

function checkUltraMode() {
    if (game.prestige >= MAX_PRESTIGE && game.kiPerClick >= MAX_TECHNIQUE && game.autoCount >= MAX_ELEVES && game.meditationCount >= MAX_MEDITATION && !ultraModeActive) {
        activateUltraMode();
    }
}

function activateUltraMode() {
    ultraModeActive = true;
    const flash = document.createElement("div"); flash.className = "reset-flash"; flash.style.background = "white";
    document.body.appendChild(flash); setTimeout(() => flash.remove(), 1200);
    if (ultraInterval) clearInterval(ultraInterval);
    ultraInterval = setInterval(() => { game.ki += ULTRA_BONUS; updateDisplay(); }, 50);
    const btn = document.getElementById("aff_click_button");
    if (btn) { btn.style.animation = "ultraPulse 0.5s infinite ease-in-out"; btn.style.boxShadow = "0 0 80px #fff, 0 0 160px #fff, 0 0 300px #ffffff88"; }
    const kiEl = document.getElementById("dis_powder");
    if (kiEl) { kiEl.style.color = "#ffffff"; kiEl.style.textShadow = "0 0 30px #fff, 0 0 60px #fff"; }
    if (!document.getElementById("ultra-banner")) {
        const banner = document.createElement("div"); banner.id = "ultra-banner";
        banner.textContent = "PUISSANCE ABSOLUE";
        banner.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);font-size:1.2rem;font-weight:bold;letter-spacing:3px;z-index:500;white-space:nowrap;color:#fff;text-shadow:0 0 20px #fff,0 0 40px #fff;animation:ultraBannerAnim 1.5s infinite ease-in-out;";
        document.body.appendChild(banner);
    }
    game.kiPerClick = ULTRA_BONUS;
    showMasterMessage("PUISSANCE ABSOLUE DEBLOQUEE !");
    updateDisplay();
}

function ResetGame() {
    if (!confirm("Voulez-vous vraiment effacer TOUTE votre progression ?")) return;
    localStorage.clear(); sessionStorage.clear(); window.location.reload();
}

// ================= AUTO LOOP =================
function startAutoLoop() {
    if (autoInterval) clearInterval(autoInterval);
    autoInterval = setInterval(() => {
        if (game.autoCount > 0) {
            const autoGain = game.autoCount * (1 + game.prestige);
            game.ki += autoGain; game.totalAutoKi += autoGain;
            updateDisplay();
        }
    }, game.autoSpeed);
}

// ================= SAVE / LOAD =================
function saveGame() { localStorage.setItem("KiMasterSave", JSON.stringify(game)); }

function loadGame() {
    try {
        let s = localStorage.getItem("KiMasterSave");
        if (s) {
            let d = JSON.parse(s); game = { ...game, ...d };
            game.sessionStart = Date.now();
            for (let i = 0; i < game.autoCount; i++) createVisualCursor();
        }
    } catch(e) { console.error("Erreur de chargement."); localStorage.clear(); }
}

// ================= VISUELS CURSEURS GIF =================
const CURSOR_GIFS = [
    "https://media.giphy.com/media/Tki7sWHDoepb2/giphy.gif",
    "https://media.giphy.com/media/wEeUz0u91oLKO6LRfu/giphy.gif",
    "https://media.giphy.com/media/ohorRePDbDefh0z8bX/giphy.gif",
    "https://media.giphy.com/media/8WqB2tmGf6Pny/giphy.gif",
    "https://media.giphy.com/media/B0yg6yWnfVpEA/giphy.gif",
    "https://media.giphy.com/media/8h3oYPjGATcOKGATMy/giphy.gif",
    "https://media.giphy.com/media/WLq5xLSELqBhK/giphy.gif",
    "https://media.giphy.com/media/lH0au8hGm4iHEfAdZP/giphy.gif",
    "https://media.giphy.com/media/PnDvC2sOfqK0jqp2Hs/giphy.gif",
    "https://media.giphy.com/media/Z1UPEUtu4y4Rt9TvDG/giphy.gif",
    "https://media.giphy.com/media/3oKGzjW7CIpfkZITsI/giphy.gif",
    "https://media.giphy.com/media/1xV69JQQ7Ibl3Pzg5C/giphy.gif",
    "https://media.giphy.com/media/xTiTnm91V79U92CeuQ/giphy.gif",
    "https://media.giphy.com/media/fQKxhY0MYcU2WTTkac/giphy.gif",
    "https://media.giphy.com/media/PeLjyjkmRpowbuqHJj/giphy.gif",
    "https://media.giphy.com/media/IcQJikabvsCtUuATQ6/giphy.gif",
    "https://media.giphy.com/media/1lrNuuRHrgKa62JsTW/giphy.gif",
    "https://media.giphy.com/media/5XgvRXYm3UJEN51rqV/giphy.gif",
    "https://media.giphy.com/media/GRkzpzhh4vpKBHHQtZ/giphy.gif",
    "https://media.giphy.com/media/t6XGC1rtyZLEfuwSLE/giphy.gif",
];

function createVisualCursor() {
    let img = document.createElement("img");
    img.src = CURSOR_GIFS[autoCursors.length % CURSOR_GIFS.length];
    img.className = "auto_cursor";
    document.body.appendChild(img);
    autoCursors.push(img);
}

function animateCursors() {
    let angle = 0;
    function loop() {
        angle += 0.02;
        const button = document.getElementById("aff_click_button");
        if (button) {
            const rect = button.getBoundingClientRect();
            const cx = rect.left + rect.width / 2 + window.scrollX;
            const cy = rect.top + rect.height / 2 + window.scrollY;
            const isMobile = window.innerWidth <= 768;
            const rx = isMobile ? 130 : 230, ry = isMobile ? 80 : 140;
            autoCursors.forEach((c, i) => {
                const a = angle + (i / autoCursors.length) * Math.PI * 2;
                const ox = Math.cos(a) * rx, oy = Math.sin(a) * ry;
                c.style.left = (cx + ox - 18) + "px";
                c.style.top  = (cy + oy - 18) + "px";
                const scale = 0.85 + 0.3 * ((Math.sin(a) + 1) / 2);
                c.style.transform = (ox > 0 ? "scaleX(-1)" : "scaleX(1)") + " scale(" + scale.toFixed(2) + ")";
                c.style.opacity = (0.6 + 0.4 * ((Math.sin(a) + 1) / 2)).toFixed(2);
            });
        }
        requestAnimationFrame(loop);
    }
    loop();
}

function animateStars() {
    const canvas = document.getElementById("stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    let s = Array(150).fill().map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.5, v: Math.random() * 0.5 + 0.2 }));
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        s.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); p.y += p.v; if (p.y > canvas.height) p.y = 0; });
        requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener("resize", () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
}

function updateDisplay() {
    const dKi    = document.getElementById("dis_powder");
    const dForce = document.getElementById("dis_powder_per_click");
    const dAuto  = document.getElementById("dis_auto");
    const bClick = document.getElementById("upg_powder_per_click");
    const bAuto  = document.getElementById("upg_autoclick");
    const bSpeed = document.getElementById("upg_autospeed");
    const pBtn   = document.getElementById("prestigeBtn");

    if (dKi)    dKi.textContent    = Math.floor(game.ki).toLocaleString() + " Ki";
    if (dForce) dForce.textContent = "Force : +" + game.kiPerClick + "/coup" + (tempBonusActive ? " x" + TEMP_BONUS_MULTIPLIER : "");
    if (dAuto)  dAuto.textContent  = "Eleves : " + game.autoCount + " | Rang : " + game.prestige;

    if (bClick) {
        if (game.kiPerClick > MAX_TECHNIQUE) { bClick.disabled = true; bClick.innerHTML = "Technique max<br><span>(100/100)</span>"; }
        else { bClick.disabled = game.ki < game.costs.click; bClick.innerHTML = "Technique<br><span>(" + game.costs.click.toLocaleString() + " Ki) " + game.kiPerClick + "/" + MAX_TECHNIQUE + "</span>"; }
    }
    if (bAuto) {
        if (game.autoCount >= MAX_ELEVES) { bAuto.disabled = true; bAuto.innerHTML = "Dojo complet<br><span>(20/20 eleves)</span>"; }
        else { bAuto.disabled = game.ki < game.costs.auto; bAuto.innerHTML = "Recruter Eleve<br><span>(" + game.costs.auto.toLocaleString() + " Ki) " + game.autoCount + "/" + MAX_ELEVES + "</span>"; }
    }
    if (bSpeed) {
        if (game.meditationCount >= MAX_MEDITATION) { bSpeed.disabled = true; bSpeed.innerHTML = "Esprit au max<br><span>(5/5 meditations)</span>"; }
        else { bSpeed.disabled = game.ki < game.costs.speed; bSpeed.innerHTML = "Meditation<br><span>(" + game.costs.speed.toLocaleString() + " Ki) " + game.meditationCount + "/" + MAX_MEDITATION + "</span>"; }
    }
    if (pBtn) {
        if (game.prestige >= MAX_PRESTIGE) {
            pBtn.style.display = "inline-block"; pBtn.style.borderColor = "#ffcc00"; pBtn.style.color = "#ffcc00";
            pBtn.style.background = "linear-gradient(to bottom, #1a0a00, #000)"; pBtn.style.opacity = "1";
            pBtn.style.cursor = "not-allowed"; pBtn.disabled = true;
            pBtn.innerHTML = "RANG MAXIMUM ATTEINT<br><span style='font-size:0.75rem;color:#aaa'>SSJ Infinity Ultra Instinct Maitrise</span>";
        } else {
            const cost = getPrestigeCost(), rank = getRankData(game.prestige), canPrest = game.ki >= cost;
            pBtn.disabled = false; pBtn.style.display = "inline-block";
            pBtn.style.borderColor = rank.couleur; pBtn.style.color = canPrest ? rank.couleur : "#555";
            pBtn.style.background = canPrest ? "linear-gradient(to bottom,#4b0082,#000)" : "#111";
            pBtn.style.opacity = canPrest ? "1" : "0.6"; pBtn.style.cursor = "pointer";
            pBtn.innerHTML = "EVEIL SPIRITUEL<br><span style='font-size:0.75rem;color:#aaa'>" + Math.floor(game.ki).toLocaleString() + " / " + cost.toLocaleString() + " Ki</span>";
        }
    }
    updateTempBonusDisplay();
}

function showMasterMessage(text) {
    const msg = document.createElement("div"); msg.className = "master-message"; msg.textContent = text;
    document.body.appendChild(msg); setTimeout(() => { if (msg && msg.parentNode) msg.remove(); }, 2000);
}

function createParticle(x, y, txt) {
    const p = document.createElement("div"); p.className = "particle"; p.textContent = txt;
    p.style.left = x + "px"; p.style.top = y + "px";
    document.body.appendChild(p); setTimeout(() => p.remove(), 800);
}

window.onload = init;
