import { Variants } from 'framer-motion';

/**
 * Presets de animação reutilizáveis para o aplicativo
 * Todas as animações respeitam prefers-reduced-motion para acessibilidade
 */

export const animations: {
  fadeInUp: Variants;
  fadeInDown: Variants;
  scaleIn: Variants;
  slideInRight: Variants;
  slideInLeft: Variants;
  staggerChildren: Variants;
} = {
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  
  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { type: 'spring', bounce: 0.4, duration: 0.5 }
  },
  
  slideInRight: {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 100 },
    transition: { type: 'spring', stiffness: 100, damping: 15 }
  },
  
  slideInLeft: {
    initial: { opacity: 0, x: -100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
    transition: { type: 'spring', stiffness: 100, damping: 15 }
  },
  
  staggerChildren: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  }
};

/**
 * Variantes para hover effects em cards
 */
export const cardHover = {
  rest: {
    scale: 1,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 20px 60px -15px hsl(var(--p) / 0.3)',
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  },
  tap: {
    scale: 0.98,
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  }
};

/**
 * Variantes para toasts
 */
export const toastVariants = {
  initial: { opacity: 0, y: 50, scale: 0.3 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.5, y: -20 },
  transition: { type: 'spring', stiffness: 300, damping: 30 }
};

/**
 * Variantes para modais
 */
export const modalVariants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
  transition: { type: 'spring', bounce: 0.2, duration: 0.4 }
};

/**
 * Variantes para overlay de modal
 */
export const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};

/**
 * Helper para respeitar prefers-reduced-motion
 */
export const shouldReduceMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Cria variantes que respeitam prefers-reduced-motion
 */
export const createAccessibleVariants = (variants: Variants): Variants => {
  if (shouldReduceMotion()) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.1 }
    };
  }
  return variants;
};

