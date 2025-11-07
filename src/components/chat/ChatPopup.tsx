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
  Badge,
  Image,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useRouter } from 'next/navigation';
import { TutorialHighlight, useTutorial } from './TutorialHighlight';
import { detectCurrentPage, getCurrentPageTutorial } from '@/lib/chat/pageContext';

// Theme colors for chat
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  blue: '#3B82F6',
  blueHover: '#60A5FA',
  gold: '#FFD700',
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasNewPageMessage, setHasNewPageMessage] = useState(false);
  const [previousPathname, setPreviousPathname] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tutorial system integration
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const tutorialSteps = getCurrentPageTutorial(pathname);
  const tutorial = useTutorial(tutorialSteps);

  // Get Next.js router for client-side navigation
  const router = useRouter();

  // Expose tutorial control and navigation to app for function calls
  useEffect(() => {
    if (app && tutorial) {
      app.startTutorial = tutorial.startTutorial;
      app.highlightElement = (elementId: string) => {
        // Find the step that highlights this element
        const step = tutorialSteps?.find(s => s.elementId === elementId);
        if (step) {
          tutorial.startTutorial();
        }
      };

      // Attach router.push for client-side navigation
      app.navigate = (path: string) => {
        router.push(path);
      };
    }
  }, [app, tutorial, tutorialSteps, router]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate page-specific welcome message
  const generatePageWelcome = (pathname: string): string => {
    const currentPage = detectCurrentPage(pathname);

    if (!currentPage) {
      return 'Hello! I\'m your KeepKey Vault assistant. Ask me about your portfolio, navigation, or how to use any feature!';
    }

    // Create contextual welcome based on page
    const features = currentPage.keyFeatures.slice(0, 3).map(f => `• ${f}`).join('\n');
    const hasTutorial = currentPage.tutorialSteps && currentPage.tutorialSteps.length > 0;
    const tutorialPrompt = hasTutorial ? '\n\n💡 New here? Try: "Start tutorial"' : '';

    return `📍 **${currentPage.name}**\n\n${currentPage.description}\n\n**What you can do:**\n${features}\n\n💬 Ask me: "What can I do here?" for more details${tutorialPrompt}`;
  };

  // Set initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage = generatePageWelcome(pathname);
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ]);
      setPreviousPathname(pathname);
    }
  }, [pathname, messages.length]);

  // Detect page changes and send automatic welcome message
  useEffect(() => {
    // Skip if this is the first load (handled by initial welcome)
    if (!previousPathname) {
      setPreviousPathname(pathname);
      return;
    }

    // Detect if pathname changed
    if (pathname !== previousPathname) {
      console.log('📍 Page changed:', { from: previousPathname, to: pathname });

      // Clear asset context if returning to homepage
      if (pathname === '/' && app?.clearAssetContext) {
        console.log('🏠 Returning to homepage - clearing asset context');
        app.clearAssetContext();
      }

      // Generate new welcome message for the page
      const pageWelcome = generatePageWelcome(pathname);

      // Add page change message to chat
      const pageChangeMessage: Message = {
        id: `page-change-${Date.now()}`,
        role: 'assistant',
        content: pageWelcome,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, pageChangeMessage]);

      // Set notification badge if chat is closed
      if (!isOpen) {
        setHasNewPageMessage(true);
      }

      // Update previous pathname
      setPreviousPathname(pathname);

      // Auto-scroll to new message
      setTimeout(scrollToBottom, 100);
    }
  }, [pathname, previousPathname, isOpen, app]);

  // Clear notification badge when chat is opened
  useEffect(() => {
    if (isOpen && hasNewPageMessage) {
      setHasNewPageMessage(false);
    }
  }, [isOpen, hasNewPageMessage]);

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
      // Get current page context
      const currentPage = detectCurrentPage(pathname);

      // Parse user intent and call appropriate Pioneer functions
      const response = await processUserIntent(inputValue, app, currentPage?.description);

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
      {/* Tutorial Highlight Overlay */}
      {tutorial.isActive && tutorial.currentStep && (
        <TutorialHighlight
          step={tutorial.currentStep}
          onNext={tutorial.nextStep}
          onPrevious={tutorial.previousStep}
          onSkip={tutorial.skipTutorial}
          totalSteps={tutorial.totalSteps}
          isFirstStep={tutorial.isFirstStep}
          isLastStep={tutorial.isLastStep}
        />
      )}

      {/* Floating Chat Button */}
      {!isOpen && (
        <Box
          position="fixed"
          bottom="24px"
          right="24px"
          zIndex={1000}
        >
          <Box position="relative">
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

            {/* Tutorial available badge OR new message notification */}
            {hasNewPageMessage ? (
              <Badge
                position="absolute"
                top="-8px"
                right="-8px"
                bg="#FF4444"
                color="white"
                borderRadius="full"
                fontSize="xs"
                px={2}
                py={1}
                fontWeight="bold"
                boxShadow="0 2px 8px rgba(255, 68, 68, 0.6)"
                animation={`${pulseAnimation} 1.5s ease-in-out infinite`}
              >
                New
              </Badge>
            ) : tutorialSteps && tutorialSteps.length > 0 ? (
              <Badge
                position="absolute"
                top="-8px"
                right="-8px"
                bg={theme.gold}
                color={theme.bg}
                borderRadius="full"
                fontSize="xs"
                px={2}
                py={1}
                fontWeight="bold"
                boxShadow="0 2px 8px rgba(255, 215, 0, 0.4)"
              >
                Tutorial
              </Badge>
            ) : null}
          </Box>
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
              <Image
                src="/images/venice.png"
                alt="Venice AI"
                boxSize="32px"
                borderRadius="md"
              />
              <VStack align="start" gap={0}>
                <Text fontSize="md" fontWeight="bold" color={theme.blue}>
                  KeepKey Assistant
                </Text>
                <Text fontSize="xs" color="gray.500">
                  AI inference provided by Venice
                </Text>
              </VStack>
            </HStack>
            <HStack gap={2}>
              {tutorialSteps && tutorialSteps.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  color={theme.gold}
                  onClick={() => {
                    tutorial.startTutorial();
                    setIsOpen(false);
                  }}
                  _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                  title="Start tutorial for this page"
                >
                  🎓
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                color="gray.400"
                onClick={() => {
                  // Clear messages and restart conversation
                  const welcomeMessage = generatePageWelcome(pathname);
                  setMessages([
                    {
                      id: Date.now().toString(),
                      role: 'assistant',
                      content: welcomeMessage,
                      timestamp: new Date(),
                    },
                  ]);
                  console.log('🔄 Chat conversation restarted');
                }}
                _hover={{ bg: 'rgba(255, 255, 255, 0.1)' }}
                title="Clear chat and restart"
              >
                🔄
              </Button>
              <Button
                size="sm"
                variant="ghost"
                color={theme.blue}
                onClick={() => setIsOpen(false)}
                _hover={{ bg: 'rgba(59, 130, 246, 0.1)' }}
              >
                ✕
              </Button>
            </HStack>
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

// Process user intent using SupportChat API (Venice.ai privacy-preserving)
async function processUserIntent(input: string, app: any, currentPageContext?: string): Promise<{
  content: string;
  functionCall?: { name: string; arguments: any; result?: any };
}> {
  try {
    // Get current page context
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const currentPage = detectCurrentPage(pathname);
    const pageContext = currentPage
      ? `Current Page: ${currentPage.name}\nPage Description: ${currentPage.description}\nAvailable Features: ${currentPage.keyFeatures.slice(0, 3).join(', ')}`
      : 'Current Page: Unknown';

    // Check if ChatCompletion API is available (this is what Pioneer SDK exposes)
    const hasChatAPI = app?.pioneer?.ChatCompletion || app?.pioneer?.SupportChat;

    if (!hasChatAPI) {
      console.warn('Chat API not available, using fallback');
      console.log('App structure:', {
        hasPioneer: !!app?.pioneer,
        pioneerKeys: app?.pioneer ? Object.keys(app.pioneer).slice(0, 10) : [],
        hasChatCompletion: !!app?.pioneer?.ChatCompletion,
        hasSupportChat: !!app?.pioneer?.SupportChat,
      });
      return fallbackProcessUserIntent(input, app, currentPage);
    }

    // Import function execution system
    const { executeChatFunctions, formatExecutionResponse } = await import('@/lib/chat/executor');

    // Build system prompt with page context
    const systemPrompt = `You are a KeepKey Vault assistant. The user is currently on: "${currentPage?.name || 'unknown page'}".

Page Description: ${currentPage?.description || 'N/A'}
Available Features: ${currentPage?.keyFeatures?.slice(0, 3).join(', ') || 'N/A'}

Analyze the user's message and return JSON:
{
  "intent": "query_balance|query_network|action_send|action_receive|action_swap|navigation|query_help|query_page|general",
  "functions": ["functionName1", "functionName2"],
  "parameters": {"key": "value"},
  "content": "friendly response text"
}

Available functions:
- Navigation: navigateToAsset, navigateToSend, navigateToReceive, navigateToSwap, navigateToDashboard
- Queries: getBalances, searchAssets, getNetworks, getAddress
- Actions: refreshPortfolio
- Tutorials: startTutorial, getPageHelp, highlightElement, explainElement, getProjectInfo

**IMPORTANT Navigation Rules**:
- For "How do I send X?" → use searchAssets + navigateToSend to open the send page for that asset
- For "Show me how to receive X" → use searchAssets + navigateToReceive to open the receive page
- For "I want to swap X" → use searchAssets + navigateToSwap to open the swap page
- For "Show me X" → use searchAssets + navigateToAsset to open the asset details page
- Always search for the asset first, then navigate with the CAIP identifier

Examples:
User: "How do I send Bitcoin?"
→ {"intent": "action_send", "functions": ["searchAssets", "navigateToSend"], "parameters": {"query": "bitcoin"}, "content": "I'll open the Bitcoin send page for you. You'll be able to enter the recipient address and amount there."}

User: "Show me my Ethereum"
→ {"intent": "navigation", "functions": ["searchAssets", "navigateToAsset"], "parameters": {"query": "ethereum"}, "content": "Opening your Ethereum asset page..."}

User: "How do I receive BTC?"
→ {"intent": "action_receive", "functions": ["searchAssets", "navigateToReceive"], "parameters": {"query": "bitcoin"}, "content": "I'll show you your Bitcoin receiving address with a QR code..."}

Be helpful, conversational, and context-aware based on the current page.`;

    // Call ChatCompletion API with JSON mode
    const response = await app.pioneer.ChatCompletion({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
      ],
      response_format: { type: 'json_object' }
    });

    // Parse the AI response (handle response.data wrapper from swagger client)
    const chatData = response.data || response;
    if (!chatData?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from SupportChat');
    }

    const intentResult = JSON.parse(chatData.choices[0].message.content);

    // Execute the functions
    const executionResult = await executeChatFunctions(
      intentResult.intent,
      intentResult.functions || [],
      intentResult.parameters || {},
      app
    );

    // Format the response
    const content = formatExecutionResponse(intentResult, executionResult);

    return {
      content,
      functionCall: executionResult.results.length > 0 ? {
        name: executionResult.results.map(r => r.function).join(', '),
        arguments: intentResult.parameters || {},
        result: executionResult.data
      } : undefined
    };

  } catch (error: any) {
    console.error('ChatCompletion error:', error);
    // Fallback to simple pattern matching
    return fallbackProcessUserIntent(input, app);
  }
}

// Fallback function for when ChatCompletion API is not available
function fallbackProcessUserIntent(input: string, app: any, currentPage?: any): {
  content: string;
  functionCall?: { name: string; arguments: any; result?: any };
} {
  const lowerInput = input.toLowerCase();

  // Handle "what page am I on?" or "where am I?" queries
  if (lowerInput.includes('what page') || lowerInput.includes('where am i')) {
    if (currentPage) {
      return {
        content: `📍 You're currently on the **${currentPage.name}**\n\n${currentPage.description}\n\n**What you can do here:**\n${currentPage.keyFeatures.slice(0, 3).map((f: string) => `• ${f}`).join('\n')}\n\n💡 Try: "Start tutorial" to learn more!`
      };
    }
    return { content: 'I\'m not sure which page you\'re on. Try refreshing the page!' };
  }

  // Balance queries
  if (lowerInput.includes('balance') || lowerInput.includes('how much')) {
    const balances = app?.balances || [];
    const totalValueUsd = app?.dashboard?.totalValueUsd || 0;

    if (balances.length === 0) {
      return { content: 'You currently have no balances. Your total portfolio value is $0.00.' };
    }

    const topBalances = balances
      .filter((b: any) => parseFloat(b.valueUsd || 0) > 0)
      .sort((a: any, b: any) => parseFloat(b.valueUsd || 0) - parseFloat(a.valueUsd || 0))
      .slice(0, 5);

    let response = `Your total portfolio value is $${totalValueUsd.toFixed(2)}.\n\nTop assets:\n`;
    topBalances.forEach((b: any) => {
      response += `\n• ${b.symbol || b.ticker}: ${b.balance} ($${parseFloat(b.valueUsd || 0).toFixed(2)})`;
    });

    return { content: response };
  }

  // Network/blockchain queries
  if (lowerInput.includes('network') || lowerInput.includes('blockchain') || lowerInput.includes('chain')) {
    const networks = app?.dashboard?.networks || [];

    if (networks.length === 0) {
      return { content: 'No networks configured yet.' };
    }

    let response = `You have ${networks.length} networks configured:\n`;
    networks.slice(0, 10).forEach((n: any) => {
      const value = n.totalValueUsd > 0 ? ` ($${n.totalValueUsd.toFixed(2)})` : ' (no balance)';
      response += `\n• ${n.gasAssetSymbol}${value}`;
    });

    return { content: response };
  }

  // Default response
  return {
    content: `I can help you with:
• Checking your balance and portfolio value
• Viewing your networks and blockchains
• Navigating to assets (e.g., "Show me Bitcoin")
• Opening send/receive pages
• Refreshing your portfolio data

Try asking: "What's my balance?" or "Show me my Bitcoin"`,
  };
}
