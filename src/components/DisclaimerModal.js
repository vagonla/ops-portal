'use client';

import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, FileWarning, EyeOff } from 'lucide-react';

export default function DisclaimerModal({ onAccept }) {
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      // Eğer ekran yeterince büyükse ve kaydırma çubuğu çıkmıyorsa direkt onay verilebilir
      if (scrollRef.current.scrollHeight <= scrollRef.current.clientHeight + 10) {
        setHasScrolledToBottom(true);
      }
    }
  }, []);

  const handleScroll = (e) => {
    // Check if scrolled to bottom with 10px tolerance
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 10;
    if (bottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-primary)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 20,
        maxWidth: 600,
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 30px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 0 }}>
              Kullanıcı Sözleşmesi
            </h1>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            padding: '30px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-primary)'
          }}>

          {/* DİKKAT ÇEKİCİ BANNER */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '2px solid rgba(239, 68, 68, 0.5)',
            borderRadius: 12,
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            <div style={{ position: 'absolute', top: -15, right: -15, opacity: 0.1, transform: 'scale(2.5)' }}>
              <AlertTriangle size={100} color="#ef4444" />
            </div>
            <h2 style={{ color: '#ef4444', fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
              <AlertTriangle size={20} strokeWidth={2.5} />
              LÜTFEN OKUMADAN GEÇMEYİN!
            </h2>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, position: 'relative', zIndex: 1, lineHeight: 1.6 }}>
              Bu metin, diğer uygulamalarda alışkın olduğunuz gereksiz yere uzatılmış ve okumadan onayladığınız standart bir sözleşme <strong>DEĞİLDİR</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <AlertTriangle size={24} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>1. Beta (Test) Aşaması ve Veri Doğruluğu</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Bu uygulama şu anda <strong>BETA (test)</strong> aşamasındadır. Şu An Çalışanlar, Sarkan Vardiyalar veya Haftalık Özet gibi otomatik analiz özelliklerinin sonuçları,
                yazılımsal kısıtlar sebebiyle <strong>hatalı, eksik veya gecikmeli</strong> olabilir.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <FileWarning size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>2. Resmi Uygulama Değildir</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Bu uygulama çalıştığınız kurumun (şirketin) <strong>resmi bir uygulaması DEĞİLDİR</strong> ve kurumla hiçbir resmi bağı bulunmamaktadır. Tamamen bağımsız olarak geliştirilen gayriresmi bir araçtır. Görüntülenen verilerin hiçbir kurumsal bağlayıcılığı yoktur. Vardiya saatlerinizle ilgili asıl kaynak,
                daima yöneticileriniz veya planlama ekipleriniz tarafından size iletilen orijinal Excel dosyalarıdır.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <EyeOff size={24} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>3. Kişisel Veriler ve Gizlilik</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Yüklediğiniz Excel dosyaları, çalışan satırları, güzergâhlar ve takip listeniz <strong>yalnızca cihazınızda işlenir ve sunucuya gönderilmez.</strong> Uygulama hesapla giriş veya cihazlar arası eşitleme kullanmaz. Veriler kullandığınız tarayıcıda saklanır; tarayıcı verilerini temizlediğinizde bu kayıtlar silinir.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <ShieldCheck size={24} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>4. Şirket Veri Güvenliği (KVKK) ve Politikalar</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Sisteme okuttuğunuz vardiya Excel dosyaları şirket içi personel verileri barındırabilir. Kurum içi dokümanları kişisel ortamlarda kullanmak konusunda <strong>şirketinizin bilgi güvenliği politikalarına, KVKK yükümlülüklerine ve gizlilik sözleşmelerine uyma sorumluluğu dosyayı yükleyen kullanıcıya aittir.</strong>
              </p>
            </div>
          </div>

          <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)', flexShrink: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Geçerlilik ve Tam Muafiyet Beyanı</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Uygulamayı kullanmanız, tüm bu riskleri kendi özgür iradenizle kabul ettiğiniz anlamına gelir. Hesaplama hatalarından ötürü <strong>işe geç kalma veya gitmeme</strong> gibi disiplin suçları ile, verilerin kullanımı sonucu oluşabilecek <strong>her türlü hukuki veya idari (KVKK, şirket gizlilik ihlali vs.) yaptırımdan TAMAMEN uygulamayı kullanan KULLANICI sorumludur.</strong>
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '24px 30px',
          borderTop: '1px solid var(--border-primary)',
          background: 'var(--bg-tertiary)',
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: 20
          }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={!hasScrolledToBottom}
              style={{
                width: 20,
                height: 20,
                marginTop: 2,
                cursor: hasScrolledToBottom ? 'pointer' : 'not-allowed',
                accentColor: 'var(--accent-primary)',
                opacity: hasScrolledToBottom ? 1 : 0.5
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: hasScrolledToBottom ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.5, transition: 'color 0.2s' }}>
                Yukarıdaki sorumluluk reddi beyanını okudum, anladım. Tüm beyanı onaylıyorum. Sistemin resmi olmayan test amaçlı bir araç olduğunu ve sistemden kaynaklı yanlış vardiyaya gitme gibi durumlarda <strong>tüm sorumluluğun şahsıma ait olduğunu</strong> beyan ve kabul ediyorum.
              </span>
              {!hasScrolledToBottom && (
                <span style={{ fontSize: 12, color: 'var(--accent-warning)', fontWeight: 500, animation: 'pulse 2s infinite' }}>
                  Lütfen onaylamak için metni sonuna kadar okuyun ↓
                </span>
              )}
            </div>
          </label>

          <button
            disabled={!agreed}
            onClick={() => agreed && onAccept()}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 14,
              border: 'none',
              background: agreed ? 'var(--gradient-primary)' : 'var(--bg-card)',
              color: agreed ? 'white' : 'var(--text-muted)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: agreed ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: agreed ? '0 4px 12px rgba(0, 92, 185, 0.3)' : 'none',
              opacity: agreed ? 1 : 0.7
            }}
          >
            Uygulamaya Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}
