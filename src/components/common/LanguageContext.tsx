"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Language = 'ar' | 'en';

export interface UserProfile {
  id: string;
  name_ar: string;
  name_en: string;
  role_ar: string;
  role_en: string;
  avatar: string;
  email: string;
  preferredLang: Language;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'usr-ops-01',
  name_ar: 'مدير العمليات',
  name_en: 'Operations Manager',
  role_ar: 'إدارة العمليات والتحكم اللوجستي',
  role_en: 'Operations & Logistics Control',
  avatar: 'OP',
  email: 'ops.manager@zahi.sa',
  preferredLang: 'ar',
};

// Comprehensive Dictionary for the Entire Zahi Control Tower
export const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Brand & System
    'brand.title': 'Zahi Control System',
    'brand.name': 'برج مراقبة زاهي',
    'brand.subtitle': 'نظام إدارة العمليات',
    'brand.tagline': 'منصة القيادة الذكية لسلاسل الإمداد ومطاعم زاهي',
    'status.online': 'متصل (Online)',
    'status.offline': 'غير متصل (Offline)',
    'status.live': 'مباشر',

    // Common Actions & Units
    'common.sar': 'ر.س',
    'common.unit': 'وحدة',
    'common.units': 'وحدات',
    'common.orders': 'أوامر',
    'common.close': 'إغلاق النافذة',
    'common.cancel': 'إلغاء',
    'common.confirm': 'تأكيد',
    'common.save': 'حفظ التعديلات',
    'common.edit': 'تعديل',
    'common.retry': 'إعادة المحاولة',
    'common.search': 'بحث...',
    'common.all': 'الكل',
    'common.view': 'عرض التفاصيل',
    'common.loading': 'جاري التحميل...',

    // Navigation & Sidebar
    'nav.dashboard': 'الرئيسية (Dashboard)',
    'nav.exceptions': 'مركز الاستثناءات (Exceptions)',
    'nav.notifications': 'الإشعارات (Notifications)',
    'nav.orders': 'الطلبات (Orders)',
    'nav.production': 'الإنتاج (Production)',
    'nav.inventory': 'إدارة المخزون (Inventory)',
    'nav.suppliers': 'الموردين (Suppliers)',
    'nav.discovery': 'اكتشاف الموردين (Discovery)',
    'sidebar.collapse': 'طي القائمة الجانبية',
    'sidebar.expand': 'توسيع القائمة الجانبية',
    'sidebar.openNav': 'فتح القائمة الجانبية',
    'sidebar.closeNav': 'إغلاق القائمة الجانبية',
    'sidebar.mainMenu': 'القائمة الرئيسية',
    'sidebar.agentSettings': 'إعدادات الوكيل الذكي',
    'sidebar.userProfile': 'الملف الشخصي',
    'sidebar.logout': 'تسجيل الخروج',

    // User Profile Modal
    'profile.modalTitle': 'الملف الشخصي للمستخدم',
    'profile.modalSubtitle': 'إدارة تفضيلات الحساب واللغة النشطة للنظام',
    'profile.activeUser': 'المستخدم النشط',
    'profile.name': 'الاسم الكامل',
    'profile.role': 'الدور الوظيفي',
    'profile.email': 'البريد الإلكتروني',
    'profile.userId': 'المعرف الوظيفي',
    'profile.languageSection': 'لغة واجهة النظام (Language)',
    'profile.languageDesc': 'تبديل فوري للغة النظام والاتجاه (RTL / LTR) وحفظ التفضيل في ملف المستخدم',
    'profile.arabic': 'العربية (AR)',
    'profile.english': 'English (EN)',
    'profile.status': 'حالة الحساب',
    'profile.active': 'نشط ومصرح',
    'profile.saveSuccess': 'تم تحديث تفضيلات المستخدم بنجاح ✨',
    'profile.accountSecurity': 'الصلاحيات الأمنية',
    'profile.securityLevel': 'مستوى التحكم الكامل (Level 4 - Operations Ops)',

    // Dashboard Page & KPIs
    'dashboard.title': 'لوحة القيادة التشغيلية (Control Tower)',
    'dashboard.subtitle': 'مراقبة الأداء اللحظي وسلاسل الإمداد لعمليات مطاعم زاهي (Zahi)',
    'dashboard.totalOrders': 'إجمالي الطلبات',
    'dashboard.activeOrders': 'الطلبات النشطة',
    'dashboard.openExceptions': 'استثناءات مفتوحة',
    'dashboard.requiresIntervention': 'تتطلب التدخل',
    'dashboard.criticalCount': 'حالات حرجة',
    'dashboard.delayedOrders': 'طلبات متأخرة',
    'dashboard.autoResolved': 'نسبة الحل التلقائي (AI)',
    'dashboard.humanIntervention': 'التدخل البشري',
    'dashboard.autonomyHeading': 'مستوى تحكم الـ Agent',
    'dashboard.currentMode': 'الوضع الحالي:',
    'dashboard.copilotLabel': 'مساعد (Copilot)',
    'dashboard.copilotDesc': 'يراقب العمليات ويقترح الإجراءات لاعتمادها',
    'dashboard.semiAutoLabel': 'شبه مستقل (Semi-Auto)',
    'dashboard.semiAutoDesc': 'يحل المشاكل البسيطة تلقائياً ويصعد المعقدة للإدارة',
    'dashboard.fullAutoLabel': 'مستقل بالكامل (Full-Auto)',
    'dashboard.fullAutoDesc': 'أتمتة كاملة للقرارات التشغيلية الذكية لزاهي',

    // Smart Inventory Page
    'inventory.title': 'إدارة المخزون والتوريد (Smart Inventory)',
    'inventory.subtitle': 'مراقبة استهلاك المواد التشغيلية والتنبؤ بطلبيات إعادة الشحن التلقائية لعمليات زاهي',
    'inventory.supabaseLive': 'قاعدة بيانات مباشرة (Supabase Live)',
    'inventory.suppliersDirectoryBtn': 'دليل الموردين والعروض',
    'inventory.dbErrorTitle': 'تنبيه اتصال قاعدة البيانات (Supabase)',
    'inventory.kpiTotalItems': 'إجمالي أصناف التشغيل',
    'inventory.kpiTotalItemsDesc': 'أصناف مسجلة في قاعدة البيانات',
    'inventory.kpiLowStock': 'أصناف تحت الحد الأدنى',
    'inventory.kpiLowStockDesc': 'تتطلب إصدار أوامر شراء فورية',
    'inventory.kpiActivePO': 'أوامر الشراء النشطة (PO)',
    'inventory.kpiActivePODesc': 'قيد المراجعة والمطابقة',
    'inventory.kpiCoverage': 'نسبة تغطية المخزون',
    'inventory.kpiCoverageDesc': 'جاهزية التوريد واستقرار العمليات',
    'inventory.categoryLabel': 'التصنيف:',
    'inventory.categoryAll': 'الكل',
    'inventory.searchPlaceholder': 'بحث بالاسم أو الكود أو التصنيف...',
    'inventory.statusStable': 'المخزون مستقر',
    'inventory.statusLow': 'تحت الحد الأدنى',
    'inventory.currentStockLabel': 'الكمية الحالية (current_stock):',
    'inventory.reorderLevelLabel': 'الحد الأدنى (reorder_level):',
    'inventory.itemCodeLabel': 'كود الصنف:',
    'inventory.coverageLevelLabel': 'مستوى التغطية:',
    'inventory.reorderLevelValue': 'مستوى إعادة الطلب:',
    'inventory.createUrgentPO': 'إنشاء أمر شراء عاجل (PO)',
    'inventory.proactiveSupply': 'طلب توريد استباقي',
    'inventory.noItemsFound': 'لم يتم العثور على أي أصناف مخزون مطابقة للبحث',
    'inventory.noItemsFoundHint': 'جرّب اختيار تصنيف آخر أو مسح كلمة البحث.',
    'inventory.poTableTitle': 'سجل أوامر الشراء المنشأة حديثاً (Purchase Orders)',
    'inventory.colPONumber': 'رقم الأمر',
    'inventory.colItem': 'الصنف',
    'inventory.colSupplier': 'المورد',
    'inventory.colQuantity': 'الكمية',
    'inventory.colEstimatedCost': 'التكلفة التقديرية',
    'inventory.colCreatedBy': 'المُنشئ',
    'inventory.colStatus': 'الحالة',
    'inventory.agentCreator': 'AI Agent',
    'inventory.humanCreator': 'موظف المشتريات',
    'inventory.statusSent': 'تم الإرسال',
    'inventory.statusApproved': 'معتمد',
    'inventory.statusPending': 'بانتظار الموافقة النهائية',
    'inventory.modalCreatePOTitle': 'إنشاء أمر شراء جديد (Purchase Order)',
    'inventory.modalRestockItem': 'إعادة تزويد مخزون:',
    'inventory.modalSupplierLabel': 'المورد المعتمد:',
    'inventory.modalQuantityLabel': 'الكمية المطلوبة (وحدة):',
    'inventory.modalTotalCostLabel': 'التكلفة التقديرية الإجمالية:',
    'inventory.modalConfirmPOBtn': 'تأكيد وإصدار أمر الشراء',
    'inventory.modalCancelBtn': 'إلغاء',
    'inventory.modalViewPOTitle': 'تفاصيل أمر الشراء',
    'inventory.modalPODocSubtitle': 'مستند توريد رسمي موجه للمورد',
    'inventory.modalEditPO': 'تعديل',
    'inventory.modalEditPOTitle': 'تعديل بيانات أمر الشراء',
    'inventory.modalSavePOEdit': 'حفظ التعديل',
    'inventory.modalClose': 'إغلاق النافذة',
    'inventory.modalSendToSupplier': 'تأكيد وإرسال للمورد (عبر الإيميل)',
    'inventory.modalAlreadySent': 'تم تأكيد وإرسال هذا الأمر للمورد مسبقاً',
    'inventory.modalRequestedItem': 'الصنف المطلوب',
    'inventory.modalCreatedAt': 'تاريخ الإنشاء',
    'inventory.modalCurrentStatus': 'حالة الأمر الحالية',
    'inventory.modalSentToSupplierBadge': 'تم الإرسال للمورد',
    'inventory.modalApprovedSupplier': 'المورد المعتمد',
    'inventory.modalIssuer': 'جهة الإصدار',

    // AI Chat Widget
    'chat.headerTitle': 'برج مراقبة زاهي',
    'chat.headerStatus': 'وكيل العمليات الذكي متصل',
    'chat.inputPlaceholder': 'اسأل الذكاء الاصطناعي لزاهي...',
    'chat.listening': '🎙️ جاري الاستماع لصوتك...',
    'chat.speakTooltip': 'تحدث بصوتك (Speech-to-Text)',
    'chat.stopRecording': 'إيقاف التسجيل الصوتي',
    'chat.launcherTooltip': 'مساعد زاهي الذكي (AI Operations Agent)',
    'chat.closeTooltip': 'إغلاق النافذة',
    'chat.send': 'إرسال',
    'chat.defaultUserMsg': 'ما أكثر المشاكل خطورة الآن؟',
    'chat.defaultAiMsgP1': 'لدينا مشكلة حرجة (High Risk) في زاهي تتمثل في تعارض بيانات التغليف للطلب ZH-2481 بسبب حذف العميل لـ "الأرز".',
    'chat.defaultAiMsgP2': 'وقد قمت للتو بإيقاف التغليف تلقائياً وإرسال تنبيه فوري للمشرف. 🚨',
    'chat.defaultAiMsgWarning': 'وهناك أيضاً تأخير محتمل في طلب زاهي (ZH-1092) بسبب الازدحام.',

    // Exceptions & Notifications
    'exceptions.title': 'مركز الاستثناءات (AI Exceptions)',
    'exceptions.subtitle': 'الحالات التشغيلية التي تتطلب الانتباه والتدخل في مطاعم زاهي (Zahi)',
    'exceptions.bulkTitle': 'إجراءات مجمعة ذكية (Smart Bulk Actions)',
    'exceptions.bulkDesc': 'حالة بسيطة/متوسطة مقترحة للحل التلقائي بواسطة الذكاء الاصطناعي.',
    'exceptions.bulkBtn': 'تنفيذ الإجراءات المجمعة بنقرة واحدة ⚡',
    'exceptions.noExceptions': 'لا توجد استثناءات نشطة تتطابق مع الفلتر المختار',
    'notifications.title': 'مركز الإشعارات (Notification Center)',
    'notifications.subtitle': 'سجل التنبيهات التشغيلية التي تتطلب تدخلك',
    'notifications.pendingTitle': 'إشعارات بانتظار الإجراء',
    'notifications.allClear': 'العمليات مستقرة، لا توجد تنبيهات معلقة حالياً',
    'notifications.executeAction': 'تنفيذ الإجراء',

    // Suppliers Page
    'suppliers.title': 'شبكة الموردين والمشتريات الذكية',
    'suppliers.subtitle': 'إدارة الموردين وعروض الأسعار والتحليل الذكي لأفضل البدائل',
    'suppliers.compareTitle': 'تحليل المقارنة الذكية للموردين (AI Matrix)',
    'suppliers.orderNow': 'إصدار أمر توريد مباشر',
  },
  en: {
    // Brand & System
    'brand.title': 'Zahi Control System',
    'brand.name': 'Zahi Control Tower',
    'brand.subtitle': 'Operations Management System',
    'brand.tagline': 'Smart Operational Command Platform for Supply Chains & Zahi Restaurants',
    'status.online': 'Online',
    'status.offline': 'Offline',
    'status.live': 'Live',

    // Common Actions & Units
    'common.sar': 'SAR',
    'common.unit': 'unit',
    'common.units': 'units',
    'common.orders': 'orders',
    'common.close': 'Close Window',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save Changes',
    'common.edit': 'Edit',
    'common.retry': 'Retry',
    'common.search': 'Search...',
    'common.all': 'All',
    'common.view': 'View Details',
    'common.loading': 'Loading...',

    // Navigation & Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.exceptions': 'Exceptions Center',
    'nav.notifications': 'Notifications',
    'nav.orders': 'Orders',
    'nav.production': 'Production',
    'nav.inventory': 'Smart Inventory',
    'nav.suppliers': 'Suppliers Directory',
    'nav.discovery': 'Supplier Discovery',
    'sidebar.collapse': 'Collapse Sidebar',
    'sidebar.expand': 'Expand Sidebar',
    'sidebar.openNav': 'Open Navigation Menu',
    'sidebar.closeNav': 'Close Navigation Menu',
    'sidebar.mainMenu': 'Main Menu',
    'sidebar.agentSettings': 'AI Agent Settings',
    'sidebar.userProfile': 'User Profile',
    'sidebar.logout': 'Sign Out',

    // User Profile Modal
    'profile.modalTitle': 'User Profile',
    'profile.modalSubtitle': 'Manage account preferences & active system interface language',
    'profile.activeUser': 'Active User',
    'profile.name': 'Full Name',
    'profile.role': 'Job Role',
    'profile.email': 'Email Address',
    'profile.userId': 'User ID',
    'profile.languageSection': 'System Interface Language',
    'profile.languageDesc': 'Instant toggle between Arabic RTL and English LTR, saved per user profile',
    'profile.arabic': 'العربية (AR)',
    'profile.english': 'English (EN)',
    'profile.status': 'Account Status',
    'profile.active': 'Active & Authorized',
    'profile.saveSuccess': 'User profile preferences updated successfully ✨',
    'profile.accountSecurity': 'Security Access',
    'profile.securityLevel': 'Full Administrative Control (Level 4 - Operations Ops)',

    // Dashboard Page & KPIs
    'dashboard.title': 'Operational Control Tower',
    'dashboard.subtitle': 'Real-time performance & supply chain monitoring for Zahi restaurants',
    'dashboard.totalOrders': 'Total Orders',
    'dashboard.activeOrders': 'Active Orders',
    'dashboard.openExceptions': 'Open Exceptions',
    'dashboard.requiresIntervention': 'Requires Intervention',
    'dashboard.criticalCount': 'Critical Cases',
    'dashboard.delayedOrders': 'Delayed Orders',
    'dashboard.autoResolved': 'AI Auto-Resolution Rate',
    'dashboard.humanIntervention': 'Human Intervention',
    'dashboard.autonomyHeading': 'AI Agent Autonomy Level',
    'dashboard.currentMode': 'Current Mode:',
    'dashboard.copilotLabel': 'Copilot',
    'dashboard.copilotDesc': 'Monitors operations and proposes actions for approval',
    'dashboard.semiAutoLabel': 'Semi-Auto',
    'dashboard.semiAutoDesc': 'Auto-resolves minor issues and escalates complex ones',
    'dashboard.fullAutoLabel': 'Full-Auto',
    'dashboard.fullAutoDesc': 'Complete autonomous operational decisions for Zahi',

    // Smart Inventory Page
    'inventory.title': 'Smart Inventory & Supply Management',
    'inventory.subtitle': 'Monitor consumables consumption and forecast automated restocking for Zahi operations',
    'inventory.supabaseLive': 'Live Database (Supabase Live)',
    'inventory.suppliersDirectoryBtn': 'Suppliers Directory & Quotes',
    'inventory.dbErrorTitle': 'Database Connection Alert (Supabase)',
    'inventory.kpiTotalItems': 'Total Operational Items',
    'inventory.kpiTotalItemsDesc': 'Items registered in database',
    'inventory.kpiLowStock': 'Items Below Minimum',
    'inventory.kpiLowStockDesc': 'Requires immediate purchase orders',
    'inventory.kpiActivePO': 'Active Purchase Orders (PO)',
    'inventory.kpiActivePODesc': 'Under review and matching',
    'inventory.kpiCoverage': 'Stock Coverage Rate',
    'inventory.kpiCoverageDesc': 'Supply readiness & operational stability',
    'inventory.categoryLabel': 'Category:',
    'inventory.categoryAll': 'All',
    'inventory.searchPlaceholder': 'Search by name, code or category...',
    'inventory.statusStable': 'Stable Stock',
    'inventory.statusLow': 'Low Stock',
    'inventory.currentStockLabel': 'Current Stock (current_stock):',
    'inventory.reorderLevelLabel': 'Reorder Level (reorder_level):',
    'inventory.itemCodeLabel': 'Item Code:',
    'inventory.coverageLevelLabel': 'Coverage Level:',
    'inventory.reorderLevelValue': 'Reorder Level:',
    'inventory.createUrgentPO': 'Create Urgent PO',
    'inventory.proactiveSupply': 'Proactive Supply Request',
    'inventory.noItemsFound': 'No inventory items matching your search',
    'inventory.noItemsFoundHint': 'Try selecting another category or clear search query.',
    'inventory.poTableTitle': 'Recent Purchase Orders Log (PO)',
    'inventory.colPONumber': 'PO Number',
    'inventory.colItem': 'Item',
    'inventory.colSupplier': 'Supplier',
    'inventory.colQuantity': 'Quantity',
    'inventory.colEstimatedCost': 'Est. Cost',
    'inventory.colCreatedBy': 'Created By',
    'inventory.colStatus': 'Status',
    'inventory.agentCreator': 'AI Agent',
    'inventory.humanCreator': 'Procurement Officer',
    'inventory.statusSent': 'Sent',
    'inventory.statusApproved': 'Approved',
    'inventory.statusPending': 'Pending Final Approval',
    'inventory.modalCreatePOTitle': 'Create New Purchase Order',
    'inventory.modalRestockItem': 'Restock inventory:',
    'inventory.modalSupplierLabel': 'Approved Supplier:',
    'inventory.modalQuantityLabel': 'Required Quantity (units):',
    'inventory.modalTotalCostLabel': 'Total Estimated Cost:',
    'inventory.modalConfirmPOBtn': 'Confirm & Issue Purchase Order',
    'inventory.modalCancelBtn': 'Cancel',
    'inventory.modalViewPOTitle': 'Purchase Order Details',
    'inventory.modalPODocSubtitle': 'Official supply document addressed to supplier',
    'inventory.modalEditPO': 'Edit',
    'inventory.modalEditPOTitle': 'Edit Purchase Order Details',
    'inventory.modalSavePOEdit': 'Save Changes',
    'inventory.modalClose': 'Close Window',
    'inventory.modalSendToSupplier': 'Confirm & Send to Supplier (Email)',
    'inventory.modalAlreadySent': 'This order was already sent to supplier',
    'inventory.modalRequestedItem': 'Requested Item',
    'inventory.modalCreatedAt': 'Created At',
    'inventory.modalCurrentStatus': 'Current PO Status',
    'inventory.modalSentToSupplierBadge': 'Sent to Supplier',
    'inventory.modalApprovedSupplier': 'Approved Supplier',
    'inventory.modalIssuer': 'Issued By',

    // AI Chat Widget
    'chat.headerTitle': 'Zahi Control Tower',
    'chat.headerStatus': 'AI Operations Agent Online',
    'chat.inputPlaceholder': 'Ask Zahi AI Agent...',
    'chat.listening': '🎙️ Listening to your voice...',
    'chat.speakTooltip': 'Speak (Speech-to-Text)',
    'chat.stopRecording': 'Stop voice recording',
    'chat.launcherTooltip': 'Zahi AI Assistant (AI Operations Agent)',
    'chat.closeTooltip': 'Close Window',
    'chat.send': 'Send',
    'chat.defaultUserMsg': 'What are the most critical issues right now?',
    'chat.defaultAiMsgP1': 'We have a critical High Risk issue in Zahi regarding packaging data conflict for order ZH-2481 due to customer removing "Rice".',
    'chat.defaultAiMsgP2': 'I have just automatically halted packaging and sent an instant alert to the supervisor. 🚨',
    'chat.defaultAiMsgWarning': 'There is also a potential delay in Zahi order (ZH-1092) due to rush hour.',

    // Exceptions & Notifications
    'exceptions.title': 'Exceptions Center (AI Exceptions)',
    'exceptions.subtitle': 'Operational cases requiring attention and intervention across Zahi restaurants',
    'exceptions.bulkTitle': 'Smart Bulk Actions',
    'exceptions.bulkDesc': 'minor/moderate issues suggested for automatic AI resolution.',
    'exceptions.bulkBtn': 'Execute Bulk Actions with One Click ⚡',
    'exceptions.noExceptions': 'No active exceptions match the selected filter',
    'notifications.title': 'Notification Center',
    'notifications.subtitle': 'Operational alerts requiring your review or intervention',
    'notifications.pendingTitle': 'Pending Action Notifications',
    'notifications.allClear': 'Operations are running smoothly, no pending alerts',
    'notifications.executeAction': 'Execute Action',

    // Suppliers Page
    'suppliers.title': 'Suppliers Network & Smart Procurement',
    'suppliers.subtitle': 'Manage verified suppliers, quotes and smart multi-criteria quotes comparison',
    'suppliers.compareTitle': 'Smart Suppliers Quote Analysis (AI Matrix)',
    'suppliers.orderNow': 'Issue Direct Purchase Order',
  },
};

