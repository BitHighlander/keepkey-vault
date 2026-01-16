'use client'

import React from 'react';

interface SwapInProgressActionsProps {
  thorchainTrackerLink: string;
  midgardApiLink: string;
  onClose: () => void;
}

// This component is no longer needed - buttons removed per user request
// Transaction tracking is now handled inline in the TimingDisplay component
export const SwapInProgressActions = ({
  thorchainTrackerLink,
  midgardApiLink,
  onClose
}: SwapInProgressActionsProps) => {
  return null;
};
