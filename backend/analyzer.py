# analyzer.py
class SpaceWeatherAnalyzer:
    def __init__(self):
        # NOAA G-Scale (Jeomanyetik Fırtına Ölçeği)
        # Kp 5 = G1 (Zayıf) ... Kp 9 = G5 (Aşırı)
        pass

    def analyze_kp_index(self, kp_value):
        """
        Kp indeksine göre fırtına riskini ve alınması gereken önlemleri belirler.
        """
        if kp_value is None:
            return {"seviye": "Bilinmiyor", "risk": "Veri Yok", "renk": "gri"}

        if kp_value < 4:
            return {"seviye": "Normal", "risk": "Tehdit Yok", "renk": "yesil", "g_scale": "G0"}
        elif kp_value == 4:
            return {"seviye": "Aktif", "risk": "Düşük (Gözlem Gerekli)", "renk": "sari", "g_scale": "G0"}
        elif kp_value == 5:
            return {"seviye": "G1 - Zayıf Fırtına", "risk": "Güç şebekelerinde ufak dalgalanmalar", "renk": "turuncu",
                    "g_scale": "G1"}
        elif kp_value == 6:
            return {"seviye": "G2 - Orta Fırtına", "risk": "Uydu yörüngelerinde sürüklenme riski", "renk": "turuncu",
                    "g_scale": "G2"}
        elif kp_value == 7:
            return {"seviye": "G3 - Güçlü Fırtına", "risk": "GPS ve navigasyon sistemlerinde kesinti",
                    "renk": "kirmizi", "g_scale": "G3"}
        elif kp_value == 8:
            return {"seviye": "G4 - Şiddetli Fırtına", "risk": "Geniş çaplı voltaj kontrol sorunları",
                    "renk": "koyu_kirmizi", "g_scale": "G4"}
        elif kp_value >= 9:
            return {"seviye": "G5 - Aşırı Fırtına", "risk": "Elektrik şebekelerinde çökme tehlikesi!", "renk": "mor",
                    "g_scale": "G5"}

    def analyze_solar_wind(self, speed_kms):
        """
        Güneş rüzgarı hızına göre durumu değerlendirir.
        """
        if speed_kms is None:
            return {"durum": "Bilinmiyor", "renk": "gri"}

        if speed_kms < 400:
            return {"durum": "Sakin", "renk": "yesil"}
        elif 400 <= speed_kms < 600:
            return {"durum": "Hızlı (Hafif Baskı)", "renk": "sari"}
        elif 600 <= speed_kms < 800:
            return {"durum": "Çok Hızlı (Fırtına Beklentisi)", "renk": "turuncu"}
        else:
            return {"durum": "Tehlikeli Hız (Şiddetli Çarpma)", "renk": "kirmizi"}

    def generate_system_report(self, kp_data, wind_data):
        """
        Tüm verileri toplayıp tek bir genel durum raporu (JSON formatında) üretir.
        """
        kp_value = kp_data.get("kp_indeksi") if kp_data else None
        wind_speed = wind_data.get("hiz_kms") if wind_data else None

        kp_analysis = self.analyze_kp_index(kp_value)
        wind_analysis = self.analyze_solar_wind(wind_speed)

        # Genel Alarm Durumunu Belirleme
        alarm_aktif = True if kp_value and kp_value >= 5 else False

        report = {
            "sistem_durumu": "ALARM" if alarm_aktif else "NORMAL",
            "kp_analizi": kp_analysis,
            "ruzgar_analizi": wind_analysis,
            "zaman_damgasi": kp_data.get("zaman") if kp_data else "Bilinmiyor"
        }

        return report


# Test Bloğu
if __name__ == "__main__":
    from fetch_data import SpaceWeatherDataFetcher

    fetcher = SpaceWeatherDataFetcher()
    analyzer = SpaceWeatherAnalyzer()

    print("📡 Veriler Çekiliyor ve Analiz Ediliyor...\n")

    anlik_kp = fetcher.get_latest_kp_index()
    anlik_ruzgar = fetcher.get_latest_solar_wind()

    rapor = analyzer.generate_system_report(anlik_kp, anlik_ruzgar)

    print("=== STARWAY UZAY HAVASI DURUM RAPORU ===")
    print(f"Genel Sistem Durumu: {rapor['sistem_durumu']}")
    print(f"Kp Seviyesi: {rapor['kp_analizi']['seviye']} (Risk: {rapor['kp_analizi']['risk']})")
    print(f"Güneş Rüzgarı Durumu: {rapor['ruzgar_analizi']['durum']}")
    print("========================================")