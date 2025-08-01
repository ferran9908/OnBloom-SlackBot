import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { env } from '../env.js';
const openrouter = createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
});
export async function generateResponse(prompt) {
    try {
        const { text } = await generateText({
            model: openrouter('meta-llama/llama-3.1-8b-instruct'),
            prompt,
            temperature: 0.7,
            maxOutputTokens: 500,
        });
        return text;
    }
    catch (error) {
        console.error('Error generating response:', error);
        throw new Error('Failed to generate AI response');
    }
}
