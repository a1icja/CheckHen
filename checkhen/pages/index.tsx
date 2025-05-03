import { useEffect, useRef, useState } from 'react';
import { User } from '@clerk/nextjs/server';
import { Socket } from 'socket.io-client';
import { Button } from '@mantine/core';
import { getSocket } from '@/lib/socket';
import { Chat } from '@/components/Chat/Chat';

export default function HomePage() {
  const ws = useRef<Socket | null>(null);

  // State variables for user, hand raise status, current class, and chat messages
  const [user, setUser] = useState<User>();
  const [handRaised, setHandRaised] = useState(false);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [currentClassName, setCurrentClassName] = useState('');
  const [messages, setMessages] = useState<Array<any>>([]);

  // Fetches the current user's information from the backend
  const fetchUser = async () => {
    const response = await fetch('/api/get-clerk-info');
    const data = await response.json();
    setUser(data.user);
  };

  // Fetches the current hand raise status for the user
  const fetchHandRaiseStatus = async () => {
    const response = await fetch('/api/student/fetch-hand-raise');
    setHandRaised(response.ok);
  };

  // Toggles the hand raise status for the user
  const toggleHandRaise = async () => {
    const response = await fetch('/api/student/toggle-vhr', {
      method: 'POST',
    });

    const data = await response.json();

    if (response.ok) {
      setHandRaised(data.status);
      ws.current?.emit('user-hand-update', {
        classId: data.classId,
        isRaised: data.status,
      });
    }
  };

  // Fetches the latest class session details
  const fetchCurrentClass = async () => {
    const response = await fetch('/api/fetch-latest-class');
    if (!response.ok) {
      setCurrentClassName('');
      return;
    }
    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const date = new Date(jsonData.createdAt);
    const endDate = new Date(date.getTime() + jsonData.duration * 60000);

    // If the class has ended, clear the current class name
    if (endDate < new Date()) {
      setCurrentClassName('');
      return;
    }

    const formattedDate = date.toLocaleString();

    // Avoid redundant updates if the class ID hasn't changed
    if (jsonData.id === currentClassId) {
      return;
    }

    setCurrentClassId(jsonData.id);
    setCurrentClassName(`${jsonData.name} - ${formattedDate}`);
  };

  // Fetches all chat messages for the current class
  const fetchAllChatMessages = async () => {
    const response = await fetch('/api/student/fetch-all-chat');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);

    setMessages(jsonData);
  };

  // Fetches the latest chat message and updates the message list
  const fetchLastChatMessage = async () => {
    const response = await fetch('/api/student/fetch-last-chat');
    if (!response.ok) return;

    const data = await response.json();
    const jsonData = JSON.parse(data.message);
    const lastMessage = jsonData[0];

    setMessages((prevMessages => {
      const newMessages = prevMessages.filter((message) => message.id !== lastMessage.id);
      return [...newMessages, lastMessage];
    }));
  }

  // Sends a new chat message
  const sendChatMessage = async (message: string) => {    
    const response = await fetch('/api/student/send-chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });

    if (!response.ok) return;

    ws.current?.emit('chat-message-sent', {
      classId: currentClassId,
    });
  };

  // Initial setup: fetch user, class, hand raise status, and chat messages
  useEffect(() => {
    fetchUser();
    fetchCurrentClass();
    fetchHandRaiseStatus();
    fetchAllChatMessages();

    // Periodically refresh the current class details
    const _interval = setInterval(() => {
      fetchCurrentClass();
    }, 5000);
  }, []);

  // Set up WebSocket connection when user and class ID are available
  useEffect(() => {
    if (!user || !currentClassId) return;

    const userId = user.id;
    const classId = currentClassId;
    const email = user.emailAddresses[0]?.emailAddress || '';

    ws.current = getSocket(userId, classId, email);

    // Listen for updates to hand raise status and chat messages
    ws.current?.on('check-raised-hands', () => {
      fetchHandRaiseStatus();
    });

    ws.current?.on('fetch-messages', () => {
      fetchLastChatMessage();
    });
  }, [user, currentClassId]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 pr-6">
        <div className="grid grid-cols-1 gap-4 h-0">
          {currentClassName && (
            <>
              <div className="flex justify-center pt-2 gap-2">
                <h1 className="text-center text-xl font-bold underline flex-grow">
                  Current Class Session
                </h1>
              </div>
              <div className="text-center">{currentClassName}</div>
            </>
          )}
          <div className="flex justify-center pt-2 gap-2">
            <Button
              color={handRaised ? '#FFC20A' : '#0C7BDC'}
              disabled={!currentClassName}
              onClick={toggleHandRaise}
            >
              {handRaised ? 'Revoke Request to Speak' : 'Request to Speak'}
            </Button>
          </div>
        </div>
        <div className="h-[calc(100vh-5rem)] overflow-hidden">
          <Chat 
            messages={messages}
            currentClerkId={user?.id}
            sendHandler={sendChatMessage}
          />
        </div>
      </div>
    </>
  );
}
