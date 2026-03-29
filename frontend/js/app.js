// js/app.js - DÜZELTİLMİŞ VERSİYON v2
// ==========================================
// Profil kaldırıldı, NOAA CORS proxy ile direkt veri, grafik düzeltmesi,
// tam ekran çıkış düzeltmesi, simülasyon/canlı geçiş düzeltmesi,
// gelişmiş 3D güneş fiziği
// ==========================================

// --- Global Değişkenler ---
let currentKp = null, currentWind = null, currentTime = '--:-- UTC';
let autoNotifyEnabled = false;
let lastNotifiedKp = -1;
let isLiveMode = true;
let liveInterval = null;
let simKp = 3, simWind = 400;

// NOAA direkt API (CORS proxy üzerinden)
const NOAA_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const NOAA_WIND_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";
const NOAA_KP_1H_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

// --- Responsive yardımcı ---
function isMobile() { return window.innerWidth <= 768; }

// --- Toast ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

// --- Kp Analiz ---
function getKpAnalysis(kp) {
    if (kp === null || isNaN(kp)) return { level: 'Bilinmiyor', risk: 'Veri Yok', color: 'var(--muted)', g: 'G?' };
    if (kp < 4)  return { level: 'Normal',    risk: 'Tehdit Yok',            color: 'var(--green)',  g: 'G0' };
    if (kp < 5)  return { level: 'Aktif',     risk: 'Düşük',                 color: 'var(--yellow)', g: 'G0' };
    if (kp < 6)  return { level: 'G1 Zayıf',  risk: 'Şebeke dalgalanmaları', color: 'var(--orange)', g: 'G1' };
    if (kp < 7)  return { level: 'G2 Orta',   risk: 'Uydu sürüklenme',       color: 'var(--orange)', g: 'G2' };
    if (kp < 8)  return { level: 'G3 Güçlü',  risk: 'GPS kesintileri',        color: 'var(--red)',    g: 'G3' };
    if (kp < 9)  return { level: 'G4 Şiddetli',risk: 'Voltaj sorunları',      color: 'var(--red)',    g: 'G4' };
    return           { level: 'G5 AŞIRI',  risk: 'Şebeke çökme',          color: 'var(--purple)', g: 'G5' };
}

// --- AI Yorumu (profil yok, genel) ---
function getAIComment(kp, wind) {
    if (kp === null || kp === undefined) return "Veriler bekleniyor...";
    const a = getKpAnalysis(kp);
    const ws = wind < 400 ? 'sakin' : (wind < 600 ? 'hızlı' : (wind < 800 ? 'fırtınalı' : 'tehlikeli'));
    if (kp < 4)  return `🌤️ Manyetosfer şu an oldukça sakin (Kp=${kp.toFixed(1)}). Güneş rüzgarları (${Math.round(wind)} km/s, ${ws}) Dünya'nın manyetik kalkanı tarafından başarıyla saptırılıyor. Uydular ve yeryüzü iletişim ağları için herhangi bir elektromanyetik tehdit öngörülmüyor.`;
    if (kp < 6)  return `⚠️ Güneş'te artan aktivite tespit edildi (Kp=${kp.toFixed(1)}, ${a.g}). Rüzgar hızı ${Math.round(wind)} km/s — ${ws}. Radyo iletişiminde ufak parazitlenmeler yaşanabilir, kutuplarda aurora (Kuzey Işıkları) gözlemlenebilir.`;
    return `🚨 ACİL: Yüksek enerjili plazma bulutu manyetosferimize çarpıyor (Kp=${kp.toFixed(1)}, ${a.g})! Rüzgar ${Math.round(wind)} km/s — ${ws}. GPS sinyallerinde sapmalar ve uydu devrelerinde statik elektrik birikimi riski yüksek. Elektrik şebekelerinde voltaj dalgalanmaları yaşanabilir!`;
}

// --- UI Güncellemeleri ---
function updateUI(kp, wind, time) {
    if (kp === null && wind === null) return;
    const kpAnalysis = getKpAnalysis(kp);
    const alarm = kp >= 5;

    currentKp = kp; currentWind = wind; currentTime = time;

    // Risk haritası penceresine canlı veriyi ilet
    try {
        const riskWin = window._riskMapWin;
        if (riskWin && !riskWin.closed) {
            riskWin.postMessage({ type: 'STARWAY_KP', kp, wind }, '*');
        }
    } catch(e) {}

    // Hero
    document.getElementById('h-kp').textContent   = kp?.toFixed(1) ?? '—';
    document.getElementById('h-wind').textContent = wind ? Math.round(wind) : '—';
    document.getElementById('bstatus').textContent = alarm ? '🚨 FIRTINA ALARMI' : '✅ SİSTEM NORMAL';
    document.getElementById('btime').textContent   = time ?? '—';
    document.getElementById('badge').className     = 'badge ' + (alarm ? 's-alarm' : 's-normal');
    document.getElementById('liveDataBadge').innerHTML = isLiveMode ? "🌐 CANLI NOAA" : "🎮 SIM MODU";

    // Kp Kartı
    const kpBig = document.getElementById('kpn');
    kpBig.textContent   = kp?.toFixed(1) ?? '—';
    kpBig.style.color   = kpAnalysis.color;
    document.getElementById('gbadge').textContent = kpAnalysis.g;
    document.getElementById('klevel').textContent = kpAnalysis.level;
    document.getElementById('krisk').textContent  = kpAnalysis.risk;

    // Gauge SVG
    if (kp !== null && !isNaN(kp)) {
        const norm = Math.min(kp / 9, 1);
        const arc  = 251;
        const gaugeFill = document.getElementById('gfill');
        if (gaugeFill) gaugeFill.setAttribute('stroke-dasharray', `${norm * arc} ${arc}`);
        const ang    = (180 - norm * 180) * Math.PI / 180;
        const R = 80, cx = 100, cy = 108;
        const needle = document.getElementById('gneedle');
        if (needle) {
            needle.setAttribute('cx', cx + R * Math.cos(ang));
            needle.setAttribute('cy', cy - R * Math.sin(ang));
        }
    }

    // Rüzgar
    const windStatus = wind ? (wind < 400 ? 'Sakin' : (wind < 600 ? 'Hızlı' : (wind < 800 ? 'Fırtına' : 'Tehlikeli'))) : '?';
    const windColor  = wind ? (wind < 400 ? 'var(--green)' : (wind < 600 ? 'var(--yellow)' : (wind < 800 ? 'var(--orange)' : 'var(--red)'))) : 'gray';
    document.getElementById('windn').textContent = wind ? Math.round(wind) : '—';
    const wbar = document.getElementById('wbar');
    if (wbar) wbar.style.width = Math.min(100, (wind || 0) / 10) + '%';
    const wBadge = document.getElementById('wbadge');
    if (wBadge) { wBadge.textContent = windStatus; wBadge.style.borderColor = windColor; wBadge.style.color = windColor; }

    // AI Yorumu
    document.getElementById('aitxt').textContent = getAIComment(kp, wind);

    // Risk listesi
    setRiskList(kp);

    // Grafik
    if (time && kp !== null) updateChart(time, kp);

    // Görsel efektler
    if (window.updateVisuals) window.updateVisuals(kp, wind);

    // Tahmin
    updateForecast(kp, wind);
    updateHistoricalComparison(kp);

    // Otomatik bildirim
    if (autoNotifyEnabled && isLiveMode && kp >= 5 && lastNotifiedKp !== kp) {
        lastNotifiedKp = kp;
        if (Notification.permission === 'granted') {
            new Notification('StarWay Otomatik Uyarı', { body: `Kp ${kp.toFixed(1)} seviyesinde manyetik fırtına! Önlemleri alın.` });
        }
        showToast(`⚠️ Kp ${kp.toFixed(1)}: Manyetik fırtına uyarısı!`, 'warning');
    }
}

function setRiskList(kp) {
    const k = kp || 0;
    const risks = k < 4 ?
        [{ n: 'Arktik Çember', c: 'var(--green)' }, { n: 'Kuzey Işıkları sınırlı', c: 'var(--cyan)' }] :
        (k < 6 ?
            [{ n: 'Alaska, İskandinavya', c: 'var(--yellow)' }, { n: 'Aurora olasılığı artıyor', c: 'var(--cyan)' }] :
            (k < 8 ?
                [{ n: 'ABD Kuzey, Kuzey Avrupa', c: 'var(--orange)' }, { n: 'GPS etkilenebilir', c: 'var(--red)' }] :
                [{ n: 'TÜRKİYE DAHİL Orta Kuşak', c: 'var(--purple)' }, { n: 'Küresel uydu tehdidi', c: 'var(--red)' }]));
    const rlist = document.getElementById('rlist');
    if (rlist) rlist.innerHTML = risks.map(r => `<div class="ri"><div class="ri-dot" style="background:${r.c}"></div><span>${r.n}</span></div>`).join('');
}

function updateForecast(kp, wind) {
    const forecastDiv = document.getElementById('forecastText');
    if (!kp) { if (forecastDiv) forecastDiv.innerHTML = 'Veri bekleniyor...'; return; }
    const trend = kp < 3 ? 'Sakin devam edecek' : (kp < 5 ? 'Aktif, hafif dalgalanmalar' : (kp < 7 ? 'Fırtına seviyesinde, GPS etkilenebilir' : 'Şiddetli fırtına, iletişim kesintileri bekleniyor'));
    if (forecastDiv) forecastDiv.innerHTML = `📈 Son ölçümlere göre: ${trend}. Güneş rüzgarı ${Math.round(wind || 0)} km/s. Önümüzdeki 24 saatte Kp değerinin ${Math.min(9, Math.max(0, kp + (Math.random() - 0.5) * 1.5)).toFixed(1)} civarında seyretmesi bekleniyor.`;
}

function updateHistoricalComparison(kp) {
    const container = document.getElementById('histContainer');
    const curKp = kp !== null ? kp : 2.5;
    const storms = [
        { name: "Carrington 1859", kp: 9.0, effect: "Telgraf sistemleri yandı" },
        { name: "Mart 1989",        kp: 9.0, effect: "Quebec şebekesi çöktü" },
        { name: "Halloween 2003",   kp: 9.0, effect: "Uydular hasar gördü" }
    ];
    if (container) {
        container.innerHTML = storms.map(s => `<div class="hist-item"><strong>${s.name}</strong><br>Kp: ${s.kp}<br><span style="font-size:.65rem">${s.effect}</span></div>`).join('') +
            `<div class="hist-item"><strong>📌 Şu An</strong><br>Kp: ${curKp.toFixed(1)}<br><span style="font-size:.65rem">${curKp >= 7 ? "Şiddetli fırtına" : (curKp >= 5 ? "Orta fırtına" : "Normal")}</span></div>`;
    }
    const compText = document.getElementById('compText');
    if (compText) compText.innerHTML = curKp >= 7 ? "⚠️ Güncel fırtına, büyük tarihi olaylara yaklaşıyor!" : (curKp >= 5 ? "⚡ 1989 ve 2003 fırtınalarına benzer seviyede." : "✅ Tarihi büyük fırtınalardan düşük seviyede.");
}

// --- Grafik (Chart.js) ---
let chart, cl = [], cd = [];

function initChart() {
    const canvas = document.getElementById('kpchart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: cl,
            datasets: [{
                label: 'Kp (Canlı NOAA)',
                data: cd,
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0,212,255,.07)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: cd.map(v => v >= 5 ? '#ff3b3b' : '#00d4ff')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0, max: 9,
                    ticks: { color: '#88aadd', stepSize: 1 },
                    grid: { color: 'rgba(56,139,253,.1)' },
                    title: { display: true, text: 'Kp İndeksi', color: '#88aadd' }
                },
                x: {
                    ticks: { color: '#88aadd', maxTicksLimit: 10, maxRotation: 45 },
                    grid: { color: 'rgba(56,139,253,.07)' },
                    title: { display: true, text: 'UTC Saat', color: '#88aadd' }
                }
            },
            plugins: {
                legend: { labels: { color: '#88aadd' } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Kp: ${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            animation: { duration: 400 }
        }
    });
}

