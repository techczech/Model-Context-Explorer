

import { GoogleGenAI, GenerateContentResponse, Type, Content } from "@google/genai";
import { Scenario, Message, ContextDetail, GroundingChunk, RetrievedChunk } from '../types';
import { MOCK_DOCUMENTS, SCENARIO_CONFIGS } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = "gemini-2.5-flash";

// Helper for rough token count estimation
const estimateTokenCount = (text: string): number => {
  if (!text) return 0;
  // A very rough approximation: 1 token ~ 4 chars in English
  return Math.ceil(text.length / 4);
};

// Helper to build conversation history for the API
const buildHistory = (messages: Message[]) => {
  return messages.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));
};

// Helper function to simulate generating a concise search query
const simulateSearchQueryGeneration = (userMessage: string): string => {
  const stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't", 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could',
    'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
    'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
    'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
    'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she', 'should',
    'so', 'some', 'such', 't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
    'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'tell', 'me', 'summarize', 'like'
  ]);

  const query = userMessage
    .toLowerCase()
    .replace(/'s/g, '') // handle possessives and contractions like "what's"
    .replace(/[?.!,]/g, '') // remove punctuation
    .split(/\s+/)
    .filter(word => !stopWords.has(word) && word.length > 0)
    .join(' ');
  
  return query.trim() || userMessage; // Fallback to original message if query becomes empty
};


const generatePlausibleSnippet = (query: string, title: string): string => {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();

    if (lowerQuery.includes('super bowl')) {
        return `The Kansas City Chiefs secured a dramatic overtime victory against the San Francisco 49ers in Super Bowl LVIII. The final score was 25-22... (Simulated snippet)`;
    }
    if (lowerQuery.includes('trending movies')) {
        return `This month's box office is led by the sci-fi epic 'Dune: Part Two'. In streaming, the romantic comedy 'Anyone But You' is a surprise hit... (Simulated snippet)`;
    }
    if (lowerQuery.includes('weather') && lowerQuery.includes('tokyo')) {
        return `Tokyo is expecting partly cloudy skies with a high of 15°C (59°F). Winds are light from the north. There is a low chance of precipitation... (Simulated snippet)`;
    }
    if (lowerQuery.includes('space exploration')) {
        if (lowerTitle.includes('artemis')) {
             return `NASA's Artemis program continues to make progress towards returning humans to the Moon, with recent successful tests of the SLS rocket's engines... (Simulated snippet)`;
        }
        return `Recent developments include new images from the James Webb Space Telescope revealing details of distant galaxies and SpaceX's ongoing Starship tests... (Simulated snippet)`;
    }

    // Generic fallback for any other query
    return `This is a simulated text snippet from "${title}" containing information relevant to your query. The model uses such text to formulate its final answer.`;
}


