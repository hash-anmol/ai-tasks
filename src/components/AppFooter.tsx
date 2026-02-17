"use client";

import AddTaskButton from "@/components/AddTaskButton";
import Menu from "@/components/Menu";

type AppFooterProps = {
  onChatClick?: () => void;
  onVoiceClick?: () => void;
  hideMenu?: boolean;
};

export default function AppFooter({ onChatClick, onVoiceClick, hideMenu }: AppFooterProps) {
  return (
    <>
      <AddTaskButton />
      {!hideMenu && <Menu onChatClick={onChatClick} onVoiceClick={onVoiceClick} />}
    </>
  );
}