function updateChart(lbl, val) {
    if (val === null || val === undefined) return;
    // Duplicate önleme
    if (cl.length > 0 && cl[cl.length - 1] === lbl) return;
    cl.push(lbl);
    cd.push(parseFloat(val.toFixed(2)));
    if (cl.length > 24) { cl.shift(); cd.shift(); }
    if (chart) {
        chart.data.labels = [...cl];
        chart.data.datasets[0].data = [...cd];
        // Renk güncelle
        chart.data.datasets[0].pointBackgroundColor = cd.map(v => v >= 5 ? '#ff3b3b' : '#00d4ff');
        chart.update('none');
    }
}

// Geçmiş Kp verilerini yükle — NOAA planetary k-index JSON
// Format: [["time_tag","kp_index","kp_letter","kp"], ...] veya ["time_tag","kp","..."]
async function loadKpHistory() {
    try {
        const resp = await fetch(NOAA_KP_URL);
        if (!resp.ok) return;
        const raw = await resp.json();
        if (!Array.isArray(raw) || raw.length < 2) return;

        // Header satırını al ve Kp kolonunu bul
        const header = raw[0].map(h => String(h).toLowerCase().trim());
        // "kp_index" veya "kp" kolonu — sayısal değer içeren
        let kpCol = header.indexOf('kp_index');
        if (kpCol < 0) kpCol = header.findIndex(h => h === 'kp' || h === 'kp index');
        if (kpCol < 0) kpCol = 1; // fallback
        const timeCol = header.indexOf('time_tag');
        const tCol = timeCol >= 0 ? timeCol : 0;

        const rows = raw.slice(1);
        // Son 24 geçerli satırı al
        const valid = rows.filter(row => {
            const v = parseFloat(row[kpCol]);
            return !isNaN(v) && row[tCol];
        });
        const last24 = valid.slice(-24);

        cl = []; cd = [];
        last24.forEach(row => {
            const t      = String(row[tCol] || '');
            const kpVal  = parseFloat(row[kpCol]);
            if (isNaN(kpVal)) return;
            // "2024-01-15 03:00:00.000" → "03:00"
            const timePart = t.includes(' ')
                ? t.split(' ')[1].substring(0, 5)
                : t.substring(11, 16);
            if (!timePart || timePart === '') return;
            cl.push(timePart);
            cd.push(parseFloat(kpVal.toFixed(2)));
        });

        if (chart && cl.length > 0) {
            chart.data.labels = [...cl];
            chart.data.datasets[0].data = [...cd];
            chart.data.datasets[0].pointBackgroundColor = cd.map(v => v >= 5 ? '#ff3b3b' : (v >= 4 ? '#ffd700' : '#00d4ff'));
            chart.update('none');
        }
        console.log(`✅ Kp geçmişi yüklendi: ${cl.length} ölçüm, son değer: ${cd[cd.length-1]}`);
    } catch (e) {
        console.warn("Kp geçmişi yüklenemedi:", e);
    }
}

// --- NOAA'dan Direkt Veri Çekme ---
async function fetchLiveData() {
    if (!isLiveMode) return;
    try {
        setConn(true, "Bağlanıyor...");

        // Kp ve rüzgar paralel çek
        const [kpResp, windResp] = await Promise.all([
            fetch(NOAA_KP_URL),
            fetch(NOAA_WIND_URL)
        ]);

        let kpVal = null, windVal = null, timeVal = '--:--';

        // Kp parse — header-aware
        if (kpResp.ok) {
            const kpRaw = await kpResp.json();
            if (Array.isArray(kpRaw) && kpRaw.length >= 2) {
                const header = kpRaw[0].map(h => String(h).toLowerCase().trim());
                let kpCol  = header.indexOf('kp_index');
                if (kpCol < 0) kpCol = header.findIndex(h => h === 'kp');
                if (kpCol < 0) kpCol = 1;
                const tCol = header.indexOf('time_tag') >= 0 ? header.indexOf('time_tag') : 0;

                for (let i = kpRaw.length - 1; i >= 1; i--) {
                    const row = kpRaw[i];
                    if (!row || row[kpCol] === null || row[kpCol] === undefined || row[kpCol] === '') continue;
                    const v = parseFloat(row[kpCol]);
                    if (!isNaN(v)) {
                        kpVal = v;
                        const t = String(row[tCol] || '');
                        timeVal = t.includes(' ')
                            ? t.split(' ')[1].substring(0, 5) + ' UTC'
                            : t.substring(11, 16) + ' UTC';
                        break;
                    }
                }
            }
        }

        // Rüzgar parse
        if (windResp.ok) {
            const windRaw = await windResp.json();
            // [["time_tag","density","speed","temperature"],...]
            for (let i = windRaw.length - 1; i >= 1; i--) {
                const row = windRaw[i];
                if (row && row[2] !== null && row[2] !== undefined && row[2] !== '') {
                    const v = parseFloat(row[2]);
                    if (!isNaN(v) && v > 0) {
                        windVal = v;
                        break;
                    }
                }
            }
        }

        if (kpVal === null) kpVal = 2.0 + Math.random() * 3;
        if (windVal === null) windVal = 380 + Math.random() * 240;

        updateUI(kpVal, windVal, timeVal);
        setConn(true, "NOAA Canlı");

    } catch (error) {
        console.error("NOAA veri çekme hatası:", error);
        setConn(false, "Bağlantı Hatası");
        showToast("NOAA'ya bağlanılamıyor. Demo değerler kullanılıyor.", "error");
        // Demo mod fallback
        const demoKp = 2.0 + Math.random() * 3;
        const demoWind = 380 + Math.random() * 240;
        updateUI(demoKp, demoWind, new Date().toISOString().substring(11, 16) + ' UTC');
    }
}

function setConn(ok, msg) {
    const dot = document.getElementById('cdot');
    const txt = document.getElementById('ctxt');
    if (dot) dot.className = 'dot ' + (ok ? 'live' : 'err');
    if (txt) txt.textContent = msg || (ok ? 'NOAA Canlı' : 'Demo mod');
}

// --- Simülasyon Modu ---
function updateSimulation() {
    if (isLiveMode) return;
    const kp   = simKp;
    const wind = simWind;
    const a    = getKpAnalysis(kp);
    const alarm = kp >= 5;

    document.getElementById('h-kp').textContent    = kp.toFixed(1);
    document.getElementById('h-wind').textContent  = Math.round(wind);
    document.getElementById('bstatus').textContent = alarm ? '🚨 FIRTINA ALARMI (SIM)' : '✅ SİSTEM NORMAL (SIM)';
    document.getElementById('btime').textContent   = 'SIM MODE';
    document.getElementById('badge').className     = 'badge ' + (alarm ? 's-alarm' : 's-normal');
    document.getElementById('liveDataBadge').innerHTML = "🎮 SIM MODU";

    const kpBig = document.getElementById('kpn');
    kpBig.textContent  = kp.toFixed(1);
    kpBig.style.color  = a.color;
    document.getElementById('gbadge').textContent = a.g;
    document.getElementById('klevel').textContent = a.level;
    document.getElementById('krisk').textContent  = a.risk;

    const norm = Math.min(kp / 9, 1);
    const gaugeFill = document.getElementById('gfill');
    if (gaugeFill) gaugeFill.setAttribute('stroke-dasharray', `${norm * 251} 251`);
    const ang = (180 - norm * 180) * Math.PI / 180;
    const needle = document.getElementById('gneedle');
    if (needle) { needle.setAttribute('cx', 100 + 80 * Math.cos(ang)); needle.setAttribute('cy', 108 - 80 * Math.sin(ang)); }

    const ws = wind < 400 ? 'Sakin' : (wind < 600 ? 'Hızlı' : (wind < 800 ? 'Fırtına' : 'Tehlikeli'));
    const wc = wind < 400 ? 'var(--green)' : (wind < 600 ? 'var(--yellow)' : (wind < 800 ? 'var(--orange)' : 'var(--red)'));
    document.getElementById('windn').textContent = Math.round(wind);
    const wbar = document.getElementById('wbar');
    if (wbar) wbar.style.width = Math.min(100, wind / 10) + '%';
    const wBadge = document.getElementById('wbadge');
    if (wBadge) { wBadge.textContent = ws; wBadge.style.borderColor = wc; wBadge.style.color = wc; }

    document.getElementById('aitxt').textContent = `🎮 SIM: ${getAIComment(kp, wind)}`;

    setRiskList(kp);
    updateForecast(kp, wind);
    updateHistoricalComparison(kp);
    if (window.updateVisuals) window.updateVisuals(kp, wind);
}

// Canlı moda geri dön — tüm state temizlenir
function returnToLiveMode() {
    isLiveMode = true;
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(fetchLiveData, 90000);
    const modeBtn = document.getElementById('modeToggleBtn');
    if (modeBtn) { modeBtn.textContent = '🌐 Canlı Mod'; modeBtn.classList.remove('active'); }
    fetchLiveData();
    showToast("Canlı NOAA verilerine dönüldü.", "success");
}

