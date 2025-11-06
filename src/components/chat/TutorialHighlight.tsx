'use client'

import React, { useEffect, useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Portal,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { TutorialStep } from '@/lib/chat/pageContext';

// Theme colors
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  blue: '#3B82F6',
  blueHover: '#60A5FA',
  gold: '#FFD700',
  border: '#222222',
};

// Pulse animation for highlighting
const pulseAnimation = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  50% {
    box-shadow: 0 0 0 20px rgba(59, 130, 246, 0);
  }
`;

// Spotlight fade animation
const spotlightFade = keyframes`
  0% {
    opacity: 0;
  }
  100% {
    opacity: 0.8;
  }
`;

interface TutorialHighlightProps {
  step: TutorialStep;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
}

/**
 * TutorialHighlight Component
 *
 * Creates a spotlight effect highlighting specific UI elements with an instructional tooltip.
 * Works like an onboarding tutorial system guiding users through the interface.
 */
export const TutorialHighlight: React.FC<TutorialHighlightProps> = ({
  step,
  onNext,
  onPrevious,
  onSkip,
  totalSteps,
  isFirstStep,
  isLastStep,
}) => {
  const [elementPosition, setElementPosition] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');

  // Find and track the highlighted element
  useEffect(() => {
    if (!step.elementId) {
      setElementPosition(null);
      return;
    }

    const findElement = () => {
      // Try multiple ways to find the element
      let element = document.getElementById(step.elementId!);

      // If not found by ID, try finding by data attribute
      if (!element) {
        element = document.querySelector(`[data-tutorial-id="${step.elementId}"]`);
      }

      // If still not found, try by class name
      if (!element) {
        element = document.querySelector(`.${step.elementId}`);
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        setElementPosition(rect);

        // Determine best tooltip position based on element location
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        if (rect.bottom + 200 > viewportHeight && rect.top > 200) {
          setTooltipPosition('top');
        } else if (rect.right + 350 > viewportWidth && rect.left > 350) {
          setTooltipPosition('left');
        } else if (rect.left < 350 && rect.right + 350 < viewportWidth) {
          setTooltipPosition('right');
        } else {
          setTooltipPosition('bottom');
        }

        // Scroll element into view if not visible
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        console.warn(`Tutorial element not found: ${step.elementId}`);
        setElementPosition(null);
      }
    };

    // Try immediately and after a short delay (in case elements are loading)
    findElement();
    const timeout = setTimeout(findElement, 100);

    return () => clearTimeout(timeout);
  }, [step.elementId]);

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!elementPosition) {
      // Center of screen if no element
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 20;

    switch (tooltipPosition) {
      case 'top':
        return {
          bottom: `${window.innerHeight - elementPosition.top + padding}px`,
          left: `${elementPosition.left + elementPosition.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: `${elementPosition.bottom + padding}px`,
          left: `${elementPosition.left + elementPosition.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: `${elementPosition.top + elementPosition.height / 2}px`,
          right: `${window.innerWidth - elementPosition.left + padding}px`,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: `${elementPosition.top + elementPosition.height / 2}px`,
          left: `${elementPosition.right + padding}px`,
          transform: 'translateY(-50%)',
        };
    }
  };

  return (
    <Portal>
      {/* Dark overlay with spotlight cutout */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="rgba(0, 0, 0, 0.8)"
        zIndex={9999}
        animation={`${spotlightFade} 0.3s ease-in-out`}
        onClick={(e) => {
          // Allow clicking overlay to skip if no specific element is highlighted
          if (e.target === e.currentTarget && !elementPosition) {
            onSkip();
          }
        }}
      >
        {/* Spotlight effect - highlight the element */}
        {elementPosition && (
          <>
            {/* Pulsing border around element */}
            <Box
              position="absolute"
              top={`${elementPosition.top - 8}px`}
              left={`${elementPosition.left - 8}px`}
              width={`${elementPosition.width + 16}px`}
              height={`${elementPosition.height + 16}px`}
              borderRadius="lg"
              border="3px solid"
              borderColor={theme.blue}
              animation={`${pulseAnimation} 2s ease-in-out infinite`}
              pointerEvents="none"
            />

            {/* Clear area (cutout) */}
            <Box
              position="absolute"
              top={`${elementPosition.top - 4}px`}
              left={`${elementPosition.left - 4}px`}
              width={`${elementPosition.width + 8}px`}
              height={`${elementPosition.height + 8}px`}
              borderRadius="lg"
              bg={theme.bg}
              opacity={0.1}
              pointerEvents="none"
            />
          </>
        )}

        {/* Tooltip with instructions */}
        <Box
          position="absolute"
          {...getTooltipStyle()}
          width="320px"
          maxWidth="90vw"
          bg={theme.cardBg}
          border="2px solid"
          borderColor={theme.blue}
          borderRadius="xl"
          boxShadow={`0 8px 32px ${theme.blue}40`}
          p={4}
          zIndex={10000}
        >
          <VStack align="stretch" gap={3}>
            {/* Header */}
            <Flex justify="space-between" align="center">
              <HStack>
                <Text fontSize="lg" fontWeight="bold" color={theme.blue}>
                  Step {step.order} of {totalSteps}
                </Text>
              </HStack>
              <Button
                size="sm"
                variant="ghost"
                color="gray.400"
                onClick={onSkip}
                _hover={{ color: 'white', bg: 'rgba(255, 255, 255, 0.1)' }}
              >
                Skip Tutorial
              </Button>
            </Flex>

            {/* Title */}
            <Text fontSize="md" fontWeight="bold" color="white">
              {step.title}
            </Text>

            {/* Description */}
            <Text fontSize="sm" color="gray.300" whiteSpace="pre-wrap">
              {step.description}
            </Text>

            {/* Action hint */}
            {step.action && (
              <Box
                p={2}
                bg="rgba(59, 130, 246, 0.1)"
                borderRadius="md"
                border="1px solid"
                borderColor="rgba(59, 130, 246, 0.3)"
              >
                <Text fontSize="xs" color={theme.blue} fontWeight="medium">
                  💡 {step.action}
                </Text>
              </Box>
            )}

            {/* Next step preview */}
            {step.nextStep && isLastStep && (
              <Box
                p={2}
                bg="rgba(255, 215, 0, 0.1)"
                borderRadius="md"
                border="1px solid"
                borderColor="rgba(255, 215, 0, 0.3)"
              >
                <Text fontSize="xs" color={theme.gold} fontWeight="medium">
                  ⭐ {step.nextStep}
                </Text>
              </Box>
            )}

            {/* Navigation buttons */}
            <Flex justify="space-between" gap={2} mt={2}>
              {!isFirstStep && (
                <Button
                  size="sm"
                  variant="outline"
                  borderColor={theme.border}
                  color="gray.300"
                  onClick={onPrevious}
                  _hover={{ borderColor: theme.blue, color: theme.blue }}
                >
                  ← Previous
                </Button>
              )}

              <Button
                size="sm"
                bg={isLastStep ? theme.gold : theme.blue}
                color={isLastStep ? theme.bg : 'white'}
                ml="auto"
                onClick={onNext}
                _hover={{
                  bg: isLastStep ? theme.gold : theme.blueHover,
                  transform: 'scale(1.05)',
                }}
                fontWeight="bold"
              >
                {isLastStep ? '🎉 Finish Tutorial' : 'Next →'}
              </Button>
            </Flex>
          </VStack>
        </Box>
      </Box>
    </Portal>
  );
};

/**
 * Tutorial Manager Hook
 *
 * Manages tutorial state and progression
 */
export function useTutorial(steps: TutorialStep[] | null) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const startTutorial = () => {
    if (steps && steps.length > 0) {
      setCurrentStep(0);
      setIsActive(true);
    }
  };

  const nextStep = () => {
    if (steps && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipTutorial = () => {
    setIsActive(false);
  };

  const resetTutorial = () => {
    setCurrentStep(0);
    setIsActive(false);
  };

  return {
    isActive,
    currentStep: steps?.[currentStep] || null,
    stepNumber: currentStep + 1,
    totalSteps: steps?.length || 0,
    isFirstStep: currentStep === 0,
    isLastStep: steps ? currentStep === steps.length - 1 : false,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    resetTutorial,
  };
}
