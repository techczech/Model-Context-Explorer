import React, { useState, useEffect } from 'react';
import { SCENARIO_CONFIGS } from '../constants';
import { Message, ContextDetail } from '../types';
import ChatMessage from './ChatMessage';
import { CloseIcon, TrashIcon } from './icons';
import ContextModal from './ContextModal';

interface ChatHistory {
    id: string;
    scenarioTitle: string;
    Icon: React.FC<{ className: string }>;
    messages: Message[];
    lastUpdated: number;
}

const HistoryModal: React.FC<{
    history: ChatHistory | null;
    onClose: () => void;
    onShowContext: (context: ContextDetail) => void;
}> = ({ history, onClose, onShowContext }) => {
    if (!history) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <history.Icon className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{history.scenarioTitle}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-grow">
                    {history.messages.map(msg => (
                        <ChatMessage key={msg.id} message={msg} onShowContext={onShowContext} />
                    ))}
                </div>
                <div className="p-2 border-t border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-500">This is a read-only view of a past conversation.</p>
                </div>
            </div>
        </div>
    );
};


const HistoryScreen: React.FC = () => {
    const [histories, setHistories] = useState<ChatHistory[]>([]);
    const [selectedHistory, setSelectedHistory] = useState<ChatHistory | null>(null);
    const [selectedContext, setSelectedContext] = useState<ContextDetail | null>(null);

    useEffect(() => {
        const loadedHistories: ChatHistory[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chatHistory_')) {
                try {
                    const scenarioId = key.replace('chatHistory_', '').split('_')[0];
                    const config = SCENARIO_CONFIGS[scenarioId as keyof typeof SCENARIO_CONFIGS];
                    if (config) {
                        const messages: Message[] = JSON.parse(localStorage.getItem(key) || '[]');
                        if (messages && messages.length > 0) {
                            const lastMessageId = messages[messages.length - 1]?.id;
                            loadedHistories.push({
                                id: key,
                                scenarioTitle: config.title,
                                Icon: config.icon,
                                messages,
                                lastUpdated: lastMessageId ? parseInt(lastMessageId, 10) : 0
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse history from localStorage:", key, e);
                }
            }
        }
        loadedHistories.sort((a, b) => b.lastUpdated - a.lastUpdated);
        setHistories(loadedHistories);
    }, []);

    const handleDeleteHistory = (id: string) => {
        localStorage.removeItem(id);
        setHistories(prev => prev.filter(h => h.id !== id));
    }

    const handleShowContext = (context: ContextDetail) => {
        setSelectedContext(context);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 text-slate-900 dark:text-white">Chat History</h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                    Review your past conversations from all scenarios. All data is stored locally in your browser.
                </p>
            </div>
            {histories.length > 0 ? (
                <div className="space-y-4">
                    {histories.map(history => {
                        const firstUserMessage = history.messages.find(m => m.role === 'user');
                        return (
                            <div key={history.id} className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-grow overflow-hidden">
                                    <div className="p-2 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-shrink-0">
                                        <history.Icon className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
                                    </div>
                                    <div className="flex-grow overflow-hidden">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white truncate">{history.scenarioTitle}</h3>
                                        {firstUserMessage && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                                "{firstUserMessage.text}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                     <button
                                        onClick={() => setSelectedHistory(history)}
                                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-semibold rounded-lg transition-colors"
                                     >
                                        View
                                     </button>
                                     <button
                                        onClick={() => handleDeleteHistory(history.id)}
                                        title="Delete this history"
                                        className="p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                                     >
                                         <TrashIcon className="w-5 h-5"/>
                                     </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 px-6 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-white">No History Found</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Start a conversation in one of the scenarios to see your history here.</p>
                </div>
            )}
            <HistoryModal 
                history={selectedHistory} 
                onClose={() => setSelectedHistory(null)} 
                onShowContext={handleShowContext} 
            />
            <ContextModal context={selectedContext} onClose={() => setSelectedContext(null)} />
        </div>
    );
};

export default HistoryScreen;