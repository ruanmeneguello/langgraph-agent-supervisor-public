# LangGraph Agent Supervisor - Usage Guide

## Overview
This is a flexible multi-agent system that can handle any general question through intelligent routing between specialized agents.

## Key Features
- **No Hardcoding**: The system adapts to any query without predefined logic
- **Intelligent Routing**: The supervisor decides which agent to use based on conversation context
- **Flexible Research**: The researcher agent can handle any domain of questions
- **Smart Visualization**: The chart generator automatically extracts and visualizes numerical data

## How to Run

### Default Query
```bash
npx tsx AgentSupervisor.ts
```
This runs with the default query: "What is the top 5 richest states in USA"

### Custom Query
```bash
npx tsx AgentSupervisor.ts "your question here"
```

### Examples
```bash
# Technology companies
npx tsx AgentSupervisor.ts "What are the most valuable tech companies?"

# Sports data
npx tsx AgentSupervisor.ts "Which NBA teams have the highest revenue?"

# Economic data
npx tsx AgentSupervisor.ts "What are the countries with highest GDP?"

# Any domain
npx tsx AgentSupervisor.ts "What are the most popular programming languages?"
```

## System Architecture

### Agents
1. **Researcher**: Searches for information on any topic
2. **Chart Generator**: Creates visualizations from numerical data
3. **Supervisor**: Routes between agents based on conversation state

### Workflow
1. User provides a question
2. Supervisor analyzes the request and conversation history
3. Routes to Researcher if information is needed
4. Routes to Chart Generator if data can be visualized
5. Completes when both research and visualization are done (if applicable)

## Key Improvements
- Removed all hardcoded query patterns
- Made agents domain-agnostic
- Improved supervisor decision-making
- Enhanced chart generation with titles and better formatting
- Added command-line argument support for any query

The system now truly handles any general question without requiring code modifications!
