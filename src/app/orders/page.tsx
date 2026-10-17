"use client";

import { useState } from 'react';
import { mockOperationService } from '@/application/services/mockOperationService';
import Link from 'next/link';
import SmartFilterBar from '@/components/common/SmartFilterBar';

const statusColorMap: Record<string, string> = {
  PENDING: 'glass glass-card text-white border ',
  KITCHEN_PREP: 'glass glass-card text-white border ',
  PACKING: 'glass glass-card text-white border ',
  READY_FOR_DELIVERY: 'glass glass-card text-white border ',
  OUT_FOR_DELIVERY: 'glass glass-card text-white border ',
  DELIVERED: 'bg-teal-700/20 text-white border border-white/14',
  CANCELLED: 'bg-rose-500/20 text-rose-800 border border-rose-400/40',
};

const statusNameMap: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  KITCHEN_PREP: 'في المطبخ',
  PACKING: 'التغليف',
  READY_FOR_DELIVERY: 'جاهز للتوصيل',
  OUT_FOR_DELIVERY: 'في الطريق',
  DELIVERED: 'تم التوصيل',
  CANCELLED: 'ملغي',
};

export default function OrdersPage() {
  const [selectedBrand, setSelectedBrand] = useState('zahi');
  
  const allOrders = mockOperationService.getAllOrders();

  const filteredOrders = allOrders.filter(order => {
    return selectedBrand === 'ALL' || order.brand.toLowerCase() === selectedBrand.toLowerCase();
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="max-w-6xl w-full mx-auto space-y-6">
      {/* Title Container with 28px radius */}
      <header className="glass rounded-[24px] p-6 mb-6">
        <h1 className="text-3xl font-extrabold text-white">سجل الطلبات</h1>
        <p className="text-white/65 font-semibold text-sm mt-2">عرض شامل لجميع الطلبات في النظام</p>
      </header>

      <SmartFilterBar 
        selectedBrand={selectedBrand}
        onBrandChange={setSelectedBrand}
        showDepartment={false}
      />

      <div className="glass rounded-[24px] mt-6 border">
        <table className="w-full text-right text-sm text-white">
          <thead className="glass glass-card text-white text-xs uppercase font-extrabold border-b">
            <tr>
              <th className="px-6 py-4">رقم الطلب</th>
              <th className="px-6 py-4">العلامة التجارية</th>
              <th className="px-6 py-4">العميل</th>
              <th className="px-6 py-4">الحالة</th>
              <th className="px-6 py-4">وقت الإنشاء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20">
            {sortedOrders.length > 0 ? (
              sortedOrders.map((order) => {
                const status = order.status || 'KITCHEN_PREP';
                
                return (
                  <tr key={order.id} className="hover:bg-white/10 transition-colors">
                    <td className="px-6 py-4 font-bold text-white font-mono">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs glass glass-card text-white border px-2.5 py-1 rounded-lg font-bold">
                        زاهي
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">{order.customer.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColorMap[status]}`}>
                        {statusNameMap[status] || status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/65 font-mono font-bold">
                      {new Date(order.createdAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-white font-bold glass glass-card">
                  لا توجد طلبات تتطابق مع الفلتر المختار
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
