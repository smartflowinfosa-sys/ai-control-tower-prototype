"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Mic, MicOff, X } from 'lucide-react';
import { mockOperationService } from '@/application/services/mockOperationService';
import { useNotification } from '@/components/common/NotificationContext';
import { initialInventoryItems, addPurchaseOrderToSession, PurchaseOrder } from '@/lib/mockInventoryData';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string | React.ReactNode;
}

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { resolveNotification } = useNotification();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      sender: 'user',
      text: 'ما أكثر المشاكل خطورة الآن؟',
    },
    {
      id: 'msg-2',
      sender: 'ai',
      text: (
        <>
          <p className="mb-3 leading-relaxed">
            لدينا <strong className="text-amber-200 bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 rounded font-bold">مشكلة حرجة (High Risk)</strong> في <strong className="text-white">زاهي</strong> تتمثل في تعارض بيانات التغليف للطلب <Link href="/orders/o-zh-2481" className="text-white font-extrabold hover:underline glass glass-card border px-1.5 py-0.5 rounded">ZH-2481</Link> بسبب حذف العميل لـ "الأرز".
          </p>
          <p className="mb-3 leading-relaxed">
            وقد قمت للتو <strong className="text-white glass glass-card px-1.5 py-0.5 rounded font-bold">بإيقاف التغليف تلقائياً</strong> وإرسال تنبيه فوري للمشرف. 🚨
          </p>
          <div className="mt-3 pt-3 border-t border-white/14 text-xs text-white/65 font-bold flex items-start gap-1">
            <span>⚠️</span>
            <span>وهناك أيضاً تأخير محتمل في طلب زاهي (ZH-1092) بسبب الازدحام.</span>
          </div>
        </>
      ),
    }
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Voice Input Speech-to-Text Handler
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("عذراً، متصفحك لا يدعم الإدخال الصوتي (Web Speech API). يرجى استخدام متصفح Google Chrome أو Microsoft Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;

      let initialText = inputValue;

      recognition.onstart = () => {
        initialText = inputValue;
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputValue(initialText ? `${initialText} ${transcript}` : transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userMessage }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const activeExceptions = mockOperationService.getActiveExceptions().map(e => ({
        id: e.id,
        category: e.category,
        title: e.title,
        riskLevel: e.riskLevel,
        suggestedAction: e.suggestedAction
      }));

      const activeOrders = mockOperationService.getAllOrders().map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        brand: o.brand,
        isDelayed: o.deliveryStatus?.isDelayed
      }));

      const contextData = {
        activeExceptions,
        activeOrders,
        inventoryStatus: initialInventoryItems.map(i => ({
          name: i.name,
          currentStock: i.currentStock,
          minThreshold: i.minThreshold,
          unit: i.unit,
          category: i.category
        }))
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userMessage, contextData }),
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        const errorText = data.error || 'حدث خطأ غير معروف في خوادم الذكاء الاصطناعي.';
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: errorText }]);
        return;
      }

      // Execution Bridge for AI Actions
      const isAction = data.type === 'action' || Boolean(data.functionCall);
      const action = data.action || data.functionCall?.args?.action;
      const exceptionId = data.exceptionId || data.functionCall?.args?.exceptionId;

      if (isAction && action === 'resolve' && exceptionId) {
        resolveNotification(exceptionId, 'ai');
        mockOperationService.resolveException?.(exceptionId);
      }

      // Capture create_purchase_order Tool
      const isPOAction =
        data.type === 'purchase_order' ||
        (data.type === 'action' && data.functionCall?.name === 'create_purchase_order') ||
        data.toolName === 'create_purchase_order' ||
        data.functionCall?.name === 'create_purchase_order';

      let replyText = data.reply || data.text;
      if (isPOAction) {
        const itemId = data.itemId || data.functionCall?.args?.itemId || 'أدوات المائدة';
        const supplierName = data.supplierName || data.functionCall?.args?.supplierName || 'مصنع البلاستيك الوطني';
        const quantity = data.quantity || data.functionCall?.args?.quantity || 2000;

        // Match item to calculate estimated unit cost
        const matchedItem = initialInventoryItems.find(
          item => item.name.includes(itemId) || itemId.includes(item.name) || item.id === itemId
        );
        const unitCost = matchedItem ? matchedItem.unitCost : 0.48;
        const totalCost = Number((quantity * unitCost).toFixed(2));

        const newAIPO: PurchaseOrder = {
          id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
          itemId: matchedItem ? matchedItem.id : 'inv-5',
          itemName: matchedItem ? matchedItem.name : itemId,
          supplierName: supplierName,
          quantity: quantity,
          totalCost: totalCost,
          status: 'PENDING_APPROVAL',
          createdAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          createdBy: 'AI_AGENT',
        };

        // Add to shared session store and fire real-time custom event for local state
        addPurchaseOrderToSession(newAIPO);

        replyText = `✅ إجراء آلي: تم إنشاء أمر شراء ${newAIPO.id} لعدد ${quantity.toLocaleString('ar-SA')} من [${newAIPO.itemName}] من المورد [${supplierName}] بنجاح، وظهر الآن في سجل أوامر الشراء بانتظار الموافقة النهائية.`;
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: replyText }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: '⚠️ حدث خطأ أثناء الاتصال بالخادم.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="chat-anchor fixed bottom-6 left-6 z-50 flex flex-col items-start gap-4">
      {/* Floating Chat Modal */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={isOpen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.85, y: 30, pointerEvents: 'none' }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className={`chat-glass glass-popover flex flex-col text-white ${
          !isOpen && 'hidden'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/30 flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/15 border border-teal-300/30 p-2 rounded-[18px] text-teal-100">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-wide flex items-center gap-1.5 text-white">
                  برج مراقبة زاهي
                  <span className="text-[10px] bg-teal-500/15 border border-teal-300/30 text-teal-100 px-1.5 py-0.5 rounded-md font-bold">AI</span>
                </h3>
                <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                  وكيل العمليات الذكي متصل
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-white/80 hover:text-white transition-colors bg-white/8 hover:bg-white/15 p-1.5 rounded-full w-8 h-8 flex items-center justify-center border border-white/30 cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Message Container */}
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`p-3.5 rounded-2xl max-w-[85%] text-sm relative transition-all break-words ${
                msg.sender === 'user' 
                  ? 'self-end bg-white/8 border border-white/60 text-white rounded-tr-xs font-semibold '
                  : 'self-start bg-teal-600/10 border border-teal-300/30 text-white rounded-tl-xs font-semibold '
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="absolute -top-3 -left-2 text-xl">✨</div>
              )}
              <div className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          ))}
          
          {isTyping && (
            <div className="self-start bg-teal-600/10 border border-teal-300/30 p-3.5 rounded-[18px] rounded-tl-xs max-w-[85%] flex gap-1.5 items-center h-12 ">
              <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>
        
        {/* Chat Input Bar with Speech-to-Text */}
        <div className="p-3 border-t border-white/30 flex items-center gap-2">
          <input 
            type="text" 
            placeholder={isListening ? "🎙️ جاري الاستماع لصوتك..." : "اسأل الذكاء الاصطناعي لزاهي..."} 
            className="flex-1 border border-white/35 bg-white/8 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 focus:bg-white/8 transition-all text-white placeholder:text-white/65 font-medium"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Voice Input Microphone Button */}
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? "إيقاف التسجيل الصوتي" : "تحدث بصوتك (Speech-to-Text)"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-500/20 border border-rose-400/50 text-rose-200 animate-pulse'
                : 'bg-white/8 hover:bg-white/15 text-white border border-white/30 active:scale-95'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Send Button */}
          <button 
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="bg-white/20 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2.5 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 font-extrabold "
          >
            ↑
          </button>
        </div>
      </motion.div>

      {/* Draggable Floating Toggle Button */}
      <motion.div 
        drag 
        dragMomentum={false} 
        className="w-fit cursor-grab active:cursor-grabbing inline-block"
      >
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`chat-launcher glass flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
            isOpen 
              ? 'text-white rotate-90'
              : 'text-white hover:bg-white/15'
          }`}
          title="مساعد زاهي الذكي (AI Operations Agent)"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
        </button>
      </motion.div>
    </div>
  );
}
