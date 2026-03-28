# main.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fetch_data import SpaceWeatherDataFetcher
from analyzer import SpaceWeatherAnalyzer
import google.generativeai as genai
import random
from datetime import datetime

# API Uygulamamızı başlatıyoruz
app = FastAPI(title="StarWay Uzay Havası Erken Uyarı Sistemi API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fetcher = SpaceWeatherDataFetcher()
analyzer = SpaceWeatherAnalyzer()

# ==========================================
# YAPAY ZEKA (GEMINI) AYARLARI
# ==========================================
# Buraya Google AI Studio'dan aldığınız API anahtarını girebilirsiniz.
# Boş bırakırsanız sistem çevrimdışı yedek yapay zeka algoritmasını kullanır.
AI_API_KEY = ""  # API anahtarınızı buraya yapıştırın

ai_model = None
if AI_API_KEY:
    try:
        genai.configure(api_key=AI_API_KEY)
        ai_model = genai.GenerativeModel('gemini-1.5-flash')
        print("✅ Google Gemini AI başarıyla yüklendi.")
    except Exception as e:
        print(f"❌ Gemini AI yüklenirken hata: {e}")

# API kotalarını aşmamak için yapay zeka yanıtını hafızada tutuyoruz
son_ai_yorumu = "Sistem başlatılıyor, veriler toplanıyor..."
son_kp_degeri = None

# Profil bazlı uyarı mesajları (yedek AI için)
PROFILE_ADVICE = {
    "ogrenci": "Eğitim amaçlı: Auroraları gözlemleyebilir, manyetik fırtınaların bilimsel etkilerini öğrenebilirsiniz. Güneş aktivitesini takip ederek bilimsel gözlemler yapabilirsiniz.",
    "pilot": "Yüksek frekanslı iletişimlerde kesinti olabilir. Kutup rotalarında radyo iletişimi etkilenebilir. Alternatif iletişim sistemlerini hazır bulundurun.",
    "uydum": "Yörünge sürüklenmesi ve yüzey yüklenmesi riski. Uydu komutlarını erteleyin. Uydu yörünge düzeltmeleri için hazırlıklı olun.",
    "radyo": "HF bantlarında parazitlenme ve sinyal kaybı. DX iletişimi için fırtına sonrası iyileşme dönemini takip edin. Radyo frekanslarında beklenmeyen kesintilere hazırlıklı olun.",
    "enerji": "Şebekelerde voltaj dalgalanmaları, trafolarda aşırı akım riski. Koruma sistemlerini gözden geçirin. Yedek güç sistemlerini kontrol edin."
}


def get_ai_analysis(kp_value: float, wind_speed: float, profile: str = "ogrenci") -> str:
    """
    Verileri ve profili kullanarak AI yorumu oluşturur.
    Gemini API varsa onu kullanır, yoksa kural tabanlı yedek sistemi çalıştırır.
    """
    global son_ai_yorumu, son_kp_degeri

    # Eğer Kp değeri değişmediyse ve API kullanılıyorsa, aynı yorumu kullan (API kotası için)
    if kp_value == son_kp_degeri and son_kp_degeri is not None and ai_model:
        return son_ai_yorumu

    son_kp_degeri = kp_value

    # Seviye belirleme
    if kp_value < 4:
        level = "sakin"
        risk_desc = "Düşük risk"
    elif kp_value < 6:
        level = "aktif"
        risk_desc = "Orta risk"
    elif kp_value < 8:
        level = "fırtına"
        risk_desc = "Yüksek risk"
    else:
        level = "şiddetli fırtına"
        risk_desc = "Çok yüksek risk"

    profile_text = PROFILE_ADVICE.get(profile, PROFILE_ADVICE["ogrenci"])
    profile_name = {
        "ogrenci": "Öğrenci",
        "pilot": "Pilot",
        "uydum": "Uydu Operatörü",
        "radyo": "Radyo Meraklısı",
        "enerji": "Enerji Sistemi Operatörü"
    }.get(profile, "Kullanıcı")

    # 1. Eğer gerçek Gemini AI aktifse
    if ai_model:
        try:
            prompt = f"""Şu anki uzay havası verileri: Dünyanın Kp manyetik indeksi {kp_value}/9 ve Güneş rüzgarı hızı {wind_speed} km/s.
            Kullanıcı profili: {profile_name} ({profile_text.split('.')[0]}).

            Bir astrofizikçi ve teknoloji uzmanı gibi bu durumu 2-3 kısa cümlede özetle. Şunlara dikkat et:
            - Uydular ve elektrik şebekeleri için risk var mı belirt
            - Profil bazlı kişisel bir uyarıyla bitir (örn: "{profile_name} olarak...")
            - Teknik terimleri açıklayıcı bir dille anlat
            - Alarm seviyesini vurgula (Kp {kp_value})

            Cevap Türkçe olsun ve sade, anlaşılır bir dille yaz."""

            response = ai_model.generate_content(prompt)
            son_ai_yorumu = response.text.strip()
            return son_ai_yorumu
        except Exception as e:
            print(f"Gemini hatası, yedeğe geçiliyor: {e}")
            # Hata durumunda kural tabanlı sisteme düş

    # 2. Yedek Kural Tabanlı AI (API key yok veya hata varsa)
    if kp_value < 4:
        risk_metni = f"🌤️ **{profile_name} için Değerlendirme:** Manyetosfer şu an oldukça sakin (Kp={kp_value:.1f}). Güneş rüzgarları ({wind_speed:.0f} km/s) Dünya'nın manyetik kalkanı tarafından başarıyla saptırılıyor. Uydular ve yeryüzü iletişim ağları için herhangi bir elektromanyetik tehdit öngörülmüyor."
    elif kp_value < 6:
        risk_metni = f"⚠️ **{profile_name} için Değerlendirme:** Güneş'te artan aktivite tespit edildi (Kp={kp_value:.1f}). Radyo iletişiminde ufak parazitlenmeler yaşanabilir, kutuplarda auroralar (Kuzey Işıkları) gözlemlenebilir. {profile_text}"
    else:
        risk_metni = f"🚨 **{profile_name} için ACİL DEĞERLENDİRME:** DİKKAT! Yüksek enerjili plazma bulutu manyetosferimize çarpıyor (Kp={kp_value:.1f}, Rüzgar={wind_speed:.0f} km/s)! GPS sinyallerinde sapmalar ve uydu devrelerinde statik elektrik birikimi riski yüksek. Elektrik şebekelerinde voltaj dalgalanmaları yaşanabilir! {profile_text}"

    son_ai_yorumu = risk_metni
    return son_ai_yorumu


@app.get("/")
def root():
    """Ana endpoint - API'nin çalıştığını kontrol eder."""
    return {
        "message": "StarWay Uzay Havası Erken Uyarı Sistemi API",
        "status": "online",
        "endpoints": ["/api/durum", "/api/durum?profile=ogrenci"]
    }


@app.get("/api/durum")
def get_space_weather_status(
        profile: str = Query("ogrenci", description="Kullanıcı profili (ogrenci, pilot, uydum, radyo, enerji)")):
    """
    Uzay havası durumunu döndürür.
    profile parametresi ile kişiye özel AI yorumu oluşturulur.

    - ogrenci: Öğrenci profili - eğitim amaçlı analiz
    - pilot: Pilot profili - havacılık etkileri
    - uydum: Uydu operatörü profili - uzay teknolojileri etkileri
    - radyo: Radyo meraklısı profili - iletişim etkileri
    - enerji: Enerji sistemi profili - şebeke etkileri
    """
    # NOAA'dan canlı verileri çek
    kp_data = fetcher.get_latest_kp_index()
    wind_data = fetcher.get_latest_solar_wind()

    # API'den veri gelmezse demo/simülasyon modu için dummy değerler (Backend offline durumunda)
    if kp_data is None or kp_data.get("kp_indeksi") is None:
        kp_val = random.uniform(2.0, 5.0)
        print(f"⚠️ Kp verisi alınamadı, demo değer kullanılıyor: {kp_val:.1f}")
    else:
        kp_val = kp_data.get("kp_indeksi")

    if wind_data is None or wind_data.get("hiz_kms") is None:
        wind_val = random.uniform(380, 620)
        print(f"⚠️ Rüzgar verisi alınamadı, demo değer kullanılıyor: {wind_val:.0f}")
    else:
        wind_val = wind_data.get("hiz_kms")

    time_val = kp_data.get("zaman") if kp_data else datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Analyzer sınıfını kullanarak detaylı analiz yap
    kp_analysis = analyzer.analyze_kp_index(kp_val)
    wind_analysis = analyzer.analyze_solar_wind(wind_val)

    # Yapay Zeka Yorumunu Oluştur (Profil bazlı)
    ai_comment = get_ai_analysis(kp_val, wind_val, profile)

    # Raporu oluştur
    report = {
        "sistem_durumu": "ALARM" if kp_val >= 5 else "NORMAL",
        "kp_analizi": kp_analysis,
        "ruzgar_analizi": wind_analysis,
        "zaman_damgasi": time_val,
        "kp_degeri": kp_val,
        "ruzgar_hizi": wind_val,
        "ai_analizi": ai_comment,
        "profil": profile
    }

    return report


@app.get("/api/health")
def health_check():
    """API sağlık kontrolü endpoint'i."""
    return {
        "status": "healthy",
        "ai_available": ai_model is not None,
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn

    print("""
    ╔══════════════════════════════════════════════════════════╗
    ║     StarWay Uzay Havası Erken Uyarı Sistemi API          ║
    ║                  Bahçeşehir Koleji FTL                   ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    print("🚀 API Başlatılıyor...")
    print("📍 Ana Endpoint: http://127.0.0.1:8000")
    print("📊 Uzay Havası Durumu: http://127.0.0.1:8000/api/durum")
    print("🎓 Profil Bazlı Sorgu: http://127.0.0.1:8000/api/durum?profile=pilot")
    print("💚 Sağlık Kontrolü: http://127.0.0.1:8000/api/health")
    print("-" * 50)

    if AI_API_KEY:
        print("✅ Google Gemini AI aktif!")
    else:
        print("⚠️ Google Gemini AI devre dışı (API anahtarı girilmemiş)")
        print("💡 Yedek kural tabanlı AI sistemi kullanılıyor.")

    print("\n🔧 Sunucu başlatılıyor...\n")

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )