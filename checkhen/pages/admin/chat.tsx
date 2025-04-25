import { useEffect, useRef, useState } from 'react';
import { User } from '@clerk/nextjs/server';
import { Socket } from 'socket.io-client';
import { Chat } from '@/components/Chat/Chat';
import { getSocket } from '@/lib/socket';

export default function StudentChatPage() {
  const ws = useRef<Socket | null>(null);

  const [user, setUser] = useState<User>();
  const [currentClassId, setCurrentClassId] = useState(null);
  const [messages, setMessages] = useState<Array<any>>([]);

  const fetchUser = async () => {
    const response = await fetch('/api/get-clerk-info');
    const data = await response.json();
    setUser(data.user);
  };

  const fetchCurrentClass = async () => {
    const response = await fetch('/api/fetch-latest-class');
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const date = new Date(jsonData.createdAt);
    const endDate = new Date(date.getTime() + jsonData.duration * 60000);

    if (endDate < new Date()) {
      return;
    }

    const formattedDate = date.toLocaleString();

    if (jsonData.id === currentClassId) {
      return;
    }

    setCurrentClassId(jsonData.id);
  };

  const fetchAllChatMessages = async () => {
    const response = await fetch('/api/admin/fetch-all-chat');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);

    setMessages(jsonData);
  };

  const fetchLastChatMessage = async () => {
    const response = await fetch('/api/admin/fetch-last-chat');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const lastMessage = jsonData[0];

    setMessages((prevMessages) => {
      const newMessages = prevMessages.filter((message) => message.id !== lastMessage.id);
      return [...newMessages, lastMessage];
    });
  };

  useEffect(() => {
    fetchUser();
    fetchCurrentClass();
    fetchAllChatMessages();
  }, []);

  useEffect(() => {
    if (!user || !currentClassId) return;

    const userId = user.id;
    const classId = currentClassId;
    const email = user.emailAddresses[0]?.emailAddress || '';

    ws.current = getSocket(userId, classId, email);

    ws.current?.on('fetch-messages', () => {
      fetchLastChatMessage();
    });
  }, [user, currentClassId]);

  return (
    <div className="h-[calc(100vh-5rem)] overflow-hidden">
      <Chat enableInput={false} messages={messages} sendHandler={() => null} />
    </div>
  );
}
