import { BaseMessage } from "@langchain/core/messages";
import { Annotation, END } from "@langchain/langgraph";
import "dotenv/config"; // Load environment variables

// This defines the object that is passed between each node
// in the graph. We will create different nodes for each agent and tool
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // The agent node that last performed work
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? END,
    default: () => END,
  }),
});

//Create tools

import { DynamicStructuredTool } from "@langchain/core/tools";
import * as d3 from "d3";
// ----------ATTENTION----------
// If attempting to run this notebook locally, you must follow these instructions
// to install the necessary system dependencies for the `canvas` package.
// https://www.npmjs.com/package/canvas#compiling
// -----------------------------
import { createCanvas } from "canvas";
import * as fs from "fs";
import { z } from "zod";

const chartTool = new DynamicStructuredTool({
  name: "generate_bar_chart",
  description:
    "Generates a bar chart from an array of data points. Provide the data as label-value pairs where labels are descriptive names and values are numbers.",
  schema: z.object({
    data: z
      .object({
        label: z.string().describe("The descriptive label for this data point"),
        value: z.number().describe("The numerical value for this data point"),
      })
      .array()
      .describe("Array of data points to visualize"),
    title: z.string().optional().describe("Optional title for the chart"),
  }),
  func: async ({ data, title }) => {
    const width = 500;
    const height = 500;
    const margin = { top: 40, right: 30, bottom: 60, left: 80 };

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Clear canvas with white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) ?? 0])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const colorPalette = [
      "#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
      "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabebe",
    ];

    // Draw bars
    data.forEach((d, idx) => {
      ctx.fillStyle = colorPalette[idx % colorPalette.length];
      ctx.fillRect(
        x(d.label) ?? 0,
        y(d.value),
        x.bandwidth(),
        height - margin.bottom - y(d.value),
      );
    });

    // Draw axes
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();

    // X-axis labels
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "12px Arial";
    x.domain().forEach((d) => {
      const xCoord = (x(d) ?? 0) + x.bandwidth() / 2;
      // Wrap long labels
      const maxWidth = x.bandwidth();
      const words = d.split(' ');
      let line = '';
      let lineHeight = 15;
      let y_pos = height - margin.bottom + 6;
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, xCoord, y_pos);
          line = words[n] + ' ';
          y_pos += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, xCoord, y_pos);
    });

    // Y-axis labels and ticks
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const ticks = y.ticks();
    ticks.forEach((d) => {
      const yCoord = y(d);
      ctx.beginPath();
      ctx.moveTo(margin.left, yCoord);
      ctx.lineTo(margin.left - 6, yCoord);
      ctx.stroke();
      ctx.fillText(d.toString(), margin.left - 8, yCoord);
    });

    // Add title if provided
    if (title) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "16px Arial bold";
      ctx.fillText(title, width / 2, 10);
    }
    
    
    // Save chart to file
    const buffer = canvas.toBuffer('image/png');
    const timestamp = Date.now();
    const filename = `chart_${timestamp}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`Chart saved as ${filename}`);
    
    return `Chart "${title || 'Data Visualization'}" has been generated and saved as ${filename}! The chart shows ${data.length} data points.`;
  },
});

// Mock Tavily tool for testing (remove when you get real API key)
const mockTavilyTool = new DynamicStructuredTool({
  name: "tavily_search_results_json",
  description: "A search engine optimized for comprehensive, accurate, and trusted results.",
  schema: z.object({
    query: z.string().describe("The search query to execute"),
  }),
  func: async ({ query }) => {
    console.log(`Mock search for: ${query}`);
    
    // Generate realistic mock data for any query
    // This simulates a real search engine that would return relevant information
    return JSON.stringify([{
      title: `Search Results for: ${query}`,
      content: `Mock data for "${query}": 1. Alpha Corp - 95, 2. Beta Inc - 87, 3. Gamma Ltd - 76, 4. Delta Group - 68, 5. Epsilon Co - 59, 6. Zeta Systems - 52, 7. Eta Solutions - 45, 8. Theta Industries - 38, 9. Iota Enterprises - 31, 10. Kappa Technologies - 24`,
      url: "https://example.com/search-results"
    }]);
  }
});

// Use real Tavily tool (uncomment when you have API key)
// const tavilyTool = new TavilySearch();

// For now, use the mock tool
const tavilyTool = mockTavilyTool;

//Create Agent Supervisor

import { ChatOpenAI } from "@langchain/openai";

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const members = ["researcher", "chart_generator"] as const;

const systemPrompt =
  "You are a supervisor tasked with managing a conversation between the" +
  " following workers: {members}. Given the following user request," +
  " respond with ONLY the name of the worker to act next, or FINISH when done." +
  " Your response should be exactly one of: {options}." +
  " Decision Logic:" +
  " - If no information has been gathered yet: choose 'researcher'" +
  " - If research data exists and contains quantifiable information: choose 'chart_generator'" +
  " - If both research and visualization are complete: choose 'FINISH'" +
  " - Analyze the conversation history to determine what has been done and what's needed next";
const options = [END, ...members];

// Define the routing function
const routingTool = new DynamicStructuredTool({
  name: "route",
  description: "Select the next role.",
  schema: z.object({
    next: z.enum([END, ...members]),
  }),
  func: async ({ next }) => {
    return next;
  },
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", systemPrompt],
  new MessagesPlaceholder("messages"),
  [
    "human",
    "Given the conversation above, who should act next?" +
    " Or should we FINISH? Select one of: {options}",
  ],
]);

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});

// Async function to handle supervisor setup
async function setupSupervisor() {
  const formattedPrompt = await prompt.partial({
    options: options.join(", "),
    members: members.join(", "),
  });

  // Intelligent supervisor without hardcoded logic
  const supervisorChain = formattedPrompt.pipe(llm).pipe((response) => {
    const content = response.content.toString().trim().toLowerCase();
    
    // Let the LLM decide based on the conversation context
    if (content.includes('researcher')) {
      return { next: 'researcher' };
    } else if (content.includes('chart_generator') || content.includes('chart') || content.includes('generator')) {
      return { next: 'chart_generator' };
    } else if (content.includes('finish')) {
      return { next: END };
    } else {
      // Default fallback - if unclear, let the researcher handle it
      return { next: 'researcher' };
    }
  });

  return supervisorChain;
}

import { HumanMessage } from "@langchain/core/messages";

//Construct Graph

import { SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Recall llm was defined as ChatOpenAI above
// It could be any other language model
const researcherAgent = createReactAgent({
  llm,
  tools: [tavilyTool],
  stateModifier: new SystemMessage("You are a versatile research agent. Use the search tool to find relevant information " +
    "for any query you receive. Focus on gathering factual, quantifiable data when possible. " +
    "Always provide clear, structured information that could be useful for analysis or visualization.")
})

const researcherNode = async (
  state: typeof AgentState.State,
  config?: RunnableConfig,
) => {
  const result = await researcherAgent.invoke(state, config);
  const lastMessage = result.messages[result.messages.length - 1];
  return {
    messages: [
      new HumanMessage({ content: lastMessage.content, name: "Researcher" }),
    ],
  };
};

const chartGenAgent = createReactAgent({
  llm,
  tools: [chartTool],
  stateModifier: new SystemMessage("You are a data visualization specialist. When you receive information containing " +
    "numerical data, extract the relevant numbers and create appropriate bar charts. " +
    "Focus on the most important or requested data points for visualization.")
})

const chartGenNode = async (
  state: typeof AgentState.State,
  config?: RunnableConfig,
) => {
  const result = await chartGenAgent.invoke(state, config);
  const lastMessage = result.messages[result.messages.length - 1];
  return {
    messages: [
      new HumanMessage({ content: lastMessage.content, name: "ChartGenerator" }),
    ],
  };
};

//GRAPH
import { START, StateGraph } from "@langchain/langgraph";

// Main async function to run the entire system
async function main() {
  // Setup supervisor chain
  const supervisorChain = await setupSupervisor();

  // Create supervisor node wrapper
  const supervisorNode = async (
    state: typeof AgentState.State,
    config?: RunnableConfig,
  ) => {
    const result = await supervisorChain.invoke(state, config);
    return {
      next: result?.next || END,
    };
  };

  // 1. Create the graph
  const workflow = new StateGraph(AgentState)
    // 2. Add the nodes; these will do the work
    .addNode("researcher", researcherNode)
    .addNode("chart_generator", chartGenNode)
    .addNode("supervisor", supervisorNode);
  // 3. Define the edges. We will define both regular and conditional ones
  // After a worker completes, report to supervisor
  members.forEach((member) => {
    workflow.addEdge(member, "supervisor");
  });

  workflow.addConditionalEdges(
    "supervisor",
    (x: typeof AgentState.State) => x.next,
  );

  workflow.addEdge(START, "supervisor");

  const graph = workflow.compile();

  // Get query from command line arguments or use default
  const query = process.argv[2] || "What is the top 5 richest states in USA";
  
  console.log(`Processing query: "${query}"`);
  console.log("=".repeat(50));

  //Invoke the team
  const streamResults = await graph.stream(
    {
      messages: [
        new HumanMessage({
          content: query,
        }),
      ],
    },
    { recursionLimit: 100 },
  );

  for await (const output of streamResults) {
    console.log(output);
    console.log("----");
  }
}

// Run the main function
main().catch(console.error);