// Common bilingual category lookup map for database items
export const CATEGORY_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  'صحون وأطباق': { ar: 'صحون وأطباق', en: 'Plates & Dishes' },
  'أكياس Holder': { ar: 'أكياس Holder', en: 'Bags & Holders' },
  'علب وبلاستيك': { ar: 'علب وبلاستيك', en: 'Containers & Plastics' },
  'مستلزمات تقديم': { ar: 'مستلزمات تقديم', en: 'Serving Cutlery' },
  'تغليف وعلب': { ar: 'تغليف وعلب', en: 'Packaging & Boxes' },
  'مواد تشغيلية وتغليف': { ar: 'مواد تشغيلية وتغليف', en: 'Operational & Packaging Supplies' },
};

// Item name translations for database items when English is selected
export const ITEM_NAME_TRANSLATIONS: Record<string, string> = {
  'بوكس وجبة زاهي': 'Zahi Meal Box',
  'كيس ورقي': 'Paper Bag Holder',
  'سليف الوجبة': 'Meal Sleeve',
  'علبة صوص 2 أونص': '2oz Sauce Container',
  'أدوات المائدة': 'Cutlery Set',
  'صحن مقاس 24': 'Plate Size 24',
  'صحن مقاس 32': 'Plate Size 32',
  'كوب ورقي 8 أونص': '8oz Paper Cup',
  'منديل معقم زاهي': 'Zahi Sanitized Napkin',
  'شريط لاصق زاهي': 'Zahi Branded Sealing Tape',
};

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  currentUser: UserProfile;
  toggleLanguage: (newLang: Language) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_USER_KEY = 'zahi_current_user_profile';
