// js/app.js
// ==========================================
// Tüm Frontend Mantığı (API, Three.js, Grafik, Simülasyon)
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

    // Gauge ve Kp kartı
    const kpBig = document.getElementById('kpn');
    kpBig.textContent = kp?.toFixed(1) || '—';
    kpBig.style.color = kpAnalysis.color;
    document.getElementById('gbadge').textContent = kpAnalysis.g;
    document.getElementById('klevel').textContent = kpAnalysis.level;
    document.getElementById('krisk').textContent = kpAnalysis.risk;

    // Gauge çizimi
    if (kp !== null && !isNaN(kp)) {
        const norm = Math.min(kp / 9, 1);
        const arc = 251;
        document.getElementById('gfill').setAttribute('stroke-dasharray', `${norm * arc} ${arc}`);
        const ang = (180 - norm * 180) * Math.PI / 180;
        const R = 80, cx = 100, cy = 108;
        document.getElementById('gneedle').setAttribute('cx', cx + R * Math.cos(ang));
        document.getElementById('gneedle').setAttribute('cy', cy - R * Math.sin(ang));
    }

    // Rüzgar
    const windStatus = wind ? (wind < 400 ? 'Sakin' : (wind < 600 ? 'Hızlı' : (wind < 800 ? 'Fırtına' : 'Tehlikeli'))) : '?';
    const windColor = wind ? (wind < 400 ? 'var(--green)' : (wind < 600 ? 'var(--yellow)' : (wind < 800 ? 'var(--orange)' : 'var(--red)'))) : 'gray';
    document.getElementById('windn').textContent = wind ? Math.round(wind) : '—';
    document.getElementById('wbar').style.width = Math.min(100, (wind || 0) / 10) + '%';
    const wBadge = document.getElementById('wbadge');
    wBadge.textContent = windStatus;
    wBadge.style.borderColor = windColor;
    wBadge.style.color = windColor;

    // AI yorumu
    document.getElementById('aitxt').textContent = data.ai_analizi || "Profil analizi yapılıyor...";

    // Risk listesi
    setRiskList(kp);

    // Grafik
    updateChart(time, kp);

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
    document.getElementById('rlist').innerHTML = risks.map(r => `<div class="ri"><div class="ri-dot" style="background:${r.c}"></div><span>${r.n}</span></div>`).join('');
}

function updateForecast(kp, wind) {
    const forecastDiv = document.getElementById('forecastText');
    if (!kp) { forecastDiv.innerHTML = 'Veri bekleniyor...'; return; }
    let trend = kp < 3 ? 'Sakin devam edecek' : (kp < 5 ? 'Aktif, hafif dalgalanmalar' : (kp < 7 ? 'Fırtına seviyesinde, GPS etkilenebilir' : 'Şiddetli fırtına, iletişim kesintileri bekleniyor'));
    forecastDiv.innerHTML = `📈 Son ölçümlere göre: ${trend}. Güneş rüzgarı ${Math.round(wind || 0)} km/s. Önümüzdeki 24 saatte Kp değerinin ${Math.min(9, Math.max(0, kp + (Math.random() - 0.5) * 1.5)).toFixed(1)} civarında seyretmesi bekleniyor.`;
}

function updateHistoricalComparison(kp) {
    const container = document.getElementById('histContainer');
    const curKp = kp !== null ? kp : 2.5;
    const storms = [
        { name: "Carrington 1859", kp: 9.0, effect: "Telgraf sistemleri yandı" },
        { name: "Mart 1989", kp: 9.0, effect: "Quebec şebekesi çöktü" },
        { name: "Halloween 2003", kp: 9.0, effect: "Uydular hasar gördü" }
    ];
    container.innerHTML = storms.map(s => `<div class="hist-item"><strong>${s.name}</strong><br>Kp: ${s.kp}<br><span style="font-size:.65rem">${s.effect}</span></div>`).join('') +
        `<div class="hist-item"><strong>📌 Şu An</strong><br>Kp: ${curKp.toFixed(1)}<br><span style="font-size:.65rem">${curKp >= 7 ? "Şiddetli fırtına" : (curKp >= 5 ? "Orta fırtına" : "Normal")}</span></div>`;
    document.getElementById('compText').innerHTML = curKp >= 7 ? "⚠️ Güncel fırtına, büyük tarihi olaylara yaklaşıyor!" : (curKp >= 5 ? "⚡ 1989 ve 2003 fırtınalarına benzer seviyede." : "✅ Tarihi büyük fırtınalardan düşük seviyede.");
}

