'use client';
import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';

const STORAGE_KEY = 'nokos_disclaimer_read';
const DISMISS_DAYS = 7;

const DisclaimerModal = forwardRef(function DisclaimerModal(_, ref) {
  const [visible, setVisible] = useState(false);

  // Expose open() ke parent via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setVisible(true);
      document.body.style.overflow = 'hidden';
    },
  }));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const expiry = Number(saved);
        if (Date.now() < expiry) return; // masih dalam periode 7 hari
      }
      // Tampilkan modal
      setVisible(true);
      document.body.style.overflow = 'hidden';
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      const expiry = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY, String(expiry));
    } catch { }
    setVisible(false);
    document.body.style.overflow = '';
  };

  if (!visible) return null;

  const bulletPoints = [
    'Dunia Nokos hanya menyediakan kode OTP untuk verifikasi. Diterimanya OTP tidak menjamin berhasil login atau mendaftar akun.',
    'Keberhasilan login, pembatasan akun, dan pemblokiran nomor (banned/kenon) bergantung pada sistem WhatsApp. Kami tidak dapat memastikan penyebab pemblokiran atau menjamin nomor bebas dari pemblokiran.',
    'Pastikan metode pengiriman kode yang dipilih adalah SMS, bukan panggilan atau metode lainnya.',
    'Jika OTP belum masuk, tunggu sekitar 5–10 menit. Apabila tetap tidak masuk dan opsi pembatalan tersedia, batalkan pesanan sebelum membeli nomor baru.',
    'Anda dapat mencoba nomor atau pilihan harga lainnya, tetapi harga yang lebih tinggi tidak menjamin OTP lebih cepat masuk atau akun berhasil login.',
    'Jika ada kendala pengiriman OTP atau ketentuan yang belum jelas, hubungi admin untuk pengecekan sebelum melanjutkan pembelian.',
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="disclaimer-backdrop"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Modal */}
      <div className="disclaimer-modal">
        {/* Header */}
        <div className="disclaimer-header">
          <div className="disclaimer-header-icon">⚠️</div>
          <div className="disclaimer-header-text">
            <h2 className="disclaimer-title">Baca Sebelum Membeli</h2>
            <p className="disclaimer-subtitle">Ketentuan penting sebelum membeli NOKOS</p>
          </div>
        </div>

        {/* Content */}
        <div className="disclaimer-body">
          {/* Warning banner */}
          <div className="disclaimer-warning-banner">
            <span className="disclaimer-warning-icon">⚠️</span>
            <span>BACA TERLEBIH DAHULU SEBELUM MEMBELI NOKOS!</span>
          </div>

          {/* Bullet points */}
          <div className="disclaimer-points">
            {bulletPoints.map((point, i) => (
              <div key={i} className="disclaimer-point">
                <div className="disclaimer-point-bullet">
                  <span>{i + 1}</span>
                </div>
                <p>{point}</p>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="disclaimer-footer-note">
            <p>
              Dengan melanjutkan pembelian, Anda menyatakan telah membaca dan memahami ketentuan di atas.
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="disclaimer-action">
          <button
            className="disclaimer-btn"
            onClick={handleDismiss}
          >
            Saya Sudah Membaca
          </button>
        </div>
      </div>
    </>
  );
});

export default DisclaimerModal;
