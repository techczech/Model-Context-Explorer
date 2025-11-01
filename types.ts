export interface Document {
  title: string;
  content: string;
}

export enum Scenario {
  NORMAL = 'normal',
  DATA = 'data',
  SEARCH = 'search',
  DOCUMENT = 'document',
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  context?: ContextDetail;
  isTyping?: boolean;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  }
  snippet?: string;
}

export interface RetrievedChunk {
  text: string;
  sourceIndex: number;
  sourceTitle: string;
  score: {
    keyword: number;
    semantic: number;
    total: number;
  };
}

export interface ContextDetail {
  // Common Inputs
  systemPrompt: string;
  systemPromptTokenCount: number;
  history: Message[];
  historyTokenCount: number;
  userMessage: string;
  userMessageTokenCount: number;
  
  // Tool-related flow
  toolDefinitions?: any;
  toolDefinitionsTokenCount?: number;
  toolCall?: any; // What the model generated
  toolCallTokenCount?: number;
  toolResult?: any; // What was sent back to the model
  toolResultTokenCount?: number;
  
  // Common Outputs
  responseText?: string;
  responseTokenCount: number;
  
  // Data for special UI rendering
  retrievedChunks?: RetrievedChunk[];
  searchGrounding?: GroundingChunk[];
}


export interface ScenarioConfig {
    id: Scenario;
    title: string;
    description: string;
    longDescription: string;
    systemPrompt: string;
    suggestions?: string[];
    suggestionDescription?: string;
}