// --- Grafik (Chart.js) ---
let chart, cl = [], cd = [];
function initChart() {
    const ctx = document.getElementById('kpchart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels: cl, datasets: [{ label: 'Kp (Canlı)', data: cd, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,.07)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 9 } } }
    });
}
function updateChart(lbl, val) {
    if (val == null || !isLiveMode) return;
    cl.push(lbl.length > 5 ? lbl.substring(0, 5) : lbl);
    cd.push(val);
    if (cl.length > 20) { cl.shift(); cd.shift(); }
    if (chart) chart.update();
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
    document.getElementById('gfill').setAttribute('stroke-dasharray', `${norm * arc} ${arc}`);
    const ang = (180 - norm * 180) * Math.PI / 180;
    const R = 80, cx = 100, cy = 108;
    document.getElementById('gneedle').setAttribute('cx', cx + R * Math.cos(ang));
    document.getElementById('gneedle').setAttribute('cy', cy - R * Math.sin(ang));

    // Rüzgar
    const windStatus = wind < 400 ? 'Sakin' : (wind < 600 ? 'Hızlı' : (wind < 800 ? 'Fırtına' : 'Tehlikeli'));
    const windColor = wind < 400 ? 'var(--green)' : (wind < 600 ? 'var(--yellow)' : (wind < 800 ? 'var(--orange)' : 'var(--red)'));
    document.getElementById('windn').textContent = Math.round(wind);
    document.getElementById('wbar').style.width = Math.min(100, wind / 10) + '%';
    const wBadge = document.getElementById('wbadge');
    wBadge.textContent = windStatus;
    wBadge.style.borderColor = windColor;
    wBadge.style.color = windColor;

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

// --- Görsel Efektler (Three.js, Canvas) ---
function initVisuals() {
    // Three.js 3D Sahne
    import('three').then((THREE) => {
        import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
            const container = document.getElementById('sunEarth3D');
            if (!container) return;
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x010007);
            const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 2, 8);
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            container.innerHTML = '';
            container.appendChild(renderer.domElement);
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;

            // Sun
            const sunGeometry = new THREE.SphereGeometry(1.2, 128, 128);
            const sunMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa55, emissive: 0xff4411, emissiveIntensity: 1.1 });
            const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
            scene.add(sunMesh);
            const sunLight = new THREE.PointLight(0xffaa66, 1.5, 20);
            sunLight.position.set(0, 0, 0);
            scene.add(sunLight);

            // Earth
            const earthGeometry = new THREE.SphereGeometry(0.6, 128, 128);
            const textureLoader = new THREE.TextureLoader();
            const earthMap = textureLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
            const earthMaterial = new THREE.MeshPhongMaterial({ map: earthMap, shininess: 5 });
            const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
            earthMesh.position.set(2.8, 0, 0);
            scene.add(earthMesh);

            // Cloud layer
            const cloudMap = textureLoader.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png');
            const cloudGeometry = new THREE.SphereGeometry(0.61, 128, 128);
            const cloudMaterial = new THREE.MeshPhongMaterial({ map: cloudMap, transparent: true, opacity: 0.15 });
            const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloudMesh.position.set(2.8, 0, 0);
            scene.add(cloudMesh);

            // Particles
            const particleCount = 550;
            const particlesGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const velocities = [];
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] = (Math.random() - 0.5) * 1.5;
                positions[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
                velocities.push({ x: 0.018 + Math.random() * 0.035, y: (Math.random() - 0.5) * 0.018, z: (Math.random() - 0.5) * 0.018 });
            }
            particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const particleMat = new THREE.PointsMaterial({ color: 0xff8844, size: 0.045 });
            const particleSystem = new THREE.Points(particlesGeometry, particleMat);
            scene.add(particleSystem);

            const ambient = new THREE.AmbientLight(0x333333);
            scene.add(ambient);
            const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
            fillLight.position.set(1, 1, 1);
            scene.add(fillLight);

            let currentWindSpeed = 400;
            function animateParticles() {
                const speedMult = Math.min(2.5, Math.max(0.5, currentWindSpeed / 380));
                const positionsAttr = particlesGeometry.attributes.position.array;
                for (let i = 0; i < particleCount; i++) {
                    let idx = i * 3;
                    positionsAttr[idx] += velocities[i].x * speedMult;
                    positionsAttr[idx + 1] += velocities[i].y * speedMult;
                    positionsAttr[idx + 2] += velocities[i].z * speedMult;
                    if (positionsAttr[idx] > 2.8 || positionsAttr[idx] < -1.5 || Math.abs(positionsAttr[idx + 1]) > 1.8 || Math.abs(positionsAttr[idx + 2]) > 1.8) {
                        positionsAttr[idx] = (Math.random() - 0.5) * 1.2;
                        positionsAttr[idx + 1] = (Math.random() - 0.5) * 1.0;
                        positionsAttr[idx + 2] = (Math.random() - 0.5) * 1.0;
                    }
                }
                particlesGeometry.attributes.position.needsUpdate = true;
                cloudMesh.rotation.y += 0.001;
            }

            function animate() {
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

            window.setSunEarthWindSpeed = (spd) => { currentWindSpeed = spd || 400; };
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
            const centerX = w / 2, centerY = h / 2 + 10;
            const radius = Math.min(w, h) * 0.35;
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
            ctx.fillStyle = '#fff9c4'; ctx.font = "bold 12px monospace";
            ctx.fillText(`Kp=${kp.toFixed(1)}`, centerX - 25, centerY - radius - 8);
            document.getElementById('auroraDesc').innerHTML = kp >= 5 ? "🔴 Yüksek olasılıkla aurora görülebilir (orta enlemler)" : (kp >= 3 ? "🟡 Kutup bölgelerinde aurora muhtemel" : "⚪ Auroralar sadece kutup kuşağında");
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
            const earthR = 35;
            const bend = Math.min(0.8, Math.max(0.1, (windSpeed - 300) / 500 + (kp - 3) / 12));
            ctx.beginPath(); ctx.arc(centerX, centerY, earthR, 0, 2 * Math.PI);
            ctx.fillStyle = '#2a6fb0'; ctx.fill();
            ctx.fillStyle = '#88ccff'; ctx.font = "8px monospace"; ctx.fillText("🌍", centerX - 5, centerY + 5);
            for (let i = -3; i <= 3; i++) {
                const angle = i * Math.PI / 6;
                let startX = centerX + Math.cos(angle) * earthR;
                let startY = centerY + Math.sin(angle) * earthR;
                let ctrl1X = startX + 60 * (1 - bend) * Math.cos(angle);
                let ctrl1Y = startY + 60 * Math.sin(angle);
                let endX = startX + 120;
                let endY = startY + (angle * 20) * bend;
                ctx.beginPath(); ctx.moveTo(startX, startY); ctx.quadraticCurveTo(ctrl1X, ctrl1Y, endX, endY);
                ctx.strokeStyle = `rgba(0,200,255,${0.4 + bend * 0.4})`; ctx.lineWidth = 1.8; ctx.stroke();
            }
            document.getElementById('magDesc').innerHTML = `💨 Güneş rüzgarı ${Math.round(windSpeed || 0)} km/s → Bükülme: ${(bend * 100).toFixed(0)}%`;
        };
    }

    window.updateVisuals = (kp, wind) => {
        if (kp !== null && window.drawAurora) window.drawAurora(kp);
        if (wind !== null && window.drawMagnetosphere) window.drawMagnetosphere(wind, kp || 3);
        if (window.setSunEarthWindSpeed) window.setSunEarthWindSpeed(wind || 400);
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
        cv.height = cv.offsetHeight || 210;
    };
    resize();
    window.addEventListener('resize', resize);

    // Fullscreen değişimini dinle — canvas büyüsün
    document.addEventListener('fullscreenchange', () => {
        isFullscreen = !!document.fullscreenElement;
        if (!isFullscreen) cv.style.borderRadius = '8px';
        resize();
    });

    // Tam ekran butonu
    const simParent = cv.parentElement;
    if (simParent && !document.getElementById('simFullscreenBtn')) {
        simParent.style.position = 'relative';
        const fsBtn = document.createElement('button');
        fsBtn.id = 'simFullscreenBtn';
        fsBtn.innerHTML = '⛶';
        fsBtn.title = 'Tam Ekran';
        fsBtn.style.cssText = `position:absolute;top:8px;right:8px;z-index:10;background:rgba(0,212,255,.15);
            border:1px solid rgba(0,212,255,.5);color:#00d4ff;border-radius:5px;padding:3px 9px;
            font-size:1rem;cursor:pointer;transition:background .2s;`;
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

    // NASA Dünya dokusu
    const earthImg = new Image();
    earthImg.crossOrigin = 'anonymous';
    earthImg.src = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
    let earthTexture = null;
    let earthRotAngle = 0;
    earthImg.onload = () => { earthTexture = earthImg; };

    // Alan çizgisi örnekleme noktaları (partiküller için etkileşim)
    // Her alan çizgisi için birkaç nokta + teğet yön döndürür
    function getFieldAt(px, py, cx, cy, R, bend) {
        // Dünya merkezine göre vektör
        const dx = px - cx, dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < R * 1.05) return null; // Dünya içinde

        // Dipol alanı yaklaşımı: B ∝ (3(m·r̂)r̂ - m) / r³
        // m = (0, -1) — manyetik eksen dikey
        const r3 = dist * dist * dist;
        const mx = 0, my = -1; // manyetik moment yönü
        const rdotm = (dx * mx + dy * my) / dist;
        // B vektörü (normalize edilmiş dipol)
        let bx = (3 * rdotm * dx / dist - mx) / r3 * 1e4;
        let by = (3 * rdotm * dy / dist - my) / r3 * 1e4;

        // Güneş rüzgarı bükme etkisi: sol tarafı sıkıştır (gün yüzü)
        if (dx < 0) { bx *= (1 - bend * 0.5); }
        else { bx *= (1 + bend * 0.3); by *= (1 + bend * 0.2); }

        const bMag = Math.sqrt(bx * bx + by * by) || 1;
        return { tx: bx / bMag, ty: by / bMag, mag: Math.min(1, bMag * dist * 0.012) };
    }

    // Dipol alan çizgilerini çiz
    function drawFieldLines(cx, cy, R, bend, windColor) {
        const numLines = 10;
        for (let li = 0; li < numLines; li++) {
            const L = R * (1.5 + li * 0.42);
            const alpha = 0.6 - li * 0.04;
            ctx.beginPath();
            let first = true;
            const steps = 90;
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
            ctx.lineWidth = 1.3;
            ctx.stroke();
        }
        // Magnetopause kesikli
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

    // Partiküller — alan etkileşimi ile
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
            this.r = Math.random() * 1.8 + 0.5;
            this.col = s > 700 ? '239,68,68' : (s > 500 ? '255,140,0' : '180,210,255');
            this.fieldInfluence = 0; // alan etkisi şiddeti
            this.deflected = false;
        }
        upd(ex, ey, R, bend) {
            const dx = this.x - ex, dy = this.y - ey;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const magnetopauseR = R * (2.3 - bend * 0.85);

            // Alan çizgisi etkileşim bölgesi: magnetopause içinde
            if (dist < magnetopauseR && dist > R * 1.1) {
                const field = getFieldAt(this.x, this.y, ex, ey, R, bend);
                if (field) {
                    // Lorentz kuvveti: v × B — hız × alan yönüne dik ivme
                    const cross = this.vx * field.ty - this.vy * field.tx; // z-bileşeni
                    const strength = Math.min(0.35, field.mag * 0.5) * (1 - dist / magnetopauseR);
                    this.vx += -field.ty * cross * strength;
                    this.vy += field.tx * cross * strength;
                    this.fieldInfluence = Math.min(1, this.fieldInfluence + 0.08);
                    this.deflected = true;
                }
            } else {
                // Alan dışında — yavaşça orijinal yöne dön
                this.vx += (this.baseVx - this.vx) * 0.04;
                this.vy += (this.baseVy - this.vy) * 0.04;
                this.fieldInfluence = Math.max(0, this.fieldInfluence - 0.05);
                this.deflected = false;
            }

            // Dünya yüzeyine çarparsa saptır (aurora efekti)
            if (dist < R * 1.08) {
                const nx = dx / dist, ny = dy / dist;
                const dot = this.vx * nx + this.vy * ny;
                this.vx -= 2.2 * dot * nx;
                this.vy -= 2.2 * dot * ny;
                this.col = '0,255,120'; // yeşil — aurora rengi
            }

            this.x += this.vx;
            this.y += this.vy;
            if (this.x > cv.width + 10 || this.y < -8 || this.y > cv.height + 8) this.reset();
        }
        draw() {
            // Alan etkisindeyse parlasın
            const glow = this.fieldInfluence;
            if (glow > 0.1) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r + glow * 3, 0, Math.PI * 2);
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
    for (let i = 0; i < 220; i++) pts.push(new Particle());

    function animate() {
        ctx.fillStyle = 'rgba(2,5,13,.28)';
        ctx.fillRect(0, 0, cv.width, cv.height);

        const sp = isLiveMode ? (currentWind || 400) : simWind;
        const kpVal = isLiveMode ? (currentKp || 3) : simKp;
        const bend = Math.min(0.85, Math.max(0.1, (sp - 300) / 500 + (kpVal - 3) / 12));
        const windRgb = sp > 700 ? '239,68,68' : (sp > 500 ? '255,140,0' : '0,200,255');

        // Dünya pozisyonu: sol kenar ekran ortasına değsin → ex = cv.width/2 + R
        const R = isFullscreen ? cv.height * 0.28 : Math.min(cv.height * 0.22, 50);
        const ex = cv.width / 2 + R;
        const ey = cv.height / 2;

        // Alan çizgileri (Dünya arkasında)
        drawFieldLines(ex, ey, R, bend, windRgb);

        // Dünya — doku
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

        // Atmosfer halkası
        const atm = ctx.createRadialGradient(ex, ey, R * 0.92, ex, ey, R * 1.22);
        atm.addColorStop(0, 'rgba(0,180,255,0)');
        atm.addColorStop(1, 'rgba(0,180,255,0.16)');
        ctx.beginPath(); ctx.arc(ex, ey, R * 1.22, 0, Math.PI * 2);
        ctx.fillStyle = atm; ctx.fill();

        // Partiküller
        pts.forEach(p => { p.upd(ex, ey, R, bend); p.draw(); });

        // Hız yazısı
        ctx.fillStyle = 'rgba(0,212,255,.65)';
        ctx.font = `${isFullscreen ? 14 : 9}px monospace`;
        ctx.fillText(`${Math.round(sp)} km/s`, 12, 20);

        requestAnimationFrame(animate);
    }
    animate();
}

