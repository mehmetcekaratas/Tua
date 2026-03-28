// js/app.js - DÜZELTİLMİŞ VERSİYON
// ==========================================
// Tüm Frontend Mantığı (API, Three.js, Grafik, Simülasyon) - RESPONSIVE VERSİYON
// ==========================================

// --- Global Değişkenler ---
let currentKp = null, currentWind = null, currentTime = '--:-- UTC';
let selectedProfile = 'ogrenci';
let autoNotifyEnabled = false;
let lastNotifiedKp = -1;
let isLiveMode = true;
let liveInterval = null;
let simKp = 3, simWind = 400;

// API URL (Backend adresiniz)
const API_BASE = "http://127.0.0.1:8000";

// --- Responsive yardımcı fonksiyonlar ---
function isMobile() {
    return window.innerWidth <= 768;
}

// --- Yardımcı Fonksiyonlar ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

// Kp değerine göre seviye ve renk döndürür
function getKpAnalysis(kp) {
    if (kp === null || isNaN(kp)) return { level: 'Bilinmiyor', risk: 'Veri Yok', color: 'var(--muted)', g: 'G?' };
    if (kp < 4) return { level: 'Normal', risk: 'Tehdit Yok', color: 'var(--green)', g: 'G0' };
    if (kp < 5) return { level: 'Aktif', risk: 'Düşük', color: 'var(--yellow)', g: 'G0' };
    if (kp < 6) return { level: 'G1 Zayıf', risk: 'Şebeke dalgalanmaları', color: 'var(--orange)', g: 'G1' };
    if (kp < 7) return { level: 'G2 Orta', risk: 'Uydu sürüklenme', color: 'var(--orange)', g: 'G2' };
    if (kp < 8) return { level: 'G3 Güçlü', risk: 'GPS kesintileri', color: 'var(--red)', g: 'G3' };
    if (kp < 9) return { level: 'G4 Şiddetli', risk: 'Voltaj sorunları', color: 'var(--red)', g: 'G4' };
    return { level: 'G5 AŞIRI', risk: 'Şebeke çökme', color: 'var(--purple)', g: 'G5' };
}

// --- UI Güncellemeleri ---
function updateUI(data) {
    if (!data) return;
    const kp = data.kp_degeri;
    const wind = data.ruzgar_hizi;
    const time = data.zaman_damgasi?.split(' ')[1]?.substring(0,5) || '--:--';
    const kpAnalysis = getKpAnalysis(kp);
    const alarm = kp >= 5;

    currentKp = kp; currentWind = wind; currentTime = time;

    // Üst Hero
    document.getElementById('h-kp').textContent = kp?.toFixed(1) || '—';
    document.getElementById('h-wind').textContent = wind ? Math.round(wind) : '—';
    document.getElementById('bstatus').textContent = alarm ? '🚨 FIRTINA ALARMI' : '✅ SİSTEM NORMAL';
    document.getElementById('btime').textContent = time || '—';
    document.getElementById('badge').className = 'badge ' + (alarm ? 's-alarm' : 's-normal');
    document.getElementById('liveDataBadge').innerHTML = isLiveMode ? "🌐 CANLI NOAA" : "🎮 SIM MODU";

    // Kp kartı
    const kpBig = document.getElementById('kpn');
    kpBig.textContent = kp?.toFixed(1) || '—';
    kpBig.style.color = kpAnalysis.color;
    document.getElementById('gbadge').textContent = kpAnalysis.g;
    document.getElementById('klevel').textContent = kpAnalysis.level;
    document.getElementById('krisk').textContent = kpAnalysis.risk;

    // Gauge çizimi (SVG - sabit koordinatlar, responsive değil)
    if (kp !== null && !isNaN(kp)) {
        const norm = Math.min(kp / 9, 1);
        const arc = 251;
        const gaugeFill = document.getElementById('gfill');
        if (gaugeFill) {
            gaugeFill.setAttribute('stroke-dasharray', `${norm * arc} ${arc}`);
        }
        const ang = (180 - norm * 180) * Math.PI / 180;
        const R = 80, cx = 100, cy = 108;
        const needle = document.getElementById('gneedle');
        if (needle) {
            needle.setAttribute('cx', cx + R * Math.cos(ang));
            needle.setAttribute('cy', cy - R * Math.sin(ang));
        }
    }

    // Rüzgar
    const windStatus = wind ? (wind < 400 ? 'Sakin' : (wind < 600 ? 'Hızlı' : (wind < 800 ? 'Fırtına' : 'Tehlikeli'))) : '?';
    const windColor = wind ? (wind < 400 ? 'var(--green)' : (wind < 600 ? 'var(--yellow)' : (wind < 800 ? 'var(--orange)' : 'var(--red)'))) : 'gray';
    document.getElementById('windn').textContent = wind ? Math.round(wind) : '—';
    const wbar = document.getElementById('wbar');
    if (wbar) wbar.style.width = Math.min(100, (wind || 0) / 10) + '%';
    const wBadge = document.getElementById('wbadge');
    if (wBadge) {
        wBadge.textContent = windStatus;
        wBadge.style.borderColor = windColor;
        wBadge.style.color = windColor;
    }

    // AI yorumu
    document.getElementById('aitxt').textContent = data.ai_analizi || "Profil analizi yapılıyor...";

    // Risk listesi
    setRiskList(kp);

    // Grafik (isLiveMode kontrolü kaldırıldı, canlı modda her zaman güncellensin)
    if (time && kp !== null) {
        updateChart(time, kp);
    }

    // Görsel efektler
    if (window.updateVisuals) window.updateVisuals(kp, wind);

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
    const risks = k < 4 ? [{ n: 'Arktik Çember', c: 'var(--green)' }, { n: 'Kuzey Işıkları sınırlı', c: 'var(--cyan)' }] :
        (k < 6 ? [{ n: 'Alaska, İskandinavya', c: 'var(--yellow)' }, { n: 'Aurora olasılığı artıyor', c: 'var(--cyan)' }] :
            (k < 8 ? [{ n: 'ABD Kuzey, Kuzey Avrupa', c: 'var(--orange)' }, { n: 'GPS etkilenebilir', c: 'var(--red)' }] :
                [{ n: 'TÜRKİYE DAHİL Orta Kuşak', c: 'var(--purple)' }, { n: 'Küresel uydu tehdidi', c: 'var(--red)' }]));
    const rlist = document.getElementById('rlist');
    if (rlist) {
        rlist.innerHTML = risks.map(r => `<div class="ri"><div class="ri-dot" style="background:${r.c}"></div><span>${r.n}</span></div>`).join('');
    }
}

