# fetch_data.py
import requests
import json


class SpaceWeatherDataFetcher:
    def __init__(self):
        # NOAA'nın halka açık canlı uzay havası veri uç noktaları (Endpoints)
        self.kp_index_url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
        self.solar_wind_url = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json"

    def get_latest_kp_index(self):
        """
        Geomanyetik fırtına riskini belirleyen Kp indeksini çeker.
        Kp indeksi 0-9 arasında değer alır. 5 ve üzeri fırtına (G1-G5) anlamına gelir.
        """
        try:
            response = requests.get(self.kp_index_url)
            response.raise_for_status()  # Eğer web sitesine ulaşılamazsa hata fırlatır
            data = response.json()

            # NOAA veriyi bir tablo (liste içinde liste) olarak yollar.
            # İlk satır başlıklar, son satır ise en güncel veridir.
            latest_data = data[-1]
            time_tag = latest_data[0]
            kp_value = float(latest_data[1])

            return {"zaman": time_tag, "kp_indeksi": kp_value}

        except Exception as e:
            print(f"❌ Kp indeksi çekilirken hata oluştu: {e}")
            return None

    def get_latest_solar_wind(self):
        """
        Güneş rüzgarı hızını (km/s) ve plazma yoğunluğunu çeker.
        Normal hız 300-400 km/s civarıdır, fırtına anında 800-1000+ km/s'ye çıkabilir.
        """
        try:
            response = requests.get(self.solar_wind_url)
            response.raise_for_status()
            data = response.json()

            latest_data = data[-1]
            return {
                "zaman": latest_data[0],
                "yogunluk_gcm3": float(latest_data[1]),  # Santimetreküp başına parçacık
                "hiz_kms": float(latest_data[2])  # Saniyede kilometre hızı
            }

        except Exception as e:
            print(f"❌ Güneş rüzgarı çekilirken hata oluştu: {e}")
            return None


# Sadece bu dosya çalıştırıldığında test etmek için (Ana programda burası çalışmaz)
if __name__ == "__main__":
    fetcher = SpaceWeatherDataFetcher()
    print("🚀 StarWay Uzay Havası Veri Toplayıcı Başlatıldı...\n")

    kp_data = fetcher.get_latest_kp_index()
    if kp_data:
        print(f"📡 Son Kp İndeksi: {kp_data['kp_indeksi']} (Zaman: {kp_data['zaman']})")

    wind_data = fetcher.get_latest_solar_wind()
    if wind_data:
        print(f"🌪️ Son Güneş Rüzgarı Hızı: {wind_data['hiz_kms']} km/s (Zaman: {wind_data['zaman']})")