// --- Olay Dinleyicileri ---
function initEventListeners() {
    // Profil seçimi
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect) {
        profileSelect.addEventListener('change', (e) => {
            selectedProfile = e.target.value;
            if (isLiveMode) fetchLiveData();
            else updateSimulation();
            showToast(`Profil: ${profileSelect.options[profileSelect.selectedIndex].text}`, "info");
        });
    }

    // Mod değiştirme
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

    // Simülasyon sliderları
    const slider = document.getElementById('slider');
    const simWindSlider = document.getElementById('simWindSlider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            simKp = parseInt(e.target.value);
            document.getElementById('skv').textContent = simKp;
            const texts = ['Tehdit Yok', 'Tehdit Yok', 'Tehdit Yok', 'Tehdit Yok', 'Düşük Risk', 'G1 Zayıf', 'G2 Orta', 'G3 Güçlü', 'G4 Şiddetli', 'G5 AŞIRI'];
            document.getElementById('skd').textContent = texts[simKp];
            if (!isLiveMode) updateSimulation();
        });
        simWindSlider.addEventListener('input', (e) => {
            simWind = parseInt(e.target.value);
            document.getElementById('simWindVal').textContent = simWind + " km/s";
            if (!isLiveMode) updateSimulation();
        });
    }

    // WhatsApp paylaşım
    const whatsappBtn = document.getElementById('whatsappShareBtn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', () => {
            const msg = `🚨 StarWay Uyarı:\nKp=${currentKp?.toFixed(1) || '?'} | Rüzgar=${Math.round(currentWind || 0)} km/s\nProfil: ${selectedProfile}\nDurum: ${document.getElementById('aitxt').innerText.substring(0, 140)}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            showToast("WhatsApp paylaşımı açıldı", "success");
        });
    }

    // Bildirim izni
    const notifyBtn = document.getElementById('notifyPermBtn');
    if (notifyBtn) {
        notifyBtn.addEventListener('click', () => {
            Notification.requestPermission().then(perm => showToast(perm === 'granted' ? 'Bildirimler aktif!' : 'Bildirimler engellendi', perm === 'granted' ? 'success' : 'error'));
        });
    }

    const autoNotify = document.getElementById('autoNotifyCheck');
    if (autoNotify) autoNotify.addEventListener('change', (e) => autoNotifyEnabled = e.target.checked);

    // Tema değiştirme
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

    // Periyodik veri çekme
    fetchLiveData();
    liveInterval = setInterval(fetchLiveData, 90000);

    // Başlangıçta risk listesi ve tahmin
    setRiskList(3);
    updateForecast(3, 400);
    updateHistoricalComparison(3);
    if (window.updateVisuals) window.updateVisuals(3, 400);
});