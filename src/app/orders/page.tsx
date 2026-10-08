"use client";

import { useState } from 'react';
import { mockOperationService } from '@/application/services/mockOperationService';
import Link from 'next/link';
import SmartFilterBar from '@/components/common/SmartFilterBar';

const statusColorMap: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  KITCHEN_PREP: 'bg-blue-100 text-blue-800',
  PACKING: 'bg-purple-100 text-purple-800',
  READY_FOR_DELIVERY: 'bg-amber-100 text-amber-800',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
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
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  
  const allOrders = mockOperationService.getAllOrders();

  const filteredOrders = allOrders.filter(order => {
    return selectedBrand === 'ALL' || order.brand === selectedBrand;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="max-w-6xl w-full mx-auto">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">سجل الطلبات</h1>
        <p className="text-gray-500 text-sm mt-2">عرض شامل لجميع الطلبات في النظام</p>
      </header>

      <SmartFilterBar 
        selectedBrand={selectedBrand}
        onBrandChange={setSelectedBrand}
        showDepartment={false}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-right text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-medium border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">رقم الطلب</th>
              <th className="px-6 py-4">العلامة التجارية</th>
              <th className="px-6 py-4">العميل</th>
              <th className="px-6 py-4">الحالة</th>
              <th className="px-6 py-4">وقت الإنشاء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedOrders.length > 0 ? (
              sortedOrders.map((order) => {
                const brandColor = order.brand === 'ZAHI' ? 'text-[var(--color-zahi-primary)]' : 'text-[var(--color-mawzoon-primary)]';
                const status = order.status || 'KITCHEN_PREP';
                
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800">
                      <Link href={`/orders/${order.id}`} className="hover:text-indigo-600 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className={`px-6 py-4 font-bold ${brandColor}`}>{order.brand === 'ZAHI' ? 'زاهي' : 'موزون'}</td>
                    <td className="px-6 py-4">{order.customer.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${statusColorMap[status]}`}>
                        {statusNameMap[status] || status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold bg-gray-50">
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
