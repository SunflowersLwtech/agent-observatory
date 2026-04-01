import { ChatInterface } from "@/components/chat/chat-interface";
import { EventSidebar } from "@/components/chat/event-sidebar";

export default function ChatPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 flex flex-col">
        <ChatInterface />
      </div>
      <EventSidebar />
    </div>
  );
}
