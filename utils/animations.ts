import { Variants } from 'framer-motion';

/**
 * Presets de animação reutilizáveis para o aplicativo
 * Todas as animações respeitam prefers-reduced-motion para acessibilidade
 */

const springEase = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.85 };
const springSoft = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.9 };

export const animations: {
  fadeInUp: Variants;
  fadeInDown: Variants;
  scaleIn: Variants;
  slideInRight: Variants;
  slideInLeft: Variants;
  staggerChildren: Variants;
} = {
  fadeInUp: {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -14 },
    transition: springEase,
  },

  fadeInDown: {
    initial: { opacity: 0, y: -18 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 14 },
    transition: springEase,
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94 },
    transition: { type: 'spring', bounce: 0.32, stiffness: 320, damping: 22 },
  },

  slideInRight: {
    initial: { opacity: 0, x: 48 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 32 },
    transition: springSoft,
  },

  slideInLeft: {
    initial: { opacity: 0, x: -48 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -32 },
    transition: springSoft,
  },

  staggerChildren: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.05,
        when: 'beforeChildren',
      },
    },
    exit: {},
  },
};

/** Transição das telas principais (App.tsx — troca de abas) */
export const tabScreenTransition = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 28,
  mass: 0.88,
};

/**
 * Variantes para hover effects em cards
 */
export const cardHover = {
  rest: {
    scale: 1,
    boxShadow: '0 8px 28px -8px rgba(0, 0, 0, 0.25)',
    transition: { type: 'spring', stiffness: 420, damping: 28 },
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 22px 52px -14px rgba(0, 0, 0, 0.4)',
    transition: { type: 'spring', stiffness: 420, damping: 26 },
  },
  tap: {
    scale: 0.99,
    transition: { type: 'spring', stiffness: 500, damping: 32 },
  },
};

/**
 * Variantes para toasts
 */
export const toastVariants = {
  initial: { opacity: 0, y: 36, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.94, y: -16 },
  transition: { type: 'spring', stiffness: 340, damping: 28, mass: 0.82 },
};

/**
 * Variantes para modais
 */
export const modalVariants = {
  initial: { opacity: 0, scale: 0.96, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 16 },
  transition: { type: 'spring', stiffness: 300, damping: 28, mass: 0.9 },
};

/**
 * Variantes para overlay de modal
 */
export const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
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
      transition: { duration: 0.1 },
    };
  }
  return variants;
};
