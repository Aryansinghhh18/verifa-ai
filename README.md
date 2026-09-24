# VeriFA AI

### AI-Powered LLM & Chatbot Evaluation Platform

VeriFA AI is an intelligent evaluation platform designed to help developers, researchers, and organizations test and analyze the reliability, safety, and quality of their AI chatbots and Large Language Model (LLM) applications.

Instead of building another chatbot, VeriFA AI focuses on **evaluating existing chatbots**. Users can connect their chatbot through an API, submit test prompts, and analyze the generated responses using automated evaluation techniques.

The platform integrates the **Vectara Hallucination Evaluation Model (HHEM)** from Hugging Face to evaluate the factual consistency of chatbot responses against provided reference or evidence.

---

## 🚀 Key Features

### 🔐 User Authentication
- User registration and login
- Secure password handling
- Protected dashboard
- User-specific evaluation data

### 🔌 Chatbot API Integration
- Connect external chatbot/LLM APIs
- Store and manage chatbot connections securely
- Test chatbot API connectivity
- Execute evaluation requests through the backend

### 🤖 LLM Evaluation Engine
VeriFA AI provides a modular evaluation architecture for analyzing chatbot responses.

Current evaluation capability includes:

- Hallucination / factual consistency evaluation
- Response analysis using Vectara HHEM
- API response latency measurement
- Individual response evaluation

The architecture is designed to support additional evaluation metrics such as:

- Toxicity
- Safety
- Jailbreak resistance
- Prompt injection
- Relevance
- Bias
- Other LLM evaluation metrics

### 🧠 Vectara HHEM Integration

VeriFA AI integrates:

`vectara/hallucination_evaluation_model`

The model evaluates the relationship between a chatbot-generated response and supporting evidence/reference information.

The model is integrated into the backend evaluation engine rather than being executed directly from the frontend.

### 📊 Evaluation Dashboard

Users can view:

- Evaluation results
- HHEM scores
- Chatbot responses
- Evaluation history
- API latency
- Analytics
- Evaluation trends

### 📁 Batch Evaluation

Users can upload CSV files containing multiple test cases and evaluate chatbot responses in batches.

The batch evaluation system provides:

- CSV validation
- Multiple test case processing
- Evaluation progress
- Individual results
- Summary statistics
- Exportable results

### 📈 Analytics & Reports

VeriFA AI provides analytical views for understanding chatbot evaluation results over time.

Users can analyze:

- Total evaluations
- Average consistency scores
- Evaluation trends
- Response latency
- Chatbot performance
- Evaluation history

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │      User           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   VeriFA AI Web UI  │
                    │    React + Vite     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    FastAPI Backend  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        Authentication   Chatbot Manager   Evaluation Engine
                                                │
                                                ▼
                                     ┌──────────────────────┐
                                     │   Vectara HHEM       │
                                     │ Hallucination Model   │
                                     └──────────┬───────────┘
                                                │
                                                ▼
                                      Evaluation Results
                                                │
                              ┌─────────────────┴──────────────┐
                              ▼                                ▼
                         History                          Analytics
