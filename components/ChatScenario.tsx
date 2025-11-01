import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Message, Scenario, ContextDetail, Document } from '../types';
import { getGeminiResponse } from '../services/geminiService';
import { SCENARIO_CONFIGS, MOCK_DOCUMENTS } from '../constants';
import ChatMessage from './ChatMessage';
import ContextModal from './ContextModal';
import { SendIcon, LightbulbIcon, BookOpenIcon, InfoIcon, PlusIcon, CloseIcon } from './icons';


const DocViewerModal: React.FC<{ doc: Document | null; onClose: () => void }> = ({ doc, onClose }) => {
  if (!doc) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
         <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{doc.title}</h2>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300">{doc.content}</pre>
        </div>
      </div>
    </div>
  );
};


const DocumentSidebar: React.FC<{ onViewDoc: (doc: Document) => void }> = ({ onViewDoc }) => (
  <div className="flex-shrink-0 w-1/3 lg:w-2/5 h-[calc(100vh-150px)] bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col">
    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
      <BookOpenIcon className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Document Library</h2>
    </div>
    <div className="flex-grow p-4 overflow-y-auto space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">The model can retrieve information from these documents (click to view):</p>
      {MOCK_DOCUMENTS.map((doc, i) => (
        <button 
          key={i} 
          onClick={() => onViewDoc(doc)}
          className="w-full text-left bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 p-3 rounded-lg transition-colors"
        >
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">{doc.title}</p>
        </button>
      ))}
    </div>
  </div>
);

const ChatPanel: React.FC<{
  config: (typeof SCENARIO_CONFIGS)[Scenario.NORMAL];
  isDocumentScenario: boolean;
}> = ({ config, isDocumentScenario }) => {
  const storageKey = `chatHistory_${config.id}`;
  
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load or parse chat history:", e);
      localStorage.removeItem(storageKey); // Clear corrupted data
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState<ContextDetail | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const messagesToSave = messages.filter(m => !m.isTyping);
    if (messagesToSave.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [messages, storageKey]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { id: 'typing', role: 'model', text: '', isTyping: true }]);

    try {
      const conversationHistory = messages.filter(m => !m.isTyping);
      const { text, context } = await getGeminiResponse(config.id, conversationHistory, input);
      const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', text, context };
      
      setMessages(prev => [...prev.filter(m => !m.isTyping), modelMessage]);
    } catch (error) {
      console.error("Error getting response from Gemini:", error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', text: "Sorry, I encountered an error. Please try again." };
      setMessages(prev => [...prev.filter(m => !m.isTyping), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleShowContext = (context: ContextDetail) => {
    setSelectedContext(context);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleNewChat = () => {
    const currentMessages = messages.filter(m => !m.isTyping);
    if (currentMessages.length > 0) {
      // Archive the current chat to a unique key in history
      const archiveKey = `chatHistory_${config.id}_${Date.now()}`;
      localStorage.setItem(archiveKey, JSON.stringify(currentMessages));
    }
    // Start a new chat session
    setMessages([]);
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-150px)] bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xl ${isDocumentScenario ? 'w-2/3 lg:w-3/5' : 'w-full'}`}>
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{config.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{config.longDescription}</p>
        </div>
        {messages.filter(m => !m.isTyping).length > 0 && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 flex-shrink-0 ml-4 px-3 py-2 bg-slate-200 dark:bg-slate-700/80 hover:bg-cyan-500/20 dark:hover:bg-cyan-500/30 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 rounded-lg text-sm font-semibold transition-colors"
              title="Start a new chat"
            >
              <PlusIcon className="w-4 h-4" />
              New Chat
            </button>
        )}
      </div>
      <div className="flex-grow p-4 overflow-y-auto">
        {messages.length === 0 && config.suggestions && config.suggestions.length > 0 && (
          <div className="p-6 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 m-4">
            <div className="flex justify-center items-center gap-3 mb-2">
              <LightbulbIcon className="w-7 h-7 text-yellow-500 dark:text-yellow-400" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Don't know what to ask?</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-center">{config.suggestionDescription}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {config.suggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(q)}
                  className="bg-white dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} onShowContext={handleShowContext} />
        ))}
         <div ref={chatEndRef} />
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="w-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-colors flex-shrink-0"
          >
            <SendIcon className="w-6 h-6" />
          </button>
        </form>
        <div className="text-xs text-slate-500 dark:text-slate-500 text-center mt-3 flex items-center justify-center gap-1.5">
          <InfoIcon className="w-3 h-3" />
          <span>Chat history is saved in this browser and is not shared.</span>
        </div>
      </div>
      <ContextModal context={selectedContext} onClose={() => setSelectedContext(null)} />
    </div>
  );
};


const ChatScenario: React.FC = () => {
  const { scenario } = useParams<{ scenario: Scenario }>();
  const navigate = useNavigate();
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  const config = scenario ? SCENARIO_CONFIGS[scenario] : null;

  useEffect(() => {
    if (!scenario || !Object.values(Scenario).includes(scenario)) {
      navigate('/');
    }
  }, [scenario, navigate]);
  
  if (!config) {
    return null; // Or a loading/error state
  }
  
  const isDocumentScenario = config.id === Scenario.DOCUMENT;

  return (
    <>
      <div className={`mx-auto ${isDocumentScenario ? 'max-w-7xl flex flex-row gap-6' : 'max-w-4xl'}`}>
        {isDocumentScenario && <DocumentSidebar onViewDoc={setViewingDoc} />}
        <ChatPanel config={config} isDocumentScenario={isDocumentScenario} />
      </div>
      <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
    </>
  );
};

export default ChatScenario;