import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3001'),
  title: '企擎协作台 · XEng Platform 0.1.0',
  description: '南通企擎四人团队的共享项目管理、甘特排期与权限协作平台',
  openGraph: {
    title: '企擎协作台',
    description: '共享项目底账 · 甘特排期 · 四人权限协作',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '企擎协作台',
    description: '共享项目底账 · 甘特排期 · 四人权限协作',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
