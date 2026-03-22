import './globals.css';

export const metadata = {
  title: 'DuniaNokos - Beli Nomor OTP Murah',
  description: 'Platform terpercaya untuk membeli nomor virtual OTP dari seluruh dunia. Harga terjangkau, proses cepat, banyak pilihan aplikasi.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
