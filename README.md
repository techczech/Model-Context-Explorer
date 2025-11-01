# Model Context Explorer

This application was created by Dominik Lukeš using Google AI Studio.

## About The Project

The **Model Context Explorer** is an interactive web application designed to demonstrate how Large Language Models (LLMs) use context to generate responses. It provides a hands-on experience for users to understand the different components that make up the "prompt" or "context" sent to the model for various tasks.

Unlike a person, an LLM doesn't "remember" past interactions. For every single turn in a conversation, it must be provided with all the necessary information—the system instructions, the conversation history, your latest message, and any relevant data from tools—to generate a coherent and relevant response. This application makes that entire context visible.

## Features

After each model response, you can click the **"Show Context"** button to see a detailed breakdown of everything the model was given, including:

*   **System Prompt:** The initial instructions that guide the model's behavior and personality.
*   **Conversation History:** The previous turns of the chat.
*   **User Message:** Your most recent input.
*   **Tool Definitions:** Descriptions of available tools (like a code interpreter or search).
*   **Tool Call & Result:** How the model decides to use a tool and the data that gets returned to it.

### Scenarios

Explore four different scenarios to see how the context changes based on the task:

1.  **Normal Chat:** A standard, free-flowing conversation where the primary context is the chat history.
2.  **Data Analysis Chat:** Ask questions that require calculations. See how the model uses a "tool" (a code interpreter) to find the answer and how the tool's output becomes part of the context for the final response.
3.  **Search Chat:** Ask about recent events. The application simulates the model using Google Search to ground its response in up-to-date information.
4.  **Document Library Chat:** Ask questions about a provided set of documents. This demonstrates Retrieval-Augmented Generation (RAG), where the context is "augmented" with relevant snippets retrieved from a knowledge base.

## How to Use and What You Can Learn

This application is designed for exploration and learning. Here’s how you can get the most out of it:

1.  **Choose a Scenario:** Start on the home screen and select one of the four scenarios. Each one is designed to highlight a different aspect of how LLMs work. For example, start with "Normal Chat" for a baseline, then try "Data Analysis Chat" to see how tools are used.

2.  **Start a Conversation:** Once you're in a scenario, you can type a message in the input box at the bottom. If you're unsure what to ask, each scenario provides helpful suggestions to get you started.

3.  **Explore the Context:** After the model replies, you will see a **"Show Context"** button beneath its message. This is the core feature of the application. Clicking this button opens a detailed, interactive view that reveals the *exact* information the model received to generate its last response.

4.  **Analyze the Context View:** Inside the context view, you can expand and collapse different sections:
    *   Look at the **System Prompt** to see the hidden instructions the model is following.
    *   Examine the **Conversation History** to see how past turns are fed back to the model.
    *   In the "Data Analysis" or "Search" scenarios, pay close attention to the **Tool Call** (what the model decided to do) and the **Tool Result** (the data it got back). This shows the two-step process of using external tools.
    *   In the "Document Library" scenario, check the **Retrieved Text Snippets** to see which pieces of information were selected from the documents to help the model answer your question.

By interacting with these elements, you can gain a much deeper intuition for how LLMs operate. You'll see firsthand that there's no "memory" or "magic"—just a well-structured set of text inputs (the context) that the model uses to predict the most probable next set of text (the response). Compare the context between a simple chat message and a complex RAG query to truly appreciate the difference.

## Deployment to Google Cloud Platform (GCP)

This is a static web application and can be easily hosted on Google Cloud Storage.

1.  **Create a Cloud Storage Bucket:**
    *   Go to the [Cloud Storage browser](https://console.cloud.google.com/storage/browser) in the Google Cloud Console.
    *   Click "Create bucket".
    *   Give your bucket a globally unique name (e.g., `your-project-name-context-explorer`).
    *   Choose a location and a storage class (Standard is fine).
    *   For "Access control", select "Uniform".
    *   Uncheck "Enforce public access prevention on this bucket".
    *   Click "Create".

2.  **Upload Files:**
    *   Navigate to your newly created bucket.
    *   Click "Upload files" and "Upload folder" to upload all the files from this repository into the bucket.

3.  **Make Files Publicly Accessible:**
    *   In your bucket, select all uploaded files and folders.
    *   Click "Permissions".
    *   Click "Grant Access".
    *   In the "New principals" field, enter `allUsers`.
    *   In the "Select a role" dropdown, choose "Storage Object Viewer".
    *   Click "Save".

4.  **Configure for Website Hosting:**
    *   In your bucket details, click the "Configurations" tab.
    *   Find the "Website configuration" section and click "Edit".
    *   Set the "Index (main) page" to `index.html`.
    *   Click "Save".

Your application is now live! You can access it via `https://storage.googleapis.com/YOUR_BUCKET_NAME/index.html`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

*   Created by **Dominik Lukeš**.
*   Built with **Google AI Studio**.
*   Powered by the **Gemini API**.
