

import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ContextDetail, Document } from '../types';
import { CloseIcon } from './icons';
import { MOCK_DOCUMENTS } from '../constants';

interface FullDocModalProps {
  doc: Document | null;
  onClose: () => void;
}

const FullDocModal: React.FC<FullDocModalProps> = ({ doc, onClose }) => {
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
}


const Section: React.FC<{
  title: string;
  type: 'input' | 'output';
  tokenCount?: number;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ title, type, tokenCount, children, isOpen, onToggle }) => {
  const headerClasses = type === 'input'
    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700'
    : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';

  const contentClasses = type === 'input'
    ? 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
    : 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700';

  return (
    <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50">
      <div
        className={`flex justify-between items-center p-3 cursor-pointer ${headerClasses}`}
        onClick={onToggle}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-4">
          {tokenCount !== undefined && (
            <span className="text-xs font-mono px-2 py-1 rounded bg-black/10 dark:bg-white/10">~{tokenCount} tokens</span>
          )}
          <span className="text-xs font-bold transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        </div>
      </div>
      {isOpen && (
        <div className={`p-4 border-t ${contentClasses}`}>
          {children}
        </div>
      )}
    </div>
  );
};


const JsonViewer: React.FC<{data: any, fontSize?: string, theme: 'light' | 'dark'}> = ({ data, fontSize = '0.8rem', theme }) => {
  const style = theme === 'dark' ? vscDarkPlus : prism;

  return (
    <SyntaxHighlighter
      language="json"
      style={style}
      wrapLongLines={true}
      customStyle={{
        background: 'transparent',
        padding: '0',
        margin: '0',
        fontSize,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
      codeTagProps={{ style: { fontFamily: 'inherit' } }}
    >
      {JSON.stringify(data, null, 2)}
    </SyntaxHighlighter>
  )
};

interface ContextModalProps {
  context: ContextDetail | null;
  onClose: () => void;
}

const sectionKeys = [
  'response',
  'systemPrompt',
  'history',
  'toolDefinitions',
  'userMessage',
  'retrieval',
  'toolCall',
  'toolResult',
];

const ContextModal: React.FC<ContextModalProps> = ({ context, onClose }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [fullDoc, setFullDoc] = useState<Document | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Reset sections state when context changes
    if (context) {
      setOpenSections({
        response: true,
        systemPrompt: false,
        history: false,
        toolDefinitions: true,
        userMessage: true,
        retrieval: true,
        toolCall: true,
        toolResult: true,
      });
    }
  }, [context]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const isDark = (mutation.target as HTMLElement).classList.contains('dark');
                setTheme(isDark ? 'dark' : 'light');
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);
  
  const handleToggleSection = (section: string) => {
    setOpenSections(prev => ({...prev, [section]: !prev[section]}));
  };

  const setAllSections = (isOpen: boolean) => {
    const newState = sectionKeys.reduce((acc, key) => {
      acc[key] = isOpen;
      return acc;
    }, {} as Record<string, boolean>);
    setOpenSections(newState);
  };

  if (!context) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">What did the model see?</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setAllSections(true)} className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline">Expand All</button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button onClick={() => setAllSections(false)} className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline">Collapse All</button>
              <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ml-4">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto font-mono">
              <Section
                title="Final Generated Response"
                type="output"
                tokenCount={context.responseTokenCount}
                isOpen={openSections.response}
                onToggle={() => handleToggleSection('response')}
              >
                <p className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-200">
                  {context.responseText || "No response text was generated."}
                </p>
              </Section>
              
              <div className="text-center my-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">To generate the response above, the model was given the following context:</p>
                <hr className="mt-2 border-slate-200 dark:border-slate-700"/>
              </div>

              <Section
                title="System Prompt"
                type="input"
                tokenCount={context.systemPromptTokenCount}
                isOpen={openSections.systemPrompt}
                onToggle={() => handleToggleSection('systemPrompt')}
              >
                <pre className="whitespace-pre-wrap font-sans">{context.systemPrompt}</pre>
              </Section>

              {context.history.length > 0 && (
                <Section
                  title="Conversation History"
                  type="input"
                  tokenCount={context.historyTokenCount}
                  isOpen={openSections.history}
                  onToggle={() => handleToggleSection('history')}
                >
                  <JsonViewer theme={theme} data={context.history.map(m => ({role: m.role, text: m.text}))} fontSize="0.875rem" />
                </Section>
              )}

              {context.toolDefinitions && (
                <Section
                  title="Tool Definitions"
                  type="input"
                  tokenCount={context.toolDefinitionsTokenCount}
                  isOpen={openSections.toolDefinitions}
                  onToggle={() => handleToggleSection('toolDefinitions')}
                >
                   <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-2">The model was provided with the following tools it could choose to use:</p>
                   <JsonViewer theme={theme} data={context.toolDefinitions} />
                </Section>
              )}
              
              <Section
                title="User Message"
                type="input"
                tokenCount={context.userMessageTokenCount}
                isOpen={openSections.userMessage}
                onToggle={() => handleToggleSection('userMessage')}
              >
                <pre className="whitespace-pre-wrap font-sans">{context.userMessage}</pre>
              </Section>

              {context.toolCall && (
                <Section
                  title="Tool Call"
                  type="output"
                  tokenCount={context.toolCallTokenCount}
                  isOpen={openSections.toolCall}
                  onToggle={() => handleToggleSection('toolCall')}
                >
                  <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-2">
                    This is what the tool invocation looks like. For data analysis, this function call is generated by the model. For Search and RAG, this is a simulation of how a real-world application would generate a query for the tool based on your message.
                  </p>
                  <JsonViewer theme={theme} data={context.toolCall} />
                </Section>
              )}

              {context.retrievedChunks && context.retrievedChunks.length > 0 && (
                 <Section
                  title="Retrieval Process: Retrieved Text Snippets"
                  type="input"
                  tokenCount={context.toolResultTokenCount}
                  isOpen={openSections.retrieval}
                  onToggle={() => handleToggleSection('retrieval')}
                 >
                  <p className="font-sans text-sm text-slate-600 dark:text-slate-400 mb-4">To answer the user's message, the system first searched the document library. This retrieval process combined keyword matching and semantic analysis to find the most relevant text snippets. These snippets are the context provided to the model.</p>
                  <ul className="space-y-3 mt-2">
                    {context.retrievedChunks.map((chunk, i) => (
                      <li key={i} className="p-3 bg-slate-200 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded">
                        <blockquote className="border-l-4 border-blue-500 pl-3 font-sans text-sm italic">
                          "{chunk.text}"
                        </blockquote>
                         <div className="text-xs mt-2 text-slate-500 dark:text-slate-400 font-sans flex justify-between items-center">
                          <p>
                            Source: <button onClick={() => setFullDoc(MOCK_DOCUMENTS[chunk.sourceIndex])} className="text-cyan-600 dark:text-cyan-400 hover:underline">
                               {chunk.sourceTitle}
                            </button>
                          </p>
                          <p className='font-mono text-right'>
                            Score: {chunk.score.total} (K: {chunk.score.keyword}, S: {chunk.score.semantic})
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {(context.toolResult && !context.retrievedChunks) && (
                <Section
                  title="Tool Execution Result"
                  type="input"
                  tokenCount={context.toolResultTokenCount}
                  isOpen={openSections.toolResult}
                  onToggle={() => handleToggleSection('toolResult')}
                >
                  <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-2">The application executed the tool and sent this result back to the model:</p>
                  <JsonViewer theme={theme} data={context.toolResult} />
                </Section>
              )}

              {context.searchGrounding && context.searchGrounding.length > 0 && (
                <Section
                  title="Tool Execution Result"
                  type="input"
                  tokenCount={context.toolResultTokenCount}
                  isOpen={openSections.toolResult}
                  onToggle={() => handleToggleSection('toolResult')}
                >
                   <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-2">The search tool returned these sources. The snippets were fed back to the model as context.</p>
                  <ul className="space-y-3 mt-2">
                    {context.searchGrounding.map((chunk, i) => (
                      <li key={i} className="p-3 bg-slate-200 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded font-sans">
                        <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-base text-cyan-600 dark:text-cyan-400 hover:underline font-semibold">
                          {chunk.web.title || chunk.web.uri}
                        </a>
                        {chunk.snippet && (
                          <blockquote className="mt-2 text-sm text-slate-600 dark:text-slate-400 border-l-4 border-slate-400 dark:border-slate-500 pl-3 italic">
                            {chunk.snippet}
                          </blockquote>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-6 text-center font-sans">* Token counts are estimated for demonstration purposes (approx. 4 chars/token).</p>

          </div>
        </div>
      </div>
      <FullDocModal doc={fullDoc} onClose={() => setFullDoc(null)} />
    </>
  );
};

export default ContextModal;