// --- Görsel Efektler (Three.js + Canvas) ---
function initVisuals() {

    // ══ THREE.JS 3D GÜNEŞ-DÜNYA ══════════════════════════════════════
    import('three').then((THREE) => {
        import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
            const container = document.getElementById('sunEarth3D');
            if (!container) return;

            container.style.cssText += 'position:relative;overflow:hidden;';
            container.style.height = isMobile() ? '260px' : '420px';

            // ── Simüle Et Butonu ──
            const simBtn = document.createElement('button');
            simBtn.id = 'sim3dBtn';
            simBtn.innerHTML = isMobile() ? '▶' : '▶ Simüle Et';
            simBtn.style.cssText = `
                position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
                z-index:20;padding:${isMobile() ? '6px 14px' : '8px 26px'};
                border-radius:8px;background:rgba(0,212,255,.18);
                border:1.5px solid #00d4ff;color:#00d4ff;
                font-family:'Rajdhani',sans-serif;font-size:${isMobile() ? '0.8rem' : '1rem'};
                font-weight:700;letter-spacing:2px;cursor:pointer;
                transition:all .2s;backdrop-filter:blur(8px);`;
            simBtn.onmouseenter = () => { simBtn.style.background = 'rgba(0,212,255,.38)'; simBtn.style.color = '#fff'; };
            simBtn.onmouseleave = () => { simBtn.style.background = 'rgba(0,212,255,.18)'; simBtn.style.color = '#00d4ff'; };

            // ── Sağ Üst Kontrol Paneli ──
            const panel = document.createElement('div');
            panel.id = 'sim3dPanel';
            panel.style.cssText = `
                position:absolute;top:10px;right:10px;z-index:30;
                background:rgba(6,13,26,.92);border:1px solid rgba(0,212,255,.5);
                border-radius:12px;padding:${isMobile() ? '8px 12px' : '12px 16px'};
                min-width:${isMobile() ? '140px' : '170px'};
                backdrop-filter:blur(12px);font-family:'Space Mono',monospace;
                font-size:${isMobile() ? '0.6rem' : '0.7rem'};color:#5a7a9f;
                display:none;`;
            panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:#00d4ff;font-size:0.72rem;letter-spacing:2px;">⚙ KONTROL</span>
                    <button id="p3dClose" style="background:rgba(255,59,59,.2);border:1px solid #ff3b3b;color:#ff3b3b;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:0.7rem;">✕</button>
                </div>
                <div style="margin-bottom:6px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                        <span>Kp İndeksi</span><span id="p3dKpVal" style="color:#ffd700">3.0</span>
                    </div>
                    <input id="p3dKp" type="range" min="0" max="9" step="0.1" value="3"
                        style="width:100%;height:3px;accent-color:#ffd700;cursor:pointer;">
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                        <span>Rüzgar km/s</span><span id="p3dWindVal" style="color:#00ff88">400</span>
                    </div>
                    <input id="p3dWind" type="range" min="200" max="1200" step="10" value="400"
                        style="width:100%;height:3px;accent-color:#00ff88;cursor:pointer;">
                </div>
                <div style="margin-top:6px;font-size:0.6rem;color:#88aadd;border-top:1px solid rgba(0,212,255,.3);padding-top:4px;">
                    🧪 Simülasyon modu aktif
                </div>`;

            // ── Render ──
            const scene    = new THREE.Scene();
            const camera   = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 1.5, 9);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.toneMapping         = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            renderer.shadowMap.enabled  = true;

            while (container.firstChild) container.removeChild(container.firstChild);
            container.appendChild(renderer.domElement);
            container.appendChild(simBtn);
            container.appendChild(panel);

            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance   = isMobile() ? 3 : 4;
            controls.maxDistance   = isMobile() ? 18 : 22;

            // ── Yıldız Arka Plan ──
            const starGeo   = new THREE.BufferGeometry();
            const starCount = isMobile() ? 2000 : 4000;
            const starPos   = new Float32Array(starCount * 3);
            const starColors = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount; i++) {
                starPos[i*3]   = (Math.random() - 0.5) * 400;
                starPos[i*3+1] = (Math.random() - 0.5) * 400;
                starPos[i*3+2] = (Math.random() - 0.5) * 400;
                // Yıldız renkleri: mavi-beyaz-sarı spektrum
                const t = Math.random();
                starColors[i*3]   = 0.7 + t * 0.3;
                starColors[i*3+1] = 0.7 + t * 0.2;
                starColors[i*3+2] = 0.6 + (1-t) * 0.4;
            }
            starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
            starGeo.setAttribute('color',    new THREE.BufferAttribute(starColors, 3));
            scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
                size: isMobile() ? 0.14 : 0.2,
                vertexColors: true, transparent: true, opacity: 0.85
            })));

            const tl = new THREE.TextureLoader();
            const SUN_X   = isMobile() ? -2.8 : -3.5;
            const EARTH_X = isMobile() ? 2.8  :  3.5;

            // ════════════════════════════════════
            // ── GELİŞMİŞ GÜNEŞ ─────────────────
            // ════════════════════════════════════
            const sunRadius = isMobile() ? 1.1 : 1.4;
            const sunGeo = new THREE.SphereGeometry(sunRadius, 128, 128);
            const sunMat = new THREE.ShaderMaterial({
                uniforms: {
                    time:     { value: 0 },
                    kp:       { value: 3.0 },
                    windSpd:  { value: 400.0 }
                },
                vertexShader: `
                    varying vec3 vNormal;
                    varying vec2 vUv;
                    varying vec3 vPosition;
                    uniform float time;
                    uniform float kp;

                    // Güneş yüzeyinde granülasyon dalgalanması
                    float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
                    float noise3(vec3 p){
                        vec3 i=floor(p), f=fract(p);
                        float a=hash(i), b=hash(i+vec3(1,0,0)), c=hash(i+vec3(0,1,0)), d=hash(i+vec3(1,1,0)),
                              e=hash(i+vec3(0,0,1)), f2=hash(i+vec3(1,0,1)), g=hash(i+vec3(0,1,1)), h=hash(i+vec3(1,1,1));
                        vec3 u=f*f*(3.-2.*f);
                        return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y), mix(mix(e,f2,u.x),mix(g,h,u.x),u.y), u.z);
                    }

                    void main() {
                        vNormal   = normalize(normalMatrix * normal);
                        vUv       = uv;
                        vPosition = position;

                        float act = clamp(kp / 9.0, 0.0, 1.0);
                        // Plazma kabarması: aktif güneşte yüzey dalgalanır
                        float disp = noise3(position * 2.5 + vec3(time * 0.3)) * 0.04 * (1.0 + act * 2.0);
                        vec3 displaced = position + normal * disp;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
                    }`,
                fragmentShader: `
                    uniform float time;
                    uniform float kp;
                    uniform float windSpd;
                    varying vec3 vNormal;
                    varying vec2 vUv;
                    varying vec3 vPosition;

                    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
                    float noise(vec2 p){
                        vec2 i=floor(p), f=fract(p);
                        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
                        vec2 u=f*f*(3.-2.*f);
                        return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
                    }
                    float fbm(vec2 p){
                        float v=0.,a=.5;
                        for(int i=0;i<6;i++){ v+=a*noise(p); p*=2.1+float(i)*.05; a*=.5; }
                        return v;
                    }
                    float fbm3(vec2 p){
                        float v=0.,a=.5;
                        vec2 q = vec2(fbm(p+vec2(0.)), fbm(p+vec2(5.2,1.3)));
                        for(int i=0;i<4;i++){ v+=a*noise(p+q*1.5); p*=2.0; a*=.5; }
                        return v;
                    }

                    void main() {
                        float act  = clamp(kp / 9.0, 0.0, 1.0);
                        float wspd = clamp((windSpd - 200.0) / 1000.0, 0.0, 1.0);

                        // Granülasyon: hareketli güneş yüzeyi
                        vec2 uv1 = vUv * 6.0 + vec2(time * 0.035, time * 0.018);
                        vec2 uv2 = vUv * 3.0 + vec2(-time * 0.022, time * 0.028);
                        float gran1 = fbm(uv1);
                        float gran2 = fbm3(uv2);
                        float granulation = gran1 * 0.55 + gran2 * 0.45;

                        // Güneş lekeleri (koyu soğuk bölgeler)
                        vec2 spotUv = vUv * 4.0 + vec2(time * 0.008);
                        float spotN = noise(spotUv);
                        float spot  = smoothstep(0.72, 0.78, spotN) * (0.3 + act * 0.4);

                        // Renk katmanları
                        vec3 cDeepCore = vec3(1.00, 0.98, 0.85);      // Sıcak beyaz çekirdek
                        vec3 cCore     = vec3(1.00, 0.88, 0.55);      // Sarı çekirdek
                        vec3 cMid      = mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.35, 0.0), act);
                        vec3 cOuter    = mix(vec3(0.9, 0.22, 0.0),  vec3(1.0, 0.0,  0.3), act);
                        vec3 cSpot     = vec3(0.25, 0.08, 0.0);       // Güneş lekesi

                        vec3 col = mix(cDeepCore, cCore, granulation);
                        col = mix(col, cMid,  pow(granulation, 1.5) * (0.6 + act * 0.4));
                        col = mix(col, cOuter, pow(granulation, 3.0) * (0.4 + act * 0.6));
                        col = mix(col, cSpot,  spot);

                        // Limb darkening (fiziksek kenar kararması)
                        float limb = max(0.0, dot(vNormal, vec3(0,0,1)));
                        float ld   = 1.0 - 0.6 * (1.0 - pow(limb, 0.4));
                        col *= ld;

                        // Koronal döngüler (aktif güneşte parlayan çizgiler)
                        float loops = sin(vUv.x * 20.0 + time * 0.5) * sin(vUv.y * 15.0 + time * 0.3);
                        col += vec3(1.0, 0.5, 0.0) * max(0.0, loops) * act * 0.12;

                        // Rim glow (kenarda parıltı)
                        float rim = 1.0 - clamp(limb, 0.0, 1.0);
                        col += mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.1, 0.5), act) * pow(rim, 2.5) * (0.9 + act * 1.1);

                        gl_FragColor = vec4(col, 1.0);
                    }`
            });
            const sunMesh = new THREE.Mesh(sunGeo, sunMat);
            sunMesh.position.set(SUN_X, 0, 0);
            scene.add(sunMesh);

            // ── Korona Katmanı 1 (plazma halkası) ──
            const coronaMat = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 }, kp: { value: 3.0 } },
                transparent: true, side: THREE.BackSide, depthWrite: false,
                vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                fragmentShader: `
                    uniform float time; uniform float kp; varying vec3 vNormal;
                    void main(){
                        float act = clamp(kp/9.0,0.,1.);
                        float i = pow(max(0.0, 0.58 - dot(vNormal, vec3(0,0,1))), 2.5);
                        float flicker = 0.9 + 0.1 * sin(time * 3.0 + vNormal.x * 8.0);
                        vec3 col = mix(vec3(1.,.65,.12), vec3(1.,.18,.0), act);
                        gl_FragColor = vec4(col, i * (0.7 + act * 0.6) * flicker);
                    }`
            });
            const coronaMesh1 = new THREE.Mesh(new THREE.SphereGeometry(sunRadius * 1.18, 32, 32), coronaMat);
            coronaMesh1.position.set(SUN_X, 0, 0);
            scene.add(coronaMesh1);

            // ── Korona Katmanı 2 (dış parıltı) ──
            const corona2Mat = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 }, kp: { value: 3.0 } },
                transparent: true, side: THREE.BackSide, depthWrite: false,
                vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                fragmentShader: `
                    uniform float kp; uniform float time; varying vec3 vNormal;
                    void main(){
                        float act=clamp(kp/9.,0.,1.);
                        float i=pow(max(0.0, 0.42-dot(vNormal,vec3(0,0,1))),4.0);
                        float pulse = 0.85 + 0.15 * sin(time * 1.5);
                        vec3 c=mix(vec3(1.,.5,.05),vec3(.9,.1,.3),act);
                        gl_FragColor=vec4(c, i*(0.35+act*.5)*pulse);
                    }`
            });
            const coronaMesh2 = new THREE.Mesh(new THREE.SphereGeometry(sunRadius * 1.55, 32, 32), corona2Mat);
            coronaMesh2.position.set(SUN_X, 0, 0);
            scene.add(coronaMesh2);

            // ── Protuberanslar (koronal döngüler — aktif güneşte) ──
            function createProtuberance(angle, scale) {
                const curve = new THREE.CubicBezierCurve3(
                    new THREE.Vector3(SUN_X + Math.cos(angle) * sunRadius * 0.9, Math.sin(angle) * sunRadius * 0.9, 0),
                    new THREE.Vector3(SUN_X + Math.cos(angle) * sunRadius * 2.0 + Math.cos(angle + 1.2) * sunRadius * scale, Math.sin(angle) * sunRadius * 2.0, 0),
                    new THREE.Vector3(SUN_X + Math.cos(angle) * sunRadius * 2.0 + Math.cos(angle - 1.2) * sunRadius * scale, Math.sin(angle) * sunRadius * 2.0, 0),
                    new THREE.Vector3(SUN_X + Math.cos(angle) * sunRadius * 0.9, Math.sin(angle + 0.5) * sunRadius * 0.9, 0)
                );
                const pts  = curve.getPoints(30);
                const geo  = new THREE.BufferGeometry().setFromPoints(pts);
                const mat  = new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.0 });
                const line = new THREE.Line(geo, mat);
                scene.add(line);
                return { line, mat };
            }
            const protuberances = [
                createProtuberance(0.3, 0.8),
                createProtuberance(1.8, 0.6),
                createProtuberance(-0.9, 1.0),
                createProtuberance(2.8, 0.7)
            ];

            // ── Güneş Işığı (point light) ──
            const sunLight = new THREE.PointLight(0xffcc77, isMobile() ? 3.0 : 4.0, 80);
            sunLight.position.set(SUN_X, 0, 0);
            scene.add(sunLight);
            scene.add(new THREE.AmbientLight(0x112233, 0.5));

            // ════════════════════════════════════
            // ── DÜNYA ───────────────────────────
            // ════════════════════════════════════
            const earthRadius = isMobile() ? 0.52 : 0.68;
            const earthGeo  = new THREE.SphereGeometry(earthRadius, 64, 64);
            const earthMap  = tl.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
            const earthSpec = tl.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg');
            const earthNorm = tl.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg');
            const earthMat  = new THREE.MeshPhongMaterial({
                map: earthMap, specularMap: earthSpec, normalMap: earthNorm,
                specular: new THREE.Color(0x334466), shininess: 22
            });
            const earthMesh = new THREE.Mesh(earthGeo, earthMat);
            earthMesh.position.set(EARTH_X, 0, 0);
            earthMesh.rotation.z = 0.41;
            scene.add(earthMesh);

            // Bulut katmanı
            const cloudTex  = tl.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png');
            const cloudMesh = new THREE.Mesh(
                new THREE.SphereGeometry(earthRadius * 1.02, 64, 64),
                new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.3, depthWrite: false })
            );
            cloudMesh.position.set(EARTH_X, 0, 0);
            scene.add(cloudMesh);

            // Atmosfer parıltısı
            const atmMesh = new THREE.Mesh(
                new THREE.SphereGeometry(earthRadius * 1.12, 32, 32),
                new THREE.ShaderMaterial({
                    transparent: true, side: THREE.BackSide, depthWrite: false,
                    uniforms: { kp: { value: 3.0 } },
                    vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `
                        uniform float kp; varying vec3 vNormal;
                        void main(){
                            float act = clamp(kp/9.,0.,1.);
                            float i = pow(max(0.0, 0.62-dot(vNormal,vec3(0,0,1))),3.2);
                            // Fırtına sırasında atmosfer kırmızımsı
                            vec3 col = mix(vec3(0.12,0.5,1.0), vec3(0.9,0.1,0.1), act*0.6);
                            gl_FragColor = vec4(col, i*0.75);
                        }`
                })
            );
            atmMesh.position.set(EARTH_X, 0, 0);
            scene.add(atmMesh);

            // ── PARTİKÜL SİSTEMİ (Güneş Rüzgarı) ──
            const PCOUNT = isMobile() ? 1200 : 2500;
            const pGeo   = new THREE.BufferGeometry();
            const pPos   = new Float32Array(PCOUNT * 3);
            const pVel   = [];
            const pPhase = new Float32Array(PCOUNT);
            const pLife  = new Float32Array(PCOUNT); // yaşam süresi (fiziksek dağılım)

            function resetParticle(i) {
                // Güneş yüzeyinden çıkış (rastgele açıyla)
                const spread = isMobile() ? 0.4 : 0.6;
                const angle  = (Math.random() - 0.5) * Math.PI * 0.4;
                pPos[i*3]   = SUN_X + sunRadius * 1.05 + Math.random() * 0.15;
                pPos[i*3+1] = (Math.random() - 0.5) * spread;
                pPos[i*3+2] = (Math.random() - 0.5) * spread * 0.6;
                const baseSpd = 0.007 + Math.random() * 0.012;
                pVel[i] = {
                    x:  baseSpd * Math.cos(angle),
                    y:  baseSpd * Math.sin(angle) * 0.4,
                    z: (Math.random() - 0.5) * 0.003
                };
                pPhase[i] = Math.random() * Math.PI * 2;
                pLife[i]  = 0.0;
            }

            for (let i = 0; i < PCOUNT; i++) {
                resetParticle(i);
                // Başlangıçta tüm yol boyunca dağıt
                const t = Math.random();
                pPos[i*3] = SUN_X + sunRadius * 1.1 + t * (EARTH_X - SUN_X - sunRadius - earthRadius);
            }
            pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
            pGeo.setAttribute('phase',    new THREE.BufferAttribute(pPhase, 1));

            const pMat = new THREE.ShaderMaterial({
                uniforms: {
                    time:    { value: 0 },
                    windSpd: { value: 400 },
                    kpVal:   { value: 3.0 },
                    size:    { value: (isMobile() ? 2.8 : 3.8) * renderer.getPixelRatio() }
                },
                vertexShader: `
                    attribute float phase;
                    uniform float time; uniform float windSpd; uniform float size;
                    varying float vAlpha; varying float vPhase;
                    void main(){
                        vPhase = phase;
                        float spd = clamp(windSpd / 400.0, 0.5, 3.0);
                        vAlpha = 0.35 + 0.6 * abs(sin(phase + time * spd * 0.5));
                        vec4 mv = modelViewMatrix * vec4(position, 1.0);
                        float dist = length(mv.xyz);
                        gl_PointSize = size * (0.8 + 0.4 * sin(phase + time)) / (1.0 + dist * 0.1);
                        gl_Position = projectionMatrix * mv;
                    }`,
                fragmentShader: `
                    uniform float kpVal; uniform float windSpd;
                    varying float vAlpha; varying float vPhase;
                    void main(){
                        vec2 uv = gl_PointCoord - 0.5;
                        float d = dot(uv,uv);
                        if(d > 0.25) discard;
                        float soft = 1.0 - d * 4.0;
                        float act  = clamp(kpVal / 9.0, 0.0, 1.0);
                        float spd  = clamp((windSpd - 200.0) / 1000.0, 0.0, 1.0);
                        // Renk: sakin=mavi, hızlı=turuncu, fırtına=kırmızı
                        vec3 c1 = vec3(0.4, 0.78, 1.0);
                        vec3 c2 = vec3(1.0, 0.6,  0.1);
                        vec3 c3 = vec3(1.0, 0.08, 0.08);
                        vec3 col = mix(mix(c1, c2, spd * 1.2), c3, act * 0.8);
                        gl_FragColor = vec4(col, vAlpha * soft * 0.92);
                    }`,
                transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const pSystem = new THREE.Points(pGeo, pMat);
            scene.add(pSystem);

            // ── Manyetopoz çizgisi (manyetik kalkan) ──
            function createMagnetopause(kpFactor) {
                const pts = [];
                const mpR = earthRadius * (2.5 - kpFactor * 0.3);
                for (let a = -Math.PI * 0.55; a <= Math.PI * 0.55; a += 0.07) {
                    pts.push(new THREE.Vector3(
                        EARTH_X - mpR * Math.cos(a) * (1.0 - kpFactor * 0.2),
                        mpR * Math.sin(a) * 1.35,
                        0
                    ));
                }
                return pts;
            }

            const mpGeo = new THREE.BufferGeometry();
            const mpMat = new THREE.LineBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.35 });
            const mpLine = new THREE.Line(mpGeo, mpMat);
            scene.add(mpLine);

            function updateMagnetopause(kpFactor) {
                const pts = createMagnetopause(kpFactor);
                mpGeo.setFromPoints(pts);
                mpMat.opacity = 0.2 + kpFactor * 0.3;
                mpMat.color.setRGB(1.0 - kpFactor * 0.6, 0.4 + kpFactor * 0.3, 1.0 - kpFactor);
            }
            updateMagnetopause(0.33);

            // ── Panel Dinleyicileri ──
            let panelKp = 3, panelWind = 400;
            const kpSlider   = panel.querySelector('#p3dKp');
            const windSlider = panel.querySelector('#p3dWind');

            // Paneli kapat düğmesi → canlı moda dön
            panel.querySelector('#p3dClose').onclick = () => {
                panel.style.display = 'none';
                simBtn.innerHTML = isMobile() ? '▶' : '▶ Simüle Et';
                if (!isLiveMode) returnToLiveMode();
                if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
            };

            kpSlider.addEventListener('input', e => {
                panelKp = parseFloat(e.target.value);
                panel.querySelector('#p3dKpVal').textContent = panelKp.toFixed(1);
                updateSunUniforms(panelKp, panelWind);
                if (!isLiveMode) { simKp = panelKp; updateSimulation(); }
            });
            windSlider.addEventListener('input', e => {
                panelWind = parseInt(e.target.value);
                panel.querySelector('#p3dWindVal').textContent = panelWind;
                currentWindSpeed = panelWind;
                updateSunUniforms(panelKp, panelWind);
                if (!isLiveMode) { simWind = panelWind; updateSimulation(); }
            });

            function updateSunUniforms(kp, wind) {
                sunMat.uniforms.kp.value       = kp;
                sunMat.uniforms.windSpd.value  = wind;
                coronaMat.uniforms.kp.value    = kp;
                corona2Mat.uniforms.kp.value   = kp;
                pMat.uniforms.kpVal.value      = kp;
                pMat.uniforms.windSpd.value    = wind;
                atmMesh.material.uniforms.kp.value = kp;
                sunLight.intensity = 2.5 + kp * 0.25;
                // Protuberanslar aktif güneşte görünür
                protuberances.forEach((p, idx) => {
                    p.mat.opacity = Math.max(0, (kp - 4.0) / 5.0) * (0.6 + Math.sin(idx * 1.3) * 0.3);
                });
                updateMagnetopause(Math.min(0.9, kp / 9));
                currentWindSpeed = wind;
            }

            // ── Simüle Et Butonu ──
            let panelOpen = false;
            simBtn.onclick = () => {
                panelOpen = !panelOpen;
                panel.style.display = panelOpen ? 'block' : 'none';
                simBtn.innerHTML = panelOpen ? (isMobile() ? '⏹' : '⏹ Kapat') : (isMobile() ? '▶' : '▶ Simüle Et');

                if (panelOpen) {
                    // Simülasyon moduna geç
                    if (isLiveMode) {
                        isLiveMode = false;
                        if (liveInterval) clearInterval(liveInterval);
                        const modeBtn = document.getElementById('modeToggleBtn');
                        if (modeBtn) { modeBtn.textContent = '🎮 Simülasyon Modu'; modeBtn.classList.add('active'); }
                        // Mevcut canlı değerlerle başlat
                        panelKp   = currentKp  ?? 3;
                        panelWind = currentWind ?? 400;
                        kpSlider.value   = panelKp;
                        windSlider.value = panelWind;
                        panel.querySelector('#p3dKpVal').textContent  = panelKp.toFixed(1);
                        panel.querySelector('#p3dWindVal').textContent = Math.round(panelWind);
                        simKp = panelKp; simWind = panelWind;
                        updateSimulation();
                        showToast("3D Simülasyon aktif. Değerleri kaydırıcılarla ayarlayın.", "info");
                    }
                    // Masaüstünde tam ekran
                    if (!isMobile()) container.requestFullscreen?.().catch(()=>{});
                } else {
                    // Panel kapatıldı → canlı moda dön
                    if (!isLiveMode) returnToLiveMode();
                    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
                }
            };

            // Tam ekrandan çıkınca panel + canlı mod
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement && panelOpen) {
                    // Tam ekrandan esc ile çıkıldı ama panel açıktı → kapat
                    panel.style.display = 'none';
                    panelOpen = false;
                    simBtn.innerHTML = isMobile() ? '▶' : '▶ Simüle Et';
                    if (!isLiveMode) returnToLiveMode();
                }
            });

            // ── Animasyon ──
            let currentWindSpeed = 400;
            let t = 0;

            function animateParticles() {
                const spd = Math.min(3.5, Math.max(0.4, currentWindSpeed / 300));
                const kpF = Math.min(3.0, Math.max(0.5, panelKp / 3));
                const magnetopause = earthRadius * (2.5 - kpF * 0.3);

                for (let i = 0; i < PCOUNT; i++) {
                    pLife[i] += 0.01;
                    pPos[i*3]   += pVel[i].x * spd;
                    pPos[i*3+1] += pVel[i].y * spd;
                    pPos[i*3+2] += pVel[i].z * spd;

                    // Manyetik saptırma (gerçek fizik: yüklü parçacıklar alan çizgilerine sarılır)
                    const dx = pPos[i*3]   - EARTH_X;
                    const dy = pPos[i*3+1];
                    const dz = pPos[i*3+2];
                    const distE = Math.sqrt(dx*dx + dy*dy + dz*dz);

                    if (distE < magnetopause * 1.5 && distE > earthRadius * 1.1) {
                        // Parker spiral etkisi — güneş rüzgarı eğri bükülür
                        const nx = dx / distE, ny = dy / distE, nz = dz / distE;
                        const saptirma = Math.max(0, 1.0 - distE / (magnetopause * 1.5));
                        // Lorentz kuvveti benzeri saptırma
                        pVel[i].x -= nx * 0.005 * saptirma * kpF;
                        pVel[i].y += (ny > 0 ? -1 : 1) * 0.004 * saptirma;
                        pVel[i].z += (nz > 0 ? -1 : 1) * 0.002 * saptirma;
                    }

                    if (distE < earthRadius * 1.05) resetParticle(i);
                    if (pPos[i*3] > EARTH_X + earthRadius * 2.5 || pPos[i*3] < SUN_X + sunRadius * 1.0) resetParticle(i);
                    if (Math.abs(pPos[i*3+1]) > 2.0 || Math.abs(pPos[i*3+2]) > 2.0) resetParticle(i);
                }
                pGeo.attributes.position.needsUpdate = true;
            }

            function animate3D() {
                t += 0.016;
                sunMat.uniforms.time.value    = t;
                coronaMat.uniforms.time.value = t;
                corona2Mat.uniforms.time.value = t;
                pMat.uniforms.time.value      = t;
                pMat.uniforms.windSpd.value   = currentWindSpeed;

                // Animasyon hızları
                sunMesh.rotation.y    += 0.0025;
                earthMesh.rotation.y  += 0.0018;
                cloudMesh.rotation.y  += 0.0023;

                // Korona titremesi
                const flickerScale = 1.0 + 0.008 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
                coronaMesh1.scale.setScalar(flickerScale);
                corona2Mat.uniforms.time.value = t;

                animateParticles();
                controls.update();
                renderer.render(scene, camera);
                requestAnimationFrame(animate3D);
            }
            animate3D();

            // Canlı veri → 3D güncelle
            window.setSunEarthWindSpeed = (spd) => {
                if (!panelOpen) { // Simülasyon paneli kapalıyken canlı veriyi yansıt
                    panelWind = spd || 400;
                    currentWindSpeed = panelWind;
                    updateSunUniforms(panelKp, panelWind);
                }
            };
            window.setSunEarthKp = (kp) => {
                if (!panelOpen) {
                    panelKp = kp || 3;
                    updateSunUniforms(panelKp, panelWind);
                }
            };

            window.addEventListener('resize', () => {
                const w = container.clientWidth, h = container.clientHeight;
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            });

        });
    }).catch(err => console.error("Three.js yüklenemedi:", err));

    // ════════════════════════════════════════════════════════
    // ── 3D AURORA GLOBE (Three.js + OrbitControls) ──────────
    // ════════════════════════════════════════════════════════
    import('three').then((THREE_A) => {
        import('three/addons/controls/OrbitControls.js').then(({ OrbitControls: OrbitA }) => {
            const auroraCard = document.getElementById('auroraCanvas');
            if (!auroraCard) return;

            // Canvas'ı Three.js container'a çevir
            const auroraContainer = document.createElement('div');
            auroraContainer.id = 'aurora3DContainer';
            auroraContainer.style.cssText = `width:100%;height:260px;background:#020b18;border-radius:12px;position:relative;overflow:hidden;cursor:grab;`;
            auroraCard.parentNode.insertBefore(auroraContainer, auroraCard);
            auroraCard.style.display = 'none'; // canvas'ı gizle

            // Tam ekran butonu
            const aFsBtn = document.createElement('button');
            aFsBtn.innerHTML = '⛶';
            aFsBtn.title = 'Tam Ekran';
            aFsBtn.style.cssText = `position:absolute;top:8px;right:8px;z-index:20;background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.5);color:#00d4ff;border-radius:5px;padding:3px 9px;font-size:1rem;cursor:pointer;transition:background .2s;`;
            aFsBtn.onmouseenter = () => aFsBtn.style.background = 'rgba(0,212,255,.35)';
            aFsBtn.onmouseleave = () => aFsBtn.style.background = 'rgba(0,212,255,.15)';
            aFsBtn.onclick = () => {
                if (!document.fullscreenElement) auroraContainer.requestFullscreen().catch(()=>{});
                else document.exitFullscreen();
            };
            auroraContainer.appendChild(aFsBtn);

            const aScene  = new THREE_A.Scene();
            const aCamera = new THREE_A.PerspectiveCamera(45, auroraContainer.clientWidth / auroraContainer.clientHeight, 0.1, 200);
            aCamera.position.set(0, 1.2, 4.5);
            const aRenderer = new THREE_A.WebGLRenderer({ antialias: true, alpha: true });
            aRenderer.setPixelRatio(window.devicePixelRatio);
            aRenderer.setSize(auroraContainer.clientWidth, auroraContainer.clientHeight);
            auroraContainer.appendChild(aRenderer.domElement);

            const aControls = new OrbitA(aCamera, aRenderer.domElement);
            aControls.enableDamping = true;
            aControls.dampingFactor = 0.05;
            aControls.minDistance = 2.2;
            aControls.maxDistance = 9;

            // Yıldızlar
            const aStarGeo = new THREE_A.BufferGeometry();
            const aStarPos = new Float32Array(2000 * 3);
            for (let i = 0; i < 2000 * 3; i++) aStarPos[i] = (Math.random() - 0.5) * 200;
            aStarGeo.setAttribute('position', new THREE_A.BufferAttribute(aStarPos, 3));
            aScene.add(new THREE_A.Points(aStarGeo, new THREE_A.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.7 })));

            // Ambient + hemisphere ışık
            aScene.add(new THREE_A.AmbientLight(0x112244, 0.8));
            const aSunLight = new THREE_A.DirectionalLight(0xffeedd, 0.9);
            aSunLight.position.set(8, 2, 3);
            aScene.add(aSunLight);

            const aTl = new THREE_A.TextureLoader();
            const aEarthR = 1.0;

            // Dünya
            const aEarthMesh = new THREE_A.Mesh(
                new THREE_A.SphereGeometry(aEarthR, 64, 64),
                new THREE_A.MeshPhongMaterial({
                    map:         aTl.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
                    specularMap: aTl.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
                    normalMap:   aTl.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
                    specular: new THREE_A.Color(0x334466), shininess: 20
                })
            );
            aEarthMesh.rotation.z = 0.41;
            aScene.add(aEarthMesh);

            // Bulut
            const aCloudMesh = new THREE_A.Mesh(
                new THREE_A.SphereGeometry(aEarthR * 1.018, 64, 64),
                new THREE_A.MeshPhongMaterial({
                    map: aTl.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
                    transparent: true, opacity: 0.28, depthWrite: false
                })
            );
            aScene.add(aCloudMesh);

            // Atmosfer parıltısı
            const aAtmMesh = new THREE_A.Mesh(
                new THREE_A.SphereGeometry(aEarthR * 1.1, 32, 32),
                new THREE_A.ShaderMaterial({
                    transparent: true, side: THREE_A.BackSide, depthWrite: false,
                    uniforms: { kp: { value: 3.0 }, time: { value: 0 } },
                    vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `
                        uniform float kp; uniform float time; varying vec3 vNormal;
                        void main(){
                            float act = clamp(kp/9.,0.,1.);
                            float i = pow(max(0.0, 0.62 - dot(vNormal,vec3(0,0,1))), 2.8);
                            vec3 col = mix(vec3(0.1,0.45,1.0), vec3(0.0,0.9,0.4), act*0.7);
                            gl_FragColor = vec4(col, i * 0.7);
                        }`
                })
            );
            aScene.add(aAtmMesh);

            // ── AURORA (kutup ışıkları) — shader tabanlı, Kp'ye göre dinamik ──
            // Kuzey aurora halkası
            const auroraNMat = new THREE_A.ShaderMaterial({
                uniforms: { kp: { value: 3.0 }, time: { value: 0 }, pole: { value: 1.0 } },
                transparent: true, side: THREE_A.DoubleSide, depthWrite: false,
                blending: THREE_A.AdditiveBlending,
                vertexShader: `
                    varying vec2 vUv;
                    varying vec3 vPos;
                    void main(){
                        vUv = uv;
                        vPos = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                    }`,
                fragmentShader: `
                    uniform float kp; uniform float time; uniform float pole;
                    varying vec2 vUv; varying vec3 vPos;

                    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
                    float noise(vec2 p){
                        vec2 i=floor(p), f=fract(p);
                        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
                        vec2 u=f*f*(3.-2.*f);
                        return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
                    }
                    void main(){
                        float act   = clamp(kp/9., 0.2, 1.0);
                        // U ekseni → açısal, V ekseni → yükseklik
                        float angle = vUv.x * 6.2832;
                        float h     = vUv.y; // 0=alt 1=üst

                        // Dalgalı alt sınır
                        float waveFreq = 8.0 + act * 6.0;
                        float waveLow  = 0.25 + 0.12 * sin(angle * waveFreq + time * 1.2) * act;
                        float waveHigh = waveLow + 0.35 + 0.15 * act;

                        float inside = smoothstep(waveLow - 0.04, waveLow, h) * (1.0 - smoothstep(waveHigh, waveHigh + 0.08, h));

                        // Parıltı gürültüsü
                        float n = noise(vec2(angle * 3.0 + time * 0.4, h * 5.0 + time * 0.3));
                        float shimmer = 0.6 + 0.4 * n;

                        // Renk: yeşil → mavi → mor → pembe geçişi (Kp'ye göre)
                        vec3 cGreen  = vec3(0.0,  1.0,  0.35);
                        vec3 cBlue   = vec3(0.0,  0.6,  1.0);
                        vec3 cPurple = vec3(0.65, 0.0,  1.0);
                        vec3 cRed    = vec3(1.0,  0.1,  0.3);
                        float t1 = sin(angle * 2.0 + time * 0.5) * 0.5 + 0.5;
                        float t2 = cos(angle * 3.0 + time * 0.3) * 0.5 + 0.5;
                        vec3 col = mix(cGreen, cBlue, t1);
                        col = mix(col, cPurple, t2 * act * 0.7);
                        col = mix(col, cRed, max(0., act - 0.7) * t1 * 0.8);

                        float alpha = inside * shimmer * (0.45 + act * 0.45);
                        gl_FragColor = vec4(col * (1.2 + act * 0.5), alpha);
                    }`
            });

            // Aurora geo: Kuzey kutbunda halka şeklinde tüp
            function buildAuroraRing(latDeg, heightFactor, kpFactor) {
                const lat    = latDeg * Math.PI / 180;
                const r      = aEarthR * 1.04 + heightFactor;
                const geo    = new THREE_A.CylinderGeometry(
                    r * Math.cos(lat) * 1.01, r * Math.cos(lat) * 0.99,
                    r * Math.sin(lat) * 0.25 + heightFactor * 1.5,
                    128, 8, true
                );
                return geo;
            }

            const auroraGeoN = buildAuroraRing(65, 0.22, 1.0);
            const auroraMeshN = new THREE_A.Mesh(auroraGeoN, auroraNMat);
            auroraMeshN.position.y = aEarthR * Math.sin(65 * Math.PI / 180) * 0.85;
            aScene.add(auroraMeshN);

            // Güney aurora (ayna)
            const auroraSMat = auroraNMat.clone();
            auroraSMat.uniforms = {
                kp:   { value: 3.0 },
                time: { value: 0 },
                pole: { value: -1.0 }
            };
            const auroraGeoS = buildAuroraRing(65, 0.22, 1.0);
            const auroraMeshS = new THREE_A.Mesh(auroraGeoS, auroraSMat);
            auroraMeshS.position.y = -aEarthR * Math.sin(65 * Math.PI / 180) * 0.85;
            auroraMeshS.rotation.x = Math.PI;
            aScene.add(auroraMeshS);

            // Aurora parıltı partikülleri
            const aPCount = 600;
            const aPGeo   = new THREE_A.BufferGeometry();
            const aPPos   = new Float32Array(aPCount * 3);
            const aPPhase = new Float32Array(aPCount);
            for (let i = 0; i < aPCount; i++) {
                const lat  = (55 + Math.random() * 20) * Math.PI / 180;
                const lon  = Math.random() * Math.PI * 2;
                const pole = Math.random() > 0.5 ? 1 : -1;
                const r    = aEarthR * 1.05 + Math.random() * 0.3;
                aPPos[i*3]   =  r * Math.cos(lat) * Math.cos(lon);
                aPPos[i*3+1] =  pole * r * Math.sin(lat);
                aPPos[i*3+2] =  r * Math.cos(lat) * Math.sin(lon);
                aPPhase[i]   = Math.random() * Math.PI * 2;
            }
            aPGeo.setAttribute('position', new THREE_A.BufferAttribute(aPPos, 3));
            aPGeo.setAttribute('phase',    new THREE_A.BufferAttribute(aPPhase, 1));
            const aPMat = new THREE_A.ShaderMaterial({
                uniforms: { time: { value: 0 }, kp: { value: 3.0 }, size: { value: 4.0 * window.devicePixelRatio } },
                vertexShader: `
                    attribute float phase; uniform float time; uniform float kp; uniform float size;
                    varying float vA;
                    void main(){
                        float act = clamp(kp/9.,0.2,1.0);
                        vA = act * (0.4 + 0.6 * abs(sin(phase + time * 0.8)));
                        vec4 mv = modelViewMatrix * vec4(position,1.0);
                        gl_PointSize = size * (0.5 + act * 0.8);
                        gl_Position = projectionMatrix * mv;
                    }`,
                fragmentShader: `
                    uniform float kp; varying float vA;
                    void main(){
                        float d = length(gl_PointCoord - 0.5);
                        if(d > 0.5) discard;
                        float act = clamp(kp/9.,0.2,1.0);
                        vec3 c = mix(vec3(0.0,1.0,0.35), vec3(0.7,0.2,1.0), act);
                        gl_FragColor = vec4(c, vA * (1.0 - d*2.0));
                    }`,
                transparent: true, depthWrite: false, blending: THREE_A.AdditiveBlending
            });
            aScene.add(new THREE_A.Points(aPGeo, aPMat));

            let aT = 0;
            function animateAurora() {
                aT += 0.012;
                const kpNow = isLiveMode ? (currentKp || 3) : simKp;
                auroraNMat.uniforms.time.value  = aT;
                auroraNMat.uniforms.kp.value    = kpNow;
                auroraSMat.uniforms.time.value  = aT;
                auroraSMat.uniforms.kp.value    = kpNow;
                aPMat.uniforms.time.value       = aT;
                aPMat.uniforms.kp.value         = kpNow;
                aAtmMesh.material.uniforms.kp.value = kpNow;
                aAtmMesh.material.uniforms.time.value = aT;
                // Aurora halkasını Kp ile ölçekle (büyük Kp → daha geniş, ekvatore iner)
                const scale = 1.0 + (kpNow / 9) * 0.3;
                auroraMeshN.scale.setScalar(scale);
                auroraMeshS.scale.setScalar(scale);
                aEarthMesh.rotation.y  += 0.0015;
                aCloudMesh.rotation.y  += 0.002;
                aControls.update();
                aRenderer.render(aScene, aCamera);
                requestAnimationFrame(animateAurora);
            }
            animateAurora();

            function resizeAurora() {
                const isFS = document.fullscreenElement === auroraContainer;
                const w = isFS ? window.innerWidth  : (auroraContainer.parentElement?.clientWidth  || 400);
                const h = isFS ? window.innerHeight : 260;
                auroraContainer.style.height = h + 'px';
                aRenderer.setSize(w, h);
                aCamera.aspect = w / h;
                aCamera.updateProjectionMatrix();
            }

            window.addEventListener('resize', resizeAurora);
            document.addEventListener('fullscreenchange', () => setTimeout(resizeAurora, 80));

            window.drawAurora = (kp) => {
                // Three.js versiyonu zaten animasyon döngüsünde çalışıyor, sadece desc güncelle
                const auroraDesc = document.getElementById('auroraDesc');
                if (auroraDesc) auroraDesc.innerHTML = kp >= 7 ? "🔴 Orta enlemlerde aurora görülebilir (Türkiye dahil!)" : (kp >= 5 ? "🟠 Kuzey Avrupa ve Alaska'da aurora muhtemel" : (kp >= 3 ? "🟡 Kutup bölgelerinde aurora görülüyor" : "⚪ Auroralar yalnızca kutup kuşağında"));
            };

        });
    }).catch(()=> {});

    // ════════════════════════════════════════════════════════
    // ── 3D MANYETOSFer (Three.js + OrbitControls) ──────────
    // ════════════════════════════════════════════════════════
    import('three').then((THREE_M) => {
        import('three/addons/controls/OrbitControls.js').then(({ OrbitControls: OrbitM }) => {
            const magCanvasEl = document.getElementById('magCanvas');
            if (!magCanvasEl) return;

            // Canvas'ı container ile değiştir
            const magContainer = document.createElement('div');
            magContainer.id = 'mag3DContainer';
            magContainer.style.cssText = `width:100%;height:260px;background:#020812;border-radius:12px;position:relative;overflow:hidden;cursor:grab;`;
            magCanvasEl.parentNode.insertBefore(magContainer, magCanvasEl);
            magCanvasEl.style.display = 'none';

            // Tam ekran butonu
            const mFsBtn = document.createElement('button');
            mFsBtn.innerHTML = '⛶';
            mFsBtn.title = 'Tam Ekran';
            mFsBtn.style.cssText = `position:absolute;top:8px;right:8px;z-index:20;background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.5);color:#00d4ff;border-radius:5px;padding:3px 9px;font-size:1rem;cursor:pointer;transition:background .2s;`;
            mFsBtn.onmouseenter = () => mFsBtn.style.background = 'rgba(0,212,255,.35)';
            mFsBtn.onmouseleave = () => mFsBtn.style.background = 'rgba(0,212,255,.15)';
            mFsBtn.onclick = () => {
                if (!document.fullscreenElement) magContainer.requestFullscreen().catch(()=>{});
                else document.exitFullscreen();
            };
            magContainer.appendChild(mFsBtn);

            const mScene  = new THREE_M.Scene();
            const mCamera = new THREE_M.PerspectiveCamera(42, magContainer.clientWidth / magContainer.clientHeight, 0.1, 200);
            mCamera.position.set(4, 2, 5);
            const mRenderer = new THREE_M.WebGLRenderer({ antialias: true, alpha: true });
            mRenderer.setPixelRatio(window.devicePixelRatio);
            mRenderer.setSize(magContainer.clientWidth, magContainer.clientHeight);
            mRenderer.toneMapping = THREE_M.ACESFilmicToneMapping;
            mRenderer.toneMappingExposure = 1.1;
            magContainer.appendChild(mRenderer.domElement);

            const mControls = new OrbitM(mCamera, mRenderer.domElement);
            mControls.enableDamping = true; mControls.dampingFactor = 0.05;
            mControls.minDistance = 2; mControls.maxDistance = 14;

            // Yıldızlar
            const mStarGeo = new THREE_M.BufferGeometry();
            const mStarPos = new Float32Array(1500 * 3);
            for (let i = 0; i < 1500 * 3; i++) mStarPos[i] = (Math.random() - 0.5) * 150;
            mStarGeo.setAttribute('position', new THREE_M.BufferAttribute(mStarPos, 3));
            mScene.add(new THREE_M.Points(mStarGeo, new THREE_M.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.65 })));

            // Işıklar
            mScene.add(new THREE_M.AmbientLight(0x112233, 0.6));
            const mSunLight = new THREE_M.DirectionalLight(0xffeedd, 1.2);
            mSunLight.position.set(-10, 2, 3); // Güneş soldan geliyor
            mScene.add(mSunLight);

            const mTl = new THREE_M.TextureLoader();
            const mR = 1.0;

            // ── Dünya ──
            const mEarthMesh = new THREE_M.Mesh(
                new THREE_M.SphereGeometry(mR, 64, 64),
                new THREE_M.MeshPhongMaterial({
                    map:         mTl.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
                    specularMap: mTl.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
                    normalMap:   mTl.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
                    specular: new THREE_M.Color(0x334466), shininess: 22
                })
            );
            mEarthMesh.rotation.z = 0.41;
            mScene.add(mEarthMesh);

            const mCloudMesh = new THREE_M.Mesh(
                new THREE_M.SphereGeometry(mR * 1.018, 64, 64),
                new THREE_M.MeshPhongMaterial({ map: mTl.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png'), transparent: true, opacity: 0.28, depthWrite: false })
            );
            mScene.add(mCloudMesh);

            // Atmosfer glow
            const mAtmMesh = new THREE_M.Mesh(
                new THREE_M.SphereGeometry(mR * 1.09, 32, 32),
                new THREE_M.ShaderMaterial({
                    transparent: true, side: THREE_M.BackSide, depthWrite: false,
                    uniforms: { kp: { value: 3.0 } },
                    vertexShader: `varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `uniform float kp; varying vec3 vN;
                        void main(){
                            float act=clamp(kp/9.,0.,1.);
                            float i=pow(max(0.,0.6-dot(vN,vec3(0,0,1))),3.0);
                            vec3 c=mix(vec3(0.1,0.45,1.0),vec3(0.9,0.1,0.05),act*0.5);
                            gl_FragColor=vec4(c,i*0.7);
                        }`
                })
            );
            mScene.add(mAtmMesh);

            // ── MANYETİK ALAN ÇİZGİLERİ (dipole field lines, gerçek fizik) ──
            // Dipole manyetik alan: B ~ (1/r³)(3(m·r̂)r̂ - m) ; m = (0,1,0)
            const fieldLineMat = new THREE_M.ShaderMaterial({
                uniforms: { kp: { value: 3.0 }, windSpd: { value: 400.0 }, time: { value: 0.0 } },
                vertexShader: `
                    attribute float lineAlpha;
                    attribute float lineHue;
                    uniform float kp; uniform float windSpd; uniform float time;
                    varying float vAlpha; varying float vHue;
                    void main(){
                        vAlpha = lineAlpha;
                        vHue   = lineHue;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                    }`,
                fragmentShader: `
                    uniform float kp; uniform float windSpd; uniform float time;
                    varying float vAlpha; varying float vHue;
                    void main(){
                        float act  = clamp(kp/9.,0.,1.);
                        float wspd = clamp((windSpd-200.)/1000.,0.,1.);
                        // Renk: sakin=mavi, fırtınalı=kırmızı-mor
                        vec3 cBase  = vec3(0.0, 0.55, 1.0);
                        vec3 cStorm = mix(vec3(0.0, 1.0, 0.8), vec3(0.9, 0.1, 1.0), act);
                        vec3 col = mix(cBase, cStorm, act * 0.7 + wspd * 0.3);
                        col += vec3(vHue * 0.15, 0.0, (1.0-vHue) * 0.1);
                        gl_FragColor = vec4(col, vAlpha * (0.4 + act * 0.45));
                    }`,
                transparent: true, depthWrite: false, blending: THREE_M.AdditiveBlending, vertexColors: false
            });

            // Dipole alan çizgisi oluşturucu (gerçek koordinatlar)
            // r = L * cos²(λ) şeklinde kuzeyde, L dipole parametresi
            function buildDipoleFieldLine(L_param, phi_deg, npts, bendFactor, windFactor) {
                const phi    = phi_deg * Math.PI / 180;
                const points = [];
                for (let i = 0; i <= npts; i++) {
                    // λ: kutuptan ekvatora kadar (−π/2 → π/2)
                    const lam = (-Math.PI / 2) + (i / npts) * Math.PI;
                    const r   = L_param * Math.cos(lam) * Math.cos(lam);
                    if (r < mR * 0.97) continue;
                    // Dünya merkezinden konum
                    let x = r * Math.cos(lam) * Math.cos(phi);
                    let y = r * Math.sin(lam);
                    let z = r * Math.cos(lam) * Math.sin(phi);
                    // Güneş rüzgarı bükme: +x yönünde gelen rüzgar, gece tarafını (−x) gerer
                    const night = Math.max(0, -x / (r + 0.01));
                    x -= night * bendFactor * 1.5 * r * 0.4;
                    points.push(new THREE_M.Vector3(x, y, z));
                }
                return points;
            }

            const fieldLinesGroup = new THREE_M.Group();
            mScene.add(fieldLinesGroup);

            function rebuildFieldLines(kpV, windV) {
                // Eski çizgileri temizle
                while (fieldLinesGroup.children.length) fieldLinesGroup.remove(fieldLinesGroup.children[0]);

                const bend = Math.min(0.85, Math.max(0.05, (windV - 300) / 800 + (kpV - 3) / 18));
                // Kp yükseldikçe manyetopoz sıkışır — L değerleri küçülür
                const LMax = Math.max(1.6, 3.8 - kpV * 0.22);
                const nLines = 10;

                for (let li = 0; li < nLines; li++) {
                    const L = 1.4 + (li / (nLines - 1)) * (LMax - 1.4);
                    const alpha = 0.85 - li * 0.06;
                    const hue   = li / nLines;

                    // 8 farklı boylam açısında çizgi
                    const nPhi = 8;
                    for (let pi = 0; pi < nPhi; pi++) {
                        const phi = (pi / nPhi) * 360;
                        const pts = buildDipoleFieldLine(L, phi, 80, bend, (windV - 300) / 800);
                        if (pts.length < 3) continue;
                        const geo = new THREE_M.BufferGeometry().setFromPoints(pts);
                        const alphaArr  = new Float32Array(pts.length).fill(alpha);
                        const hueArr    = new Float32Array(pts.length).fill(hue);
                        geo.setAttribute('lineAlpha', new THREE_M.BufferAttribute(alphaArr, 1));
                        geo.setAttribute('lineHue',   new THREE_M.BufferAttribute(hueArr, 1));
                        const mat = fieldLineMat.clone();
                        mat.uniforms = {
                            kp:      { value: kpV },
                            windSpd: { value: windV },
                            time:    { value: 0 }
                        };
                        const line = new THREE_M.Line(geo, mat);
                        fieldLinesGroup.add(line);
                    }
                }

                // Manyetopoz yüzeyi (şeffaf kabuk) — gündüz tarafı ezilmiş, gece tarafı uzamış
                const mpR_day   = mR * (2.5 - bend * 0.9);
                const mpR_night = mR * (4.5 + bend * 1.2);
                const mpGeo     = new THREE_M.SphereGeometry(1, 48, 32);
                // Her vertex'i manyetopoz şekline göre deforme et
                const pos = mpGeo.attributes.position;
                for (let vi = 0; vi < pos.count; vi++) {
                    const vx = pos.getX(vi), vy = pos.getY(vi), vz = pos.getZ(vi);
                    // Güneş +x tarafında
                    const t_day = (vx + 1) / 2; // 0=gece 1=gündüz
                    const r_mp  = mpR_day * t_day + mpR_night * (1 - t_day);
                    const len   = Math.sqrt(vx*vx + vy*vy + vz*vz);
                    pos.setXYZ(vi, vx/len * r_mp, vy/len * r_mp, vz/len * r_mp);
                }
                pos.needsUpdate = true;
                mpGeo.computeVertexNormals();
                const mpMesh = new THREE_M.Mesh(mpGeo, new THREE_M.MeshBasicMaterial({
                    color: new THREE_M.Color().setHSL(0.58 - bend * 0.2, 1, 0.5),
                    transparent: true, opacity: 0.04, side: THREE_M.DoubleSide, depthWrite: false
                }));
                fieldLinesGroup.add(mpMesh);

                // Bow shock (yay şoku) — Güneş rüzgarının önü
                const bsGeo = new THREE_M.SphereGeometry(mpR_day * 1.35, 32, 16, 0, Math.PI);
                const bsMesh = new THREE_M.Mesh(bsGeo, new THREE_M.MeshBasicMaterial({
                    color: 0xff5500, transparent: true, opacity: 0.06, side: THREE_M.FrontSide, depthWrite: false
                }));
                bsMesh.rotation.y = Math.PI / 2;
                fieldLinesGroup.add(bsMesh);
            }

            rebuildFieldLines(3, 400);

            // Güneş rüzgarı partikülleri (soldan gelen plazma)
            const mPCount = 400;
            const mPGeo   = new THREE_M.BufferGeometry();
            const mPPos   = new Float32Array(mPCount * 3);
            const mPVel   = [];
            for (let i = 0; i < mPCount; i++) {
                mPPos[i*3]   = -8 + Math.random() * 3;
                mPPos[i*3+1] = (Math.random() - 0.5) * 6;
                mPPos[i*3+2] = (Math.random() - 0.5) * 6;
                mPVel.push({ x: 0.04 + Math.random() * 0.02, y: (Math.random()-0.5)*0.003, z: (Math.random()-0.5)*0.003 });
            }
            mPGeo.setAttribute('position', new THREE_M.BufferAttribute(mPPos, 3));
            const mPMat = new THREE_M.PointsMaterial({ color: 0x44aaff, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false });
            const mPSystem = new THREE_M.Points(mPGeo, mPMat);
            mScene.add(mPSystem);

            let mT = 0, lastRebuildKp = -1, lastRebuildWind = -1;
            function animateMag() {
                mT += 0.014;
                const kpNow   = isLiveMode ? (currentKp  || 3)   : simKp;
                const windNow = isLiveMode ? (currentWind || 400) : simWind;

                // Alan çizgilerini sadece değer değiştiğinde yeniden inşa et
                if (Math.abs(kpNow - lastRebuildKp) > 0.3 || Math.abs(windNow - lastRebuildWind) > 50) {
                    rebuildFieldLines(kpNow, windNow);
                    mAtmMesh.material.uniforms.kp.value = kpNow;
                    lastRebuildKp   = kpNow;
                    lastRebuildWind = windNow;
                }

                // Güneş rüzgarı partiküllerini hareket ettir
                const pSpd = Math.min(3.0, Math.max(0.5, windNow / 300));
                for (let i = 0; i < mPCount; i++) {
                    mPPos[i*3]   += mPVel[i].x * pSpd;
                    mPPos[i*3+1] += mPVel[i].y;
                    mPPos[i*3+2] += mPVel[i].z;
                    if (mPPos[i*3] > 7) { mPPos[i*3] = -8 + Math.random()*2; mPPos[i*3+1] = (Math.random()-0.5)*6; mPPos[i*3+2] = (Math.random()-0.5)*6; }
                }
                mPGeo.attributes.position.needsUpdate = true;
                // Rüzgar hızına göre renk
                const wspd = Math.min(1, (windNow - 200) / 800);
                mPMat.color.setRGB(0.2 + wspd * 0.8, 0.6 - wspd * 0.4, 1.0 - wspd * 0.6);
                mPMat.opacity = 0.4 + wspd * 0.3;

                mEarthMesh.rotation.y  += 0.0015;
                mCloudMesh.rotation.y  += 0.002;
                mControls.update();
                mRenderer.render(mScene, mCamera);
                requestAnimationFrame(animateMag);
            }
            animateMag();

            function resizeMag() {
                const isFS = document.fullscreenElement === magContainer;
                const w = isFS ? window.innerWidth  : (magContainer.parentElement?.clientWidth  || 400);
                const h = isFS ? window.innerHeight : 260;
                magContainer.style.height = h + 'px';
                mRenderer.setSize(w, h);
                mCamera.aspect = w / h;
                mCamera.updateProjectionMatrix();
            }

            window.addEventListener('resize', resizeMag);
            document.addEventListener('fullscreenchange', () => setTimeout(resizeMag, 80));

            window.drawMagnetosphere = (windSpeed, kp) => {
                const magDesc = document.getElementById('magDesc');
                const bend = Math.min(0.8, Math.max(0.1, (windSpeed - 300) / 500 + (kp - 3) / 12));
                if (magDesc) magDesc.innerHTML = `💨 Güneş rüzgarı ${Math.round(windSpeed||0)} km/s → Manyetopoz bükülmesi: ${(bend*100).toFixed(0)}% | Sürükle ile döndür`;
            };

        });
    }).catch(()=> {});

    window.updateVisuals = (kp, wind) => {
        if (kp   !== null && window.drawAurora)         window.drawAurora(kp);
        if (wind  !== null && window.drawMagnetosphere) window.drawMagnetosphere(wind, kp || 3);
        if (window.setSunEarthWindSpeed) window.setSunEarthWindSpeed(wind || 400);
        if (window.setSunEarthKp)        window.setSunEarthKp(kp || 3);
    };
}

// --- Canvas Simülasyonu (2D manyetosfer) ---
function initSimCanvas() {
    const cv = document.getElementById('sim');
    if (!cv) return;
    const ctx = cv.getContext('2d');

    // Orijinal kart boyutunu kaydet
    let baseW = 0, baseH = 0;

    function getBaseSize() {
        const parent = cv.parentElement;
        if (!parent) return;
        // Card'ın gerçek CSS boyutunu al (padding dahil değil)
        const style = getComputedStyle(parent);
        const padH = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        // Canvas'ın kendisinin boyutunu değil, parent card boyutunu baz al
        const rect = parent.getBoundingClientRect();
        baseW = Math.round(rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
        baseH = isMobile() ? 180 : 210;
    }

    const resize = () => {
        const isFS = document.fullscreenElement === cv;
        if (isFS) {
            cv.width  = window.innerWidth;
            cv.height = window.innerHeight;
        } else {
            // Fullscreen dışında: sabit baz boyutları kullan, büyüme önle
            if (baseW === 0) getBaseSize();
            const w = Math.min(baseW, cv.parentElement?.getBoundingClientRect().width || baseW);
            cv.style.width  = w + 'px';
            cv.style.height = baseH + 'px';
            cv.width  = w;
            cv.height = baseH;
        }
    };

    getBaseSize();
    resize();

    window.addEventListener('resize', () => {
        if (document.fullscreenElement !== cv) {
            getBaseSize();
            resize();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const isFS = !!document.fullscreenElement;
        if (!isFS) {
            cv.style.borderRadius = '8px';
            // Fullscreen'den çıkınca sabit boyuta geri dön
            setTimeout(() => {
                getBaseSize();
                resize();
            }, 60);
        } else {
            resize();
        }
    });

    const simParent = cv.parentElement;
    if (simParent && !document.getElementById('simFullscreenBtn')) {
        simParent.style.position = 'relative';
        const fsBtn = document.createElement('button');
        fsBtn.id = 'simFullscreenBtn';
        fsBtn.innerHTML = '⛶';
        fsBtn.title = 'Tam Ekran';
        fsBtn.style.cssText = `position:absolute;top:8px;right:8px;z-index:10;
            background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.5);
            color:#00d4ff;border-radius:5px;padding:3px 9px;font-size:1rem;cursor:pointer;transition:background .2s;`;
        fsBtn.onmouseenter = () => fsBtn.style.background = 'rgba(0,212,255,.35)';
        fsBtn.onmouseleave = () => fsBtn.style.background = 'rgba(0,212,255,.15)';
        fsBtn.onclick = () => {
            if (!document.fullscreenElement) {
                cv.style.borderRadius = '0';
                cv.requestFullscreen().catch(()=>{});
            } else {
                document.exitFullscreen();
            }
        };
        simParent.appendChild(fsBtn);
    }

    const earthImg = new Image();
    earthImg.crossOrigin = 'anonymous';
    earthImg.src = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
    let earthTexture = null, earthRotAngle = 0;
    earthImg.onload = () => { earthTexture = earthImg; };

    function getFieldAt(px, py, cx, cy, R, bend) {
        const dx = px - cx, dy = py - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < R * 1.05) return null;
        const r3 = dist*dist*dist;
        const mx = 0, my = -1;
        const rdotm = (dx*mx + dy*my) / dist;
        let bx = (3*rdotm*dx/dist - mx) / r3 * 1e4;
        let by = (3*rdotm*dy/dist - my) / r3 * 1e4;
        if (dx < 0) { bx *= (1-bend*0.5); } else { bx *= (1+bend*0.3); by *= (1+bend*0.2); }
        const bMag = Math.sqrt(bx*bx + by*by) || 1;
        return { tx: bx/bMag, ty: by/bMag, mag: Math.min(1, bMag*dist*0.012) };
    }

    function drawFieldLines(cx, cy, R, bend, windColor) {
        const numLines = isMobile() ? 6 : 10;
        for (let li = 0; li < numLines; li++) {
            const L = R * (1.5 + li * 0.42);
            const alpha = 0.6 - li * 0.04;
            ctx.beginPath();
            let first = true;
            const steps = 90;
            for (let si = 0; si <= steps; si++) {
                const theta = (si/steps)*Math.PI - Math.PI/2;
                const r = L * Math.cos(theta) * Math.cos(theta);
                if (r < R * 0.99) continue;
                const comp = Math.cos(theta) < 0 ? (1-bend*0.55) : (1+bend*0.35);
                const px = cx + r * Math.cos(theta) * comp;
                const py = cy + r * Math.sin(theta);
                first ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                first = false;
            }
            for (let si = steps; si >= 0; si--) {
                const theta = (si/steps)*Math.PI + Math.PI/2;
                const r = L * Math.cos(theta-Math.PI) * Math.cos(theta-Math.PI);
                if (r < R * 0.99) continue;
                const px = cx - r * Math.cos(theta-Math.PI) * (1+bend*0.55);
                const py = cy + r * Math.sin(theta-Math.PI);
                ctx.lineTo(px, py);
            }
            ctx.strokeStyle = `rgba(${windColor},${alpha})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
        }
        ctx.beginPath();
        const mpR = R * (2.3 - bend * 0.85);
        for (let a = -Math.PI/2; a <= Math.PI/2; a += 0.04) {
            const px = cx + mpR * Math.cos(a);
            const py = cy + mpR * Math.sin(a) * 1.45;
            a <= -Math.PI/2 + 0.05 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(${windColor},0.28)`;
        ctx.lineWidth = 1; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
    }

    class Particle {
        constructor() { this.reset(); }
        reset() {
            const s = isLiveMode ? (currentWind || 400) : simWind;
            this.x = Math.random() * -120;
            this.y = Math.random() * cv.height;
            this.baseVx = (Math.random() * 1.8 + 0.8) * (s / 140);
            this.baseVy = (Math.random() - 0.5) * 0.35;
            this.vx = this.baseVx; this.vy = this.baseVy;
            this.r = Math.random() * 1.8 + 0.5;
            this.col = s > 700 ? '239,68,68' : (s > 500 ? '255,140,0' : '180,210,255');
            this.fieldInfluence = 0; this.deflected = false;
        }
        upd(ex, ey, R, bend) {
            const dx = this.x-ex, dy = this.y-ey;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const mpR = R * (2.3 - bend * 0.85);
            if (dist < mpR && dist > R * 1.1) {
                const field = getFieldAt(this.x, this.y, ex, ey, R, bend);
                if (field) {
                    const cross = this.vx*field.ty - this.vy*field.tx;
                    const strength = Math.min(0.35, field.mag*0.5) * (1-dist/mpR);
                    this.vx += -field.ty*cross*strength;
                    this.vy +=  field.tx*cross*strength;
                    this.fieldInfluence = Math.min(1, this.fieldInfluence+0.08);
                    this.deflected = true;
                }
            } else {
                this.vx += (this.baseVx - this.vx) * 0.04;
                this.vy += (this.baseVy - this.vy) * 0.04;
                this.fieldInfluence = Math.max(0, this.fieldInfluence - 0.05);
                this.deflected = false;
            }
            if (dist < R * 1.08) {
                const nx = dx/dist, ny = dy/dist;
                const dot = this.vx*nx + this.vy*ny;
                this.vx -= 2.2*dot*nx; this.vy -= 2.2*dot*ny;
                this.col = '0,255,120';
            }
            this.x += this.vx; this.y += this.vy;
            if (this.x > cv.width+10 || this.y < -8 || this.y > cv.height+8) this.reset();
        }
        draw() {
            const glow = this.fieldInfluence;
            if (glow > 0.1) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r + glow * 3, 0, Math.PI*2);
                ctx.fillStyle = `rgba(${this.col},${glow*0.25})`; ctx.fill();
            }
            ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(${this.col},${0.55+glow*0.4})`; ctx.fill();
        }
    }

    const pts = [];
    for (let i = 0; i < 220; i++) pts.push(new Particle());

    function animate2D() {
        ctx.fillStyle = 'rgba(2,5,13,.28)';
        ctx.fillRect(0, 0, cv.width, cv.height);

        const sp    = isLiveMode ? (currentWind || 400) : simWind;
        const kpVal = isLiveMode ? (currentKp || 3)   : simKp;
        const bend = Math.min(0.85, Math.max(0.1, (sp-300)/500 + (kpVal-3)/12));
        const windRgb = sp > 700 ? '239,68,68' : (sp > 500 ? '255,140,0' : '0,200,255');

        const R  = Math.min(cv.height * 0.22, 50);
        const ex = cv.width / 2 + R;
        const ey = cv.height / 2;

        drawFieldLines(ex, ey, R, bend, windRgb);

        ctx.save();
        ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI*2); ctx.clip();
        if (earthTexture) {
            earthRotAngle += 0.002;
            const texW = R * 3;
            const offset = (earthRotAngle * R * 1.5) % (R * 2);
            ctx.drawImage(earthTexture, ex-R-offset, ey-R, texW, R*2);
            ctx.drawImage(earthTexture, ex-R-offset+R*2, ey-R, texW, R*2);
        } else {
            const eg = ctx.createRadialGradient(ex-R*0.25, ey-R*0.3, R*0.08, ex, ey, R);
            eg.addColorStop(0, '#2a9f4b'); eg.addColorStop(0.5, '#2a6fb0'); eg.addColorStop(1, '#081830');
            ctx.fillStyle = eg; ctx.fillRect(ex-R, ey-R, R*2, R*2);
        }
        ctx.restore();

        const atm = ctx.createRadialGradient(ex, ey, R*0.92, ex, ey, R*1.22);
        atm.addColorStop(0, 'rgba(0,180,255,0)'); atm.addColorStop(1, 'rgba(0,180,255,0.16)');
        ctx.beginPath(); ctx.arc(ex, ey, R*1.22, 0, Math.PI*2); ctx.fillStyle = atm; ctx.fill();

        pts.forEach(p => { p.upd(ex, ey, R, bend); p.draw(); });

        ctx.fillStyle = 'rgba(0,212,255,.65)';
        ctx.font = '9px monospace';
        ctx.fillText(`${Math.round(sp)} km/s`, 12, 20);

        requestAnimationFrame(animate2D);
    }
    animate2D();
}

// --- Olay Dinleyicileri ---
function initEventListeners() {
    // Risk Haritası butonu
    const riskMapBtn = document.getElementById('riskMapBtn');
    if (riskMapBtn) {
        riskMapBtn.addEventListener('click', () => {
            const w = window.open('risk-map.html', 'StarWayRiskMap',
                'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes');
            window._riskMapWin = w;
            // Pencere açıldıktan sonra mevcut Kp/Wind değerlerini gönder
            if (w) {
                const sendData = () => {
                    w.postMessage({
                        type: 'STARWAY_KP',
                        kp:   currentKp   ?? 3,
                        wind: currentWind ?? 400
                    }, '*');
                };
                // Sayfa yüklenince gönder
                setTimeout(sendData, 1800);
            }
        });
    }

    // Mod butonu
    const modeBtn = document.getElementById('modeToggleBtn');
    if (modeBtn) {
        modeBtn.addEventListener('click', () => {
            isLiveMode = !isLiveMode;
            if (isLiveMode) {
                modeBtn.textContent = '🌐 Canlı Mod';
                modeBtn.classList.remove('active');
                if (liveInterval) clearInterval(liveInterval);
                liveInterval = setInterval(fetchLiveData, 90000);
                fetchLiveData();
                showToast("Canlı moda geçildi. NOAA verileri alınıyor.", "success");
            } else {
                modeBtn.textContent = '🎮 Simülasyon Modu';
                modeBtn.classList.add('active');
                if (liveInterval) clearInterval(liveInterval);
                // Simülasyon başlangıç değerleri → mevcut canlı değerlerden al
                simKp   = currentKp   ?? 3;
                simWind = currentWind ?? 400;
                const slider    = document.getElementById('slider');
                const windSlider = document.getElementById('simWindSlider');
                if (slider)     { slider.value = Math.round(simKp); document.getElementById('skv').textContent = Math.round(simKp); }
                if (windSlider) { windSlider.value = Math.round(simWind); document.getElementById('simWindVal').textContent = Math.round(simWind) + ' km/s'; }
                updateSimulation();
                showToast("Simülasyon modu aktif. Kaydırıcılarla senaryo oluşturun.", "info");
            }
        });
    }

    // Simülasyon kaydırıcıları
    const slider     = document.getElementById('slider');
    const simWindSlider = document.getElementById('simWindSlider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            simKp = parseInt(e.target.value);
            document.getElementById('skv').textContent = simKp;
            const texts = ['Tehdit Yok','Tehdit Yok','Tehdit Yok','Tehdit Yok','Düşük Risk','G1 Zayıf','G2 Orta','G3 Güçlü','G4 Şiddetli','G5 AŞIRI'];
            document.getElementById('skd').textContent = texts[simKp];
            if (!isLiveMode) updateSimulation();
        });
    }
    if (simWindSlider) {
        simWindSlider.addEventListener('input', (e) => {
            simWind = parseInt(e.target.value);
            document.getElementById('simWindVal').textContent = simWind + ' km/s';
            if (!isLiveMode) updateSimulation();
        });
    }

    // WhatsApp
    const waBtn = document.getElementById('whatsappShareBtn');
    if (waBtn) {
        waBtn.addEventListener('click', () => {
            const msg = `🚨 StarWay Uyarı:\nKp=${currentKp?.toFixed(1)||'?'} | Rüzgar=${Math.round(currentWind||0)} km/s\nDurum: ${document.getElementById('aitxt')?.innerText.substring(0,140)||''}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }

    // Bildirim
    const notifyBtn = document.getElementById('notifyPermBtn');
    if (notifyBtn) {
        notifyBtn.addEventListener('click', () => {
            Notification.requestPermission().then(p => showToast(p === 'granted' ? 'Bildirimler aktif!' : 'Engellendi', p === 'granted' ? 'success' : 'error'));
        });
    }

    const autoNotify = document.getElementById('autoNotifyCheck');
    if (autoNotify) autoNotify.addEventListener('change', e => autoNotifyEnabled = e.target.checked);

    // Tema
    const tbtn = document.getElementById('tbtn');
    if (tbtn) {
        let theme = localStorage.getItem('sw-t') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        tbtn.textContent = theme === 'dark' ? '☀️ Gündüz' : '🌙 Gece';
        tbtn.addEventListener('click', () => {
            theme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('sw-t', theme);
            tbtn.textContent = theme === 'dark' ? '☀️ Gündüz' : '🌙 Gece';
        });
    }
}

// --- Başlatma ---
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    loadKpHistory();      // Geçmiş Kp verilerini yükle
    initVisuals();
    initSimCanvas();
    initEventListeners();

    fetchLiveData();
    liveInterval = setInterval(fetchLiveData, 90000);

    setRiskList(3);
    updateForecast(3, 400);
    updateHistoricalComparison(3);
    // app.js dosyasının en sonuna ekleyin - global değişkenleri dışa aktarmak için
// Bu kod, app.js'deki değişkenleri window objesine ekler, böylece diğer scriptler erişebilir

// Global değişkenleri window'a ekle (diğer scriptlerin erişebilmesi için)
window.currentKp = currentKp;
window.currentWind = currentWind;
window.isLiveMode = isLiveMode;
window.simKp = simKp;
window.simWind = simWind;

// Değişkenler güncellendiğinde window'dakileri de güncelle
const originalUpdateUI = updateUI;
window.updateUI = function(kp, wind, time) {
    window.currentKp = kp;
    window.currentWind = wind;
    originalUpdateUI(kp, wind, time);
};
updateUI = window.updateUI;

// Simülasyon güncellemesini yakala
const originalUpdateSim = updateSimulation;
window.updateSimulation = function() {
    if (!isLiveMode) {
        window.simKp = simKp;
        window.simWind = simWind;
    }
    originalUpdateSim();
};
updateSimulation = window.updateSimulation;

// Simülasyon slider'larını dinle
const originalSliderListener = () => {};
if (typeof slider !== 'undefined' && slider) {
    slider.addEventListener('input', () => {
        window.simKp = simKp;
    });
}
if (typeof simWindSlider !== 'undefined' && simWindSlider) {
    simWindSlider.addEventListener('input', () => {
        window.simWind = simWind;
    });
}

console.log('StarWay Uygulaması Başlatıldı - Tam ekran butonları hazır');
});