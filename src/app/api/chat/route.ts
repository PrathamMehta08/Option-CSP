import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: groq('llama-3.1-8b-instant'),
      system: `You are a helpful AI assistant for an options trading platform (Cash Secured Puts).
You help the user filter and sort the option chain data by invoking tools.
DO NOT make up data.
Use the setSort tool to sort the table.
Use addCustomFilter for complex logic (e.g. opt.iv > 50). Do not use addCustomFilter to sort.`,
      messages,
      tools: {
        setCapital: tool({
          description: 'Set the total capital available for the user to trade with.',
          parameters: z.object({
            capital: z.number().describe('The capital amount in dollars'),
          }),
        }),
        setSort: tool({
          description: 'Sort the option data table by a specific column.',
          parameters: z.object({
            key: z.string().describe('The exact column name to sort by (e.g. "iv", "strike", "expiration", "annualizedReturn", "daysToExpiration", "lastPrice", "delta", "openInterest", "volume")'),
            direction: z.string().describe('Sort direction: "asc" or "desc"'),
          }),
        }),
        setTicker: tool({
          description: 'Set the stock ticker symbol to analyze (e.g. AAPL, TSLA)',
          parameters: z.object({
            ticker: z.string().describe('The stock ticker symbol'),
          }),
        }),
        setMonthsRange: tool({
          description: 'Set the minimum and maximum months to expiration (MTE).',
          parameters: z.object({
            minMonths: z.number().describe('Minimum months'),
            maxMonths: z.number().describe('Maximum months'),
          }),
        }),
        setMinDelta: tool({
          description: 'Set the minimum delta for the puts (e.g. -0.2 for a 20 delta put)',
          parameters: z.object({
            minDelta: z.number().describe('The minimum delta value (between -1 and 0)'),
          }),
        }),
        setStrikeRange: tool({
          description: 'Set the minimum and maximum strike price',
          parameters: z.object({
            minStrike: z.number().describe('Minimum strike price'),
            maxStrike: z.number().describe('Maximum strike price'),
          }),
        }),
        addCustomFilter: tool({
          description: 'Apply a custom javascript filter expression to the option data. Use this for complex filters (e.g. IV > 50). The expression must be a valid JS boolean expression using the "opt" variable.',
          parameters: z.object({
            id: z.string().describe('A unique identifier'),
            name: z.string().describe('A short, human-readable name for the tag'),
            code: z.string().describe('The JS expression using "opt" variable. Properties: strike, lastPrice, delta, iv, moneyness, openInterest, volume, maxContracts, totalCapitalRequired, totalPremiumReceived, annualizedReturn.'),
          }),
        }),
      },
      onError: (error) => {
        console.error('[chat/route] streamText error:', JSON.stringify(error));
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error('[chat/route] caught error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
