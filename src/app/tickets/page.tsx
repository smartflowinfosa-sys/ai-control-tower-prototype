import TicketsClient from './TicketsClient';

export const metadata = {
  title: 'التذاكر والعمليات 🎫 | Zahi Control Tower',
  description: 'منظومة إدارة التذاكر التشغيلية وطلبات التعويض والشكاوى والتنسيق بين الأقسام',
};

export default function TicketsPage() {
  return <TicketsClient />;
}

