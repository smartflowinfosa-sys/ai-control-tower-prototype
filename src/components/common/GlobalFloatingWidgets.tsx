"use client";

import dynamic from "next/dynamic";

const AIAssistantWidget = dynamic(
  () => import("@/components/chat/AIAssistantWidget"),
  { ssr: false }
);

const VoiceAIAgent = dynamic(
  () => import("@/components/voice/VoiceAIAgent"),
  { ssr: false }
);

const WelcomeToast = dynamic(
  () => import("@/components/common/WelcomeToast"),
  { ssr: false }
);

export default function GlobalFloatingWidgets() {
  return (
    <>
      <AIAssistantWidget />
      <VoiceAIAgent />
      <WelcomeToast />
    </>
  );
}

