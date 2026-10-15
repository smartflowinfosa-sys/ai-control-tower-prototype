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
            لدينا <strong className="text-red-600 bg-red-50 px-1 rounded">مشكلة حرجة (High Risk)</strong> في <strong className="text-sky-600">زاهي</strong> تتمثل في تعارض بيانات التغليف للطلب <Link href="/orders/o-zh-2481" className="text-sky-600 font-bold hover:underline bg-sky-50 px-1 rounded">ZH-2481</Link> بسبب حذف العميل لـ "الأرز".
          </p>
          <p className="mb-3 leading-relaxed">
            وقد قمت للتو <strong className="text-teal-700 bg-teal-50 px-1 rounded">بإيقاف التغليف تلقائياً</strong> وإرسال تنبيه فوري للمشرف. 🚨
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-start gap-1">
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
        if (transcript) {
          setInputValue(initialText ? `${initialText} ${transcript.trim()}` : transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userMessage }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const kpis = mockOperationService.getDashboardKPIs();
      const activeExceptions = mockOperationService.getActiveExceptions();
      
      const contextData = {
        kpis,
        exceptions: activeExceptions.map(exc => ({
          orderId: exc.orderId,
          brand: exc.brand,
          title: exc.title,
          department: exc.department,
          riskLevel: exc.riskLevel,
          status: exc.status
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
    <div className="fixed bottom-6 left-6 z-50">
      {/* Draggable Glassmorphic Chat Window - Kept permanently in DOM to preserve chat memory */}
      <motion.div 
        drag
        dragMomentum={false}
        className={`bg-white/70 backdrop-blur-2xl border border-white/70 shadow-2xl w-80 md:w-96 rounded-3xl overflow-hidden mb-4 flex-col h-[480px] transition-all cursor-auto ${isOpen ? 'flex' : 'hidden'}`}
      >
        {/* Drag Handle Bar & Header */}
        <div className="bg-gradient-to-r from-sky-500/85 to-teal-600/85 backdrop-blur-md text-white pt-2.5 pb-3 px-4 shadow-sm z-10 select-none border-b border-white/20">
          {/* Centered Visual Drag Handle */}
          <div className="flex justify-center w-full mb-2">
            <div 
              className="w-12 h-1.5 bg-white/50 hover:bg-white/80 rounded-full cursor-grab active:cursor-grabbing transition-colors" 
              title="اسحب لتحريك نافذة المحادثة"
            />
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/30">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5">
                  برج مراقبة زاهي
                  <span className="text-[10px] bg-white/25 text-white border border-white/40 px-1.5 py-0.5 rounded-md font-normal">AI</span>
                </h3>
                <p className="text-xs text-teal-100 flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse shadow-sm shadow-emerald-300/50"></span>
                  وكيل العمليات الذكي متصل
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-white/80 hover:text-white transition-colors bg-white/20 hover:bg-white/30 p-1.5 rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-sm cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Message Container */}
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-teal-50/20 to-white/40 flex flex-col gap-3.5 backdrop-blur-sm">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`p-3.5 rounded-2xl max-w-[85%] text-sm relative transition-all break-words ${
                msg.sender === 'user' 
                  ? 'self-end bg-gradient-to-r from-sky-500 to-teal-600 text-white shadow-md shadow-teal-600/20 rounded-tr-sm' 
                  : 'self-start bg-white/85 backdrop-blur-md border border-white/90 text-gray-800 shadow-sm rounded-tl-sm'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="absolute -top-3 -left-2 text-xl">✨</div>
              )}
              <div className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          ))}
          
          {isTyping && (
            <div className="self-start bg-white/85 backdrop-blur-md border border-white/90 p-3.5 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm flex gap-1 items-center h-12">
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>
        
        {/* Chat Input Bar with Speech-to-Text */}
        <div className="p-3 bg-white/70 backdrop-blur-md border-t border-white/60 flex items-center gap-2">
          <input 
            type="text" 
            placeholder={isListening ? "🎙️ جاري الاستماع لصوتك..." : "اسأل الذكاء الاصطناعي لزاهي..."} 
            className={`flex-1 border bg-white/90 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner text-slate-800 ${
              isListening ? 'border-rose-400 ring-2 ring-rose-300/50 bg-rose-50/50 placeholder:text-rose-600' : 'border-white/80'
            }`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Voice Input Microphone Button */}
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? "إيقاف التسجيل الصوتي" : "تحدث بصوتك (Speech-to-Text)"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0 ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40 ring-2 ring-rose-300'
                : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-teal-600 border border-slate-200/80 active:scale-95'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Send Button */}
          <button 
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="bg-teal-600 text-white p-2.5 w-10 h-10 rounded-full hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shadow-md shadow-teal-600/30 cursor-pointer shrink-0"
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
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
            isOpen 
              ? 'bg-slate-800 text-white rotate-90 shadow-slate-800/40' 
              : 'bg-gradient-to-tr from-sky-500 to-teal-600 text-white shadow-teal-600/30 border border-teal-400/40'
          }`}
          title="مساعد زاهي الذكي (AI Operations Agent)"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
        </button>
      </motion.div>
    </div>
  );
}
