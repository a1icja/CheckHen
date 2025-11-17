import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Chat } from '@/components/Chat/Chat';
import { getSocket } from '@/lib/socket';

type UserInfo = {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
};

export default function StudentChatPage() {
  const ws = useRef<Socket | null>(null); // WebSocket reference

  const [user, setUser] = useState<UserInfo>(); // State to store the current user
  const [currentClassId, setCurrentClassId] = useState(null); // State to store the current class ID
  const [messages, setMessages] = useState<Array<any>>([]); // State to store chat messages

  // Fetch the current user's details
  const fetchUser = async () => {
    const response = await fetch('/api/get-clerk-info');
    const data = await response.json();
    setUser(data.user);
  };

  // Fetch the current class details
  const fetchCurrentClass = async () => {
    const response = await fetch('/api/fetch-latest-class');
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const date = new Date(jsonData.createdAt);
    const endDate = new Date(date.getTime() + jsonData.duration * 60000);

    // Check if the class has ended
    if (endDate < new Date()) {
      return;
    }

    // Avoid re-fetching if the class ID hasn't changed
    if (jsonData.id === currentClassId) {
      return;
    }

    setCurrentClassId(jsonData.id);
  };

  // Fetch all chat messages for the current class
  const fetchAllChatMessages = async () => {
    const response = await fetch('/api/admin/fetch-all-chat');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);

    setMessages(jsonData);
  };

  // Fetch the latest chat message and update the state
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

  // Initial data fetching when the component mounts
  useEffect(() => {
    fetchUser();
    fetchCurrentClass();
    fetchAllChatMessages();
  }, []);

  // Set up WebSocket connection and handle incoming messages
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

  // Render the chat component
  return (
    <div className="h-[calc(100vh-5rem)] overflow-hidden">
      <Chat enableInput={false} messages={messages} sendHandler={() => null} />
    </div>
  );
}
