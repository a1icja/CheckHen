import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

import {
  ChatContainer,
  MainContainer,
  Message,
  MessageInput,
  MessageList,
} from '@chatscope/chat-ui-kit-react';
import { currentUser } from '@clerk/nextjs/server';

export function Chat({
  enableInput = true,
  messages,
  currentClerkId,
  sendHandler,
}: {
  enableInput?: boolean;
  messages: {
    id: string;
    message: string;
    clerkId?: string;
    userName?: string;
  }[];
  currentClerkId?: string;
  sendHandler: (message: string) => void;
}) {
  return (
    <MainContainer>
      <ChatContainer className="overflow-scroll">
        <MessageList className="overflow-scroll">
          {messages?.map((message) => (
            <Message
              key={message.id}
              model={{
                message: message.message,
                direction: currentClerkId == message.clerkId ? 'outgoing' : 'incoming',
                position: 'single',
              }}
              children={message.userName && <Message.Header sender={message.userName} />}
            />
          ))}
        </MessageList>
        {enableInput && (
          <MessageInput placeholder="Type message here" attachButton={false} onSend={sendHandler} />
        )}
      </ChatContainer>
    </MainContainer>
  );
}
