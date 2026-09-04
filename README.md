# EMED Nöbet Planlayıcı

Acil tıp intörn stajı için 28 günlük nöbet listesi hazırlayan, tarayıcıda çalışan tek sayfalık uygulama. Sunucu yok, hesap yok, veri tarayıcıdan çıkmıyor.

## Ne yapar

- Pazartesi 08:00'de başlayan 28 günlük dönem, günde iki nöbet: gündüz 08:00-20:00, gece 20:00-08:00.
- 4 ile 8 intörn, her birine tam olarak 8 gündüz ve 8 gece nöbeti.
- İsim havuzu: bir listeye isimleri yazarsınız, adı girilmemiş intörnlere rastgele dağıtılır. Karttaki bir isim elle yazıldıysa asla değişmez.
- Dinlenme kuralları canlı denetlenir: gece nöbetinin ertesi günü gündüz nöbeti olmaz, iki gece nöbeti arasında en az iki tam gün bulunur, aynı güne hem gündüz hem gece düşmez.
- Hiçbir yerleştirme engellenmez. Kural ihlali kırmızı rozetle gösterilir, kararı kullanıcı verir.
- Rastgele doldur iki aşamalıdır: panodaki elle yerleştirilmiş nöbetlerin kalıp kalmayacağını sorar, sonra kalan nöbetleri kurallara uygun ve dengeli dağıtır, ardından havuzdaki isimleri adsız intörnlere verir.
- Takvim ve matris görünümü, koyu ve açık tema, Türkçe ve İngilizce arayüz.
- Sekiz intörn rengi göz kararı değil, ölçüyle seçildi: en yakın iki renk arasındaki algısal fark en büyük olacak şekilde arandı.
- Dışa aktarma: PNG (3x), Excel, yazdırma veya PDF, JSON dosyası ve bağlantı.
- İçe aktarma ayrı bir düğmede: tek dosya, ya da herkesin dosyasını bir arada.

## Herkes kendi programını yapsın, sonra birleştirsin

İlk ekranda iki mod var. Takım programında bütün intörnlerin nöbetlerini tek
panoda planlarsınız. Kendi programımda yalnızca kendi 8 gündüz ve 8 gece
nöbetinizi seçersiniz; kadro uyarıları çıkmaz, çünkü tek kişi 56 nöbeti zaten
dolduramaz.

Akış şöyle: herkes kendi programını yapar, JSON olarak dışa aktarır ve gönderir.
Toplantıda bir kişi İçe aktar altındaki Programları birleştir ile bütün dosyaları
birlikte seçer. Açılan ekran hangi dosyanın kimi getirdiğini, kimsenin almadığı
nöbetleri, hedeften fazla kişi olan nöbetleri ve 8 + 8'ini tamamlamamış olanları
listeler. Pano ancak Panoya aktar'a basılınca değişir.

Birleşen program büyük ihtimalle ilk seferde geçerli olmayacak: yedi kişi 28 gün
içinden serbestçe seçtiğinde bazı nöbetler boş, bazıları kalabalık kalır. Zaten
amaç da bu, neyin pazarlık edilmesi gerektiğini görmek. Düzeltmeyi elle panoda
yaparsınız.

## Çalıştırma

```bash
npm install
npm run dev      # geliştirme sunucusu
npm run check    # lint + test + derleme, hepsi yeşil olmalı
npm run build    # dist/ üretir
```

## Yapı

| Klasör | İçerik |
|---|---|
| `src/engine/` | saf TypeScript: veri modeli, kurallar, çözücü, karıştırma, kodlayıcılar. React yok, DOM yok, rastgelelik yalnızca tohumla girer |
| `src/state/` | tek yazar olan reducer, kalıcılık, çözücü istemcisi |
| `src/i18n/` | iki sözlük, aynı anahtar kümesi, bir test eşitliği doğrular |
| `src/components/` | arayüz: kurulum, pano, matris, palet, denetim, dışa aktarma |
| `src/styles/` | tasarım jetonları, açık ve koyu palet, yazdırma |

Sözleşme `SPEC.md`, görsel dil `DESIGN.md`, kararlar ve denetim kaydı `memory.md`. `PLAN.md` ilk yapım günlüğüdür, güncel belge değildir. Belgeler çelişirse `SPEC.md` kazanır.

## Çözücü

Her intörn için önce kurallara uyan bir gece deseni (rastgele derinlik öncelikli arama), sonra o desenin bıraktığı günlerden gündüz nöbetleri seçilir; böylece sert kurallar kuruluşta garanti edilir. Ardından benzetilmiş tavlama yalnızca yumuşak maliyeti iyileştirir: nöbet başına hedef kadro, dengeli dağılım, yoğunluk sınırı ve haftalık denge. Tohum verildiğinde çıktı belirlenimlidir ve Web Worker'da çalıştığı için arayüz donmaz.

Ölçülen sonuç: 7 intörn ve hedef 2 kişi için 20 tohumun 20'sinde 56 nöbetin tamamı tam olarak 2 kişiye ulaşır; 4, 5, 6 ve 8 intörn için aritmetik en iyi sonuç her tohumda elde edilir.

## Veri ve gizlilik

Arka uç yok. Sunucu yok, veritabanı yok, SQL yok, hesap yok, çerez yok, ölçüm veya izleme kodu yok. Her şey kullanıcının kendi tarayıcısında olur.

- Kaydetme, tarayıcının kendi deposunda tek bir anahtarla yapılır (`emed-nobet.v1`). O anahtar yalnızca o bilgisayarda durur.
- Paylaşma bağlantısı programın tamamını adresin kesir (`#`) kısmına yazar. Kesir kısmı tarayıcıdan hiçbir sunucuya gönderilmez.
- PNG, Excel, JSON ve yazdırma çıktıları tarayıcı içinde üretilir, dosya doğrudan indirilenler klasörüne iner.
- Uygulamanın tek dış bağlantısı, alt köşedeki GitHub profil bağlantısıdır ve yalnızca tıklanınca açılır.

`netlify.toml` bunu tarayıcıya kural olarak da yazdırır: içerik güvenlik politikası dışarıya giden her isteği kapatır, sayfanın başka bir siteye çerçevelenmesini engeller. Politika, üretim başlıklarının aynısı gönderilerek çözücü ve beş dışa aktarmanın tamamı üzerinde denendi, hiçbir ihlal çıkmadı.

## Yayın

Depo kökü uygulamanın kökü olduğu için Netlify ayarı sadedir: derleme komutu `npm run build`, yayın klasörü `dist`. İkisi de `netlify.toml` içinde yazılıdır, Netlify arayüzünde elle girmeye gerek yoktur.

Yönlendirme kuralı gerekmez: program URL'nin kesir kısmında taşınır, bağlantıyı açan kişi aynı panoyu görür.

Bilinen sınır: hizmet çalışanı (service worker) yok. Sayfa açıkken internet gitse uygulama çalışmaya devam eder, ama kapatılıp yeniden açılırsa tarayıcı önbelleği yetmediğinde sayfa açılmaz.