// Main function to route to the correct scenario handler
export const getGeminiResponse = async (
  scenario: Scenario,
  conversation: Message[],
  userMessage: string
): Promise<{ text: string; context: ContextDetail }> => {
  switch (scenario) {
    case Scenario.NORMAL:
      return getNormalChatResponse(conversation, userMessage);
    case Scenario.DATA:
      return getDataAnalysisResponse(conversation, userMessage);
    case Scenario.SEARCH:
      return getSearchChatResponse(conversation, userMessage);
    case Scenario.DOCUMENT:
      return getDocumentChatResponse(conversation, userMessage);
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
};

// Scenario 1: Normal Chat
const getNormalChatResponse = async (conversation: Message[], userMessage: string): Promise<{ text: string, context: ContextDetail }> => {
  const systemInstruction = SCENARIO_CONFIGS[Scenario.NORMAL].systemPrompt;
  const history = buildHistory(conversation);
  
  const response = await ai.models.generateContent({
    model,
    contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
    config: { systemInstruction },
  });

  const responseText = response.text;

  const context: ContextDetail = {
    systemPrompt: systemInstruction,
    systemPromptTokenCount: estimateTokenCount(systemInstruction),
    history: conversation,
    historyTokenCount: estimateTokenCount(JSON.stringify(history)),
    userMessage: userMessage,
    userMessageTokenCount: estimateTokenCount(userMessage),
    responseTokenCount: estimateTokenCount(responseText),
    responseText,
  };

  return { text: responseText, context };
};


// Scenario 2: Data Analysis Chat (with real Function Calling)
const getDataAnalysisResponse = async (conversation: Message[], userMessage: string): Promise<{ text: string, context: ContextDetail }> => {
  const systemInstruction = SCENARIO_CONFIGS[Scenario.DATA].systemPrompt;
  const history = buildHistory(conversation);

  const codeInterpreterTool = {
    functionDeclarations: [{
      name: "code_interpreter",
      description: "Executes simple, single-line Python code to answer a question that requires a calculation. The code must be a simple expression that returns a value.",
      parameters: { type: Type.OBJECT, properties: { code: { type: Type.STRING, description: "The single-line Python expression to execute. e.g., '150 / 3' or '3.14 * (5**2)'"}}, required: ["code"]}
    }]
  };

  const initialContents = [...history, { role: 'user', parts: [{ text: userMessage }] }];

  const initialResponse = await ai.models.generateContent({
    model,
    contents: initialContents,
    config: { systemInstruction, tools: [codeInterpreterTool] },
  });

  const initialResponseData = initialResponse.candidates?.[0]?.content;
  const functionCall = initialResponseData?.parts?.[0]?.functionCall;

  if (!functionCall || functionCall.name !== 'code_interpreter') {
    const responseText = initialResponse.text;
    const context: ContextDetail = {
      systemPrompt: systemInstruction,
      systemPromptTokenCount: estimateTokenCount(systemInstruction),
      history: conversation,
      historyTokenCount: estimateTokenCount(JSON.stringify(history)),
      userMessage: userMessage,
      userMessageTokenCount: estimateTokenCount(userMessage),
      toolDefinitions: codeInterpreterTool,
      toolDefinitionsTokenCount: estimateTokenCount(JSON.stringify(codeInterpreterTool)),
      responseText,
      responseTokenCount: estimateTokenCount(responseText),
    };
    return { text: responseText, context };
  }
  
  const modelFunctionCallTurn: Content = { 
    role: 'model', 
    parts: [{ functionCall: { name: functionCall.name, args: functionCall.args } }] 
  };

  const codeToExecute = functionCall.args?.code;
  let executionResult: any;
  let executionError: Error | null = null;

  try {
    executionResult = new Function(`return ${codeToExecute}`)();
  } catch (e: any) {
    executionError = e;
  }
  
  const functionResponsePayload = executionError ? { error: executionError.message } : { result: executionResult };
  const functionResponsePart = {
    functionResponse: { name: 'code_interpreter', response: functionResponsePayload }
  };

  // If there was an error, report it directly instead of asking the model to explain it.
  if (executionError) {
    const responseText = `An error occurred while executing the code:\n\`\`\`\n${executionError.message}\n\`\`\`\nPlease check the context for more details.`;
    const context: ContextDetail = {
      systemPrompt: systemInstruction,
      systemPromptTokenCount: estimateTokenCount(systemInstruction),
      history: conversation,
      historyTokenCount: estimateTokenCount(JSON.stringify(history)),
      userMessage: userMessage,
      userMessageTokenCount: estimateTokenCount(userMessage),
      toolDefinitions: codeInterpreterTool,
      toolDefinitionsTokenCount: estimateTokenCount(JSON.stringify(codeInterpreterTool)),
      toolCall: functionCall,
      toolCallTokenCount: estimateTokenCount(JSON.stringify(functionCall)),
      toolResult: functionResponsePart,
      toolResultTokenCount: estimateTokenCount(JSON.stringify(functionResponsePart)),
      responseText,
      responseTokenCount: estimateTokenCount(responseText),
    };
    return { text: responseText, context };
  }


  const finalResponse = await ai.models.generateContent({
    model,
    contents: [
      ...initialContents,
      modelFunctionCallTurn,
      { role: 'function', parts: [functionResponsePart] }
    ],
    config: { systemInstruction, tools: [codeInterpreterTool] },
  });

  const responseText = finalResponse.text;
  const context: ContextDetail = {
    systemPrompt: systemInstruction,
    systemPromptTokenCount: estimateTokenCount(systemInstruction),
    history: conversation,
    historyTokenCount: estimateTokenCount(JSON.stringify(history)),
    userMessage: userMessage,
    userMessageTokenCount: estimateTokenCount(userMessage),
    toolDefinitions: codeInterpreterTool,
    toolDefinitionsTokenCount: estimateTokenCount(JSON.stringify(codeInterpreterTool)),
    toolCall: functionCall,
    toolCallTokenCount: estimateTokenCount(JSON.stringify(functionCall)),
    toolResult: functionResponsePart,
    toolResultTokenCount: estimateTokenCount(JSON.stringify(functionResponsePart)),
responseText,
    responseTokenCount: estimateTokenCount(responseText),
  };

  return { text: responseText, context };
};


// Scenario 3: Search Chat
const getSearchChatResponse = async (conversation: Message[], userMessage: string): Promise<{ text: string, context: ContextDetail }> => {
  const systemInstruction = SCENARIO_CONFIGS[Scenario.SEARCH].systemPrompt;
  const history = buildHistory(conversation);
  const searchTool = { googleSearch: {} };

  const response = await ai.models.generateContent({
    model,
    contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
    config: { systemInstruction, tools: [searchTool] },
  });

  const responseText = response.text;
  const groundingChunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] || [])
    .map(chunk => ({
      ...chunk,
      snippet: generatePlausibleSnippet(userMessage, chunk.web.title)
    }));

  const generatedQuery = simulateSearchQueryGeneration(userMessage);
  const toolCall = { 
    name: 'google_search', 
    args: { query: generatedQuery } 
  };

  const context: ContextDetail = {
    systemPrompt: systemInstruction,
    systemPromptTokenCount: estimateTokenCount(systemInstruction),
    history: conversation,
    historyTokenCount: estimateTokenCount(JSON.stringify(history)),
    userMessage: userMessage,
    userMessageTokenCount: estimateTokenCount(userMessage),
    toolDefinitions: { tools: [searchTool] },
    toolDefinitionsTokenCount: estimateTokenCount(JSON.stringify(searchTool)),
    toolCall: toolCall,
    toolCallTokenCount: estimateTokenCount(JSON.stringify(toolCall)),
    searchGrounding: groundingChunks,
    toolResultTokenCount: estimateTokenCount(JSON.stringify(groundingChunks)),
    responseTokenCount: estimateTokenCount(responseText),
    responseText,
  };

  return { text: responseText, context };
};


