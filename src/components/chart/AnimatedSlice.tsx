'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedSliceProps {
  index?: number;
  children: React.ReactNode;
}

export function AnimatedSlice({
  index = 0,
  children,
}: AnimatedSliceProps) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.25, transformOrigin: 'center' }}
      animate={{ opacity: 1, scale: 1, transformOrigin: 'center' }}
      whileHover={{ 
        scale: 1.05,
        filter: 'brightness(1.15)', 
        transition: { duration: 0.15 }
      }}
      transition={{
        opacity: { duration: 0.4, delay: index * 0.1 },
        scale: { type: 'spring', duration: 0.5, bounce: 0.2, delay: index * 0.1 },
      }}
      style={{ originX: 0, originY: 0 }}
    >
      {children}
    </motion.g>
  );
}

export default AnimatedSlice; 