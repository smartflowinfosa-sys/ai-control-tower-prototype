import PackagingClient from './PackagingClient';

export const metadata = {
  title: 'تقرير التغليف وبوليصات التوصيل المباشرة | Zahi Control Tower',
  description: 'متابعة مباشرة لبوليصات التوصيل وتوزيع الوجبات على العملاء وفروع الإرسال من نظام تكرار (Techrar)',
};

export default function PackagingPage() {
  return <PackagingClient />;
}
