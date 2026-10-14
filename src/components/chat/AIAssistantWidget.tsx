"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mockOperationService } from '@/application/services/mockOperationService';
import { useNotification } from '@/components/common/NotificationContext';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string | React.ReactNode;
}

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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

  const handleSend = async () => {
    if (!inputValue.trim()) return;

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

      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.reply }]);
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
      {/* Draggable Glassmorphic Chat Window */}
      <motion.div 
        drag
        dragMomentum={false}
        className={`bg-white/60 backdrop-blur-2xl border border-white/60 shadow-2xl w-80 md:w-96 rounded-3xl overflow-hidden mb-4 flex-col h-[480px] transition-all cursor-auto ${isOpen ? 'flex' : 'hidden'}`}
      >
        {/* Drag Handle Bar & Header */}
        <div className="bg-gradient-to-r from-sky-500/80 to-teal-500/80 backdrop-blur-md text-white pt-2.5 pb-3 px-4 shadow-sm z-10 select-none border-b border-white/20">
          {/* Centered Visual Drag Handle */}
          <div className="flex justify-center w-full mb-2">
            <div 
              className="w-12 h-1.5 bg-white/50 hover:bg-white/80 rounded-full cursor-grab active:cursor-grabbing transition-colors" 
              title="اسحب لتحريك النافذة"
            />
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/30">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5">
                  برج مراقبة زاهي
                  <span className="text-[10px] bg-white/25 text-white border border-white/40 px-1.5 py-0.5 rounded-md font-normal">AI</span>
                </h3>
                <p className="text-xs text-teal-100 flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse shadow-sm shadow-emerald-300/50"></span>
                  متصل بـ Gemini
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-white/80 hover:text-white transition-colors bg-white/20 hover:bg-white/30 p-1.5 rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-sm cursor-pointer"
            >
              ✕
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
                  : 'self-start bg-white/80 backdrop-blur-md border border-white/90 text-gray-800 shadow-sm rounded-tl-sm'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="absolute -top-3 -left-2 text-xl">✨</div>
              )}
              {/* For real responses we render it as text, for mock ones it could be ReactNode */}
              <div className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          ))}
          
          {isTyping && (
            <div className="self-start bg-white/80 backdrop-blur-md border border-white/90 p-3.5 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm flex gap-1 items-center h-12">
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>
        
        {/* Chat Input */}
        <div className="p-3 bg-white/60 backdrop-blur-md border-t border-white/60 flex gap-2">
          <input 
            type="text" 
            placeholder="اسأل الذكاء الاصطناعي لزاهي..." 
            className="flex-1 border border-white/80 bg-white/80 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner text-slate-800"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="bg-teal-600 text-white p-2.5 w-11 h-11 rounded-full hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shadow-md shadow-teal-600/30 cursor-pointer"
          >
            ↑
          </button>
        </div>
      </motion.div>

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
          isOpen 
            ? 'bg-slate-800 text-white rotate-90 shadow-slate-800/40' 
            : 'bg-gradient-to-tr from-sky-500 to-teal-600 text-white shadow-teal-600/30 border border-teal-400/40'
        }`}
      >
        {isOpen ? '✕' : <span className="text-2xl animate-pulse">✨</span>}
      </button>
    </div>
  );
}
