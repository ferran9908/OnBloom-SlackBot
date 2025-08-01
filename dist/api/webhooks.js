import express from 'express';
export function createWebhookServer() {
    const app = express();
    app.use(express.json());
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // Webhook endpoint for external integrations
    app.post('/webhook', async (req, res) => {
        try {
            console.log('Received webhook:', req.body);
            // Add your webhook processing logic here
            // For example, you might want to send a message to a Slack channel
            res.json({ success: true });
        }
        catch (error) {
            console.error('Webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    return app;
}