const STORAGE_LANG_KEY = 'zahi_system_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [lang, setLang] = useState<Language>('ar');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initialize from localStorage safely on client
  useEffect(() => {
    try {
      const storedUserStr = localStorage.getItem(STORAGE_USER_KEY);
      let activeUser = DEFAULT_USER_PROFILE;

      if (storedUserStr) {
        try {
          const parsed = JSON.parse(storedUserStr);
          activeUser = { ...DEFAULT_USER_PROFILE, ...parsed };
        } catch (e) {
          console.warn('Could not parse stored user profile:', e);
        }
      }

      // Read preferred language from user profile or fallback key
      const storedLang = (localStorage.getItem(STORAGE_LANG_KEY) || activeUser.preferredLang) as Language;
      const initialLang: Language = storedLang === 'en' ? 'en' : 'ar';

      activeUser.preferredLang = initialLang;
      setCurrentUser(activeUser);
      setLang(initialLang);

      // Apply HTML attributes
      document.documentElement.lang = initialLang;
      document.documentElement.dir = initialLang === 'ar' ? 'rtl' : 'ltr';
    } catch (e) {
      console.warn('Error reading language from localStorage:', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const toggleLanguage = useCallback((newLang: Language) => {
    setLang(newLang);

    // Apply document layout direction immediately
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    }

    // Persist per-user and globally
    setCurrentUser(prev => {
      const updatedUser: UserProfile = { ...prev, preferredLang: newLang };
      try {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
        localStorage.setItem(STORAGE_LANG_KEY, newLang);
      } catch (err) {
        console.warn('Failed saving user language preference:', err);
      }
      return updatedUser;
    });
  }, []);

  const updateUserProfile = useCallback((profileUpdates: Partial<UserProfile>) => {
    setCurrentUser(prev => {
      const updated: UserProfile = { ...prev, ...profileUpdates };
      try {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updated));
        if (profileUpdates.preferredLang && profileUpdates.preferredLang !== lang) {
          toggleLanguage(profileUpdates.preferredLang);
        }
      } catch (err) {
        console.warn('Failed saving user profile:', err);
      }
      return updated;
    });
  }, [lang, toggleLanguage]);

  const t = useCallback((key: string, fallback?: string): string => {
    const dict = translations[lang] || translations.ar;
    if (dict && dict[key] !== undefined) {
      return dict[key];
    }
    // Fallback to Arabic if English key missing
    if (translations.ar && translations.ar[key] !== undefined) {
      return translations.ar[key];
    }
    return fallback || key;
  }, [lang]);

  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';
  const isRtl = lang === 'ar';

  const contextValue = useMemo(() => ({
    lang,
    dir,
    isRtl,
    currentUser,
    toggleLanguage,
    updateUserProfile,
    t,
  }), [lang, dir, isRtl, currentUser, toggleLanguage, updateUserProfile, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
