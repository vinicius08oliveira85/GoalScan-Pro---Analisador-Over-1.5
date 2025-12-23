import React from 'react';
import { motion } from 'framer-motion';
import { Home, ChevronRight } from 'lucide-react';
import { animations } from '../utils/animations';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <motion.nav
      className={`flex items-center gap-2 text-sm mb-4 ${className}`}
      variants={animations.fadeInDown}
      initial="initial"
      animate="animate"
      aria-label="Breadcrumb"
    >
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={items[0].onClick}
        className="flex items-center gap-1 text-base-content/60 hover:text-primary transition-colors focus-ring-sm"
        aria-label="Home"
      >
        <Home className="w-4 h-4" />
      </motion.button>
      
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-3 h-3 text-base-content/40" />
          {index === items.length - 1 ? (
            <span className="font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {item.label}
            </span>
          ) : (
            <button
              onClick={item.onClick}
              className="text-base-content/60 hover:text-primary transition-colors focus-ring-sm"
            >
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </motion.nav>
  );
};

export default Breadcrumb;