// Scenario 4: Document Library Chat (RAG)
const getDocumentChatResponse = async (conversation: Message[], userMessage: string): Promise<{ text: string, context: ContextDetail }> => {
  const systemInstruction = SCENARIO_CONFIGS[Scenario.DOCUMENT].systemPrompt;
  
  // 1. Chunk all documents into sentences
  const allChunks = MOCK_DOCUMENTS.flatMap((doc, index) => 
    doc.content.match(/[^.!?]+[.!?]+/g)?.map(sentence => ({
        text: sentence.trim(),
        sourceIndex: index,
        sourceTitle: doc.title,
    })) || [{ text: doc.content, sourceIndex: index, sourceTitle: doc.title }]
  );

  // 2. Simulate a Hybrid Search (Keyword + "Semantic")
  const stopWords = new Set(['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'tell', 'me', 'about']);
  const queryWords = new Set(userMessage.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(word => !stopWords.has(word) && word.length > 2));
  
  // Semantic simulation dictionary
  const semanticSimulations: { [key: string]: RegExp } = {
    'budget': /\$\d+(\.\d+)?\s*million/i,
    'cost': /\$\d+(\.\d+)?\s*million/i,
    'money': /\$\d+(\.\d+)?\s*million/i,
    'engineer': /dr\. evelyn reed/i,
    'manager': /david chen/i,
    'leader': /dr\. evelyn reed|david chen/i,
    'when': /august 15th|october 3rd|september 1st|q2 2024/i,
    'where': /lisbon, portugal/i,
    'offsite': /lisbon, portugal/i,
  };

  const scoredChunks = allChunks.map(chunk => {
    const chunkTextLower = chunk.text.toLowerCase();
    const chunkWords = new Set(chunkTextLower.replace(/[^\w\s]/g, '').split(/\s+/));
    
    const keywordScore = [...queryWords].reduce((acc, word) => acc + (chunkWords.has(word) ? 1 : 0), 0);

    let semanticScore = 0;
    for (const word of queryWords) {
        if(semanticSimulations[word] && semanticSimulations[word].test(chunkTextLower)) {
            semanticScore++;
        }
    }
    
    return { ...chunk, score: { keyword: keywordScore, semantic: semanticScore, total: keywordScore + semanticScore }};
  });

  // 3. Retrieve the top 5 chunks with a score > 0
  const retrievedChunks: RetrievedChunk[] = scoredChunks
    .sort((a, b) => b.score.total - a.score.total)
    .filter(d => d.score.total > 0)
    .slice(0, 5);

  const contextText = retrievedChunks.length > 0
    ? retrievedChunks.map((c, i) => `Snippet ${i+1} from "${c.sourceTitle}":\n${c.text}`).join('\n---\n')
    : "No relevant document chunks found.";

  // 4. Construct the prompt for the model
  const ragPrompt = `
Based *only* on the document excerpts provided below, answer the following question.
Question: "${userMessage}"

Excerpts:
---
${contextText}
---
`;

  const history = buildHistory(conversation);

  const response = await ai.models.generateContent({
    model,
    contents: [...history, { role: 'user', parts: [{ text: ragPrompt }] }],
    config: { systemInstruction },
  });

  const responseText = response.text;

  const generatedQuery = simulateSearchQueryGeneration(userMessage);
  const toolCall = {
    name: "document_retrieval_tool",
    args: { query: generatedQuery }
  };

  // 5. Construct the context object for the UI
  const context: ContextDetail = {
    systemPrompt: systemInstruction,
    systemPromptTokenCount: estimateTokenCount(systemInstruction),
    history: conversation,
    historyTokenCount: estimateTokenCount(JSON.stringify(history)),
    userMessage: userMessage,
    userMessageTokenCount: estimateTokenCount(userMessage),
    toolCall: toolCall,
    toolCallTokenCount: estimateTokenCount(JSON.stringify(toolCall)),
    retrievedChunks: retrievedChunks, // This is the crucial part for the UI
    toolResultTokenCount: estimateTokenCount(JSON.stringify(retrievedChunks)), // Represents the "tool" part of the context
    responseTokenCount: estimateTokenCount(responseText),
    responseText,
  };

  return { text: responseText, context };
};