function updateForecast(kp, wind) {
    const forecastDiv = document.getElementById('forecastText');
    if (!kp) { if (forecastDiv) forecastDiv.innerHTML = 'Veri bekleniyor...'; return; }
    let trend = kp < 3 ? 'Sakin devam edecek' : (kp < 5 ? 'Aktif, hafif dalgalanmalar' : (kp < 7 ? 'Fırtına seviyesinde, GPS etkilenebilir' : 'Şiddetli fırtına, iletişim kesintileri bekleniyor'));
    if (forecastDiv) {
        forecastDiv.innerHTML = `📈 Son ölçümlere göre: ${trend}. Güneş rüzgarı ${Math.round(wind || 0)} km/s. Önümüzdeki 24 saatte Kp değerinin ${Math.min(9, Math.max(0, kp + (Math.random() - 0.5) * 1.5)).toFixed(1)} civarında seyretmesi bekleniyor.`;
    }
}

function updateHistoricalComparison(kp) {
    const container = document.getElementById('histContainer');
    const curKp = kp !== null ? kp : 2.5;
    const storms = [
        { name: "Carrington 1859", kp: 9.0, effect: "Telgraf sistemleri yandı" },
        { name: "Mart 1989", kp: 9.0, effect: "Quebec şebekesi çöktü" },
        { name: "Halloween 2003", kp: 9.0, effect: "Uydular hasar gördü" }

    ];
    if (container) {
        container.innerHTML = storms.map(s => `<div class="hist-item"><strong>${s.name}</strong><br>Kp: ${s.kp}<br><span style="font-size:.65rem">${s.effect}</span></div>`).join('') +
            `<div class="hist-item"><strong>📌 Şu An</strong><br>Kp: ${curKp.toFixed(1)}<br><span style="font-size:.65rem">${curKp >= 7 ? "Şiddetli fırtına" : (curKp >= 5 ? "Orta fırtına" : "Normal")}</span></div>`;
    }
    const compText = document.getElementById('compText');
    if (compText) {
        compText.innerHTML = curKp >= 7 ? "⚠️ Güncel fırtına, büyük tarihi olaylara yaklaşıyor!" : (curKp >= 5 ? "⚡ 1989 ve 2003 fırtınalarına benzer seviyede." : "✅ Tarihi büyük fırtınalardan düşük seviyede.");
    }
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
                label: 'Kp (Canlı)',
                data: cd,
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0,212,255,.07)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: '#00d4ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 9,
                    title: { display: true, text: 'Kp İndeksi', color: '#88aadd' }
                },
                x: {
                    title: { display: true, text: 'Zaman', color: '#88aadd' }
                }
            },
            plugins: {
                legend: { labels: { color: '#88aadd' } }
            }
        }
    });
}

function updateChart(lbl, val) {
    // Canlı modda her zaman grafiği güncelle
    if (val === null || val === undefined) return;

    // Etiketi kısalt (sadece saat:dakika)
    const shortLabel = lbl.length > 5 ? lbl.substring(0, 5) : lbl;
    cl.push(shortLabel);
    cd.push(val);

    // Son 20 veriyi tut
    if (cl.length > 20) {
        cl.shift();
        cd.shift();
    }

    if (chart) {
        chart.data.labels = [...cl];
        chart.data.datasets[0].data = [...cd];
        chart.update();
    }
}

