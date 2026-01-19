import React from 'react';

// Helper to map tailwind width/height classes (used in the app) to font-size classes
// Material icons are controlled by font-size.
const getFontSize = (className: string = '') => {
  if (className.includes('w-3') || className.includes('h-3')) return 'text-xs';
  if (className.includes('w-4') || className.includes('h-4')) return 'text-base'; // 16px
  if (className.includes('w-5') || className.includes('h-5')) return 'text-xl';   // 20px
  if (className.includes('w-6') || className.includes('h-6')) return 'text-2xl';  // 24px
  if (className.includes('w-8') || className.includes('h-8')) return 'text-4xl';  // 32px (approx 36px but close enough)
  if (className.includes('w-10') || className.includes('h-10')) return 'text-5xl';
  return 'text-2xl'; // Default to 24px
};

interface IconProps {
  className?: string;
  name: string;
  fill?: boolean;
}

const MaterialIcon: React.FC<IconProps> = ({ className = '', name, fill = false }) => {
  // Combine the calculated font size with the passed className (which contains colors, margins, etc.)
  const fontSizeClass = getFontSize(className);
  // Add 'filled' class if requested
  const fillClass = fill ? 'filled' : '';
  
  return (
    <span className={`material-symbols-rounded select-none ${fontSizeClass} ${fillClass} ${className}`}>
      {name}
    </span>
  );
};

export const BrainCircuitIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="psychology" className={className} />
);

export const ChatIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="chat_bubble" className={className} />
);

export const CodeIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="terminal" className={className} />
);

export const WebSearchIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="public" className={className} />
);

export const DocumentSearchIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="manage_search" className={className} />
);

export const UserIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="person" className={className} fill={true} />
);

export const BotIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="smart_toy" className={className} fill={true} />
);

export const SendIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="send" className={className} />
);

export const CloseIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="close" className={className} />
);

export const LightbulbIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="lightbulb" className={className} />
);

export const BookOpenIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="menu_book" className={className} />
);

export const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="delete" className={className} />
);

export const InfoIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="info" className={className} />
);

export const SunIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="light_mode" className={className} fill={true} />
);

export const MoonIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="dark_mode" className={className} fill={true} />
);

export const HistoryIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="history" className={className} />
);

export const PlusIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="add" className={className} />
);

export const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
  <MaterialIcon name="expand_more" className={className} />
);