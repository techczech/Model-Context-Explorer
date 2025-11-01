import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SCENARIO_CONFIGS } from '../constants';
import { Scenario } from '../types';
import { ChevronDownIcon } from './icons';

const ScenarioCard: React.FC<{ config: (typeof SCENARIO_CONFIGS)[Scenario] }> = ({ config }) => {
  const Icon = config.icon;
  return (
    <Link to={`/chat/${config.id}`} className="block bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg p-6 transition-all duration-300 transform hover:-translate-y-1 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 shadow-lg hover:shadow-cyan-500/10">
      <div className="flex items-center gap-4 mb-3">
        <div className="p-2 bg-slate-200 dark:bg-slate-700/50 rounded-lg">
          <Icon className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h3>
      </div>
      <p className="text-slate-600 dark:text-slate-400">{config.longDescription}</p>
    </Link>
  );
};

const HomeScreen: React.FC = () => {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const toggleDetails = () => setIsDetailsOpen(prev => !prev);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-12 text-center">
        <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-slate-900 dark:text-white">Model Context Explorer</h2>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Look under the hood of a Large Language Model.
        </p>
        <p className="mt-4 text-base text-slate-700 dark:text-slate-300 bg-cyan-500/10 dark:bg-cyan-400/10 py-2 px-4 rounded-lg inline-block">
          Choose a scenario below, have a chat, and click 'Show Context' to explore what the model was given.
        </p>
      </div>

      <div className="max-w-3xl mx-auto mb-12">
        <div className="border border-slate-200 dark:border-slate-700/50 rounded-lg bg-white dark:bg-slate-800/20">
          <button
            className="w-full flex justify-between items-center p-4 text-left"
            onClick={toggleDetails}
          >
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">More Details</h3>
            <ChevronDownIcon className={`w-6 h-6 text-slate-500 transition-transform duration-300 ${isDetailsOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDetailsOpen && (
            <div className="px-4 pb-4 text-slate-600 dark:text-slate-400 space-y-4 border-t border-slate-200 dark:border-slate-700/50 pt-4">
              <div>
                <h4 className="font-bold text-lg text-slate-700 dark:text-slate-200 mb-2">How do models respond?</h4>
                <div className="space-y-3">
                  <p>
                    Having a chat with a Large Language Model in a chatbot like ChatGPT can feel like chatting with a person. But unlike a person, the model does not 'remember' anything. For any response it generates, it always has to receive not just your last comment but also the whole chat history. Otherwise, it is just starting over.
                  </p>
                  <p>
                    With more complicated tasks like searches or data analysis, the model needs all that context but also needs to call a "tool". And then there's also the "system prompt" which is there to remind the model what that chat is about and who it's supposed to be.
                  </p>
                </div>
              </div>
              <div>
                 <h4 className="font-bold text-lg text-slate-700 dark:text-slate-200 mb-2">Why this tool?</h4>
                 <p>
                  This tool is designed to let you explore the exact context the model has for every individual response it generates. Use it as you would a normal chatbot. Only remember, the searches and document retrieval are simulated for illustration.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(SCENARIO_CONFIGS).map(config => (
          <ScenarioCard key={config.id} config={config} />
        ))}
      </div>
    </div>
  );
};

export default HomeScreen;