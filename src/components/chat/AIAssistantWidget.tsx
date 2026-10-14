"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
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
            لدينا <strong className="text-red-600 bg-red-50 px-1 rounded">مشكلة حرجة (High Risk)</strong> في <strong className="text-emerald-700">زاهي</strong> تتمثل في تعارض بيانات التغليف للطلب <Link href="/orders/o-zh-2481" className="text-indigo-600 font-bold hover:underline bg-indigo-50 px-1 rounded">ZH-2481</Link> بسبب حذف العميل لـ "الأرز".
          </p>
          <p className="mb-3 leading-relaxed">
            وقد قمت للتو <strong className="text-orange-600">بإيقاف التغليف تلقائياً</strong> وإرسال تنبيه فوري للمشرف. 🚨
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-start gap-1">
            <span>⚠️</span>
            <span>وهناك أيضاً تأخير محتمل في طلب موزون (MZ-1092) بسبب الازدحام.</span>
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
      {/* Chat Window: Preserved in DOM with CSS visibility to keep chat memory */}
      <div className={`bg-white w-80 md:w-96 rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mb-4 flex-col h-[450px] transform transition-all ${isOpen ? 'flex' : 'hidden'}`}>
        <div className="bg-gradient-to-r from-gray-900 to-indigo-900 text-white p-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">AI Control Tower</h3>
              <p className="text-xs text-indigo-200 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                متصل بـ Gemini
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-white transition-colors bg-white/10 p-1.5 rounded-full hover:bg-white/20">
            ✕
          </button>
        </div>
        
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto bg-gray-50/50 flex flex-col gap-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`p-3.5 rounded-2xl max-w-[85%] shadow-sm text-sm relative ${
                msg.sender === 'user' 
                  ? 'self-end bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm' 
                  : 'self-start bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="absolute -top-3 -left-2 text-xl">✨</div>
              )}
              {/* For real responses we render it as text, for mock ones it could be ReactNode */}
              <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>
            </div>
          ))}
          
          {isTyping && (
            <div className="self-start bg-white border border-gray-200 p-3.5 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm flex gap-1 items-center h-12">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>
        
        <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
          <input 
            type="text" 
            placeholder="اسأل الذكاء الاصطناعي..." 
            className="flex-1 border border-gray-200 bg-gray-50 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="bg-indigo-600 text-white p-2.5 w-11 h-11 rounded-full hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-transform active:scale-95 shadow-md"
          >
            ↑
          </button>
        </div>
      </div>

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 ${
          isOpen ? 'bg-gray-800 text-white rotate-90' : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'
        }`}
      >
        {isOpen ? '✕' : <span className="text-2xl animate-pulse">✨</span>}
      </button>
    </div>
  );
}
