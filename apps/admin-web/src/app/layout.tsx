import './global.css';

export const metadata = {
  title: 'Payflow Admin',
  description: 'Payflow operations administration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
