'use client'

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Button,
  Input,
  IconButton,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

// Theme colors for chat
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  blue: '#3B82F6',
  blueHover: '#60A5FA',
  border: '#222222',
};

// Pulse animation for the chat button
const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
`;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  functionCall?: {
    name: string;
    arguments: any;
    result?: any;
  };
}

interface ChatPopupProps {
  app: any; // Pioneer SDK app instance
}

export const ChatPopup: React.FC<ChatPopupProps> = ({ app }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your KeepKey Vault assistant. I can help you with your portfolio, balances, and transactions. What would you like to know?',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Process user input and generate responses
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Parse user intent and call appropriate Pioneer functions
      const response = await processUserIntent(inputValue, app);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        functionCall: response.functionCall,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Box
          position="fixed"
          bottom="24px"
          right="24px"
          zIndex={1000}
        >
          <Button
            onClick={() => setIsOpen(true)}
            bg={theme.blue}
            color="white"
            size="lg"
            borderRadius="full"
            boxSize="60px"
            p={0}
            _hover={{
              bg: theme.blueHover,
              transform: 'scale(1.05)',
            }}
            _active={{
              transform: 'scale(0.95)',
            }}
            animation={`${pulseAnimation} 2s ease-in-out infinite`}
            boxShadow="0 4px 20px rgba(59, 130, 246, 0.4)"
          >
            <Text fontSize="2xl">💬</Text>
          </Button>
        </Box>
      )}

      {/* Chat Dialog */}
      {isOpen && (
        <Box
          position="fixed"
          bottom="24px"
          right="24px"
          width="400px"
          height="600px"
          bg={theme.cardBg}
          borderRadius="2xl"
          border="1px solid"
          borderColor={theme.blue}
          boxShadow={`0 8px 32px ${theme.blue}40`}
          zIndex={1000}
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          {/* Header */}
          <Flex
            p={4}
            borderBottom="1px solid"
            borderColor={theme.border}
            justify="space-between"
            align="center"
            bg={theme.bg}
          >
            <HStack gap={2}>
              <Text fontSize="xl">💬</Text>
              <Text fontSize="md" fontWeight="bold" color={theme.blue}>
                KeepKey Assistant
              </Text>
            </HStack>
            <Button
              size="sm"
              variant="ghost"
              color={theme.blue}
              onClick={() => setIsOpen(false)}
              _hover={{ bg: 'rgba(59, 130, 246, 0.1)' }}
            >
              ✕
            </Button>
          </Flex>

          {/* Messages */}
          <VStack
            flex={1}
            overflowY="auto"
            p={4}
            gap={3}
            align="stretch"
            css={{
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#4A5568',
                borderRadius: '24px',
              },
            }}
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </VStack>

          {/* Input */}
          <Flex
            p={4}
            borderTop="1px solid"
            borderColor={theme.border}
            gap={2}
            bg={theme.bg}
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask about your portfolio..."
              bg={theme.cardBg}
              border="1px solid"
              borderColor={theme.border}
              color="white"
              _placeholder={{ color: 'gray.500' }}
              _focus={{
                borderColor: theme.blue,
                boxShadow: `0 0 0 1px ${theme.blue}`,
              }}
              disabled={isProcessing}
            />
            <Button
              onClick={handleSendMessage}
              bg={theme.blue}
              color="white"
              _hover={{ bg: theme.blueHover }}
              disabled={isProcessing || !inputValue.trim()}
              isLoading={isProcessing}
            >
              Send
            </Button>
          </Flex>
        </Box>
      )}
    </>
  );
};

// Message bubble component
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <Flex
      justify={isUser ? 'flex-end' : 'flex-start'}
      w="100%"
    >
      <Box
        maxW="80%"
        p={3}
        borderRadius="lg"
        bg={isUser ? theme.blue : theme.cardBg}
        color="white"
        border={isUser ? 'none' : '1px solid'}
        borderColor={theme.border}
      >
        <Text fontSize="sm" whiteSpace="pre-wrap">
          {message.content}
        </Text>
        {message.functionCall && (
          <Box
            mt={2}
            p={2}
            bg={isUser ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)'}
            borderRadius="md"
            fontSize="xs"
          >
            <Text fontWeight="bold" mb={1}>
              🔧 Function: {message.functionCall.name}
            </Text>
            {message.functionCall.result && (
              <Text color="gray.400">
                ✅ Executed successfully
              </Text>
            )}
          </Box>
        )}
        <Text
          fontSize="xs"
          color="gray.500"
          mt={1}
        >
          {message.timestamp.toLocaleTimeString()}
        </Text>
      </Box>
    </Flex>
  );
};

// Process user intent and map to Pioneer SDK functions
async function processUserIntent(input: string, app: any): Promise<{
  content: string;
  functionCall?: { name: string; arguments: any; result?: any };
}> {
  const lowerInput = input.toLowerCase();

  // Balance queries
  if (lowerInput.includes('balance') || lowerInput.includes('how much')) {
    try {
      const balances = app?.balances || [];
      const totalValueUsd = app?.dashboard?.totalValueUsd || 0;

      const functionCall = {
        name: 'getBalances',
        arguments: {},
        result: { balances, totalValueUsd },
      };

      if (balances.length === 0) {
        return {
          content: 'You currently have no balances. Your total portfolio value is $0.00.',
          functionCall,
        };
      }

      const topBalances = balances
        .filter((b: any) => parseFloat(b.valueUsd || 0) > 0)
        .sort((a: any, b: any) => parseFloat(b.valueUsd || 0) - parseFloat(a.valueUsd || 0))
        .slice(0, 5);

      let response = `Your total portfolio value is $${totalValueUsd.toFixed(2)}.\n\nTop assets:\n`;
      topBalances.forEach((b: any) => {
        response += `\n• ${b.symbol || b.ticker}: ${b.balance} ($${parseFloat(b.valueUsd || 0).toFixed(2)})`;
      });

      return { content: response, functionCall };
    } catch (error) {
      return { content: 'I had trouble fetching your balances. Please try again.' };
    }
  }

  // Network/blockchain queries
  if (lowerInput.includes('network') || lowerInput.includes('blockchain') || lowerInput.includes('chain')) {
    try {
      const networks = app?.dashboard?.networks || [];
      const functionCall = {
        name: 'getNetworks',
        arguments: {},
        result: networks,
      };

      if (networks.length === 0) {
        return {
          content: 'No networks configured yet.',
          functionCall,
        };
      }

      let response = `You have ${networks.length} networks configured:\n`;
      networks.slice(0, 10).forEach((n: any) => {
        const value = n.totalValueUsd > 0 ? ` ($${n.totalValueUsd.toFixed(2)})` : ' (no balance)';
        response += `\n• ${n.gasAssetSymbol}${value}`;
      });

      return { content: response, functionCall };
    } catch (error) {
      return { content: 'I had trouble fetching network information.' };
    }
  }

  // Pubkey/address queries
  if (lowerInput.includes('address') || lowerInput.includes('pubkey') || lowerInput.includes('public key')) {
    try {
      const pubkeys = app?.pubkeys || [];
      const functionCall = {
        name: 'getPubkeys',
        arguments: {},
        result: pubkeys,
      };

      if (pubkeys.length === 0) {
        return {
          content: 'No addresses/pubkeys found. Please pair your KeepKey device first.',
          functionCall,
        };
      }

      let response = `You have ${pubkeys.length} addresses configured:\n`;
      pubkeys.slice(0, 5).forEach((p: any) => {
        response += `\n• ${p.symbol || 'Unknown'}: ${p.address || p.master || 'N/A'}`;
      });

      return { content: response, functionCall };
    } catch (error) {
      return { content: 'I had trouble fetching address information.' };
    }
  }

  // Refresh/sync queries
  if (lowerInput.includes('refresh') || lowerInput.includes('sync') || lowerInput.includes('update')) {
    try {
      if (app && typeof app.refresh === 'function') {
        await app.refresh();
        return {
          content: 'Portfolio refreshed successfully! Your balances have been updated.',
          functionCall: {
            name: 'refresh',
            arguments: {},
            result: { success: true },
          },
        };
      } else {
        return { content: 'Refresh function is not available at the moment.' };
      }
    } catch (error) {
      return { content: 'Failed to refresh portfolio. Please try again.' };
    }
  }

  // Default response for unrecognized queries
  return {
    content: `I can help you with:
• Checking your balance and portfolio value
• Viewing your networks and blockchains
• Listing your addresses and pubkeys
• Refreshing your portfolio data

Try asking: "What's my balance?" or "Show me my networks"`,
  };
}
