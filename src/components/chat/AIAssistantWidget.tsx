"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mic, MicOff, Paperclip, X, Image as ImageIcon, Send, Sparkles } from 'lucide-react';
import { mockOperationService } from '@/application/services/mockOperationService';
import { useNotification } from '@/components/common/NotificationContext';
import { useLanguage } from '@/components/common/LanguageContext';
import { initialInventoryItems, addPurchaseOrderToSession, PurchaseOrder } from '@/lib/mockInventoryData';

interface AttachedImage {
  base64: string;
  mimeType: string;
  name: string;
  previewUrl: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string | React.ReactNode;
  image?: string; // base64 preview for user uploaded image
  provider?: string;
}

export default function AIAssistantWidget() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  const { lang, isRtl } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);

  // Clean initial state: completely empty
  const [messages, setMessages] = useState<Message[]>([]);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { resolveNotification } = useNotification();

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Handle Image File Selection (Multimodal)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(lang === 'en' ? 'Please upload an image file (PNG, JPG, WEBP).' : 'يرجى رفع ملف صورة بصيغة صحيحة (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAttachedImage({
        base64: result,
        mimeType: file.type,
        name: file.name,
        previewUrl: result,
      });
    };
    reader.readAsDataURL(file);

    // Reset input so re-selecting same file works
    e.target.value = '';
  };

  const removeAttachedImage = () => {
    setAttachedImage(null);
  };

  // Voice Input Speech-to-Text Handler (Web Speech API - ar-SA)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        lang === 'en'
          ? 'Your browser does not support Speech Recognition. Please use Chrome or Edge.'
          : 'عذراً، متصفحك لا يدعم الإدخال الصوتي (Web Speech API). يرجى استخدام متصفح Google Chrome أو Microsoft Edge.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA'; // strictly ar-SA
      recognition.continuous = false;
      recognition.interimResults = true;

      let capturedTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        capturedTranscript = transcript;
        setInputValue(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-submit as text if speech was captured
        if (capturedTranscript.trim().length > 0) {
          handleSend(capturedTranscript.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Handle Message Sending
  const handleSend = async (overridePrompt?: string) => {
    const textToSend = overridePrompt !== undefined ? overridePrompt : inputValue;
    const currentAttachment = attachedImage;

    if (!textToSend.trim() && !currentAttachment) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: textToSend.trim() || (lang === 'en' ? 'Attached image for analysis' : 'صورة مرفقة للتحليل'),
      image: currentAttachment?.previewUrl,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue('');
    setAttachedImage(null);
    setIsTyping(true);

    try {
      const activeExceptions = mockOperationService.getActiveExceptions().map((e) => ({
        id: e.id,
        category: e.category,
        title: e.title,
        riskLevel: e.riskLevel,
        suggestedAction: e.suggestedAction,
      }));

      const activeOrders = mockOperationService
        .getAllOrders()
        .filter((o) => o.status !== 'DELIVERED')
        .slice(0, 15)
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          brand: o.brand,
          isDelayed: o.deliveryStatus?.isDelayed,
        }));

      const contextData = {
        activeExceptions,
        activeOrders,
        inventoryStatus: initialInventoryItems
          .filter((i) => i.currentStock <= i.minThreshold * 1.5 || i.currentStock < 500)
          .slice(0, 15)
          .map((i) => ({
            name: i.name,
            currentStock: i.currentStock,
            minThreshold: i.minThreshold,
            unit: i.unit,
            category: i.category,
          })),
        productionTarget: 215,
      };

      // Payload includes multimodal image if attached
      const payload: any = {
        prompt: textToSend.trim(),
        contextData,
      };

      if (currentAttachment) {
        payload.image = {
          data: currentAttachment.base64,
          mimeType: currentAttachment.mimeType,
        };
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorText = data.error || (lang === 'en' ? 'AI server connection error.' : 'حدث تعذر مؤقت في الاتصال بالذكاء الاصطناعي.');
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), sender: 'ai', text: errorText },
        ]);
        return;
      }

      // Handle function execution (e.g. resolve exception or purchase order)
      const isAction = data.type === 'action' || Boolean(data.functionCall);
      const action = data.action || data.functionCall?.args?.action;
      const exceptionId = data.exceptionId || data.functionCall?.args?.exceptionId;

      if (isAction && action === 'resolve' && exceptionId) {
        resolveNotification(exceptionId, 'ai');
        mockOperationService.resolveException?.(exceptionId);
      }

      const isPOAction =
        data.type === 'purchase_order' ||
        (data.type === 'action' && data.functionCall?.name === 'create_purchase_order') ||
        data.toolName === 'create_purchase_order' ||
        data.functionCall?.name === 'create_purchase_order';

      let replyText = data.reply || data.text;
      if (isPOAction) {
        const itemId = data.itemId || data.functionCall?.args?.itemId || 'أدوات المائدة والتغليف';
        const supplierName = data.supplierName || data.functionCall?.args?.supplierName || 'مصنع البلاستيك الوطني';
        const quantity = data.quantity || data.functionCall?.args?.quantity || 2000;

        const matchedItem = initialInventoryItems.find(
          (item) => item.name.includes(itemId) || itemId.includes(item.name) || item.id === itemId
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

        addPurchaseOrderToSession(newAIPO);
        replyText = `✅ **إجراء آلي**: تم إنشاء أمر شراء **${newAIPO.id}** لعدد **${quantity}** من [${newAIPO.itemName}] من المورد [${supplierName}] بنجاح وهو مدرج في سجل المشتريات. 📦`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'ai',
          text: replyText,
          provider: data.provider,
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'ai',
          text: lang === 'en' ? '⚠️ Network error communicating with AI server.' : '⚠️ حدث تعذر في الاتصال بخادم الذكاء الاصطناعي.',
        },
      ]);
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
    <div className={`chat-anchor fixed bottom-6 z-50 flex flex-col items-start gap-4 ${isRtl ? 'left-6' : 'right-6'}`}>
      {/* Hidden File Input for Attachment */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Floating Chat Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={
          isOpen
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.85, y: 30, pointerEvents: 'none' }
        }
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className={`w-[410px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-zinc-950/95 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-3xl flex flex-col text-white ${
          !isOpen && 'hidden'
        }`}
      >
        {/* Header: Renamed to "Zahi AI Agent" (وكيل زاهي الذكي) */}
        <div className="p-4 border-b border-white/15 flex items-center justify-between bg-white/[0.04]">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 border border-teal-400/30 p-2.5 rounded-2xl text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.25)]">
                <Bot className="w-5 h-5 text-teal-200" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-wide flex items-center gap-2 text-white">
                  <span>{lang === 'en' ? 'Zahi AI Agent' : 'وكيل زاهي الذكي'}</span>
                  <span className="text-[10px] bg-teal-500/20 border border-teal-300/40 text-teal-200 px-2 py-0.5 rounded-full font-bold">
                    PRO
                  </span>
                </h3>
                <p className="text-xs text-white/70 flex items-center gap-1.5 mt-0.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"></span>
                  <span>{lang === 'en' ? 'Active & Ready' : 'نشط وجاهز للعمليات'}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors bg-white/5 hover:bg-white/15 p-2 rounded-xl w-8 h-8 flex items-center justify-center border border-white/15 cursor-pointer"
              title={lang === 'en' ? 'Close Chat' : 'إغلاق المحادثة'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Container: Clean Empty State if no messages */}
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-[0_0_25px_rgba(45,212,191,0.2)]">
                <Sparkles className="w-7 h-7 text-teal-200" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">
                  {lang === 'en' ? 'Zahi AI Operations Agent' : 'وكيل زاهي الذكي للعمليات'}
                </h4>
                <p className="text-xs text-white/60 mt-1.5 max-w-[270px] leading-relaxed">
                  {lang === 'en'
                    ? 'Ask questions about live inventory, speak with your voice, or attach invoice screenshots for instant analysis.'
                    : 'اسأل عن النواقص وأوامر الشراء، أو تحدث بالصوت، أو أرفق لقطات الفواتير والمطبخ للفحص الفوري.'}
                </p>
              </div>

              {/* Quick Action Chips */}
              <div className="flex flex-col gap-2 w-full pt-2">
                <button
                  type="button"
                  onClick={() => handleSend(lang === 'en' ? 'Check critical inventory shortages' : 'فحص النواقص الحرجة بالمخزون')}
                  className="w-full text-start px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/80 hover:text-white transition-all cursor-pointer font-medium"
                >
                  ⚡ {lang === 'en' ? 'Check critical shortages' : 'فحص النواقص الحرجة بالمخزون'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(lang === 'en' ? 'Summary of active purchase orders' : 'ملخص أوامر الشراء النشطة')}
                  className="w-full text-start px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/80 hover:text-white transition-all cursor-pointer font-medium"
                >
                  📦 {lang === 'en' ? 'Summary of active purchase orders' : 'ملخص أوامر الشراء النشطة'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(lang === 'en' ? 'Daily kitchen production schedule' : 'أهداف إنتاج المطبخ اليوم')}
                  className="w-full text-start px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/80 hover:text-white transition-all cursor-pointer font-medium"
                >
                  👨‍🍳 {lang === 'en' ? 'Daily kitchen production plan' : 'أهداف إنتاج المطبخ اليوم (215 وجبة)'}
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3.5 rounded-2xl max-w-[85%] text-xs sm:text-sm relative transition-all break-words ${
                  msg.sender === 'user'
                    ? 'self-end bg-gradient-to-r from-teal-700/40 to-emerald-700/40 border border-teal-400/30 text-white rounded-tr-xs font-medium shadow-md'
                    : 'self-start bg-white/[0.08] border border-white/20 text-white rounded-tl-xs font-normal shadow-sm'
                }`}
              >
                {/* Uploaded Image Thumbnail Preview */}
                {msg.image && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-white/20 max-w-[200px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.image}
                      alt="Attached upload"
                      className="w-full h-auto max-h-36 object-cover"
                    />
                  </div>
                )}

                <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>

                {msg.provider && (
                  <div className="mt-1.5 pt-1 border-t border-white/10 text-[9px] text-teal-300/80 font-mono flex items-center justify-end gap-1">
                    <span>⚡ {msg.provider}</span>
                  </div>
                )}
              </div>
            ))
          )}

          {isTyping && (
            <div className="self-start bg-white/[0.08] border border-white/20 p-3.5 rounded-2xl rounded-tl-xs max-w-[85%] flex gap-1.5 items-center h-11">
              <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.15s' }}
              ></div>
              <div
                className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.3s' }}
              ></div>
            </div>
          )}
        </div>

        {/* Attached Image Preview Chip (above input) */}
        <AnimatePresence>
          {attachedImage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 bg-white/[0.06] border-t border-white/10 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImage.previewUrl}
                  alt="Thumb"
                  className="w-8 h-8 rounded-lg object-cover border border-white/25 shrink-0"
                />
                <span className="truncate font-medium text-white/90 text-xs">
                  {attachedImage.name}
                </span>
                <span className="text-[10px] text-teal-300 font-bold bg-teal-500/20 px-1.5 py-0.5 rounded">
                  {lang === 'en' ? 'Vision' : 'فحص بصري'}
                </span>
              </div>
              <button
                type="button"
                onClick={removeAttachedImage}
                className="p-1 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white/80 hover:text-rose-200 transition-colors cursor-pointer"
                title={lang === 'en' ? 'Remove Image' : 'إزالة الصورة'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Input Bar with Attachment and Voice-to-Text */}
        <div className="p-3 border-t border-white/15 flex items-center gap-2 bg-black/40">
          {/* Attachment Paperclip Button (Multimodal Image Upload) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={lang === 'en' ? 'Attach Image for Vision Analysis' : 'إرفاق صورة للتحليل البصري الذكي'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              attachedImage
                ? 'bg-teal-500/25 border border-teal-400/50 text-teal-200'
                : 'bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/15 active:scale-95'
            }`}
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice Input Microphone Button (Web Speech API) */}
          <button
            type="button"
            onClick={toggleListening}
            title={
              isListening
                ? lang === 'en' ? 'Stop Listening' : 'إيقاف التسجيل الصوتي'
                : lang === 'en' ? 'Speak with Voice (ar-SA)' : 'تحدث بالصوت (عربي)'
            }
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-500/30 border border-rose-400 text-rose-200 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/15 active:scale-95'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            placeholder={
              isListening
                ? lang === 'en' ? 'Listening now...' : 'جاري الاستماع الآن، تحدث...'
                : lang === 'en' ? 'Ask anything or attach image...' : 'اكتب سؤالك أو ارفق صورة...'
            }
            className="flex-1 border border-white/20 bg-white/5 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-teal-400/50 focus:bg-white/10 transition-all text-white placeholder:text-white/50 font-medium"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={(!inputValue.trim() && !attachedImage) || isTyping}
            className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-md"
            title={lang === 'en' ? 'Send' : 'إرسال'}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Floating Toggle Button */}
      <motion.div
        drag
        dragMomentum={false}
        className="w-fit cursor-grab active:cursor-grabbing inline-block"
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.35)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md ${
            isOpen ? 'text-teal-300 rotate-90' : 'text-white'
          }`}
          title={lang === 'en' ? 'Zahi AI Agent' : 'وكيل زاهي الذكي'}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7 text-teal-300" />}
        </button>
      </motion.div>
    </div>
  );
}
