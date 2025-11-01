
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ContextDetail } from '../types';
import { BotIcon, UserIcon } from './icons';

interface ChatMessageProps {
  message: Message;
  onShowContext?: (context: ContextDetail) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onShowContext }) => {
  const isModel = message.role === 'model';

  if (message.isTyping) {
    return (
      <div className="flex items-start gap-3 my-4 animate-pulse">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 dark:bg-cyan-400/20 flex items-center justify-center">
          <BotIcon className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
        </div>
        <div className="bg-slate-200 dark:bg-slate-800 rounded-lg p-3 max-w-xl">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 my-6 ${isModel ? '' : 'flex-row-reverse'}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isModel ? 'bg-cyan-500/20 dark:bg-cyan-400/20' : 'bg-violet-500/20 dark:bg-violet-400/20'}`}>
        {isModel ? <BotIcon className="w-6 h-6 text-cyan-600 dark:text-cyan-300" /> : <UserIcon className="w-6 h-6 text-violet-600 dark:text-violet-300" />}
      </div>
      <div className={`p-4 rounded-lg max-w-2xl shadow-sm ${isModel ? 'bg-white dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-700'}`}>
        {isModel ? (
          <div className="prose dark:prose-invert max-w-none 
                         prose-p:my-2 prose-headings:my-3 prose-ol:my-2 prose-ul:my-2 prose-blockquote:my-2
                         prose-code:bg-slate-200 prose-code:dark:bg-slate-900
                         prose-pre:bg-slate-200 prose-pre:dark:bg-slate-900 prose-pre:p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{message.text}</p>
        )}
        {isModel && message.context && onShowContext && (
          <div className="mt-4 text-right">
            <button
              onClick={() => onShowContext(message.context!)}
              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1 transition-colors"
            >
              Show Context
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;