// --- API Veri Çekme ---
async function fetchLiveData() {
    if (!isLiveMode) return;
    try {
        const url = `${API_BASE}/api/durum?profile=${selectedProfile}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("API Hatası");
        const data = await response.json();
        updateUI(data);
        setConn(true, "NOAA Canlı");
        updateForecast(data.kp_degeri, data.ruzgar_hizi);
        updateHistoricalComparison(data.kp_degeri);
        if (window.updateVisuals) window.updateVisuals(data.kp_degeri, data.ruzgar_hizi);
    } catch (error) {
        console.error("Veri çekme hatası:", error);
        setConn(false, "Bağlantı Hatası!");
        showToast("Backend API'ye bağlanılamıyor. Lütfen sunucuyu başlatın.", "error");
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
    const kp = simKp;
    const wind = simWind;
    const kpAnalysis = getKpAnalysis(kp);
    const alarm = kp >= 5;

    // UI'ı simülasyon verileriyle güncelle
    document.getElementById('h-kp').textContent = kp.toFixed(1);
    document.getElementById('h-wind').textContent = Math.round(wind);
    document.getElementById('bstatus').textContent = alarm ? '🚨 FIRTINA ALARMI (SIM)' : '✅ SİSTEM NORMAL (SIM)';
    document.getElementById('btime').textContent = 'SIM MODE';
    document.getElementById('badge').className = 'badge ' + (alarm ? 's-alarm' : 's-normal');
    document.getElementById('liveDataBadge').innerHTML = "🎮 SIM MODU";

    const kpBig = document.getElementById('kpn');
    kpBig.textContent = kp.toFixed(1);
    kpBig.style.color = kpAnalysis.color;
    document.getElementById('gbadge').textContent = kpAnalysis.g;
    document.getElementById('klevel').textContent = kpAnalysis.level;
    document.getElementById('krisk').textContent = kpAnalysis.risk;

    // Gauge
    const norm = Math.min(kp / 9, 1);
    const arc = 251;
    const gaugeFill = document.getElementById('gfill');
    if (gaugeFill) {
        gaugeFill.setAttribute('stroke-dasharray', `${norm * arc} ${arc}`);
    }
    const ang = (180 - norm * 180) * Math.PI / 180;
    const R = 80, cx = 100, cy = 108;
    const needle = document.getElementById('gneedle');
    if (needle) {
        needle.setAttribute('cx', cx + R * Math.cos(ang));
        needle.setAttribute('cy', cy - R * Math.sin(ang));
    }

    // Rüzgar
    const windStatus = wind < 400 ? 'Sakin' : (wind < 600 ? 'Hızlı' : (wind < 800 ? 'Fırtına' : 'Tehlikeli'));
    const windColor = wind < 400 ? 'var(--green)' : (wind < 600 ? 'var(--yellow)' : (wind < 800 ? 'var(--orange)' : 'var(--red)'));
    document.getElementById('windn').textContent = Math.round(wind);
    const wbar = document.getElementById('wbar');
    if (wbar) wbar.style.width = Math.min(100, wind / 10) + '%';
    const wBadge = document.getElementById('wbadge');
    if (wBadge) {
        wBadge.textContent = windStatus;
        wBadge.style.borderColor = windColor;
        wBadge.style.color = windColor;
    }

    // AI Yorumu (basit)
    let aiText = `SIM: Kp ${kp.toFixed(1)} - ${kpAnalysis.level}. `;
    if (kp < 4) aiText += "Sakin seviye. Profiliniz için önemli bir risk yok.";
    else if (kp < 6) aiText += "Hafif etkiler bekleniyor. Dikkatli olun.";
    else aiText += "ŞİDDETLİ FIRTINA! Önlem alın!";
    document.getElementById('aitxt').textContent = aiText;

    setRiskList(kp);
    updateForecast(kp, wind);
    updateHistoricalComparison(kp);
    if (window.updateVisuals) window.updateVisuals(kp, wind);
}

// --- Görsel Efektler (Three.js, Canvas) - Responsive ---
function initVisuals() {
    // ── Three.js 3D Sahne ──────────────────────────────────────────
    import('three').then((THREE) => {
        import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
            const container = document.getElementById('sunEarth3D');
            if (!container) return;

            // Responsive container yükseklik
            container.style.position = 'relative';
            container.style.background = '#000';
            container.style.height = isMobile() ? '250px' : '400px';
            container.style.borderRadius = '12px';
            container.style.overflow = 'hidden';

            // ── Simüle Et Butonu ──
            const simBtn = document.createElement('button');
            simBtn.id = 'sim3dBtn';
            simBtn.innerHTML = isMobile() ? '▶' : '▶ Simüle Et';
            simBtn.style.cssText = `
                position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
                z-index:20;padding:${isMobile() ? '6px 16px' : '8px 26px'};
                border-radius:8px;background:rgba(0,212,255,.18);
                border:1.5px solid #00d4ff;color:#00d4ff;
                font-family:'Rajdhani',sans-serif;font-size:${isMobile() ? '0.8rem' : '1rem'};
                font-weight:700;letter-spacing:2px;cursor:pointer;
                transition:all .2s;backdrop-filter:blur(8px);
                white-space:nowrap;`;
            simBtn.onmouseenter = () => { simBtn.style.background='rgba(0,212,255,.38)'; simBtn.style.color='#fff'; };
            simBtn.onmouseleave = () => { simBtn.style.background='rgba(0,212,255,.18)'; simBtn.style.color='#00d4ff'; };
            container.appendChild(simBtn);

            // ── Sağ Üst Kontrol Paneli (Başlangıçta gizli) ──
            const panel = document.createElement('div');
            panel.id = 'sim3dPanel';
            panel.style.cssText = `
                position:absolute;top:10px;right:10px;z-index:20;
                background:rgba(6,13,26,.92);border:1px solid rgba(0,212,255,.5);
                border-radius:12px;padding:${isMobile() ? '8px 12px' : '12px 16px'};
                min-width:${isMobile() ? '140px' : '170px'};
                backdrop-filter:blur(12px);font-family:'Space Mono',monospace;
                font-size:${isMobile() ? '0.6rem' : '0.7rem'};color:#5a7a9f;
                display:none;transition:opacity 0.2s;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
            panel.innerHTML = `
                <div style="color:#00d4ff;font-size:${isMobile() ? '0.65rem' : '0.72rem'};letter-spacing:2px;margin-bottom:8px;">⚙ KONTROL</div>
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
                <div style="margin-top:6px;font-size:${isMobile() ? '0.55rem' : '0.65rem'};color:#88aadd;border-top:1px solid rgba(0,212,255,.3);padding-top:4px;">
                    🧪 Simülasyon modunda<br>manuel ayarlar kullanılır
                </div>`;
            container.appendChild(panel);

            let panelKp = 3, panelWind = 400;
            const kpSlider = panel.querySelector('#p3dKp');
            const windSlider = panel.querySelector('#p3dWind');

            // Simüle Et butonuna tıklayınca paneli göster/gizle
            simBtn.onclick = () => {
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    if (isLiveMode) {
                        isLiveMode = false;
                        if (liveInterval) clearInterval(liveInterval);
                        const modeBtn = document.getElementById('modeToggleBtn');
                        if (modeBtn) {
                            modeBtn.textContent = '🎮 Simülasyon Modu';
                            modeBtn.classList.add('active');
                        }
                        updateSimulation();
                        showToast("3D Simülasyon kontrolü aktif. Kp ve rüzgarı manuel ayarlayın.", "info");
                    }
                } else {
                    panel.style.display = 'none';
                    if (!isLiveMode) {
                        isLiveMode = true;
                        if (liveInterval) clearInterval(liveInterval);
                        liveInterval = setInterval(fetchLiveData, 90000);
                        fetchLiveData();
                        const modeBtn = document.getElementById('modeToggleBtn');
                        if (modeBtn) {
                            modeBtn.textContent = '🌐 Canlı Mod';
                            modeBtn.classList.remove('active');
                        }
                        showToast("3D simülasyon kontrolü kapandı. Canlı NOAA verilerine dönüldü.", "success");
                    }
                }
                if (panel.style.display === 'block' && !isMobile()) {
                    container.requestFullscreen?.().catch(()=>{});
                }
            };

            kpSlider.addEventListener('input', e => {
                panelKp = parseFloat(e.target.value);
                panel.querySelector('#p3dKpVal').textContent = panelKp.toFixed(1);
                if (!isLiveMode) {
                    simKp = panelKp;
                    updateSimulation();
                }
                updateParticleColor();
            });

            windSlider.addEventListener('input', e => {
                panelWind = parseInt(e.target.value);
                panel.querySelector('#p3dWindVal').textContent = panelWind;
                currentWindSpeed = panelWind;
                if (!isLiveMode) {
                    simWind = panelWind;
                    updateSimulation();
                }
                updateParticleColor();
            });

            // ── Sahne ──
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 1.5, 9);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.1;

            // Temizle ve ekle
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            container.appendChild(renderer.domElement);
            container.appendChild(simBtn);
            container.appendChild(panel);

            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = isMobile() ? 3 : 4;
            controls.maxDistance = isMobile() ? 15 : 20;

            // Yıldız arka planı
            const starGeo = new THREE.BufferGeometry();
            const starCount = isMobile() ? 1500 : 3000;
            const starPos = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 400;
            starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
            scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: isMobile() ? 0.12 : 0.18, transparent: true, opacity: 0.7 })));

            const tl = new THREE.TextureLoader();

            // ── GÜNEŞ (sol) ──
            const SUN_X = isMobile() ? -2.5 : -3.2;
            const sunGeo = new THREE.SphereGeometry(isMobile() ? 1.0 : 1.3, 64, 64);
            const sunMat = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 }, kp: { value: 3.0 } },
                vertexShader: `
                    varying vec3 vNormal;
                    varying vec2 vUv;
                    void main() {
                        vNormal = normalize(normalMatrix * normal);
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: `
                    uniform float time;
                    uniform float kp;
                    varying vec3 vNormal;
                    varying vec2 vUv;

                    float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
                    float noise(vec2 p) {
                        vec2 i=floor(p), f=fract(p);
                        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
                        vec2 u=f*f*(3.-2.*f);
                        return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
                    }
                    float fbm(vec2 p) {
                        float v=0., a=.5;
                        for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.1; a*=.5; }
                        return v;
                    }
                    void main() {
                        vec2 uv = vUv * 4.0 + vec2(time * 0.04, time * 0.02);
                        float n = fbm(uv);
                        float n2 = fbm(uv * 1.8 + vec2(time*0.03));
                        float plasma = n * 0.6 + n2 * 0.4;

                        float act = clamp(kp / 9.0, 0.0, 1.0);
                        vec3 cCore  = vec3(1.0, 0.95, 0.6);
                        vec3 cMid   = mix(vec3(1.0,0.55,0.1), vec3(1.0,0.3,0.0), act);
                        vec3 cOuter = mix(vec3(0.8,0.2,0.0), vec3(1.0,0.0,0.3), act);

                        vec3 col = mix(cCore, cMid, plasma);
                        col = mix(col, cOuter, pow(plasma, 2.0) * (0.5 + act * 0.5));

                        float limb = dot(vNormal, vec3(0,0,1));
                        col *= 0.4 + 0.6 * limb;

                        float rim = 1.0 - clamp(limb, 0.0, 1.0);
                        col += vec3(1.0, 0.6, 0.1) * pow(rim, 3.0) * (0.8 + act * 0.8);

                        gl_FragColor = vec4(col, 1.0);
                    }`
            });
            const sunMesh = new THREE.Mesh(sunGeo, sunMat);
            sunMesh.position.set(SUN_X, 0, 0);
            scene.add(sunMesh);

            // Güneş corona
            const coronaGeo = new THREE.SphereGeometry(isMobile() ? 1.3 : 1.65, 32, 32);
            const coronaMat = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 }, kp: { value: 3.0 } },
                transparent: true, side: THREE.BackSide,
                vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                fragmentShader: `
                    uniform float time; uniform float kp; varying vec3 vNormal;
                    void main(){
                        float intensity = pow(0.55 - dot(vNormal, vec3(0,0,1)), 3.0);
                        float act = clamp(kp/9.0,0.,1.);
                        vec3 col = mix(vec3(1.,.6,.1), vec3(1.,.15,.0), act);
                        gl_FragColor = vec4(col, intensity * (0.6 + act * 0.5));
                    }`
            });
            const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
            coronaMesh.position.set(SUN_X, 0, 0);
            scene.add(coronaMesh);

            const coronaMesh2 = new THREE.Mesh(new THREE.SphereGeometry(isMobile() ? 1.7 : 2.1, 32, 32),
                new THREE.ShaderMaterial({
                    uniforms: { time: { value: 0 }, kp: { value: 3.0 } },
                    transparent: true, side: THREE.BackSide,
                    vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `uniform float kp; varying vec3 vNormal;
                        void main(){
                            float i=pow(0.4-dot(vNormal,vec3(0,0,1)),4.0);
                            float act=clamp(kp/9.,0.,1.);
                            vec3 c=mix(vec3(1.,.5,.05),vec3(.9,.1,.3),act);
                            gl_FragColor=vec4(c,i*(0.3+act*.4));
                        }`
                }));
            coronaMesh2.position.set(SUN_X, 0, 0);
            scene.add(coronaMesh2);

            // Güneş ışığı
            const sunLight = new THREE.PointLight(0xffcc88, isMobile() ? 2.5 : 3.5, 60);
            sunLight.position.set(SUN_X, 0, 0);
            scene.add(sunLight);
            scene.add(new THREE.AmbientLight(0x111122, 0.4));

            // ── DÜNYA (sağ) ──
            const EARTH_X = isMobile() ? 2.5 : 3.2;
            const earthGeo = new THREE.SphereGeometry(isMobile() ? 0.5 : 0.65, 64, 64);
            const earthMap  = tl.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
            const earthSpec = tl.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg');
            const earthMat  = new THREE.MeshPhongMaterial({ map: earthMap, specularMap: earthSpec, specular: new THREE.Color(0x224466), shininess: 18 });
            const earthMesh = new THREE.Mesh(earthGeo, earthMat);
            earthMesh.position.set(EARTH_X, 0, 0);
            earthMesh.rotation.z = 0.41;
            scene.add(earthMesh);

            // Bulut katmanı
            const cloudTex = tl.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png');
            const cloudMesh = new THREE.Mesh(
                new THREE.SphereGeometry(isMobile() ? 0.515 : 0.668, 64, 64),
                new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.28, depthWrite: false })
            );
            cloudMesh.position.set(EARTH_X, 0, 0);
            scene.add(cloudMesh);

            // Dünya atmosfer glow
            const atmMesh = new THREE.Mesh(
                new THREE.SphereGeometry(isMobile() ? 0.55 : 0.72, 32, 32),
                new THREE.ShaderMaterial({
                    transparent: true, side: THREE.BackSide,
                    vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `varying vec3 vNormal;
                        void main(){
                            float i=pow(0.6-dot(vNormal,vec3(0,0,1)),3.5);
                            gl_FragColor=vec4(0.15,0.55,1.0,i*0.7);
                        }`
                })
            );
            atmMesh.position.set(EARTH_X, 0, 0);
            scene.add(atmMesh);

            // ── PARTİKÜL AKIŞI ──
            const PCOUNT = isMobile() ? 800 : 1800;
            const pGeo = new THREE.BufferGeometry();
            const pPos  = new Float32Array(PCOUNT * 3);
            const pVel  = [];
            const pPhase = new Float32Array(PCOUNT);

            function resetParticle(i) {
                const spread = isMobile() ? 0.3 : 0.5;
                pPos[i*3]   = SUN_X + (isMobile() ? 1.1 : 1.35) + Math.random() * 0.1;
                pPos[i*3+1] = (Math.random() - 0.5) * spread;
                pPos[i*3+2] = (Math.random() - 0.5) * spread;
                const spd = (Math.random() * 0.015 + 0.008);
                pVel[i] = {
                    x: spd,
                    y: (Math.random() - 0.5) * 0.004,
                    z: (Math.random() - 0.5) * 0.004
                };
                pPhase[i] = Math.random() * Math.PI * 2;
            }
            for (let i = 0; i < PCOUNT; i++) {
                resetParticle(i);
                pPos[i*3] = SUN_X + (isMobile() ? 1.1 : 1.35) + Math.random() * (EARTH_X - SUN_X - 1.0);
            }
            pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
            pGeo.setAttribute('phase', new THREE.BufferAttribute(pPhase, 1));

            const pMat = new THREE.ShaderMaterial({
                uniforms: {
                    time:     { value: 0 },
                    windSpd:  { value: 400 },
                    kpVal:    { value: 3.0 },
                    size:     { value: (isMobile() ? 2.5 : 3.5) * renderer.getPixelRatio() }
                },
                vertexShader: `
                    attribute float phase;
                    uniform float time; uniform float windSpd; uniform float size;
                    varying float vAlpha; varying float vPhase;
                    void main(){
                        vPhase = phase;
                        float spd = windSpd / 400.0;
                        vAlpha = 0.4 + 0.5 * abs(sin(phase + time * spd));
                        vec4 mv = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = size * (1.0 + 0.3 * sin(phase + time));
                        gl_Position = projectionMatrix * mv;
                    }`,
                fragmentShader: `
                    uniform float kpVal; uniform float windSpd;
                    varying float vAlpha; varying float vPhase;
                    void main(){
                        float d = length(gl_PointCoord - 0.5);
                        if(d > 0.5) discard;
                        float soft = 1.0 - d * 2.0;
                        float act = clamp(kpVal / 9.0, 0.0, 1.0);
                        float spd = clamp((windSpd - 200.0) / 1000.0, 0.0, 1.0);
                        vec3 c1 = vec3(0.4, 0.75, 1.0);
                        vec3 c2 = vec3(1.0, 0.55, 0.1);
                        vec3 c3 = vec3(1.0, 0.1,  0.1);
                        vec3 col = mix(mix(c1, c2, spd), c3, act * 0.7);
                        gl_FragColor = vec4(col, vAlpha * soft * 0.9);
                    }`,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const pSystem = new THREE.Points(pGeo, pMat);
            scene.add(pSystem);

            let currentWindSpeed = 400;
            let t = 0;

            function updateParticleColor() {
                pMat.uniforms.kpVal.value  = panelKp;
                pMat.uniforms.windSpd.value = panelWind;
                sunMat.uniforms.kp.value   = panelKp;
                coronaMat.uniforms.kp.value = panelKp;
                coronaMesh2.material.uniforms.kp.value = panelKp;
                currentWindSpeed = panelWind;
            }

            function animateParticles() {
                const spd = Math.min(3.0, Math.max(0.4, currentWindSpeed / 350));
                for (let i = 0; i < PCOUNT; i++) {
                    pPos[i*3]   += pVel[i].x * spd;
                    pPos[i*3+1] += pVel[i].y * spd;
                    pPos[i*3+2] += pVel[i].z * spd;

                    const dx = pPos[i*3] - EARTH_X;
                    const dy = pPos[i*3+1];
                    const dz = pPos[i*3+2];
                    const distEarth = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    const kpFactor = Math.min(3.0, Math.max(0.5, panelKp / 3));
                    const magnetopause = 1.4 / kpFactor;

                    if (distEarth < magnetopause) {
                        const nx = dx / distEarth, ny = dy / distEarth;
                        pVel[i].x -= nx * 0.004;
                        pVel[i].y += ny < 0 ? 0.003 : -0.003;
                        if (distEarth < (isMobile() ? 0.5 : 0.7)) resetParticle(i);
                    }
                    if (pPos[i*3] > EARTH_X + 1.5 || pPos[i*3] < SUN_X + (isMobile() ? 1.0 : 1.2)) resetParticle(i);
                }
                pGeo.attributes.position.needsUpdate = true;
            }

            function animate() {
                t += 0.016;
                sunMat.uniforms.time.value   = t;
                coronaMat.uniforms.time.value = t;
                pMat.uniforms.time.value      = t;
                pMat.uniforms.windSpd.value   = currentWindSpeed;

                sunMesh.rotation.y += 0.003;
                earthMesh.rotation.y += 0.0018;
                cloudMesh.rotation.y += 0.0022;

                animateParticles();
                controls.update();
                renderer.render(scene, camera);
                requestAnimationFrame(animate);
            }
            animate();

            window.addEventListener('resize', () => {
                const w = container.clientWidth, h = container.clientHeight;
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            });

            window.setSunEarthWindSpeed = (spd) => {
                currentWindSpeed = spd || 400;
                pMat.uniforms.windSpd.value = currentWindSpeed;
                if (!isLiveMode && windSlider) {
                    windSlider.value = currentWindSpeed;
                    panel.querySelector('#p3dWindVal').textContent = Math.round(currentWindSpeed);
                }
            };

            window.setSunEarthKp = (kp) => {
                panelKp = kp || 3;
                sunMat.uniforms.kp.value = panelKp;
                coronaMat.uniforms.kp.value = panelKp;
                coronaMesh2.material.uniforms.kp.value = panelKp;
                pMat.uniforms.kpVal.value = panelKp;
                if (!isLiveMode && kpSlider) {
                    kpSlider.value = panelKp;
                    panel.querySelector('#p3dKpVal').textContent = panelKp.toFixed(1);
                }
            };
        });
    }).catch(err => console.error("Three.js yüklenemedi:", err));

    // Aurora Canvas
    const auroraCanvas = document.getElementById('auroraCanvas');
    if (auroraCanvas) {
        window.drawAurora = (kp) => {
            const ctx = auroraCanvas.getContext('2d');
            const w = auroraCanvas.clientWidth, h = auroraCanvas.clientHeight;
            auroraCanvas.width = w; auroraCanvas.height = h;
            ctx.clearRect(0, 0, w, h);
            const centerX = w / 2, centerY = h / 2 + (isMobile() ? 5 : 10);
            const radius = Math.min(w, h) * (isMobile() ? 0.3 : 0.35);
            ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = '#1a3355'; ctx.fill();
            ctx.strokeStyle = '#5a9eff'; ctx.stroke();
            const k = Math.min(1, Math.max(0.2, kp / 9));
            const ovalW = radius * (0.6 + k * 0.5);
            const ovalH = radius * (0.4 + k * 0.3);
            ctx.beginPath();
            ctx.ellipse(centerX, centerY - radius * 0.15, ovalW, ovalH, 0, 0, 2 * Math.PI);
            const grad = ctx.createLinearGradient(centerX - ovalW, centerY, centerX + ovalW, centerY);
            grad.addColorStop(0, `rgba(0,255,100,${0.3 + k * 0.5})`);
            grad.addColorStop(0.5, `rgba(100,255,100,${0.5 + k * 0.4})`);
            grad.addColorStop(1, `rgba(255,100,200,${0.4 + k * 0.4})`);
            ctx.fillStyle = grad; ctx.fill();
            ctx.fillStyle = '#fff9c4';
            ctx.font = `bold ${isMobile() ? 10 : 12}px monospace`;
            ctx.fillText(`Kp=${kp.toFixed(1)}`, centerX - (isMobile() ? 20 : 25), centerY - radius - (isMobile() ? 6 : 8));
            const auroraDesc = document.getElementById('auroraDesc');
            if (auroraDesc) {
                auroraDesc.innerHTML = kp >= 5 ? "🔴 Yüksek olasılıkla aurora görülebilir (orta enlemler)" : (kp >= 3 ? "🟡 Kutup bölgelerinde aurora muhtemel" : "⚪ Auroralar sadece kutup kuşağında");
            }
        };
    }

    // Magnetosphere Canvas
    const magCanvas = document.getElementById('magCanvas');
    if (magCanvas) {
        window.drawMagnetosphere = (windSpeed, kp) => {
            const ctx = magCanvas.getContext('2d');
            const w = magCanvas.clientWidth, h = magCanvas.clientHeight;
            magCanvas.width = w; magCanvas.height = h;
            ctx.clearRect(0, 0, w, h);
            const centerX = w / 2, centerY = h / 2;
            const earthR = isMobile() ? 25 : 35;
            const bend = Math.min(0.8, Math.max(0.1, (windSpeed - 300) / 500 + (kp - 3) / 12));
            ctx.beginPath(); ctx.arc(centerX, centerY, earthR, 0, 2 * Math.PI);
            ctx.fillStyle = '#2a6fb0'; ctx.fill();
            ctx.fillStyle = '#88ccff';
            ctx.font = `${isMobile() ? 6 : 8}px monospace`;
            ctx.fillText("🌍", centerX - (isMobile() ? 4 : 5), centerY + (isMobile() ? 4 : 5));
            for (let i = -3; i <= 3; i++) {
                const angle = i * Math.PI / 6;
                let startX = centerX + Math.cos(angle) * earthR;
                let startY = centerY + Math.sin(angle) * earthR;
                let ctrl1X = startX + (isMobile() ? 40 : 60) * (1 - bend) * Math.cos(angle);
                let ctrl1Y = startY + (isMobile() ? 40 : 60) * Math.sin(angle);
                let endX = startX + (isMobile() ? 80 : 120);
                let endY = startY + (angle * (isMobile() ? 15 : 20)) * bend;
                ctx.beginPath(); ctx.moveTo(startX, startY); ctx.quadraticCurveTo(ctrl1X, ctrl1Y, endX, endY);
                ctx.strokeStyle = `rgba(0,200,255,${0.4 + bend * 0.4})`;
                ctx.lineWidth = isMobile() ? 1.2 : 1.8;
                ctx.stroke();
            }
            const magDesc = document.getElementById('magDesc');
            if (magDesc) {
                magDesc.innerHTML = `💨 Güneş rüzgarı ${Math.round(windSpeed || 0)} km/s → Bükülme: ${(bend * 100).toFixed(0)}%`;
            }
        };
    }

    window.updateVisuals = (kp, wind) => {
        if (kp !== null && window.drawAurora) window.drawAurora(kp);
        if (wind !== null && window.drawMagnetosphere) window.drawMagnetosphere(wind, kp || 3);
        if (window.setSunEarthWindSpeed) window.setSunEarthWindSpeed(wind || 400);
        if (window.setSunEarthKp) window.setSunEarthKp(kp || 3);
    };
}

// --- Canvas Simülasyonu (manyetosfer) ---
function initSimCanvas() {
    const cv = document.getElementById('sim');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let isFullscreen = false;

    const resize = () => {
        cv.width = cv.offsetWidth;
        cv.height = cv.offsetHeight || (isMobile() ? 180 : 210);
    };
    resize();
    window.addEventListener('resize', resize);

    document.addEventListener('fullscreenchange', () => {
        isFullscreen = !!document.fullscreenElement;
        if (!isFullscreen) cv.style.borderRadius = '8px';
        resize();
    });

    const simParent = cv.parentElement;
    if (simParent && !document.getElementById('simFullscreenBtn')) {
        simParent.style.position = 'relative';
        const fsBtn = document.createElement('button');
        fsBtn.id = 'simFullscreenBtn';
        fsBtn.innerHTML = '⛶';
        fsBtn.title = 'Tam Ekran';
        fsBtn.style.cssText = `position:absolute;top:${isMobile() ? '4px' : '8px'};right:${isMobile() ? '4px' : '8px'};z-index:10;
            background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.5);
            color:#00d4ff;border-radius:5px;padding:${isMobile() ? '2px 6px' : '3px 9px'};
            font-size:${isMobile() ? '0.8rem' : '1rem'};cursor:pointer;transition:background .2s;`;
        fsBtn.onmouseenter = () => fsBtn.style.background = 'rgba(0,212,255,.35)';
        fsBtn.onmouseleave = () => fsBtn.style.background = 'rgba(0,212,255,.15)';
        fsBtn.onclick = () => {
            if (!document.fullscreenElement) {
                cv.style.borderRadius = '0';
                cv.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen();
            }
        };
        simParent.appendChild(fsBtn);
    }

    const earthImg = new Image();
    earthImg.crossOrigin = 'anonymous';
    earthImg.src = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
    let earthTexture = null;
    let earthRotAngle = 0;
    earthImg.onload = () => { earthTexture = earthImg; };

    function getFieldAt(px, py, cx, cy, R, bend) {
        const dx = px - cx, dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < R * 1.05) return null;

        const r3 = dist * dist * dist;
        const mx = 0, my = -1;
        const rdotm = (dx * mx + dy * my) / dist;
        let bx = (3 * rdotm * dx / dist - mx) / r3 * 1e4;
        let by = (3 * rdotm * dy / dist - my) / r3 * 1e4;

        if (dx < 0) { bx *= (1 - bend * 0.5); }
        else { bx *= (1 + bend * 0.3); by *= (1 + bend * 0.2); }

        const bMag = Math.sqrt(bx * bx + by * by) || 1;
        return { tx: bx / bMag, ty: by / bMag, mag: Math.min(1, bMag * dist * 0.012) };
    }

    function drawFieldLines(cx, cy, R, bend, windColor) {
        const numLines = isMobile() ? 6 : 10;
        for (let li = 0; li < numLines; li++) {
            const L = R * (1.5 + li * 0.42);
            const alpha = 0.6 - li * 0.04;
            ctx.beginPath();
            let first = true;
            const steps = isMobile() ? 60 : 90;
            for (let si = 0; si <= steps; si++) {
                const theta = (si / steps) * Math.PI - Math.PI / 2;
                const r = L * Math.cos(theta) * Math.cos(theta);
                if (r < R * 0.99) continue;
                const comp = Math.cos(theta) < 0 ? (1 - bend * 0.55) : (1 + bend * 0.35);
                const px = cx + r * Math.cos(theta) * comp;
                const py = cy + r * Math.sin(theta);
                first ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                first = false;
            }
            for (let si = steps; si >= 0; si--) {
                const theta = (si / steps) * Math.PI + Math.PI / 2;
                const r = L * Math.cos(theta - Math.PI) * Math.cos(theta - Math.PI);
                if (r < R * 0.99) continue;
                const px = cx - r * Math.cos(theta - Math.PI) * (1 + bend * 0.55);
                const py = cy + r * Math.sin(theta - Math.PI);
                ctx.lineTo(px, py);
            }
            ctx.strokeStyle = `rgba(${windColor},${alpha})`;
            ctx.lineWidth = isMobile() ? 1 : 1.3;
            ctx.stroke();
        }
        ctx.beginPath();
        const mpR = R * (2.3 - bend * 0.85);
        for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.04) {
            const px = cx + mpR * Math.cos(a);
            const py = cy + mpR * Math.sin(a) * 1.45;
            a <= -Math.PI / 2 + 0.05 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(${windColor},0.28)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    class Particle {
        constructor() { this.reset(); }
        reset() {
            const s = isLiveMode ? (currentWind || 400) : simWind;
            this.x = Math.random() * -120;
            this.y = Math.random() * cv.height;
            this.baseVx = (Math.random() * 1.8 + 0.8) * (s / 140);
            this.baseVy = (Math.random() - 0.5) * 0.35;
            this.vx = this.baseVx;
            this.vy = this.baseVy;
            this.r = Math.random() * (isMobile() ? 1.2 : 1.8) + 0.5;
            this.col = s > 700 ? '239,68,68' : (s > 500 ? '255,140,0' : '180,210,255');
            this.fieldInfluence = 0;
            this.deflected = false;
        }
        upd(ex, ey, R, bend) {
            const dx = this.x - ex, dy = this.y - ey;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const magnetopauseR = R * (2.3 - bend * 0.85);

            if (dist < magnetopauseR && dist > R * 1.1) {
                const field = getFieldAt(this.x, this.y, ex, ey, R, bend);
                if (field) {
                    const cross = this.vx * field.ty - this.vy * field.tx;
                    const strength = Math.min(0.35, field.mag * 0.5) * (1 - dist / magnetopauseR);
                    this.vx += -field.ty * cross * strength;
                    this.vy += field.tx * cross * strength;
                    this.fieldInfluence = Math.min(1, this.fieldInfluence + 0.08);
                    this.deflected = true;
                }
            } else {
                this.vx += (this.baseVx - this.vx) * 0.04;
                this.vy += (this.baseVy - this.vy) * 0.04;
                this.fieldInfluence = Math.max(0, this.fieldInfluence - 0.05);
                this.deflected = false;
            }

            if (dist < R * 1.08) {
                const nx = dx / dist, ny = dy / dist;
                const dot = this.vx * nx + this.vy * ny;
                this.vx -= 2.2 * dot * nx;
                this.vy -= 2.2 * dot * ny;
                this.col = '0,255,120';
            }

            this.x += this.vx;
            this.y += this.vy;
            if (this.x > cv.width + 10 || this.y < -8 || this.y > cv.height + 8) this.reset();
        }
        draw() {
            const glow = this.fieldInfluence;
            if (glow > 0.1) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r + glow * (isMobile() ? 2 : 3), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.col},${glow * 0.25})`;
                ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.col},${0.55 + glow * 0.4})`;
            ctx.fill();
        }
    }

    let pts = [];
    const particleCount = isMobile() ? 120 : 220;
    for (let i = 0; i < particleCount; i++) pts.push(new Particle());

    function animate() {
        ctx.fillStyle = 'rgba(2,5,13,.28)';
        ctx.fillRect(0, 0, cv.width, cv.height);

        const sp = isLiveMode ? (currentWind || 400) : simWind;
        const kpVal = isLiveMode ? (currentKp || 3) : simKp;
        const bend = Math.min(0.85, Math.max(0.1, (sp - 300) / 500 + (kpVal - 3) / 12));
        const windRgb = sp > 700 ? '239,68,68' : (sp > 500 ? '255,140,0' : '0,200,255');

        const R = isFullscreen ? cv.height * (isMobile() ? 0.24 : 0.28) : Math.min(cv.height * (isMobile() ? 0.18 : 0.22), isMobile() ? 40 : 50);
        const ex = cv.width / 2 + R;
        const ey = cv.height / 2;

        drawFieldLines(ex, ey, R, bend, windRgb);

        ctx.save();
        ctx.beginPath();
        ctx.arc(ex, ey, R, 0, Math.PI * 2);
        ctx.clip();
        if (earthTexture) {
            earthRotAngle += 0.002;
            const texW = R * 3;
            const offset = (earthRotAngle * R * 1.5) % (R * 2);
            ctx.drawImage(earthTexture, ex - R - offset, ey - R, texW, R * 2);
            ctx.drawImage(earthTexture, ex - R - offset + R * 2, ey - R, texW, R * 2);
        } else {
            const eg = ctx.createRadialGradient(ex - R * 0.25, ey - R * 0.3, R * 0.08, ex, ey, R);
            eg.addColorStop(0, '#2a9f4b'); eg.addColorStop(0.5, '#2a6fb0'); eg.addColorStop(1, '#081830');
            ctx.fillStyle = eg; ctx.fillRect(ex - R, ey - R, R * 2, R * 2);
        }
        ctx.restore();

        const atm = ctx.createRadialGradient(ex, ey, R * 0.92, ex, ey, R * 1.22);
        atm.addColorStop(0, 'rgba(0,180,255,0)');
        atm.addColorStop(1, 'rgba(0,180,255,0.16)');
        ctx.beginPath(); ctx.arc(ex, ey, R * 1.22, 0, Math.PI * 2);
        ctx.fillStyle = atm; ctx.fill();

        pts.forEach(p => { p.upd(ex, ey, R, bend); p.draw(); });

        ctx.fillStyle = 'rgba(0,212,255,.65)';
        ctx.font = `${isFullscreen ? (isMobile() ? 12 : 14) : (isMobile() ? 7 : 9)}px monospace`;
        ctx.fillText(`${Math.round(sp)} km/s`, 12, isMobile() ? 15 : 20);

        requestAnimationFrame(animate);
    }
    animate();
}

// --- Olay Dinleyicileri ---
function initEventListeners() {
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect) {
        profileSelect.addEventListener('change', (e) => {
            selectedProfile = e.target.value;
            if (isLiveMode) fetchLiveData();
            else updateSimulation();
            showToast(`Profil: ${profileSelect.options[profileSelect.selectedIndex].text}`, "info");
        });
    }

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
                updateSimulation();
                showToast("Simülasyon modu aktif. Kaydırıcılarla senaryo oluşturun.", "info");
            }
        });
    }

    const slider = document.getElementById('slider');
    const simWindSlider = document.getElementById('simWindSlider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            simKp = parseInt(e.target.value);
            const skv = document.getElementById('skv');
            if (skv) skv.textContent = simKp;
            const texts = ['Tehdit Yok', 'Tehdit Yok', 'Tehdit Yok', 'Tehdit Yok', 'Düşük Risk', 'G1 Zayıf', 'G2 Orta', 'G3 Güçlü', 'G4 Şiddetli', 'G5 AŞIRI'];
            const skd = document.getElementById('skd');
            if (skd) skd.textContent = texts[simKp];
            if (!isLiveMode) updateSimulation();
        });
        simWindSlider.addEventListener('input', (e) => {
            simWind = parseInt(e.target.value);
            const simWindVal = document.getElementById('simWindVal');
            if (simWindVal) simWindVal.textContent = simWind + " km/s";
            if (!isLiveMode) updateSimulation();
        });
    }

    const whatsappBtn = document.getElementById('whatsappShareBtn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', () => {
            const msg = `🚨 StarWay Uyarı:\nKp=${currentKp?.toFixed(1) || '?'} | Rüzgar=${Math.round(currentWind || 0)} km/s\nProfil: ${selectedProfile}\nDurum: ${document.getElementById('aitxt')?.innerText.substring(0, 140) || ''}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            showToast("WhatsApp paylaşımı açıldı", "success");
        });
    }

    const notifyBtn = document.getElementById('notifyPermBtn');
    if (notifyBtn) {
        notifyBtn.addEventListener('click', () => {
            Notification.requestPermission().then(perm => showToast(perm === 'granted' ? 'Bildirimler aktif!' : 'Bildirimler engellendi', perm === 'granted' ? 'success' : 'error'));
        });
    }

    const autoNotify = document.getElementById('autoNotifyCheck');
    if (autoNotify) autoNotify.addEventListener('change', (e) => autoNotifyEnabled = e.target.checked);

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
            showToast(`Tema: ${theme === 'dark' ? 'Gece' : 'Gündüz'} modu`, "info");
        });
    }
}

// --- Başlatma ---
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    initVisuals();
    initSimCanvas();
    initEventListeners();

    fetchLiveData();
    liveInterval = setInterval(fetchLiveData, 90000);

    setRiskList(3);
    updateForecast(3, 400);
    updateHistoricalComparison(3);
    if (window.updateVisuals) window.updateVisuals(3, 400);
});