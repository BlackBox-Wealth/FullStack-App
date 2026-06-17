import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type Motion3DProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

const Motion3D: React.FC<Motion3DProps> = ({ children, delay = 0, className }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26, rotateX: 9, rotateY: -7, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.56, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ rotateX: 2, rotateY: -2, y: -4 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
    >
      {children}
    </motion.div>
  );
};

export default Motion3D;
